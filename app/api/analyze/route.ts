import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { getAccessSessionFromRequest } from "@/lib/auth";
import {
  decryptSecret,
  getInternalConnectionByOwnerEmail,
  listMonitoringConnections,
  saveSnapshot,
  updateConnectionHealth
} from "@/lib/database";
import { sendRiskAlertEmail } from "@/lib/email-alerts";
import { analyzeStripeAccount } from "@/lib/stripe-analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AnalyzeRequestSchema = z.object({
  stripeSecretKey: z.string().optional(),
  windowDays: z.coerce.number().int().min(7).max(180).default(30),
  useSavedConnection: z.boolean().default(true)
});

async function maybeSendThresholdAlert(input: {
  ownerEmail: string;
  threshold: number;
  alertEmail: string;
  riskScore: number;
  account: Awaited<ReturnType<typeof analyzeStripeAccount>>["account"];
  metrics: Awaited<ReturnType<typeof analyzeStripeAccount>>["metrics"];
  risk: Awaited<ReturnType<typeof analyzeStripeAccount>>["risk"];
  lastAlertAt?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  if (input.riskScore < input.threshold) {
    return { sent: false, reason: "threshold_not_reached" };
  }

  const cooldownMs = 1000 * 60 * 60 * 6;
  const now = Date.now();

  if (input.lastAlertAt) {
    const delta = now - new Date(input.lastAlertAt).getTime();

    if (delta < cooldownMs) {
      return {
        sent: false,
        reason: "alert_cooldown_active"
      };
    }
  }

  const result = await sendRiskAlertEmail({
    to: input.alertEmail,
    account: input.account,
    metrics: input.metrics,
    risk: input.risk
  });

  if (result.sent) {
    await updateConnectionHealth(input.ownerEmail, {
      lastAlertAt: new Date().toISOString()
    });

    return {
      sent: true
    };
  }

  return {
    sent: false,
    reason: result.reason
  };
}

export async function POST(request: NextRequest) {
  const session = await getAccessSessionFromRequest(request);

  if (!session) {
    return NextResponse.json(
      {
        message: "Not authenticated"
      },
      {
        status: 401
      }
    );
  }

  const json = await request.json().catch(() => null);

  if (!json) {
    return NextResponse.json(
      {
        message: "Request body must be valid JSON"
      },
      {
        status: 400
      }
    );
  }

  const parsed = AnalyzeRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: parsed.error.issues[0]?.message ?? "Invalid request"
      },
      {
        status: 400
      }
    );
  }

  const connection = await getInternalConnectionByOwnerEmail(session.email);
  let stripeSecretKey = parsed.data.stripeSecretKey?.trim();
  let keySource: "provided" | "saved" = "provided";

  if (!stripeSecretKey) {
    if (!parsed.data.useSavedConnection) {
      return NextResponse.json(
        {
          message: "Provide a Stripe Secret Key or enable saved connection usage."
        },
        {
          status: 400
        }
      );
    }

    if (!connection) {
      return NextResponse.json(
        {
          message: "No saved Stripe connection found. Add a key in Alert Settings first."
        },
        {
          status: 400
        }
      );
    }

    stripeSecretKey = decryptSecret(connection.encryptedStripeKey);
    keySource = "saved";
  }

  try {
    const analysis = await analyzeStripeAccount(stripeSecretKey, parsed.data.windowDays);

    const snapshot = await saveSnapshot({
      ownerEmail: session.email,
      windowDays: parsed.data.windowDays,
      account: analysis.account,
      metrics: analysis.metrics,
      risk: analysis.risk,
      timeline: analysis.timeline
    });

    if (connection) {
      await updateConnectionHealth(session.email, {
        lastAnalysisAt: new Date().toISOString(),
        lastRiskScore: analysis.risk.score
      });
    }

    let alertResult: { sent: boolean; reason?: string } | null = null;

    if (connection?.monitorEnabled) {
      alertResult = await maybeSendThresholdAlert({
        ownerEmail: connection.ownerEmail,
        threshold: connection.riskThreshold,
        alertEmail: connection.alertEmail,
        riskScore: analysis.risk.score,
        account: analysis.account,
        metrics: analysis.metrics,
        risk: analysis.risk,
        lastAlertAt: connection.lastAlertAt
      });
    }

    return NextResponse.json({
      message: "Analysis completed",
      keySource,
      snapshot,
      alertResult
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Analysis failed"
      },
      {
        status: 400
      }
    );
  }
}

export async function GET(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;

  if (configuredSecret) {
    const providedSecret = request.headers.get("x-cron-secret");

    if (!providedSecret || providedSecret !== configuredSecret) {
      return NextResponse.json(
        {
          message: "Unauthorized"
        },
        {
          status: 401
        }
      );
    }
  }

  const connections = await listMonitoringConnections();
  let alertsSent = 0;
  const results: Array<{
    ownerEmail: string;
    status: "ok" | "error";
    riskScore?: number;
    reason?: string;
  }> = [];

  for (const connection of connections) {
    try {
      const stripeSecretKey = decryptSecret(connection.encryptedStripeKey);
      const analysis = await analyzeStripeAccount(stripeSecretKey, 30);

      await saveSnapshot({
        ownerEmail: connection.ownerEmail,
        windowDays: 30,
        account: analysis.account,
        metrics: analysis.metrics,
        risk: analysis.risk,
        timeline: analysis.timeline
      });

      await updateConnectionHealth(connection.ownerEmail, {
        lastAnalysisAt: new Date().toISOString(),
        lastRiskScore: analysis.risk.score
      });

      const alertResult = await maybeSendThresholdAlert({
        ownerEmail: connection.ownerEmail,
        threshold: connection.riskThreshold,
        alertEmail: connection.alertEmail,
        riskScore: analysis.risk.score,
        account: analysis.account,
        metrics: analysis.metrics,
        risk: analysis.risk,
        lastAlertAt: connection.lastAlertAt
      });

      if (alertResult.sent) {
        alertsSent += 1;
      }

      results.push({
        ownerEmail: connection.ownerEmail,
        status: "ok",
        riskScore: analysis.risk.score,
        reason: alertResult.reason
      });
    } catch (error) {
      results.push({
        ownerEmail: connection.ownerEmail,
        status: "error",
        reason: error instanceof Error ? error.message : "monitoring_failed"
      });
    }
  }

  return NextResponse.json({
    processed: connections.length,
    alertsSent,
    results
  });
}
