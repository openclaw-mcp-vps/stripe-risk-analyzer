import crypto from "crypto";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { recordPurchase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LemonWebhookSchema = z.object({
  meta: z
    .object({
      event_name: z.string()
    })
    .optional(),
  data: z
    .object({
      attributes: z.record(z.unknown()).optional()
    })
    .optional()
});

function signatureMatches(rawBody: string, signature: string, secret: string): boolean {
  const digest = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const digestBuffer = Buffer.from(digest, "utf8");
  const signatureBuffer = Buffer.from(signature.trim(), "utf8");

  if (digestBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(digestBuffer, signatureBuffer);
}

function extractEmail(attributes: Record<string, unknown> | undefined): string | null {
  if (!attributes) {
    return null;
  }

  const candidates = [
    attributes.user_email,
    attributes.customer_email,
    attributes.email,
    attributes.billing_email
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("@")) {
      return candidate;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (secret) {
    if (!signature) {
      return NextResponse.json(
        {
          message: "Missing x-signature header"
        },
        {
          status: 400
        }
      );
    }

    if (!signatureMatches(rawBody, signature, secret)) {
      return NextResponse.json(
        {
          message: "Invalid webhook signature"
        },
        {
          status: 401
        }
      );
    }
  }

  const parsedJson = (() => {
    try {
      return JSON.parse(rawBody) as unknown;
    } catch {
      return null;
    }
  })();

  if (!parsedJson) {
    return NextResponse.json(
      {
        message: "Invalid JSON body"
      },
      {
        status: 400
      }
    );
  }

  const parsedPayload = LemonWebhookSchema.safeParse(parsedJson);

  if (!parsedPayload.success) {
    return NextResponse.json(
      {
        message: "Invalid webhook payload"
      },
      {
        status: 400
      }
    );
  }

  const eventName = parsedPayload.data.meta?.event_name;
  const supportedEvents = new Set([
    "order_created",
    "subscription_created",
    "subscription_payment_success"
  ]);

  if (eventName && supportedEvents.has(eventName)) {
    const email = extractEmail(parsedPayload.data.data?.attributes);

    if (email) {
      await recordPurchase({
        email,
        source: "lemonsqueezy"
      });
    }
  }

  return NextResponse.json({ received: true });
}
