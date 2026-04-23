"use client";

import { FormEvent, useMemo, useState } from "react";
import { BarChart3, LoaderCircle, ShieldAlert } from "lucide-react";

import AlertSettings from "@/components/AlertSettings";
import MetricsDashboard from "@/components/MetricsDashboard";
import RiskScore from "@/components/RiskScore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { PublicConnection, SnapshotRecord } from "@/lib/types";

interface DashboardClientProps {
  ownerEmail: string;
  initialConnection: PublicConnection | null;
  initialSnapshot: SnapshotRecord | null;
}

export default function DashboardClient({
  ownerEmail,
  initialConnection,
  initialSnapshot
}: DashboardClientProps) {
  const [connection, setConnection] = useState<PublicConnection | null>(initialConnection);
  const [snapshot, setSnapshot] = useState<SnapshotRecord | null>(initialSnapshot);
  const [windowDays, setWindowDays] = useState<number>(30);
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [useSavedConnection, setUseSavedConnection] = useState(Boolean(initialConnection));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [message, setMessage] = useState<string>("");

  const accountHeadline = useMemo(() => {
    if (snapshot) {
      return `${snapshot.account.displayName} (${snapshot.account.id})`;
    }

    if (connection) {
      return `${connection.accountDisplayName} (${connection.stripeAccountId})`;
    }

    return "No Stripe account connected yet";
  }, [connection, snapshot]);

  async function runAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!useSavedConnection && !stripeSecretKey.trim()) {
      setMessage("Enter a Stripe Secret Key or enable saved connection usage.");
      return;
    }

    setIsAnalyzing(true);
    setMessage("");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          stripeSecretKey: stripeSecretKey.trim() || undefined,
          windowDays,
          useSavedConnection
        })
      });

      const payload = (await response.json()) as {
        message?: string;
        snapshot?: SnapshotRecord;
      };

      if (!response.ok || !payload.snapshot) {
        setMessage(payload.message ?? "Analysis failed. Please verify your Stripe key and try again.");
        return;
      }

      setSnapshot(payload.snapshot);
      setStripeSecretKey("");
      setMessage("Analysis complete. Your risk profile is now up to date.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sky-400" />
            Live Stripe Risk Analysis
          </CardTitle>
          <CardDescription>
            Analyze transaction patterns, dispute pressure, and account health signals across a configurable timeframe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Signed in as</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{ownerEmail}</div>
            <div className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">Account scope</div>
            <div className="mt-1 text-sm text-slate-200">{accountHeadline}</div>
          </div>

          <form className="space-y-4" onSubmit={runAnalysis}>
            <div className="space-y-1.5">
              <label htmlFor="stripeKeyNow" className="text-sm font-medium text-slate-200">
                Stripe Secret Key (for immediate analysis)
              </label>
              <Input
                id="stripeKeyNow"
                type="password"
                autoComplete="off"
                value={stripeSecretKey}
                onChange={(event) => setStripeSecretKey(event.target.value)}
                placeholder="sk_live_..."
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="windowDays" className="text-sm font-medium text-slate-200">
                Analysis Window (days)
              </label>
              <Input
                id="windowDays"
                type="number"
                min={7}
                max={180}
                value={windowDays}
                onChange={(event) => setWindowDays(Number(event.target.value))}
                required
              />
            </div>

            <label className="flex items-center gap-3 rounded-md border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                className="h-4 w-4 accent-sky-500"
                checked={useSavedConnection}
                onChange={(event) => setUseSavedConnection(event.target.checked)}
                disabled={!connection}
              />
              Reuse stored Stripe connection for analysis and background jobs
            </label>

            <Button type="submit" disabled={isAnalyzing}>
              {isAnalyzing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Run Analysis
            </Button>
          </form>

          {message ? (
            <p className="flex items-center gap-2 text-sm text-slate-300">
              <ShieldAlert className="h-4 w-4 text-sky-400" />
              {message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <RiskScore risk={snapshot?.risk ?? null} />

      <MetricsDashboard metrics={snapshot?.metrics ?? null} timeline={snapshot?.timeline ?? []} />

      <AlertSettings ownerEmail={ownerEmail} connection={connection} onConnectionChange={setConnection} />
    </div>
  );
}
