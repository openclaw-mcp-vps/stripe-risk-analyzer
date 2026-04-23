import { Resend } from "resend";

import type { RiskAssessment, StripeAccountMetrics, StripeAccountSummary } from "@/lib/types";

export interface RiskAlertEmailPayload {
  to: string;
  account: StripeAccountSummary;
  metrics: StripeAccountMetrics;
  risk: RiskAssessment;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

export async function sendRiskAlertEmail(payload: RiskAlertEmailPayload): Promise<{
  sent: boolean;
  id?: string;
  reason?: string;
}> {
  if (!process.env.RESEND_API_KEY) {
    return {
      sent: false,
      reason: "RESEND_API_KEY is not configured"
    };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const from = process.env.ALERT_FROM_EMAIL ?? "alerts@stripe-risk-analyzer.local";

  const text = [
    `Stripe account: ${payload.account.displayName} (${payload.account.id})`,
    `Risk score: ${payload.risk.score}/100 (${payload.risk.level.toUpperCase()})`,
    `Dispute rate: ${payload.metrics.disputeRate.toFixed(2)}%`,
    `Refund rate: ${payload.metrics.refundRate.toFixed(2)}%`,
    `Failed charge rate: ${payload.metrics.failedChargeRate.toFixed(2)}%`,
    `Chargeback amount: ${formatCurrency(payload.metrics.chargebackAmount)}`,
    "",
    "Top triggers:",
    ...payload.risk.triggers.map((trigger) => `- ${trigger}`),
    "",
    "Recommended actions:",
    ...payload.risk.recommendations.map((item) => `- ${item}`)
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
      <h2>Stripe Suspension Risk Alert</h2>
      <p><strong>Account:</strong> ${payload.account.displayName} (${payload.account.id})</p>
      <p><strong>Risk score:</strong> ${payload.risk.score}/100 (${payload.risk.level.toUpperCase()})</p>
      <ul>
        <li>Dispute rate: ${payload.metrics.disputeRate.toFixed(2)}%</li>
        <li>Refund rate: ${payload.metrics.refundRate.toFixed(2)}%</li>
        <li>Failed charge rate: ${payload.metrics.failedChargeRate.toFixed(2)}%</li>
        <li>Chargeback amount: ${formatCurrency(payload.metrics.chargebackAmount)}</li>
      </ul>
      <h3>Top triggers</h3>
      <ul>
        ${payload.risk.triggers.map((trigger) => `<li>${trigger}</li>`).join("")}
      </ul>
      <h3>Recommended actions</h3>
      <ul>
        ${payload.risk.recommendations.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: payload.to,
      subject: `Stripe risk alert: ${payload.risk.score}/100 for ${payload.account.displayName}`,
      text,
      html
    });

    if (error) {
      return {
        sent: false,
        reason: error.message
      };
    }

    return {
      sent: true,
      id: data?.id
    };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : "Failed to send alert email"
    };
  }
}
