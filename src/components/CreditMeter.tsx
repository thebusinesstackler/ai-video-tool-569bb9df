// src/components/CreditMeter.tsx
// Premium sidebar credit widget + a CostBadge to put on every Generate button.
//
// Sidebar:   <CreditMeter />                      (drop into Navigation.tsx footer)
// Buttons:   <Button>Generate <CostBadge tool="reel_video" multiplier={sceneCount} /></Button>
//
// Copy rules baked in:
//  - Never says "Running low" at 0. At 0 on Free it invites upgrade positively.
//  - Shows what's reserved by in-flight jobs so the number never "jumps" mysteriously.
//  - Cost is visible BEFORE the click, so a deduction never surprises the user.

import React from "react";
import { Link } from "react-router-dom";
import { Zap, ArrowUpRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCredits } from "@/hooks/useCredits";

export function CreditMeter({ collapsed = false }: { collapsed?: boolean }) {
  const { isLoading, available, reserved, monthlyAllowance, usedPct, planName, isFree, renewsAt } = useCredits();

  if (isLoading) {
    return (
      <div className="mx-3 mb-3 rounded-xl border border-border/60 bg-card/60 p-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (collapsed) {
    return (
      <Link
        to="/settings?tab=billing"
        className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-card/60 text-xs font-semibold hover:border-primary/50 transition-colors"
        title={`${available} credits available`}
      >
        <span className="flex items-center gap-0.5">
          <Zap className="h-3 w-3 text-primary" />
          {available > 999 ? `${Math.floor(available / 1000)}k` : available}
        </span>
      </Link>
    );
  }

  const low = available > 0 && available <= monthlyAllowance * 0.15;
  const empty = available === 0;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-border/60 bg-gradient-to-b from-card to-card/40 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {planName} plan
        </span>
        <Link
          to="/settings?tab=billing"
          className="group flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
        >
          {isFree ? "Upgrade" : "Manage"}
          <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <Zap className="h-4 w-4 self-center text-primary" />
        <span className={cn("text-2xl font-bold tabular-nums tracking-tight", empty && "text-muted-foreground")}>
          {available.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">/ {monthlyAllowance.toLocaleString()}</span>
      </div>

      {/* usage bar */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700 ease-out",
            empty ? "bg-muted-foreground/30" : low ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${100 - usedPct}%` }}
        />
      </div>

      {reserved > 0 && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {reserved} held by jobs in progress
        </p>
      )}

      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {empty && isFree && "You've used this month's free credits. Plans start at $29/mo."}
        {empty && !isFree && renewsAt && `Credits refresh ${new Date(renewsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`}
        {!empty && low && "Heads up — you're in your last 15%."}
        {!empty && !low && renewsAt && `Refreshes ${new Date(renewsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.`}
      </p>
    </div>
  );
}

/** Put this inside every Generate button so cost is never a surprise. */
export function CostBadge({ tool, multiplier = 1 }: { tool: string; multiplier?: number }) {
  const { costOf, canAfford } = useCredits();
  const cost = costOf(tool, multiplier);
  if (!cost) return null;
  const affordable = canAfford(tool, multiplier);
  return (
    <span
      className={cn(
        "ml-2 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        affordable ? "bg-white/15" : "bg-destructive/20 text-destructive",
      )}
      title={affordable ? `This will use ${cost} credits` : `Needs ${cost} credits — you don't have enough`}
    >
      <Zap className="h-3 w-3" />
      {cost}
    </span>
  );
}

/** Guard for click handlers: shows the paywall instead of firing a 402. */
export function useCreditGate() {
  const { canAfford, costOf } = useCredits();
  return (tool: string, multiplier = 1): { allowed: boolean; needed: number } => ({
    allowed: canAfford(tool, multiplier),
    needed: costOf(tool, multiplier),
  });
}
