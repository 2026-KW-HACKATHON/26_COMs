// 폰 알림(웹 푸시) 받기. vite.config.ts의 workbox.importScripts로 앱 서비스 워커에 들어간다.
// 보내는 쪽은 api/push.ts. 내용: { title, body, url, tag, badge }

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // 형식이 다르면 기본 문구로 띄운다
  }
  const url = typeof data.url === 'string' && data.url.startsWith('/') ? data.url : '/notifications';
  const tasks = [
    self.registration.showNotification(data.title || '왔다감', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      tag: data.tag,
      data: { url },
      vibrate: [80, 40, 80, 40, 160],
    }),
  ];
  // 홈 화면 앱 아이콘에 안 읽은 수 (지원하는 기기만)
  if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
    tasks.push(self.navigator.setAppBadge(data.badge).catch(() => undefined));
  }
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notifications';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const app = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (app) {
        // 열려 있는 앱을 앞으로 가져와 그 안에서 이동한다 (새로고침 없이, src/components/NudgeProvider.tsx)
        await app.focus();
        app.postMessage({ type: 'open', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
