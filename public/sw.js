self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/app", self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const targetClient = clientList.find((client) => client.url === targetUrl);
      if (targetClient && "focus" in targetClient) {
        return targetClient.focus();
      }

      const sameOriginClient = clientList.find((client) => {
        const clientUrl = new URL(client.url);
        return clientUrl.origin === self.location.origin;
      });

      if (sameOriginClient && "navigate" in sameOriginClient) {
        return sameOriginClient.navigate(targetUrl).then((client) => client?.focus());
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
