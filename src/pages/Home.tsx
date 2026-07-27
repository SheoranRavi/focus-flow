import React from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BarChart3, CheckCircle2, Layers3, Pencil, Play, RotateCcw, Target, Trash2 } from "lucide-react";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

const Home: React.FC = () => {
  const user = useAuth();

  if (user) {
    return <Navigate to="/app" replace />;
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        name: "Task Quota",
        url: "https://www.taskquota.com/",
        description: "Task-based focus sessions with analytics, daily goals, and streak tracking.",
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What is Task Quota?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Task Quota is a task-based focus app that helps you run focused sessions, track daily goals, and review analytics over time.",
            },
          },
          {
            "@type": "Question",
            name: "Can I use Task Quota without creating an account?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. You can start as a guest on your current device. Create an account when you want to sync sessions and progress across devices.",
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SEO
        title="Task Quota | Task-based focus sessions with analytics"
        description="Run task-based focus sessions, track daily goals and streaks, and use analytics to understand where your focused time goes."
        schema={structuredData}
      />
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="brand-gradient shadow-brand flex h-10 w-10 items-center justify-center rounded-xl text-white">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">Task Quota</span>
          </div>

          <Button asChild variant="outline" className="border-slate-300 bg-white shadow-sm hover:bg-slate-100 hover:shadow-md">
            <Link to="/login">Sign in</Link>
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_0.9fr] lg:py-16">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-brand">
              Task-based focus sessions and analytics
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Make every focused session count.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Organize focused time by task, track daily goals and streaks, and use analytics to see how your work is really progressing. Start as a guest or create an account to sync sessions across multiple devices.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-slate-950 text-white hover:bg-slate-800">
                <Link to="/register">
                  Start focusing free — create an account
                  <ArrowRight size={18} />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-300 bg-white">
                <Link to="/app">Continue as guest</Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative flex w-full flex-col items-center justify-between rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/70 md:w-[320px] lg:ml-auto">
              <div className="mb-4 flex w-full items-start justify-between">
                <div className="flex max-w-[80%] items-center gap-2">
                  <h2 className="truncate font-bold text-slate-800">Deep Work</h2>
                </div>
                <div className="flex gap-1" aria-hidden="true">
                  <span className="rounded-full p-1.5 text-slate-400">
                    <Pencil size={14} />
                  </span>
                  <span className="rounded-full p-1.5 text-slate-400">
                    <Trash2 size={14} />
                  </span>
                </div>
              </div>

              <div className="relative my-4 flex flex-col items-center justify-center">
                <div className="relative flex items-center justify-center">
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center [transform:scale(1.15)]">
                    <svg height={200} width={200} className="-rotate-90">
                      <circle stroke="#f1f5f9" strokeWidth={2} fill="transparent" r={76} cx={80} cy={100} />
                      <circle
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="477.52 477.52"
                        strokeDashoffset="238.76"
                        strokeLinecap="round"
                        fill="transparent"
                        r={76}
                        cx={80}
                        cy={100}
                      />
                    </svg>
                  </div>

                  <div className="relative z-10 flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-4 border-slate-100 bg-white">
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-brand-soft opacity-50" />
                    <div className="z-10 text-center">
                      <div className="text-5xl font-bold tracking-tighter text-slate-800">25</div>
                      <div className="mt-1 text-sm font-medium uppercase tracking-widest text-slate-400">00</div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  Daily Goal: 50%
                </div>
              </div>

              <div className="mt-4 flex items-center gap-4" aria-hidden="true">
                <span className="flex items-center gap-2 rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white shadow-md">
                  <Play size={20} fill="currentColor" /> Start
                </span>
                <span className="rounded-xl p-3 text-slate-400">
                  <RotateCcw size={18} />
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-soft bg-brand-soft p-5 md:w-[320px] lg:ml-auto">
              <p className="font-semibold text-slate-900">Account sync</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Register to keep sessions and progress available across your laptop, tablet, and phone.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-12 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <BarChart3 size={20} />
            </div>
            <h2 className="font-bold text-slate-900">Pro analytics dashboard</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Unlock the session-by-session analytics view with weekly, monthly, and quarterly breakdowns.
            </p>
            <Button asChild variant="outline" className="mt-4 border-slate-300 bg-white">
              <Link to="/analytics">Open analytics</Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Layers3 size={20} />
            </div>
            <h2 className="font-bold text-slate-900">Switch between tasks</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Keep multiple sessions ready and move between work, reading, study, or planning without rebuilding your timer.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <Target size={20} />
            </div>
            <h2 className="font-bold text-slate-900">Deep focus on one task</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Start one active session at a time so the app keeps your attention on the task you chose.
            </p>
          </div>
        </section>

        <section aria-labelledby="explore-heading" className="pb-12">
          <h2 id="explore-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            Explore Task Quota
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Link to="/task-focus-timer" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <h3 className="font-bold text-slate-900">Task focus timer</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Focus on one task at a time with a dedicated session.</p>
            </Link>
            <Link to="/focus-session-tracker" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <h3 className="font-bold text-slate-900">Focus session tracker</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Keep daily sessions, goals, and streaks visible.</p>
            </Link>
            <Link to="/productivity-analytics" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <h3 className="font-bold text-slate-900">Productivity analytics</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Understand where your focused time goes by task.</p>
            </Link>
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="pb-12">
          <h2 id="faq-heading" className="text-2xl font-bold tracking-tight text-slate-900">
            Frequently asked questions
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">What is Task Quota?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Task Quota helps you run task-based focus sessions, track daily goals, and review your focused time with analytics.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-bold text-slate-900">Can I use it without an account?</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Yes. Start as a guest on your current device, then create an account when you want to sync sessions and progress across devices.
              </p>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default Home;
