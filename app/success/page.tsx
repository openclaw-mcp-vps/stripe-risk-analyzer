import { CheckCircle2 } from "lucide-react";

import ClaimAccessForm from "@/components/ClaimAccessForm";

export default function SuccessPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <div className="flex items-center gap-2 text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
          Payment received
        </div>
        <h1 className="mt-3 text-3xl font-semibold">Your Stripe Risk Analyzer access is ready</h1>
        <p className="mt-3 text-slate-300">
          Enter the same email used at checkout to unlock your dashboard. Webhook sync usually finishes in under one
          minute.
        </p>
        <div className="mt-6">
          <ClaimAccessForm />
        </div>
      </div>
    </main>
  );
}
