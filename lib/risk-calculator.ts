import type { RiskAssessment, RiskLevel, StripeAccountMetrics } from "@/lib/types";

function round(value: number): number {
  return Number(value.toFixed(2));
}

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) {
    return "critical";
  }

  if (score >= 55) {
    return "high";
  }

  if (score >= 30) {
    return "moderate";
  }

  return "low";
}

function formatPercent(value: number): string {
  return `${round(value)}%`;
}

export function calculateSuspensionRisk(metrics: StripeAccountMetrics): RiskAssessment {
  let score = 0;
  const triggers: string[] = [];
  const recommendations = new Set<string>();

  if (metrics.disputeRate >= 1.0) {
    score += 34;
    triggers.push(`Dispute rate is ${formatPercent(metrics.disputeRate)}, which is above Stripe's risk comfort zone.`);
    recommendations.add("Cut your dispute rate under 0.75% by tightening fulfillment evidence and billing descriptors.");
  } else if (metrics.disputeRate >= 0.75) {
    score += 24;
    triggers.push(`Dispute rate is ${formatPercent(metrics.disputeRate)} and trending into elevated risk.`);
    recommendations.add("Contact recent disputing customers early and submit stronger dispute evidence with tracking details.");
  } else if (metrics.disputeRate >= 0.4) {
    score += 10;
    triggers.push(`Dispute rate is ${formatPercent(metrics.disputeRate)}, which deserves monitoring.`);
    recommendations.add("Review SKU-level dispute patterns and stop promoting products with repeated chargeback activity.");
  }

  if (metrics.refundRate >= 12) {
    score += 22;
    triggers.push(`Refund rate reached ${formatPercent(metrics.refundRate)}, signaling post-purchase dissatisfaction.`);
    recommendations.add("Add post-checkout friction controls and tighten offer clarity to reduce avoidable refunds.");
  } else if (metrics.refundRate >= 8) {
    score += 14;
    triggers.push(`Refund rate is ${formatPercent(metrics.refundRate)}, higher than healthy baseline levels.`);
    recommendations.add("Track refunds by campaign and pause traffic sources generating low-retention customers.");
  } else if (metrics.refundRate >= 5) {
    score += 7;
    triggers.push(`Refund rate is ${formatPercent(metrics.refundRate)} and should be watched weekly.`);
    recommendations.add("Introduce a support intervention flow before high-intent customers request refunds.");
  }

  if (metrics.failedChargeRate >= 20) {
    score += 16;
    triggers.push(`Failed charge rate is ${formatPercent(metrics.failedChargeRate)}, often linked to fraud or issuer friction.`);
    recommendations.add("Enable adaptive acceptance and run payment retries with issuer-specific timing windows.");
  } else if (metrics.failedChargeRate >= 12) {
    score += 9;
    triggers.push(`Failed charge rate is ${formatPercent(metrics.failedChargeRate)} across recent attempts.`);
    recommendations.add("Segment declines by reason code and remove high-decline payment methods from weak geographies.");
  }

  if (metrics.highRiskCountryRatio >= 35) {
    score += 14;
    triggers.push(`High-risk geography exposure is ${formatPercent(metrics.highRiskCountryRatio)} of successful volume.`);
    recommendations.add("Increase verification for high-risk regions and consider restricting instant fulfillment on first orders.");
  } else if (metrics.highRiskCountryRatio >= 20) {
    score += 8;
    triggers.push(`High-risk geography exposure is ${formatPercent(metrics.highRiskCountryRatio)} of successful volume.`);
    recommendations.add("Add velocity controls by country and device fingerprint before authorizing higher-ticket orders.");
  }

  if (metrics.payoutFailures > 0) {
    score += 10;
    triggers.push(`${metrics.payoutFailures} payout failure(s) detected in the analysis window.`);
    recommendations.add("Resolve banking verification issues and ensure payout account ownership data is current.");
  }

  if (metrics.averageTicket >= 700) {
    score += 6;
    triggers.push(`Average ticket value is $${round(metrics.averageTicket)}, which magnifies dispute impact.`);
    recommendations.add("Use manual review for unusually large orders and require stronger delivery confirmation.");
  }

  if (metrics.successfulCharges < 25) {
    score += 5;
    triggers.push("Low successful charge volume limits Stripe's confidence in stable operating history.");
    recommendations.add("Keep dispute and refund performance tight while building a longer clean transaction history.");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = riskLevelFromScore(score);

  if (triggers.length === 0) {
    triggers.push("No suspension-grade triggers were detected in the selected timeframe.");
  }

  if (recommendations.size === 0) {
    recommendations.add("Continue weekly monitoring and keep your dispute rate well below 0.75%.");
  }

  const summaryByLevel: Record<RiskLevel, string> = {
    low: "Current account health looks stable. Maintain policy compliance and continue routine monitoring.",
    moderate:
      "Risk indicators are elevated. Address operational weak points now to avoid sudden account restrictions.",
    high: "Risk is high. Prioritize dispute reduction, clearer fulfillment proof, and fraud controls immediately.",
    critical:
      "Critical suspension risk detected. Take corrective action now and prepare supporting documentation for Stripe review."
  };

  return {
    score,
    level,
    summary: summaryByLevel[level],
    triggers,
    recommendations: Array.from(recommendations)
  };
}
