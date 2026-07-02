// supabase/functions/stripe-webhook/index.ts
// The function that turns money into credits. Handles the full lifecycle:
//   checkout.session.completed        → activate plan
//   invoice.paid                      → grant monthly credits (initial + renewals)
//   customer.subscription.updated     → plan change / status change
//   customer.subscription.deleted     → downgrade to free
//
// Required secrets:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Required config.toml (webhooks can't carry a user JWT — signature IS the auth):
//   [functions.stripe-webhook]
//   verify_jwt = false
//
// Stripe dashboard → Developers → Webhooks → add endpoint:
//   https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   events: the four listed above.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

// Map a Stripe price back to a plan row.
async function planFromPrice(priceId: string) {
  const { data } = await admin()
    .from("plans")
    .select("id, monthly_credits")
    .eq("stripe_price_id", priceId)
    .maybeSingle();
  return data;
}

// Resolve our user_id from subscription metadata, falling back to customer id.
async function resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.user_id) return sub.metadata.user_id;
  const { data } = await admin()
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", sub.customer as string)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function upsertSubscription(userId: string, sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price?.id;
  const plan = priceId ? await planFromPrice(priceId) : null;
  await admin().from("subscriptions").upsert({
    user_id: userId,
    plan_id: plan?.id ?? "free",
    status: sub.status === "active" || sub.status === "trialing" ? "active"
          : sub.status === "past_due" ? "past_due" : "canceled",
    stripe_customer_id: sub.customer as string,
    stripe_subscription_id: sub.id,
    current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  return plan;
}

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    // constructEventAsync is required in Deno (SubtleCrypto is async)
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
    );
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const db = admin();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        if (!userId || !session.subscription) break;
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertSubscription(userId, sub);
        // Credits are granted by invoice.paid (fires immediately after),
        // so we don't grant here — avoids double-granting.
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;
        const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
        const userId = await resolveUserId(sub);
        if (!userId) { console.error("invoice.paid: no user for", sub.id); break; }

        // Idempotency: never grant twice for the same invoice
        // (Stripe retries webhooks; this guard makes retries safe).
        const marker = `stripe_invoice:${invoice.id}`;
        const { data: already } = await db
          .from("credit_ledger")
          .select("id").eq("note", marker).limit(1);
        if (already && already.length > 0) break;

        const plan = await upsertSubscription(userId, sub);
        const credits = plan?.monthly_credits ?? 0;
        if (credits > 0) {
          await db.rpc("grant_credits", {
            p_user: userId,
            p_amount: credits,
            p_note: marker,
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(sub);
        if (userId) await upsertSubscription(userId, sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(sub);
        if (userId) {
          await db.from("subscriptions").update({
            plan_id: "free",
            status: "canceled",
            stripe_subscription_id: null,
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);
          // Existing credits are kept until spent — kinder than clawing back,
          // and simpler to reason about. They just stop refreshing.
        }
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`stripe-webhook error on ${event.type}:`, err);
    // 500 → Stripe retries automatically. Idempotency guard makes that safe.
    return new Response("Handler error", { status: 500 });
  }
});
