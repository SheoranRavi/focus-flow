import React from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowRight, BarChart3, CheckCircle2, Layers3, Pencil, Play, RotateCcw, Target, Trash2 } from "lucide-react";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";

const Home: React.FC = () => {
  const user = useAuth();

  if (user) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 md:px-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-200">
              <CheckCircle2 size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">Focus Flow</span>
          </div>

          <Button asChild variant="outline" className="border-slate-300 bg-white shadow-sm hover:bg-slate-100 hover:shadow-md">
            <Link to="/login">Sign in</Link>
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_0.9fr] lg:py-16">
          <div className="max-w-2xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Focus sessions, daily progress, zero friction
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Start focusing now. Sync when you want.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Create focus sessions, track your daily goal, and keep your streak visible. Use it as a guest on this device, or create an account to sync sessions across multiple devices.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-slate-950 text-white hover:bg-slate-800">
                <Link to="/register">
                  Create an account
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
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-emerald-200 opacity-50" />
                    <div className="z-10 text-center">
                      <div className="text-5xl font-bold tracking-tighter text-slate-800">25</div>
                      <div className="mt-1 text-sm font-medium uppercase tracking-widest text-slate-400">00</div>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-400">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
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

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 md:w-[320px] lg:ml-auto">
              <p className="font-semibold text-slate-900">Account sync</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Register to keep sessions and progress available across your laptop, tablet, and phone.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 pb-12 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <BarChart3 size={20} />
            </div>
            <h2 className="font-bold text-slate-900">Analytics dashboard</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              See how much time you spend on each session over the last week, month, and more.
            </p>
            <Button asChild variant="outline" className="mt-4 border-slate-300 bg-white">
              <Link to="/analytics">Open analytics</Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
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
      </main>
    </div>
  );
};

export default Home;
