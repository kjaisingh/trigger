self.addEventListener('push', (event) => {
  let data = { title: 'Trigger', body: 'Something happened.', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  const url = new URL(data.url, self.location.origin);
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: url.origin === self.location.origin ? url.pathname : '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const existing = windows.find((client) => {
        const url = new URL(client.url);
        return url.origin === self.location.origin && url.pathname === target;
      });
      if (existing) {
        return existing.focus();
      }
      return clients.openWindow(target);
    }),
  );
});
