"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChargeTimelinePoint, StripeAccountMetrics } from "@/lib/types";

interface MetricsDashboardProps {
  metrics: StripeAccountMetrics | null;
  timeline: ChargeTimelinePoint[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

export default function MetricsDashboard({ metrics, timeline }: MetricsDashboardProps) {
  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Metrics Dashboard</CardTitle>
          <CardDescription>
            Connect your Stripe account and run an analysis to populate transaction and dispute metrics.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const rateData = [
    {
      metric: "Dispute Rate",
      value: Number(metrics.disputeRate.toFixed(2))
    },
    {
      metric: "Refund Rate",
      value: Number(metrics.refundRate.toFixed(2))
    },
    {
      metric: "Failed Charge Rate",
      value: Number(metrics.failedChargeRate.toFixed(2))
    },
    {
      metric: "High-Risk Geography",
      value: Number(metrics.highRiskCountryRatio.toFixed(2))
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Gross volume ({metrics.windowDays}d)</CardDescription>
            <CardTitle>{formatCurrency(metrics.grossVolume)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Disputes</CardDescription>
            <CardTitle>{metrics.disputeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Refunded volume</CardDescription>
            <CardTitle>{formatCurrency(metrics.refundedVolume)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Payout failures</CardDescription>
            <CardTitle>{metrics.payoutFailures}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction Pattern</CardTitle>
          <CardDescription>Daily successful, failed, and disputed activity.</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #334155",
                  borderRadius: 8
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="successful" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="failed" stroke="#fb7185" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="disputes" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Risk Rate Breakdown</CardTitle>
          <CardDescription>Key percentages that correlate with suspension events.</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="metric" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} unit="%" />
              <Tooltip
                formatter={(value) => [`${value}%`, "Value"]}
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #334155",
                  borderRadius: 8
                }}
              />
              <Bar dataKey="value" fill="#38bdf8" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
