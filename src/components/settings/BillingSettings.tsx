import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, Check, Loader2, Receipt, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function BillingSettings() {
  const { available, monthlyAllowance, planName, plan, isFree, renewsAt } = useCredits();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["all_plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plans").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: ledger } = useQuery({
    queryKey: ["ledger_recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_ledger")
        .select("amount, kind, tool_key, note, created_at, tool_costs(display_name)")
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data;
    },
  });

  const startCheckout = async (planId: string) => {
    setBusy(planId);
    const { data, error } = await supabase.functions.invoke("create-checkout", { body: { planId } });
    setBusy(null);
    if (error || !data?.url) {
      toast({ title: "Checkout unavailable", description: "Please try again in a moment.", variant: "destructive" });
      return;
    }
    window.location.href = data.url;
  };

  const openPortal = async () => {
    setBusy("portal");
    const { data, error } = await supabase.functions.invoke("customer-portal");
    setBusy(null);
    if (error || !data?.url) {
      toast({ title: "Couldn't open billing portal", variant: "destructive" });
      return;
    }
    window.location.href = data.url;
  };

  return (
    <div className="space-y-8">
      {/* Current plan summary */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-xl font-bold">{planName}</p>
            {renewsAt && !isFree && (
              <p className="text-xs text-muted-foreground">
                Renews {new Date(renewsAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-2xl font-bold tabular-nums">
              <Zap className="h-5 w-5 text-primary" /> {available.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">of {monthlyAllowance.toLocaleString()} credits left</p>
          </div>
          {!isFree && (
            <Button variant="outline" onClick={openPortal} disabled={busy === "portal"}>
              {busy === "portal" ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Receipt className="mr-1.5 h-4 w-4" /> Manage billing</>}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Plan grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans?.map((p) => {
          const isCurrent = p.id === (plan?.id ?? "free");
          const isPopular = p.id === "pro";
          return (
            <Card key={p.id} className={cn("relative flex flex-col", isPopular && "border-primary shadow-lg shadow-primary/10")}>
              {isPopular && (
                <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Most popular</Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <p className="text-2xl font-bold">
                  ${p.price_usd_month}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-2">
                <p className="flex items-center gap-1.5 text-sm">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  {p.monthly_credits.toLocaleString()} credits / month
                </p>
                <p className="flex items-center gap-1.5 text-sm">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  {p.features?.watermark ? "Watermarked exports" : "No watermark"}
                </p>
                <p className="flex items-center gap-1.5 text-sm">
                  <Check className="h-3.5 w-3.5 text-primary" />
                  Videos up to {Math.round((p.features?.max_video_seconds ?? 30) / 60) || 1} min
                </p>
                <div className="mt-auto pt-3">
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"}
                    disabled={isCurrent || p.id === "free" || busy === p.id}
                    onClick={() => startCheckout(p.id)}
                  >
                    {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : isCurrent ? "Current plan" : `Get ${p.name}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage ledger — the transparency users never get elsewhere */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent activity</CardTitle></CardHeader>
        <CardContent className="divide-y divide-border/60">
          {ledger?.filter((l) => l.kind !== "settle").map((l, i) => (
            <div key={i} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">
                {l.kind === "grant" && (l.note?.startsWith("stripe") ? "Monthly credits added" : l.note ?? "Credits added")}
                {l.kind === "reserve" && (l.tool_costs?.display_name ?? l.tool_key)}
                {l.kind === "refund" && `Refunded — ${l.note ?? "generation failed"}`}
              </span>
              <span className={cn("tabular-nums font-medium", l.amount > 0 ? "text-emerald-500" : "text-foreground")}>
                {l.amount > 0 ? "+" : ""}{l.amount}
              </span>
            </div>
          ))}
          {(!ledger || ledger.length === 0) && (
            <p className="py-4 text-sm text-muted-foreground">Your credit activity will appear here.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
