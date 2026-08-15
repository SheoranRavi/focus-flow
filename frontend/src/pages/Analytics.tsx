import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { openRazorpayCheckout, RazorpaySuccessPayload } from "@/lib/razorpay";
import { formatSubscriptionPrice, resolveSubscriptionCurrency } from "@/lib/subscription";
import {
  ANALYTICS_RANGE_CONFIG,
  AnalyticsRangeKey,
  buildAnalyticsViewModel,
  getAnalyticsRangeWindow,
  formatReadableDate,
} from "@/lib/analytics";
import { Session, BackendUser, BackendAnalyticsEntry } from "@/types";
import SEO from "@/components/SEO";

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
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [analyticsRows, setAnalyticsRows] = useState<BackendAnalyticsEntry[]>([]);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);

  const hasProAnalytics = profile?.subscriptionTier === "pro" && profile?.subscriptionStatus === "active";
  const hasAnalyticsAccess = Boolean(profile);
  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID?.trim() ?? "";
  const subscriptionCurrency = profile?.subscriptionCurrency === "INR" || profile?.subscriptionCurrency === "USD"
    ? profile.subscriptionCurrency
    : resolveSubscriptionCurrency();
  const subscriptionPrice = formatSubscriptionPrice(subscriptionCurrency);

  useEffect(() => {
    if (!hasProAnalytics) {
      setRange("7d");
      setIncludeDeleted(false);
    }
  }, [hasProAnalytics]);

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
    if (!user || !profile || !hasAnalyticsAccess) {
      setIsLoadingAnalytics(false);
      setAnalyticsRows([]);
      return;
    }

    let cancelled = false;
    setIsLoadingAnalytics(true);
    setError(null);

    const { startDate, endDate } = getAnalyticsRangeWindow(range, profile.timezone);

    api.getAnalytics(startDate, endDate, includeDeleted)
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
  }, [user, profile, range, includeDeleted, hasAnalyticsAccess]);

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

  const handleCheckoutSuccess = useCallback(async (payload: RazorpaySuccessPayload) => {
    setCheckoutError(null);
    try {
      await api.verifyRazorpaySubscription(payload);
      setCheckoutMessage("Payment verified. Unlocking analytics...");
      const updatedUser = await api.getUser();
      if (updatedUser) {
        setProfile(updatedUser);
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to verify payment");
    }
  }, []);

  const handleStartCheckout = useCallback(async () => {
    if (!profile) {
      return;
    }

    setCheckoutError(null);
    setCheckoutMessage(null);

    if (!razorpayKeyId) {
      setCheckoutError("Missing Razorpay key ID.");
      return;
    }

    setIsStartingCheckout(true);

    try {
      const subscription = await api.createRazorpaySubscription({
        currency: subscriptionCurrency,
      });
      const checkout = await openRazorpayCheckout({
        key: razorpayKeyId,
        name: "Task Quota",
        description: `Start your subscription`,
        subscription_id: subscription.subscription_id,
        prefill: {
          name: profile.name || user?.displayName || undefined,
          email: profile.email || user?.email || undefined,
        },
        theme: {
          color: "#2563eb",
        },
        handler: async (response) => {
          await handleCheckoutSuccess(response);
        },
        modal: {
          ondismiss: () => {
            setCheckoutMessage("Checkout closed before payment was completed.");
          },
        },
      });

      checkout.on("payment.failed", (payload) => {
        const description = payload.error?.description || payload.error?.reason || "Payment failed";
        setCheckoutError(description);
      });
      checkout.open();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setIsStartingCheckout(false);
    }
  }, [handleCheckoutSuccess, profile, razorpayKeyId, subscriptionCurrency, user?.displayName, user?.email]);

  const handleCancelSubscription = useCallback(async () => {
    if (!profile?.razorpaySubscriptionId) {
      setCheckoutError("No active subscription found.");
      return;
    }

    setCheckoutError(null);
    setCheckoutMessage(null);
    setIsCancellingSubscription(true);

    try {
      await api.cancelRazorpaySubscription();
      setCheckoutMessage("Cancellation scheduled for the end of the current billing period.");
      const updatedUser = await api.getUser();
      if (updatedUser) {
        setProfile(updatedUser);
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setIsCancellingSubscription(false);
    }
  }, [profile]);

  const activeSessionId = profile?.activeSessionId ?? null;
  const activeSessionTitle = sessions.find((session) => session.id === activeSessionId)?.title ?? "Ready to Focus";
  const resetTime = profile?.sessionsResetTime ?? "00:00";
  const timezone = profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const viewModel = useMemo(() => buildAnalyticsViewModel(analyticsRows, range, timezone), [analyticsRows, range, timezone]);
  const visibleSessions = viewModel.sessionTotals;
  const maxBucketMinutes = Math.max(1, ...viewModel.buckets.map((bucket) => bucket.totalMinutes));
  const loading = isLoadingProfile || isLoadingAnalytics;
  const hasRows = analyticsRows.length > 0;

  useEffect(() => {
    if (loading) {
      return;
    }

    const element = chartScrollRef.current;
    if (!element) {
      return;
    }

    const animationFrame = window.requestAnimationFrame(() => {
      element.scrollLeft = element.scrollWidth;
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [loading, viewModel.buckets.length]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand-soft">
      <SEO title="Analytics | Task Quota" description="Review focused time by task and track your productivity trends in Task Quota analytics." path="/analytics" indexable={false} />
      <Navbar
        activeSessionTitle={activeSessionTitle}
        activeSessionId={activeSessionId}
        resetTime={resetTime}
        timezone={timezone}
        handleSaveSettings={handleSaveSettings}
        subscriptionStatus={profile?.subscriptionStatus}
        subscriptionCancelAtPeriodEnd={profile?.subscriptionCancelAtPeriodEnd}
        isCancellingSubscription={isCancellingSubscription}
        onCancelSubscription={handleCancelSubscription}
      />

      <main className="mx-auto max-w-7xl px-6 py-8 md:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-white to-brand-soft/50 p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand">
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

            <div className="flex flex-wrap items-center justify-end gap-3 lg:mt-1">
              {hasProAnalytics && <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={includeDeleted}
                  onChange={(event) => setIncludeDeleted(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                Include deleted sessions
              </label>}
              <Button asChild variant="outline" className="border-slate-300 bg-white">
                <Link to="/app">
                  <ArrowLeft size={16} />
                  Back to focus
                </Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(Object.keys(ANALYTICS_RANGE_CONFIG) as AnalyticsRangeKey[])
              .filter((key) => hasProAnalytics || key === "7d")
              .map((key) => {
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

        {isLoadingProfile ? (
          <section className="mt-6 rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <BarChart3 size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Loading subscription state</h2>
                <p className="text-sm text-slate-500">Checking whether analytics is available for this account.</p>
              </div>
            </div>
            <div className="mt-6 h-64 animate-pulse rounded-[1.5rem] bg-slate-100" />
          </section>
        ) : hasAnalyticsAccess ? (
          <>
            {!hasProAnalytics && (
              <section className="mt-6 flex flex-col gap-4 rounded-[1.5rem] border border-brand-soft bg-brand-soft/60 p-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">You&apos;re viewing the last 7 days</p>
                  <p className="mt-1 text-sm text-slate-600">Subscribe to unlock 30, 90, and 180-day analytics and deleted-session history.</p>
                </div>
                <Button onClick={handleStartCheckout} disabled={isStartingCheckout} className="shrink-0 bg-slate-950 text-white hover:bg-slate-800">
                  {isStartingCheckout ? "Opening Razorpay..." : "Unlock longer history"}
                </Button>
              </section>
            )}
            <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Focus time"
                value={loading && !hasRows ? "Loading..." : formatMinutes(viewModel.totalMinutesSpent)}
                helper={`Across ${viewModel.sessionTotals.length} sessions`}
                icon={<Clock3 size={18} />}
              />
              <MetricCard
                label="Accumulated Goal"
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
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
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

                      <div ref={chartScrollRef} className="h-[360px] overflow-x-auto">
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
                      <div className="text-lg font-bold text-brand">{formatMinutes(viewModel.totalMinutesSpent)}</div>
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
          </>
        ) : profile ? (
          <SubscriptionPaywall
            onCheckout={handleStartCheckout}
            isLoading={isStartingCheckout}
            checkoutMessage={checkoutMessage}
            checkoutError={checkoutError}
            subscriptionCurrency={subscriptionCurrency}
            subscriptionPrice={subscriptionPrice}
          />
        ) : null}
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
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function SubscriptionPaywall({
  onCheckout,
  isLoading,
  checkoutMessage,
  checkoutError,
  subscriptionCurrency,
  subscriptionPrice,
}: {
  onCheckout: () => void;
  isLoading: boolean;
  checkoutMessage: string | null;
  checkoutError: string | null;
  subscriptionCurrency: string;
  subscriptionPrice: string;
}) {
  return (
    <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-brand p-8 text-white md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
            <BarChart3 size={14} />
            Pro analytics
          </div>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            Unlock the analytics dashboard.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            The core timer remains free. Subscribe only if you want the reporting layer: charts, goal breakdowns, and range-based analysis.
          </p>

          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="font-semibold">What Pro includes</p>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              <li>Session-level time charts across 7, 30, 90, and 180 day ranges</li>
              <li>Goal and completion breakdowns for each selected window</li>
              <li>Optional deleted-session visibility for a fuller history</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col justify-between p-8 md:p-10">
          <div>
            <div className="rounded-[1.5rem] border border-brand-soft bg-brand-soft p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Checkout</p>
              <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{subscriptionPrice}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Complete the Razorpay checkout, then verify the payment signature to unlock analytics automatically.
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Currency: {subscriptionCurrency}
              </p>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="font-semibold text-slate-900">Free stays free</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Session timers, daily progress, streaks, and multi-device sync remain available without a subscription.
              </p>
            </div>

            {(checkoutMessage || checkoutError) && (
              <div
                className={`mt-6 rounded-[1.25rem] border p-4 text-sm ${
                  checkoutError
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-brand-soft bg-brand-soft text-brand"
                }`}
              >
                {checkoutError ?? checkoutMessage}
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild variant="outline" className="border-slate-300 bg-white">
              <Link to="/app">
                <ArrowLeft size={16} />
                Back to focus
              </Link>
            </Button>
            <Button onClick={onCheckout} disabled={isLoading} className="bg-slate-950 text-white hover:bg-slate-800">
              {isLoading ? "Opening Razorpay..." : "Start subscription"}
              <BarChart3 size={16} />
            </Button>
          </div>
        </div>
      </div>
    </section>
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
