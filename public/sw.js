function notificationUrl(value) {
  try {
    const url = new URL(value || '/', self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}${url.hash}` : '/';
  } catch {
    return '/';
  }
}

self.addEventListener('push', (event) => {
  let data = { title: 'Trigger', body: 'Something happened.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: notificationUrl(data.url) },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = notificationUrl(event.notification.data?.url);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const existing = windows.find((client) => {
        const url = new URL(client.url);
        return url.href === new URL(target, self.location.origin).href;
      });
      if (existing) {
        return existing.focus();
      }
      return clients.openWindow(target);
    }),
  );
});
