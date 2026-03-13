import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Settings2 } from 'lucide-react';
import { CreatorMode } from '@/hooks/useCreatorMode';

interface CreatorModeToggleProps {
  mode: CreatorMode;
  onModeChange: (mode: CreatorMode) => void;
  className?: string;
}

export function CreatorModeToggle({ mode, onModeChange, className }: CreatorModeToggleProps) {
  return (
    <div className={cn("inline-flex items-center rounded-full border border-border bg-muted p-0.5 gap-0.5", className)}>
      <button
        onClick={() => onModeChange('beginner')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
          mode === 'beginner'
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        Easy
      </button>
      <button
        onClick={() => onModeChange('advanced')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
          mode === 'advanced'
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Settings2 className="w-3.5 h-3.5" />
        Advanced
      </button>
    </div>
  );
}
