import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, ShieldAlert, TrendingDown } from "lucide-react";

import ClaimAccessForm from "@/components/ClaimAccessForm";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccessSessionFromCookies } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Predict Stripe Account Suspension Risk",
  description:
    "Stripe Risk Analyzer warns e-commerce and SaaS teams before disputes, refunds, and payment failures trigger account suspension."
};

const painPoints = [
  {
    title: "Revenue can stop in a single day",
    text: "Stripe account reviews and reserves can freeze your cash flow without enough time to react."
  },
  {
    title: "Disputes often spike before suspension",
    text: "Most teams see warning signals in dispute and refund behavior but lack one place that tracks risk clearly."
  },
  {
    title: "Manual account checks are inconsistent",
    text: "Without automated monitoring, critical signals are missed until payouts fail or risk notices arrive."
  }
];

const features = [
  "Real-time suspension risk score based on dispute, refund, and failed charge patterns",
  "Transaction timeline that highlights sudden quality shifts in your payment traffic",
  "Background monitoring with configurable thresholds and email alerts",
  "Stripe webhook support to unlock access and keep account health in sync"
];

const faqItems = [
  {
    question: "How does access unlock after purchase?",
    answer:
      "After checkout, Stripe sends a webhook with your purchase email. Enter that same email in the unlock form and the app issues a secure access cookie."
  },
  {
    question: "Do you store my Stripe API key?",
    answer:
      "You can run one-time analysis with a temporary key, or opt in to encrypted key storage for automated background monitoring and alerts."
  },
  {
    question: "Who is this built for?",
    answer:
      "The product is designed for SaaS founders and e-commerce operators using Stripe who want early suspension warnings before revenue is interrupted."
  },
  {
    question: "What happens when risk exceeds my threshold?",
    answer:
      "The system saves a new snapshot and sends an actionable alert email with top triggers and a concrete remediation checklist."
  }
];

export default async function LandingPage() {
  const session = await getAccessSessionFromCookies();

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
      <header className="rounded-2xl border border-slate-800 bg-slate-900/55 p-6 sm:p-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-sky-300">
          fintech-tools
        </div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">
          Predict Stripe account suspension risk before it damages revenue
        </h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-300">
          Stripe Risk Analyzer monitors disputes, refunds, payout reliability, and transaction quality to warn you early
          when your account is drifting toward suspension triggers.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK}
            className={buttonVariants({ size: "lg" })}
          >
            Start Monitoring for $19/mo
            <ArrowRight className="h-4 w-4" />
          </a>
          {session ? (
            <a href="/dashboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
              Open Your Dashboard
            </a>
          ) : null}
        </div>
      </header>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {painPoints.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="text-xl">{item.title}</CardTitle>
              <CardDescription className="text-base leading-relaxed">{item.text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldAlert className="h-5 w-5 text-rose-400" />
              Problem
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Businesses often discover Stripe risk only after payouts fail or reserves are imposed. At that point,
              recovery is slower and revenue damage is already underway.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <TrendingDown className="h-5 w-5 text-emerald-400" />
              Solution
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              Stripe Risk Analyzer continuously scores account health and gives targeted steps to lower suspension
              probability before Stripe enforcement actions begin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-300">
              {features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Simple pricing for high-stakes payment risk</CardTitle>
            <CardDescription className="text-base">
              One plan, immediate insights. Designed for teams that need visibility before Stripe sends enforcement
              notices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="text-4xl font-semibold">$19<span className="text-lg text-slate-400">/month</span></div>
              <p className="mt-2 text-sm text-slate-300">Cancel anytime. Use your Stripe hosted checkout link directly.</p>
            </div>
            <a href={process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK} className={buttonVariants({ size: "lg" })}>
              Subscribe with Stripe
              <ArrowRight className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>
        <ClaimAccessForm />
      </section>

      <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900/55 p-6 sm:p-8">
        <h2 className="text-2xl font-semibold">FAQ</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {faqItems.map((item) => (
            <div key={item.question} className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-base font-semibold text-slate-100">{item.question}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
