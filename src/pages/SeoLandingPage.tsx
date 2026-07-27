import { ArrowRight, BarChart3, CheckCircle2, Clock3, Target, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Footer from "../components/Footer";
import SEO from "../components/SEO";

export interface SeoLandingPageConfig {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  benefits: Array<{ title: string; description: string; icon: "target" | "clock" | "analytics" }>;
  workflowHeading: string;
  workflow: string[];
  faqs: Array<{ question: string; answer: string }>;
}

const iconMap = {
  target: Target,
  clock: Clock3,
  analytics: BarChart3,
};

export default function SeoLandingPage({ config }: { config: SeoLandingPageConfig }) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: config.title,
        url: `https://www.taskquota.com${config.path}`,
        description: config.description,
      },
      {
        "@type": "FAQPage",
        mainEntity: config.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <SEO title={config.title} description={config.description} path={config.path} schema={schema} />

      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8 md:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Task Quota home">
          <span className="brand-gradient shadow-brand flex h-10 w-10 items-center justify-center rounded-xl text-white">
            <CheckCircle2 size={24} />
          </span>
          <span className="text-xl font-bold tracking-tight">Task Quota</span>
        </Link>
        <Button asChild variant="outline" className="border-slate-300 bg-white">
          <Link to="/login">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 md:px-8">
        <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="max-w-3xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-brand">{config.eyebrow}</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">{config.heading}</h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">{config.intro}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-slate-950 text-white hover:bg-slate-800">
                <Link to="/register">Start focusing free <ArrowRight size={18} /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-slate-300 bg-white">
                <Link to="/app">Try it as a guest</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5">
              <div>
                <p className="text-sm font-semibold text-slate-500">Today&apos;s focus</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">3 sessions planned</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><Target size={24} /></div>
            </div>
            <div className="mt-5 space-y-3">
              {["Deep work", "Research", "Planning"].map((task, index) => (
                <div key={task} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-semibold text-slate-800">{task}</span>
                  <span className="text-sm font-medium text-slate-500">{index === 0 ? "25 min" : index === 1 ? "45 min" : "15 min"}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-brand-soft px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Daily goal</span>
              <span className="font-bold text-brand">50%</span>
            </div>
          </div>
        </section>

        <section aria-labelledby="benefits-heading" className="py-10">
          <h2 id="benefits-heading" className="text-3xl font-bold tracking-tight text-slate-950">A clearer way to work on what matters</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {config.benefits.map((benefit) => {
              const Icon = iconMap[benefit.icon];
              return (
                <article key={benefit.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon size={20} /></div>
                  <h3 className="font-bold text-slate-900">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{benefit.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 py-16 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">Simple workflow</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{config.workflowHeading}</h2>
          </div>
          <ol className="space-y-4">
            {config.workflow.map((step, index) => (
              <li key={step} className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{index + 1}</span>
                <span className="leading-7 text-slate-700">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq-heading" className="pb-16">
          <h2 id="faq-heading" className="text-3xl font-bold tracking-tight text-slate-950">Frequently asked questions</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {config.faqs.map((faq) => (
              <article key={faq.question} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="font-bold text-slate-900">{faq.question}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{faq.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-16 rounded-3xl bg-slate-900 px-6 py-12 text-center text-white md:px-10">
          <TrendingUp className="mx-auto text-blue-300" size={28} />
          <h2 className="mt-4 text-3xl font-bold">Turn focused time into visible progress.</h2>
          <p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-300">Start with one task, keep your attention there, and use Task Quota to understand the routine you are building.</p>
          <Button asChild size="lg" className="mt-7 bg-white text-slate-900 hover:bg-slate-100"><Link to="/register">Create your free account</Link></Button>
        </section>
      </main>

      <Footer />
    </div>
  );
}
