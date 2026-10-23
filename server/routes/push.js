import { Router } from 'express';
import { supabase, unwrap } from '../lib/db.js';
import { sendPush } from '../lib/push.js';
import { validatePushEndpoint, validatePushSubscription } from '../lib/validation.js';

const router = Router();

router.post('/status', async (req, res, next) => {
  try {
    const endpoint = validatePushEndpoint(req.body?.endpoint);
    const existing = unwrap(
      await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('endpoint', endpoint)
        .maybeSingle(),
    );
    res.json({ enabled: Boolean(existing) });
  } catch (error) {
    next(error);
  }
});

router.post('/subscribe', async (req, res, next) => {
  try {
    const subscription = validatePushSubscription(req.body?.subscription);
    const existing = unwrap(
      await supabase
        .from('push_subscriptions')
        .select('user_id,keys')
        .eq('endpoint', subscription.endpoint)
        .maybeSingle(),
    );
    if (
      existing &&
      existing.user_id !== req.user.id &&
      (existing.keys?.p256dh !== subscription.keys.p256dh ||
        existing.keys?.auth !== subscription.keys.auth)
    ) {
      return res.status(409).json({ message: 'This push endpoint is already registered.' });
    }
    if (existing) {
      unwrap(
        await supabase
          .from('push_subscriptions')
          .update({ keys: subscription.keys, user_id: req.user.id })
          .eq('endpoint', subscription.endpoint)
          .eq('user_id', existing.user_id),
      );
    } else {
      unwrap(
        await supabase.from('push_subscriptions').insert({ user_id: req.user.id, ...subscription }),
      );
    }

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/unsubscribe', async (req, res, next) => {
  try {
    const endpoint = validatePushEndpoint(req.body?.endpoint);
    unwrap(
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', req.user.id)
        .eq('endpoint', endpoint),
    );
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/test', async (req, res, next) => {
  try {
    const endpoint = validatePushEndpoint(req.body?.endpoint);
    const subs = unwrap(
      await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('endpoint', endpoint),
    );

    if (!subs.length) {
      return res
        .status(400)
        .json({ message: 'No push subscription found. Enable notifications first.' });
    }

    const results = await Promise.allSettled(
      subs.map((sub) =>
        sendPush(sub, { title: 'Trigger', body: "This is a test notification. You're all set." }),
      ),
    );

    const deadEndpoints = subs
      .filter((_, i) => {
        const r = results[i];
        return r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode);
      })
      .map((sub) => sub.endpoint);

    if (deadEndpoints.length) {
      unwrap(
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', req.user.id)
          .in('endpoint', deadEndpoints),
      );
    }

    const delivered = results.filter((r) => r.status === 'fulfilled').length;
    if (!delivered) {
      return res.status(deadEndpoints.length ? 410 : 502).json({
        message: deadEndpoints.length
          ? 'Push subscription expired. Disable notifications, then enable them again.'
          : 'The push service is temporarily unavailable. Try again later.',
      });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
