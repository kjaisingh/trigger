import { Router } from 'express';
import { supabase, unwrap } from '../lib/db.js';
import { parsePrompt } from '../lib/llm.js';
import { resolveSubject } from '../lib/domains/index.js';
import { PublicError, validatePrompt, validateTrigger } from '../lib/validation.js';

const router = Router();
const parseRequests = new Map();

function limitParse(req, res, next) {
  const now = Date.now();
  for (const [userId, entry] of parseRequests) {
    if (entry.resetAt <= now) parseRequests.delete(userId);
  }
  const entry = parseRequests.get(req.user.id);
  if (entry?.count >= 10) {
    res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
    return res.status(429).json({ message: 'Too many parse requests. Try again in a minute.' });
  }
  parseRequests.set(req.user.id, {
    count: (entry?.count ?? 0) + 1,
    resetAt: entry?.resetAt ?? now + 60_000,
  });
  next();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.param('id', (req, res, next, id) => {
  if (!UUID_RE.test(id)) {
    return res.status(400).json({ message: 'Invalid trigger ID.' });
  }
  next();
});

router.post('/parse', limitParse, async (req, res, next) => {
  try {
    const rawPrompt = validatePrompt(req.body);
    const parsed = await parsePrompt(rawPrompt);
    try {
      const validated = validateTrigger({
        ...parsed,
        raw_prompt: rawPrompt,
        channels: ['push'],
        recurring: false,
      });
      return res.json({
        domain: validated.domain,
        subject: validated.subject || {},
        condition: validated.condition || {},
        unsupported_reason: validated.unsupported_reason || null,
      });
    } catch (error) {
      if (!(error instanceof PublicError)) throw error;
      return res.json({
        domain: 'unsupported',
        subject: {},
        condition: {},
        unsupported_reason:
          "Couldn't determine a complete condition to watch. Try rephrasing your request.",
      });
    }
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
      await supabase
        .from('triggers')
        .select('*')
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .single(),
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
    const { raw_prompt, domain, subject, condition, channels, recurring, unsupported_reason } =
      validateTrigger(req.body);

    if (domain === 'unsupported') {
      const created = unwrap(
        await supabase
          .from('triggers')
          .insert({
            user_id: req.user.id,
            raw_prompt,
            domain: 'unsupported',
            status: 'unsupported',
            unsupported_reason,
          })
          .select()
          .single(),
      );
      return res.status(201).json(created);
    }

    let resolvedSubject;
    try {
      resolvedSubject = await resolveSubject(domain, subject);
    } catch (error) {
      if (error instanceof PublicError) throw error;
      if (error.message.startsWith("Couldn't find")) throw new PublicError(error.message);
      throw error;
    }

    const created = unwrap(
      await supabase
        .from('triggers')
        .insert({
          user_id: req.user.id,
          raw_prompt,
          domain,
          subject: resolvedSubject,
          condition,
          channels,
          recurring,
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
    const status = req.body?.status;
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
    const deleted = unwrap(
      await supabase
        .from('triggers')
        .delete()
        .eq('id', req.params.id)
        .eq('user_id', req.user.id)
        .select('id'),
    );
    if (!deleted.length) return res.status(404).json({ message: 'Trigger not found.' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
