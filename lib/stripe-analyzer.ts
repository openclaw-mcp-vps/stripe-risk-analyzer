import Stripe from "stripe";

import { calculateSuspensionRisk } from "@/lib/risk-calculator";
import type {
  ChargeTimelinePoint,
  StripeAccountMetrics,
  StripeAccountSummary,
  StripeAnalysisResult
} from "@/lib/types";

const HIGH_RISK_COUNTRY_CODES = new Set([
  "BD",
  "BR",
  "GH",
  "ID",
  "IN",
  "KE",
  "MA",
  "NG",
  "PK",
  "RO",
  "TR",
  "UA",
  "VN"
]);

const MAX_CHARGES = 1200;
const MAX_DISPUTES = 600;

function round(value: number): number {
  return Number(value.toFixed(2));
}

function centsToDollars(value: number): number {
  return value / 100;
}

function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    appInfo: {
      name: "Stripe Risk Analyzer",
      version: "1.0.0"
    }
  });
}

async function collectCharges(stripe: Stripe, startUnix: number): Promise<Stripe.Charge[]> {
  const charges: Stripe.Charge[] = [];

  const list = stripe.charges.list({
    limit: 100,
    created: {
      gte: startUnix
    }
  });

  for await (const charge of list) {
    charges.push(charge);

    if (charges.length >= MAX_CHARGES) {
      break;
    }
  }

  return charges;
}

async function collectDisputes(stripe: Stripe, startUnix: number): Promise<Stripe.Dispute[]> {
  const disputes: Stripe.Dispute[] = [];

  const list = stripe.disputes.list({
    limit: 100,
    created: {
      gte: startUnix
    }
  });

  for await (const dispute of list) {
    disputes.push(dispute);

    if (disputes.length >= MAX_DISPUTES) {
      break;
    }
  }

  return disputes;
}

async function countFailedPayouts(stripe: Stripe, startUnix: number): Promise<number> {
  try {
    let failures = 0;

    const list = stripe.payouts.list({
      limit: 100,
      status: "failed",
      created: {
        gte: startUnix
      }
    });

    for await (const _payout of list) {
      failures += 1;
    }

    return failures;
  } catch {
    return 0;
  }
}

function buildTimeline(charges: Stripe.Charge[], disputes: Stripe.Dispute[]): ChargeTimelinePoint[] {
  const points = new Map<string, ChargeTimelinePoint>();

  for (const charge of charges) {
    const date = new Date(charge.created * 1000).toISOString().slice(0, 10);

    if (!points.has(date)) {
      points.set(date, {
        date,
        successful: 0,
        failed: 0,
        disputes: 0
      });
    }

    const point = points.get(date);

    if (!point) {
      continue;
    }

    if (charge.status === "succeeded" && charge.paid) {
      point.successful += 1;
    } else {
      point.failed += 1;
    }
  }

  for (const dispute of disputes) {
    const date = new Date(dispute.created * 1000).toISOString().slice(0, 10);

    if (!points.has(date)) {
      points.set(date, {
        date,
        successful: 0,
        failed: 0,
        disputes: 0
      });
    }

    const point = points.get(date);

    if (!point) {
      continue;
    }

    point.disputes += 1;
  }

  return Array.from(points.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function fetchStripeAccountSummary(secretKey: string): Promise<StripeAccountSummary> {
  const stripe = createStripeClient(secretKey);
  const account = await stripe.accounts.retrieve();

  const displayName =
    account.business_profile?.name ??
    account.settings?.dashboard?.display_name ??
    account.email ??
    "Stripe account";

  return {
    id: account.id,
    displayName,
    country: account.country ?? "unknown",
    businessType: account.business_type ?? "unknown",
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    requirementsDueCount: account.requirements?.currently_due?.length ?? 0
  };
}

export async function analyzeStripeAccount(
  secretKey: string,
  windowDays = 30
): Promise<StripeAnalysisResult> {
  const stripe = createStripeClient(secretKey);
  const now = Date.now();
  const startUnix = Math.floor((now - windowDays * 24 * 60 * 60 * 1000) / 1000);

  const [account, charges, disputes, payoutFailures] = await Promise.all([
    fetchStripeAccountSummary(secretKey),
    collectCharges(stripe, startUnix),
    collectDisputes(stripe, startUnix),
    countFailedPayouts(stripe, startUnix)
  ]);

  const totalCharges = charges.length;
  const successfulCharges = charges.filter((charge) => charge.status === "succeeded" && charge.paid);
  const failedCharges = totalCharges - successfulCharges.length;

  const grossVolume = successfulCharges.reduce((sum, charge) => sum + centsToDollars(charge.amount), 0);
  const refundedVolume = successfulCharges.reduce(
    (sum, charge) => sum + centsToDollars(charge.amount_refunded),
    0
  );

  const chargebackAmount = disputes.reduce((sum, dispute) => sum + centsToDollars(dispute.amount), 0);

  const highRiskCountryCount = successfulCharges.filter((charge) => {
    const country = charge.billing_details.address?.country;

    if (!country) {
      return false;
    }

    return HIGH_RISK_COUNTRY_CODES.has(country.toUpperCase());
  }).length;

  const metrics: StripeAccountMetrics = {
    windowDays,
    totalCharges,
    successfulCharges: successfulCharges.length,
    failedCharges,
    grossVolume: round(grossVolume),
    refundedVolume: round(refundedVolume),
    refundRate: grossVolume === 0 ? 0 : round((refundedVolume / grossVolume) * 100),
    disputeCount: disputes.length,
    disputeRate:
      successfulCharges.length === 0
        ? 0
        : round((disputes.length / successfulCharges.length) * 100),
    chargebackAmount: round(chargebackAmount),
    failedChargeRate: totalCharges === 0 ? 0 : round((failedCharges / totalCharges) * 100),
    highRiskCountryRatio:
      successfulCharges.length === 0
        ? 0
        : round((highRiskCountryCount / successfulCharges.length) * 100),
    averageTicket:
      successfulCharges.length === 0
        ? 0
        : round(grossVolume / successfulCharges.length),
    payoutFailures
  };

  const timeline = buildTimeline(charges, disputes);
  const risk = calculateSuspensionRisk(metrics);

  return {
    account,
    metrics,
    risk,
    timeline
  };
}
