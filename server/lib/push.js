import webpush from 'web-push';
import { isPushEndpoint, PUSH_OPTIONS } from '../../supabase/functions/_shared/push.js';

if (!process.env.VAPID_SUBJECT || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  throw new Error('VAPID_SUBJECT, VAPID_PUBLIC_KEY, and VAPID_PRIVATE_KEY are required.');
}

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

export async function sendPush(subscription, payload) {
  if (!isPushEndpoint(subscription.endpoint)) throw new Error('Unsupported push endpoint.');
  return webpush.sendNotification(
    { endpoint: subscription.endpoint, keys: subscription.keys },
    JSON.stringify(payload),
    PUSH_OPTIONS,
  );
}
