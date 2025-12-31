import { ReadinessCheck } from '@/types/testimonialCommercial';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SegmentReadinessChecklistProps {
  checks: ReadinessCheck[];
  compact?: boolean;
}

export function SegmentReadinessChecklist({ checks, compact = false }: SegmentReadinessChecklistProps) {
  if (compact) {
    const requiredIncomplete = checks.filter(c => c.isRequired && !c.isComplete);
    const allComplete = requiredIncomplete.length === 0;
    
    if (allComplete) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-emerald-500">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Ready</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-500">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{requiredIncomplete.length} required</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-3 bg-muted/30 rounded-lg border border-border/50">
      <p className="text-xs font-medium text-muted-foreground mb-2">Requirements</p>
      {checks.map((check) => (
        <div 
          key={check.id} 
          className={cn(
            "flex items-start gap-2 text-sm",
            check.isComplete ? "text-emerald-500" : check.isRequired ? "text-muted-foreground" : "text-muted-foreground/60"
          )}
        >
          {check.isComplete ? (
            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : check.isRequired ? (
            <Circle className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <Circle className="h-4 w-4 mt-0.5 shrink-0 opacity-50" />
          )}
          <div className="flex-1">
            <span className={cn(!check.isRequired && "opacity-60")}>
              {check.label}
              {!check.isRequired && <span className="text-xs ml-1">(optional)</span>}
            </span>
            {!check.isComplete && check.hint && (
              <p className="text-xs text-muted-foreground/70 mt-0.5">{check.hint}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
