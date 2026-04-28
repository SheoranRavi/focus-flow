import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Cloud, Timer } from "lucide-react";
import Button from "../components/ui/Button";

const Home: React.FC = () => {
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

          <Button asChild variant="ghost">
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

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Today</p>
                <h2 className="text-2xl font-bold text-slate-900">Deep Work</h2>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                3 day streak
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950 text-white">
                    <Timer size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">25 minute focus block</p>
                    <p className="text-sm text-slate-500">Ready when you are</p>
                  </div>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full w-2/3 rounded-full bg-emerald-500" />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                <div className="flex items-start gap-3">
                  <Cloud className="mt-0.5 text-emerald-700" size={20} />
                  <div>
                    <p className="font-semibold text-slate-900">Account sync</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Register to keep sessions and progress available across your laptop, tablet, and phone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;
