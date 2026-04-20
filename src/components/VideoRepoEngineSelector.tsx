import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Film, Layers, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type VideoEngine = 'sora-2' | 'veo3' | 'wan-2.5';

interface VideoRepoEngineSelectorProps {
  engine: VideoEngine;
  onEngineChange: (engine: VideoEngine) => void;
  flowMode: boolean;
  onFlowModeChange: (enabled: boolean) => void;
  flowShots: number;
  onFlowShotsChange: (n: number) => void;
  className?: string;
}

const ENGINES: { value: VideoEngine; label: string; sub: string; icon: React.ComponentType<{ className?: string }>; accent: string }[] = [
  { value: 'sora-2', label: 'Sora-2', sub: 'Cinematic, 10–20s', icon: Film, accent: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 'veo3', label: 'Veo 3', sub: 'Native dialogue + audio', icon: Sparkles, accent: 'border-blue-500/50 bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { value: 'wan-2.5', label: 'Wan 2.5', sub: 'Fast B-roll', icon: Zap, accent: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
];

export const VideoRepoEngineSelector: React.FC<VideoRepoEngineSelectorProps> = ({
  engine,
  onEngineChange,
  flowMode,
  onFlowModeChange,
  flowShots,
  onFlowShotsChange,
  className,
}) => {
  const flowAvailable = engine === 'veo3';
  const totalSeconds = flowShots * 8;

  return (
    <Card className={cn('p-3 bg-background/40 border-border/60 rounded-2xl space-y-3', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Engine</Label>
        {engine === 'veo3' && flowMode && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Layers className="w-3 h-3" /> Flow · {flowShots} shots · ~{totalSeconds}s
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ENGINES.map((e) => {
          const Icon = e.icon;
          const active = engine === e.value;
          return (
            <button
              key={e.value}
              type="button"
              onClick={() => onEngineChange(e.value)}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-colors',
                active
                  ? e.accent
                  : 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/50'
              )}
            >
              <div className="flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">{e.label}</span>
              </div>
              <span className="text-[10px] opacity-80 leading-tight">{e.sub}</span>
            </button>
          );
        })}
      </div>

      <div
        className={cn(
          'flex items-center justify-between rounded-xl border border-border/50 px-3 py-2 transition-opacity',
          !flowAvailable && 'opacity-50'
        )}
      >
        <div className="flex flex-col">
          <Label htmlFor="flow-mode-switch" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            Flow Mode
          </Label>
          <span className="text-[10px] text-muted-foreground">
            {flowAvailable
              ? 'Multi-shot Veo 3, auto-stitched into one video'
              : 'Switch to Veo 3 to enable multi-shot Flow'}
          </span>
        </div>
        <Switch
          id="flow-mode-switch"
          checked={flowMode && flowAvailable}
          onCheckedChange={(v) => onFlowModeChange(v)}
          disabled={!flowAvailable}
        />
      </div>

      {flowAvailable && flowMode && (
        <div className="space-y-2 px-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Shots</Label>
            <span className="text-xs font-semibold tabular-nums">
              {flowShots} × 8s = {totalSeconds}s
            </span>
          </div>
          <Slider
            value={[flowShots]}
            min={2}
            max={6}
            step={1}
            onValueChange={(v) => onFlowShotsChange(v[0] ?? 3)}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>2 (16s)</span>
            <span>6 (48s)</span>
          </div>
        </div>
      )}
    </Card>
  );
};
