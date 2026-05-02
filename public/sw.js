self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "SESSION_COMPLETE") {
    return;
  }

  const payload = message.payload || {};
  const title = payload.title || "Focus session complete";
  const options = {
    body: payload.body || "Your focus session is done.",
    icon: payload.icon || "/icon.svg",
    badge: payload.badge || "/icon.svg",
    tag: payload.tag || "session-complete",
    renotify: true,
    data: {
      url: payload.url || "/app",
      sessionId: payload.sessionId,
    },
  };

  const showNotification = self.registration.showNotification(title, options);
  if (typeof event.waitUntil === "function") {
    event.waitUntil(showNotification);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/app", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
