import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface HoldToDeleteProps {
  onConfirm: () => void;
  durationMs?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
  iconClassName?: string;
  title?: string;
  disabled?: boolean;
  stopPropagation?: boolean;
}

/**
 * HoldToDelete — destructive button that requires a press-and-hold
 * to fire (default 700 ms). A circular progress ring fills around the
 * trash icon while held; releasing early cancels.
 */
export function HoldToDelete({
  onConfirm,
  durationMs = 700,
  size = "sm",
  className,
  iconClassName,
  title = "Hold to delete",
  disabled = false,
  stopPropagation = true,
}: HoldToDeleteProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const dims = size === "xs" ? 20 : size === "md" ? 32 : 26;
  const stroke = size === "xs" ? 2 : 2.5;
  const r = dims / 2 - stroke;
  const c = 2 * Math.PI * r;
  const iconSize = size === "xs" ? 12 : size === "md" ? 18 : 14;

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
  }, []);

  const tick = useCallback(
    (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(1, elapsed / durationMs);
      setProgress(p);
      if (p >= 1) {
        if (!firedRef.current) {
          firedRef.current = true;
          onConfirm();
        }
        cleanup();
        // brief flash, then reset
        window.setTimeout(() => setProgress(0), 180);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [durationMs, onConfirm, cleanup],
  );

  const start = useCallback(
    (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
      if (disabled) return;
      if (stopPropagation) e.stopPropagation();
      firedRef.current = false;
      startRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    },
    [disabled, stopPropagation, tick],
  );

  const cancel = useCallback(() => {
    cleanup();
    if (!firedRef.current) setProgress(0);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={title}
            disabled={disabled}
            onPointerDown={start}
            onPointerUp={cancel}
            onPointerLeave={cancel}
            onPointerCancel={cancel}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              "relative inline-flex items-center justify-center rounded-full transition-colors",
              "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
              "disabled:opacity-40 disabled:cursor-not-allowed select-none touch-none",
              progress > 0 && "text-destructive bg-destructive/10",
              className,
            )}
            style={{ width: dims, height: dims }}
          >
            <svg
              className="absolute inset-0 -rotate-90 pointer-events-none"
              width={dims}
              height={dims}
              viewBox={`0 0 ${dims} ${dims}`}
            >
              <circle
                cx={dims / 2}
                cy={dims / 2}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.15}
                strokeWidth={stroke}
              />
              <circle
                cx={dims / 2}
                cy={dims / 2}
                r={r}
                fill="none"
                stroke="currentColor"
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - progress)}
                style={{ transition: progress === 0 ? "stroke-dashoffset 180ms ease-out" : "none" }}
              />
            </svg>
            <Trash2 size={iconSize} className={cn("relative", iconClassName)} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {title}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default HoldToDelete;
