export type SubscriptionCurrency = "INR" | "USD";

const INDIA_TIMEZONES = new Set([
  "Asia/Kolkata",
  "Asia/Calcutta",
]);

export function resolveSubscriptionCurrency(): SubscriptionCurrency {
  const region = getNavigatorRegion();
  if (region === "IN") {
    return "INR";
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (INDIA_TIMEZONES.has(timeZone)) {
    return "INR";
  }

  return "USD";
}

export function formatSubscriptionPrice(currency: SubscriptionCurrency): string {
  return currency === "INR" ? "₹199 / month" : "$4 / month";
}

function getNavigatorRegion(): string | null {
  const language = navigator.language || navigator.languages?.[0];
  if (!language) {
    return null;
  }

  try {
    const locale = new Intl.Locale(language);
    return locale.region?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}
