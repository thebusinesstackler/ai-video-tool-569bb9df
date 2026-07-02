// src/hooks/useCredits.ts
// Live credit balance + plan + per-tool costs, with realtime updates.
// Balance updates the moment a reservation/settle/refund happens server-side.

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export interface PlanInfo {
  id: string;
  name: string;
  monthly_credits: number;
  price_usd_month: number;
  features: Record<string, unknown>;
}

export function useCredits() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const balanceQuery = useQuery({
    queryKey: ["credits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_balances")
        .select("balance, reserved")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data ?? { balance: 0, reserved: 0 };
    },
  });

  const planQuery = useQuery({
    queryKey: ["plan", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("plan_id, status, current_period_end, plans(id, name, monthly_credits, price_usd_month, features)")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const costsQuery = useQuery({
    queryKey: ["tool_costs"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("tool_costs").select("tool_key, display_name, cost");
      if (error) throw error;
      return Object.fromEntries(data.map((c) => [c.tool_key, c]));
    },
  });

  // Realtime: refresh the instant the ledger changes for this user
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`credits-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "credit_balances", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["credits", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const balance = balanceQuery.data?.balance ?? 0;
  const reserved = balanceQuery.data?.reserved ?? 0;
  const available = Math.max(balance - reserved, 0);
  const plan = (planQuery.data?.plans as unknown as PlanInfo) ?? null;
  const monthly = plan?.monthly_credits ?? 100;

  return useMemo(
    () => ({
      isLoading: balanceQuery.isLoading || planQuery.isLoading,
      balance,
      reserved,
      available,
      monthlyAllowance: monthly,
      usedPct: monthly > 0 ? Math.min(100, Math.round(((monthly - available) / monthly) * 100)) : 100,
      plan,
      planName: plan?.name ?? "Free",
      isFree: (plan?.id ?? "free") === "free",
      renewsAt: planQuery.data?.current_period_end ?? null,
      costs: costsQuery.data ?? {},
      costOf: (toolKey: string, multiplier = 1) =>
        (costsQuery.data?.[toolKey]?.cost ?? 0) * multiplier,
      canAfford: (toolKey: string, multiplier = 1) =>
        available >= (costsQuery.data?.[toolKey]?.cost ?? 0) * multiplier,
    }),
    [balanceQuery.isLoading, planQuery.isLoading, balance, reserved, available, monthly, plan, planQuery.data, costsQuery.data],
  );
}
