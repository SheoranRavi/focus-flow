import { Session } from "../types";

const SERVICE_WORKER_PATH = "/sw.js";
const APP_URL = "/app";

let serviceWorkerRegistrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

function notificationApiSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

function serviceWorkerSupported(): boolean {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator && window.isSecureContext;
}

function notificationTitle(session: Session): string {
  return `${session.title} complete`;
}

function notificationOptions(session: Session) {
  return {
    body: "Your focus session is done.",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: `session-complete-${session.id}`,
    data: {
      url: APP_URL,
      sessionId: session.id,
    },
  };
}

export function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!serviceWorkerSupported()) {
    return Promise.resolve(null);
  }

  if (!serviceWorkerRegistrationPromise) {
    serviceWorkerRegistrationPromise = navigator.serviceWorker
      .register(SERVICE_WORKER_PATH)
      .then((registration) => registration)
      .catch((error) => {
        console.error("Failed to register notification service worker:", error);
        serviceWorkerRegistrationPromise = null;
        return null;
      });
  }

  return serviceWorkerRegistrationPromise;
}

export async function requestSessionNotificationPermission() {
  if (!notificationApiSupported()) {
    return "unsupported";
  }

  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return Notification.permission;
    }
  }

  return Notification.permission;
}

async function showServiceWorkerNotification(session: Session): Promise<boolean> {
  if (!serviceWorkerSupported()) {
    return false;
  }

  const registration = await registerNotificationServiceWorker();
  if (!registration || !("showNotification" in registration)) {
    return false;
  }

  try {
    await registration.showNotification(notificationTitle(session), notificationOptions(session));
    return true;
  } catch (error) {
    console.error("Failed to show service worker notification:", error);
    return false;
  }
}

function showPageNotification(session: Session): boolean {
  if (!notificationApiSupported()) {
    return false;
  }

  try {
    const notification = new Notification(notificationTitle(session), notificationOptions(session));
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (error) {
    console.error("Failed to show page notification:", error);
    return false;
  }
}

export async function notifySessionComplete(session: Session): Promise<boolean> {
  if (!notificationApiSupported()) {
    console.info("Notifications are not supported by this browser.");
    return false;
  }

  if (Notification.permission !== "granted") {
    console.info(`Notification permission is ${Notification.permission}.`);
    return false;
  }

  const shownByServiceWorker = await showServiceWorkerNotification(session);
  if (shownByServiceWorker) {
    return true;
  }

  return showPageNotification(session);
}
