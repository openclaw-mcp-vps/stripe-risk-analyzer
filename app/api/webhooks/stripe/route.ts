import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

import { recordPurchase } from "@/lib/database";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  appInfo: {
    name: "Stripe Risk Analyzer",
    version: "1.0.0"
  }
});

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      {
        message: "STRIPE_WEBHOOK_SECRET is not configured"
      },
      {
        status: 500
      }
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        message: "Missing stripe-signature header"
      },
      {
        status: 400
      }
    );
  }

  const body = await request.text();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Invalid webhook signature"
      },
      {
        status: 400
      }
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerEmail = session.customer_details?.email ?? session.customer_email;

    if (customerEmail) {
      await recordPurchase({
        email: customerEmail,
        source: "stripe",
        customerId: typeof session.customer === "string" ? session.customer : undefined,
        sessionId: session.id,
        eventId: event.id
      });
    }
  }

  return NextResponse.json({ received: true });
}
