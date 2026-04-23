import type { Metadata } from "next";
import { redirect } from "next/navigation";

import DashboardClient from "@/components/DashboardClient";
import { getAccessSessionFromCookies } from "@/lib/auth";
import { getConnectionByOwnerEmail, getLatestSnapshotByOwnerEmail } from "@/lib/database";

export const metadata: Metadata = {
  title: "Risk Dashboard",
  description:
    "Analyze Stripe account health, monitor dispute risk, and receive suspension alerts before problems escalate."
};

export default async function DashboardPage() {
  const session = await getAccessSessionFromCookies();

  if (!session) {
    redirect("/?paywall=locked");
  }

  const [connection, snapshot] = await Promise.all([
    getConnectionByOwnerEmail(session.email),
    getLatestSnapshotByOwnerEmail(session.email)
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h1 className="text-3xl font-semibold">Suspension Risk Dashboard</h1>
        <p className="mt-3 max-w-3xl text-slate-300">
          Monitor the exact Stripe account patterns most correlated with payment processor enforcement.
          Run ad-hoc analysis anytime or keep continuous monitoring enabled for automatic alerts.
        </p>
      </header>

      <DashboardClient
        ownerEmail={session.email}
        initialConnection={connection}
        initialSnapshot={snapshot}
      />
    </main>
  );
}
