import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Clock3,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  ANALYTICS_RANGE_CONFIG,
  AnalyticsRangeKey,
  buildAnalyticsViewModel,
  getAnalyticsRangeWindow,
  formatReadableDate,
} from "@/lib/analytics";
import { Session, BackendUser, BackendAnalyticsEntry } from "@/types";

const SESSION_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const formatMinutes = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
};

const AnalyticsPage: React.FC = () => {
  const user = useAuth();
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [range, setRange] = useState<AnalyticsRangeKey>("7d");
  const [analyticsRows, setAnalyticsRows] = useState<BackendAnalyticsEntry[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    setIsLoadingProfile(true);
    setError(null);

    Promise.all([api.getUser(), api.getSessions()])
      .then(([userProfile, userSessions]) => {
        if (cancelled) {
          return;
        }
        if (!userProfile) {
          setError("Unable to load your account details.");
          return;
        }
        setProfile(userProfile);
        setSessions(userSessions ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics page");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profile) {
      return;
    }

    let cancelled = false;
    setIsLoadingAnalytics(true);
    setError(null);

    const { startDate, endDate } = getAnalyticsRangeWindow(range, profile.timezone);

    api.getAnalytics(startDate, endDate, false)
      .then((rows) => {
        if (!cancelled) {
          setAnalyticsRows(rows);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load analytics data");
          setAnalyticsRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingAnalytics(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, profile, range]);

  const handleSaveSettings = useCallback(async (newResetTime: string, newTimezone: string) => {
    setProfile((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        sessionsResetTime: newResetTime,
        timezone: newTimezone,
      };
    });

    try {
      await api.sendUserEvent("auto_reset_time_change", {
        sessionsResetTime: newResetTime,
        timezone: newTimezone,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }, []);

  const activeSessionId = profile?.activeSessionId ?? null;
  const activeSessionTitle = sessions.find((session) => session.id === activeSessionId)?.title ?? "Ready to Focus";
  const streak = profile?.streak ?? 0;
  const resetTime = profile?.sessionsResetTime ?? "00:00";
  const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const viewModel = useMemo(() => buildAnalyticsViewModel(analyticsRows, range, timezone), [analyticsRows, range, timezone]);
  const visibleSessions = viewModel.sessionTotals;
  const maxBucketMinutes = Math.max(1, ...viewModel.buckets.map((bucket) => bucket.totalMinutes));
  const loading = isLoadingProfile || isLoadingAnalytics;
  const hasRows = analyticsRows.length > 0;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-emerald-100">
      <Navbar
        activeSessionTitle={activeSessionTitle}
        activeSessionId={activeSessionId}
        streak={streak}
        resetTime={resetTime}
        timezone={timezone}
        handleSaveSettings={handleSaveSettings}
      />

      <main className="mx-auto max-w-7xl px-6 py-8 md:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/50 p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                <BarChart3 size={16} />
                Analytics
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                Time spent by session, at a glance.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Review how your focus is distributed across sessions over the last week, month, or quarter. The chart groups longer windows by week so trends stay readable.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="outline" className="border-slate-300 bg-white">
                <Link to="/app">
                  <ArrowLeft size={16} />
                  Back to focus
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(Object.keys(ANALYTICS_RANGE_CONFIG) as AnalyticsRangeKey[]).map((key) => {
              const active = key === range;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setRange(key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {ANALYTICS_RANGE_CONFIG[key].label}
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{error}</p>
                <p className="mt-1 text-rose-600">Try again, or change the range to fetch a smaller window.</p>
              </div>
            </div>
          </div>
        )}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Focus time"
            value={loading && !hasRows ? "Loading..." : formatMinutes(viewModel.totalMinutesSpent)}
            helper={`Across ${viewModel.sessionTotals.length} sessions`}
            icon={<Clock3 size={18} />}
          />
          <MetricCard
            label="Goal minutes"
            value={loading && !hasRows ? "Loading..." : formatMinutes(viewModel.totalGoalMinutes)}
            helper={`${Math.round(viewModel.completionPercent)}% of target`}
            icon={<Target size={18} />}
          />
          <MetricCard
            label="Selected range"
            value={ANALYTICS_RANGE_CONFIG[range].label}
            helper={`${viewModel.startDate} to ${viewModel.endDate}`}
            icon={<TrendingUp size={18} />}
          />
          <MetricCard
            label="Daily buckets"
            value={viewModel.bucketMode === "day" ? "Daily" : "Weekly"}
            helper={`Data grouped by ${viewModel.bucketMode}`}
            icon={<RefreshCw size={18} />}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Time chart</h2>
                <p className="text-sm text-slate-500">
                  {viewModel.rangeLabel} · {viewModel.bucketMode === "day" ? "Daily breakdown" : "Weekly breakdown"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {visibleSessions.slice(0, 5).map((session, index) => (
                  <LegendPill
                    key={session.sessionId}
                    label={session.sessionName}
                    color={SESSION_COLORS[index % SESSION_COLORS.length]}
                  />
                ))}
              </div>
            </div>

            {loading && !hasRows ? (
              <div className="mt-6 h-[360px] animate-pulse rounded-[1.5rem] bg-slate-100" />
            ) : viewModel.sessionTotals.length === 0 ? (
              <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                <div className="max-w-sm">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <BarChart3 size={20} />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">No analytics yet</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Reset progress after you have focused on sessions to populate this page.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <div className="grid grid-cols-[auto_1fr] gap-3">
                  <div className="flex h-[360px] flex-col justify-between py-1 text-[11px] font-medium text-slate-400">
                    <span>{formatMinutes(maxBucketMinutes)}</span>
                    <span>{formatMinutes(Math.round(maxBucketMinutes * 0.66))}</span>
                    <span>{formatMinutes(Math.round(maxBucketMinutes * 0.33))}</span>
                    <span>0 min</span>
                  </div>

                  <div className="h-[360px] overflow-x-auto">
                    <div className="flex h-full min-w-max items-end gap-3 pb-2">
                      {viewModel.buckets.map((bucket) => (
                        <div key={bucket.key} className="flex w-16 flex-1 min-w-[64px] flex-col justify-end">
                          <div className="flex h-[300px] items-end rounded-2xl bg-slate-100/70 p-1">
                            <div className="flex h-full w-full flex-col justify-end overflow-hidden rounded-xl bg-white shadow-inner">
                              {visibleSessions.map((session, index) => {
                                const minutes = bucket.sessionMinutes[session.sessionId] ?? 0;
                                if (minutes <= 0) {
                                  return null;
                                }
                                const heightPercent = (minutes / maxBucketMinutes) * 100;
                                return (
                                  <div
                                    key={session.sessionId}
                                    title={`${bucket.label}: ${session.sessionName} - ${minutes} min`}
                                    className="w-full border-t border-white/30"
                                    style={{
                                      height: `${heightPercent}%`,
                                      backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length],
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                          <div className="mt-2 px-1 text-center text-[11px] font-medium text-slate-500">
                            {bucket.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Session breakdown</h2>
                  <p className="text-sm text-slate-500">Totals across the selected range</p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Total</div>
                  <div className="text-lg font-bold text-emerald-600">{formatMinutes(viewModel.totalMinutesSpent)}</div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {viewModel.sessionTotals.map((session, index) => {
                  const completion = session.goalMinutes > 0
                    ? Math.min((session.timeSpentMinutes / session.goalMinutes) * 100, 100)
                    : 0;
                  return (
                    <div key={session.sessionId} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length] }}
                            />
                            <p className="truncate font-semibold text-slate-900">{session.sessionName}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {session.goalMinutes > 0
                              ? `${formatMinutes(session.goalMinutes)} goal`
                              : "No goal set"}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900">{formatMinutes(session.timeSpentMinutes)}</div>
                          <div className="text-xs text-slate-500">{Math.round(completion)}% of goal</div>
                        </div>
                      </div>

                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${completion}%`,
                            backgroundColor: SESSION_COLORS[index % SESSION_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">Range details</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DetailTile label="Window" value={`${formatReadableDate(viewModel.startDate)} - ${formatReadableDate(viewModel.endDate)}`} />
                <DetailTile label="Grouping" value={viewModel.bucketMode === "day" ? "Daily" : "Weekly"} />
                <DetailTile label="Sessions" value={`${viewModel.sessionTotals.length}`} />
                <DetailTile label="Tracked entries" value={`${analyticsRows.length}`} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function LegendPill({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="max-w-[10rem] truncate">{label}</span>
    </div>
  );
}

function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default AnalyticsPage;
