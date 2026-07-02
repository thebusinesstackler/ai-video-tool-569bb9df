// supabase/functions/_shared/credits.ts
// Drop-in credit guard for every paid edge function.
//
// Usage inside any function (3 lines):
//
//   const guard = await requireCredits(req, "reel_video", { multiplier: sceneCount });
//   if (!guard.ok) return guard.response;           // 401 or 402 already built
//   ... run the expensive work ...
//   await guard.settle();                            // on success
//   // in your catch block:  await guard.refund("what went wrong");
//
// For async jobs (WaveSpeed/Creatomate/Vizard webhooks): call requireCredits
// with { jobId } at submit time, then call settleJob()/refundJob() from the
// webhook handler when the vendor reports completed/failed.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

export const corsHeaders = {
  // TODO before launch: replace * with your real origins
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function admin(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

export interface CreditGuard {
  ok: boolean;
  response: Response;          // ready-made 401/402 when !ok
  userId: string;
  jobId: string;
  cost: number;
  remaining: number;
  settle: () => Promise<void>;
  refund: (note?: string) => Promise<void>;
}

export async function requireCredits(
  req: Request,
  toolKey: string,
  opts: { multiplier?: number; jobId?: string } = {},
): Promise<CreditGuard> {
  const fail = (status: number, error: string, extra: Record<string, unknown> = {}): CreditGuard => ({
    ok: false,
    response: json({ error, ...extra }, status),
    userId: "", jobId: "", cost: 0, remaining: 0,
    settle: async () => {}, refund: async () => {},
  });

  // 1. Identify the user from their JWT
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return fail(401, "Please sign in to continue.");

  // 2. Reserve credits (race-safe, server-side)
  const jobId = opts.jobId ?? crypto.randomUUID();
  const db = admin();
  const { data, error } = await db.rpc("reserve_credits", {
    p_user: user.id,
    p_tool: toolKey,
    p_job: jobId,
    p_multiplier: opts.multiplier ?? 1,
  });
  if (error) {
    console.error("reserve_credits failed:", error);
    return fail(500, "Could not verify your credits. Please try again.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.ok) {
    return fail(402, "Not enough credits for this generation.", {
      code: "INSUFFICIENT_CREDITS",
      required: row?.cost,
      available: row?.balance,
      upgradeUrl: "/settings?tab=billing",
    });
  }

  return {
    ok: true,
    response: json({ ok: true }),
    userId: user.id,
    jobId,
    cost: row.cost,
    remaining: row.balance,
    settle: async () => {
      const { error: e } = await db.rpc("settle_credits", { p_user: user.id, p_job: jobId });
      if (e) console.error("settle_credits failed:", e);
    },
    refund: async (note = "generation failed") => {
      const { error: e } = await db.rpc("refund_credits", { p_user: user.id, p_job: jobId, p_note: note });
      if (e) console.error("refund_credits failed:", e);
    },
  };
}

// For webhook handlers (no user JWT available) — settle/refund by jobId.
export async function settleJob(userId: string, jobId: string) {
  const { error } = await admin().rpc("settle_credits", { p_user: userId, p_job: jobId });
  if (error) console.error("settleJob failed:", error);
}
export async function refundJob(userId: string, jobId: string, note = "vendor reported failure") {
  const { error } = await admin().rpc("refund_credits", { p_user: userId, p_job: jobId, p_note: note });
  if (error) console.error("refundJob failed:", error);
}

/* ============================================================
   EXAMPLE PATCH — supabase/functions/wavespeed-video/index.ts
   ============================================================

import { requireCredits } from "../_shared/credits.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const guard = await requireCredits(req, "scene_video");
  if (!guard.ok) return guard.response;

  try {
    // ... existing WaveSpeed submission logic ...
    // Store guard.userId + guard.jobId on the video_tasks row so the
    // webhook can settle/refund later:
    //   await db.from("video_tasks").update({ credit_job_id: guard.jobId }).eq("id", taskId);

    // If generation completes synchronously in this function:
    await guard.settle();
    return jsonResponse(result);
  } catch (err) {
    await guard.refund(String(err));
    // NEVER surface vendor names to users:
    return jsonResponse({ error: "Video generation failed — your credits were refunded automatically. Please try again." }, 500);
  }
});

   And in wavespeed-webhook/index.ts, on vendor callback:
     status === "completed" ? settleJob(task.user_id, task.credit_job_id)
                            : refundJob(task.user_id, task.credit_job_id);
   ============================================================ */
