import { Router } from 'express';
import { supabase, unwrap } from '../lib/db.js';
import { parsePrompt } from '../lib/llm.js';
import { resolveSubject } from '../lib/domains/index.js';
import { isValidCondition, METRICS_BY_DOMAIN } from '../lib/domains/allowlist.js';

const router = Router();

const SUPPORTED_DOMAINS = Object.keys(METRICS_BY_DOMAIN);

router.post('/parse', async (req, res, next) => {
  try {
    const { raw_prompt } = req.body;
    if (!raw_prompt || !raw_prompt.trim()) {
      return res.status(400).json({ message: 'raw_prompt is required.' });
    }

    const parsed = await parsePrompt(raw_prompt.trim());

    if (parsed.domain !== 'unsupported' && !SUPPORTED_DOMAINS.includes(parsed.domain)) {
      return res.json({
        domain: 'unsupported',
        subject: {},
        condition: {},
        unsupported_reason: "This request isn't supported yet.",
      });
    }

    if (parsed.domain !== 'unsupported' && !isValidCondition(parsed.domain, parsed.condition)) {
      return res.json({
        domain: 'unsupported',
        subject: {},
        condition: {},
        unsupported_reason: "Couldn't determine a valid condition to watch for this request.",
      });
    }

    res.json(parsed);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const data = unwrap(
      await supabase
        .from('triggers')
        .select('*')
        .eq('user_id', req.user.id)
        .order('created_at', { ascending: false }),
    );
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const trigger = unwrap(
      await supabase.from('triggers').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single(),
    );

    const events = unwrap(
      await supabase
        .from('trigger_events')
        .select('*')
        .eq('trigger_id', req.params.id)
        .order('fired_at', { ascending: false }),
    );

    res.json({ ...trigger, events });
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ message: 'Trigger not found.' });
    }
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { raw_prompt, domain, subject, condition, channels, recurring } = req.body;

    if (!raw_prompt || !domain) {
      return res.status(400).json({ message: 'raw_prompt and domain are required.' });
    }

    if (domain === 'unsupported') {
      const created = unwrap(
        await supabase
          .from('triggers')
          .insert({
            user_id: req.user.id,
            raw_prompt,
            domain: 'unsupported',
            status: 'unsupported',
            unsupported_reason: req.body.unsupported_reason || "This request isn't supported yet.",
          })
          .select()
          .single(),
      );
      return res.status(201).json(created);
    }

    if (!isValidCondition(domain, condition)) {
      return res.status(400).json({ message: 'Invalid condition for this domain.' });
    }

    const resolvedSubject = await resolveSubject(domain, subject);

    const created = unwrap(
      await supabase
        .from('triggers')
        .insert({
          user_id: req.user.id,
          raw_prompt,
          domain,
          subject: resolvedSubject,
          condition,
          channels: channels?.length ? channels : ['push'],
          recurring: Boolean(recurring),
          status: 'active',
        })
        .select()
        .single(),
    );

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({ message: 'status must be "active" or "paused".' });
    }

    const updated = unwrap(
      await supabase
        .from('triggers')
        .update({ status })
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select()
        .single(),
    );

    res.json(updated);
  } catch (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ message: 'Trigger not found.' });
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    unwrap(await supabase.from('triggers').delete().eq('id', req.params.id).eq('user_id', req.user.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
