import { BackendAnalyticsEntry } from "@/types";

export type AnalyticsRangeKey = "7d" | "30d" | "90d" | "180d";
export type AnalyticsBucketMode = "day" | "week";

export const ANALYTICS_RANGE_CONFIG: Record<AnalyticsRangeKey, { days: number; label: string; bucketDays: number }> = {
  "7d": { days: 7, label: "Last 7 days", bucketDays: 1 },
  "30d": { days: 30, label: "Last 30 days", bucketDays: 1 },
  "90d": { days: 90, label: "Last 90 days", bucketDays: 7 },
  "180d": { days: 180, label: "Last 180 days", bucketDays: 7 },
};

export interface AnalyticsBucket {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  totalMinutes: number;
  sessionMinutes: Record<number, number>;
}

export interface AnalyticsSessionTotal {
  sessionId: number;
  sessionName: string;
  timeSpentMinutes: number;
  goalMinutes: number;
}

export interface AnalyticsViewModel {
  rangeLabel: string;
  startDate: string;
  endDate: string;
  bucketMode: AnalyticsBucketMode;
  buckets: AnalyticsBucket[];
  sessionTotals: AnalyticsSessionTotal[];
  totalMinutesSpent: number;
  totalGoalMinutes: number;
  completionPercent: number;
}

function getDateParts(isoDate: string): [number, number, number] {
  const normalized = normalizeDateString(isoDate);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function toUtcDate(isoDate: string): Date {
  const [year, month, day] = getDateParts(isoDate);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function normalizeDateString(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }

  return fromUtcDate(parsed);
}

export function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const date = toUtcDate(isoDate);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return fromUtcDate(date);
}

export function getDateInTimeZone(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Failed to format date in timezone ${timeZone}`);
  }
  return `${year}-${month}-${day}`;
}

export function getCurrentDateInTimeZone(timeZone: string): string {
  return getDateInTimeZone(new Date(), timeZone);
}

export function formatReadableDate(isoDate: string): string {
  const [year, month, day] = getDateParts(isoDate);
  const monthLabel = new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(Date.UTC(year, month - 1, 1)));
  return `${monthLabel} ${day}`;
}

export function buildAnalyticsViewModel(
  entries: BackendAnalyticsEntry[],
  rangeKey: AnalyticsRangeKey,
  timeZone: string,
  now: Date = new Date(),
): AnalyticsViewModel {
  const config = ANALYTICS_RANGE_CONFIG[rangeKey];
  const { startDate, endDate } = getAnalyticsRangeWindow(rangeKey, timeZone, now);
  const bucketMode: AnalyticsBucketMode = config.bucketDays === 1 ? "day" : "week";
  const bucketCount = Math.ceil(config.days / config.bucketDays);

  const buckets: AnalyticsBucket[] = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = shiftIsoDate(startDate, index * config.bucketDays);
    const bucketEnd = shiftIsoDate(bucketStart, config.bucketDays - 1);
    const clampedEnd = bucketEnd > endDate ? endDate : bucketEnd;
    return {
      key: bucketStart,
      startDate: bucketStart,
      endDate: clampedEnd,
      label: bucketMode === "day"
        ? formatReadableDate(bucketStart)
        : `${formatReadableDate(bucketStart)} - ${formatReadableDate(clampedEnd)}`,
      totalMinutes: 0,
      sessionMinutes: {},
    };
  });

  const filteredEntries = entries.filter((entry) => {
    const entryDate = normalizeDateString(entry.date);
    return entryDate >= startDate && entryDate <= endDate;
  });
  const sessionTotalsMap = new Map<number, AnalyticsSessionTotal>();

  for (const entry of filteredEntries) {
    const entryDate = normalizeDateString(entry.date);
    const dayOffset = Math.floor((toUtcDate(entryDate).getTime() - toUtcDate(startDate).getTime()) / (24 * 60 * 60 * 1000));
    const bucketIndex = Math.floor(dayOffset / config.bucketDays);
    const bucket = buckets[bucketIndex];
    if (!bucket) {
      continue;
    }

    bucket.totalMinutes += entry.timeSpentMinutes;
    bucket.sessionMinutes[entry.id] = (bucket.sessionMinutes[entry.id] ?? 0) + entry.timeSpentMinutes;

    const existing = sessionTotalsMap.get(entry.id);
    if (existing) {
      existing.timeSpentMinutes += entry.timeSpentMinutes;
      existing.goalMinutes += entry.goalMinutes;
    } else {
      sessionTotalsMap.set(entry.id, {
        sessionId: entry.id,
        sessionName: entry.name,
        timeSpentMinutes: entry.timeSpentMinutes,
        goalMinutes: entry.goalMinutes,
      });
    }
  }

  const sessionTotals = Array.from(sessionTotalsMap.values()).sort((a, b) => b.timeSpentMinutes - a.timeSpentMinutes);
  const totalMinutesSpent = sessionTotals.reduce((sum, session) => sum + session.timeSpentMinutes, 0);
  const totalGoalMinutes = sessionTotals.reduce((sum, session) => sum + session.goalMinutes, 0);
  const completionPercent = totalGoalMinutes > 0 ? Math.min((totalMinutesSpent / totalGoalMinutes) * 100, 100) : 0;

  return {
    rangeLabel: config.label,
    startDate,
    endDate,
    bucketMode,
    buckets,
    sessionTotals,
    totalMinutesSpent,
    totalGoalMinutes,
    completionPercent,
  };
}

export function getAnalyticsRangeWindow(
  rangeKey: AnalyticsRangeKey,
  timeZone: string,
  now: Date = new Date(),
): { startDate: string; endDate: string; label: string } {
  const config = ANALYTICS_RANGE_CONFIG[rangeKey];
  const endDate = getDateInTimeZone(now, timeZone);
  const startDate = shiftIsoDate(endDate, -(config.days - 1));
  return {
    startDate,
    endDate,
    label: config.label,
  };
}
