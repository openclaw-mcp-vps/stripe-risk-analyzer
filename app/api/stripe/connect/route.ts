import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE_NAME,
  ACCESS_COOKIE_OPTIONS,
  createAccessToken,
  getAccessSessionFromRequest
} from "@/lib/auth";
import {
  decryptSecret,
  deleteConnectionByOwnerEmail,
  getInternalConnectionByOwnerEmail,
  getPurchaseByEmail,
  toPublicConnection,
  upsertConnection
} from "@/lib/database";
import { fetchStripeAccountSummary } from "@/lib/stripe-analyzer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ClaimAccessSchema = z.object({
  mode: z.literal("claim_access"),
  email: z.string().email()
});

const ConnectAccountSchema = z.object({
  mode: z.literal("connect_account"),
  stripeSecretKey: z.string().min(10).optional(),
  alertEmail: z.string().email(),
  riskThreshold: z.number().int().min(25).max(95),
  monitorEnabled: z.boolean()
});

const DisconnectAccountSchema = z.object({
  mode: z.literal("disconnect_account")
});

const ConnectRequestSchema = z.discriminatedUnion("mode", [
  ClaimAccessSchema,
  ConnectAccountSchema,
  DisconnectAccountSchema
]);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
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

  const connection = await getInternalConnectionByOwnerEmail(session.email);

  return NextResponse.json({
    connected: Boolean(connection),
    connection: connection ? toPublicConnection(connection) : null
  });
}

export async function POST(request: NextRequest) {
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

  const parsed = ConnectRequestSchema.safeParse(json);

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

  if (parsed.data.mode === "claim_access") {
    const email = normalizeEmail(parsed.data.email);
    const purchase = await getPurchaseByEmail(email);

    if (!purchase) {
      return NextResponse.json(
        {
          message:
            "No completed purchase found for this email yet. Confirm checkout used this address and wait for webhook sync."
        },
        {
          status: 403
        }
      );
    }

    const token = await createAccessToken(email);

    const response = NextResponse.json({
      message: "Access unlocked"
    });

    response.cookies.set(ACCESS_COOKIE_NAME, token, ACCESS_COOKIE_OPTIONS);

    return response;
  }

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

  if (parsed.data.mode === "disconnect_account") {
    await deleteConnectionByOwnerEmail(session.email);

    return NextResponse.json({
      message: "Connection removed"
    });
  }

  const existingConnection = await getInternalConnectionByOwnerEmail(session.email);
  let keyToUse = parsed.data.stripeSecretKey?.trim();

  if (!keyToUse && existingConnection) {
    keyToUse = decryptSecret(existingConnection.encryptedStripeKey);
  }

  if (!keyToUse) {
    return NextResponse.json(
      {
        message: "Provide a Stripe Secret Key to connect monitoring."
      },
      {
        status: 400
      }
    );
  }

  try {
    const account = await fetchStripeAccountSummary(keyToUse);
    const record = await upsertConnection({
      ownerEmail: session.email,
      stripeAccountId: account.id,
      accountDisplayName: account.displayName,
      stripeSecretKey: keyToUse,
      alertEmail: normalizeEmail(parsed.data.alertEmail),
      riskThreshold: parsed.data.riskThreshold,
      monitorEnabled: parsed.data.monitorEnabled
    });

    return NextResponse.json({
      message: "Stripe account connected",
      connection: toPublicConnection(record)
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? `Stripe connection failed: ${error.message}`
            : "Stripe connection failed"
      },
      {
        status: 400
      }
    );
  }
}
