// supabase/functions/create-checkout/index.ts
// Creates a Stripe Checkout session for a plan upgrade.
// Frontend: supabase.functions.invoke('create-checkout', { body: { planId: 'creator' } })
// → redirect user to data.url
//
// Required secrets (Supabase dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY   (sk_live_... or sk_test_...)
// Required config.toml:
//   [functions.create-checkout]
//   verify_jwt = true

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain before launch
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { planId } = await req.json();
    if (!planId || planId === "free") return json({ error: "Invalid plan." }, 400);

    // 1. Who is upgrading?
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user?.email) return json({ error: "Please sign in first." }, 401);

    // 2. Look up the plan's Stripe price (source of truth = plans table)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: plan } = await admin
      .from("plans")
      .select("id, name, stripe_price_id")
      .eq("id", planId)
      .single();
    if (!plan?.stripe_price_id) {
      return json({ error: "This plan isn't available yet." }, 400);
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2023-10-16",
    });

    // 3. Reuse the Stripe customer if we've seen this user before
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = existing.data[0]?.id;
    }

    const origin = req.headers.get("origin") ?? "https://videoaipro.studio";

    // 4. Create the session. metadata.user_id is how the webhook links back.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/settings?tab=billing&upgraded=1`,
      cancel_url: `${origin}/settings?tab=billing`,
      metadata: { user_id: user.id, plan_id: plan.id },
      subscription_data: {
        metadata: { user_id: user.id, plan_id: plan.id },
      },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("create-checkout error:", err);
    return json({ error: "Could not start checkout. Please try again." }, 500);
  }
});
