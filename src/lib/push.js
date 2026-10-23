import { api } from './api.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export async function isPushSupported() {
  return window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window;
}

export async function getPushSubscription() {
  if (!(await isPushSupported())) return null;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function enablePush() {
  if (!import.meta.env.VITE_VAPID_PUBLIC_KEY) {
    throw new Error('Push notifications are unavailable. Please contact the site owner.');
  }
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    }));

  await api.post('/api/push/subscribe', { subscription });
  return subscription;
}

export async function disablePush() {
  const subscription = await getPushSubscription();
  if (!subscription) return;

  try {
    await api.post('/api/push/unsubscribe', { endpoint: subscription.endpoint });
  } finally {
    await subscription.unsubscribe();
  }
}
