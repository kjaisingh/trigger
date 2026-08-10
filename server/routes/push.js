import { Router } from 'express';
import { supabase, unwrap } from '../lib/db.js';
import { sendPush } from '../lib/push.js';

const router = Router();

router.post('/subscribe', async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ message: 'A valid push subscription is required.' });
    }

    unwrap(
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: req.user.id,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
        { onConflict: 'endpoint' },
      ),
    );

    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

router.post('/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body;
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
    const subs = unwrap(
      await supabase.from('push_subscriptions').select('*').eq('user_id', req.user.id),
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
      await supabase.from('push_subscriptions').delete().in('endpoint', deadEndpoints);
    }

    const delivered = results.filter((r) => r.status === 'fulfilled').length;
    if (!delivered) {
      return res
        .status(400)
        .json({ message: 'Push subscription is no longer valid. Enable notifications again.' });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
