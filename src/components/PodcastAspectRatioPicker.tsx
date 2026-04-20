import { Smartphone, Monitor, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

export type PodcastAspectRatio = '9:16' | '16:9' | '1:1';

interface Props {
  value: PodcastAspectRatio;
  onChange: (v: PodcastAspectRatio) => void;
  className?: string;
}

const OPTIONS: {
  value: PodcastAspectRatio;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  preview: string;
}[] = [
  { value: '9:16', label: '9:16 Portrait', hint: 'TikTok / Reels / Shorts', icon: Smartphone, preview: 'w-4 h-7' },
  { value: '16:9', label: '16:9 Landscape', hint: 'YouTube / web', icon: Monitor, preview: 'w-7 h-4' },
  { value: '1:1', label: '1:1 Square', hint: 'Instagram feed', icon: Square, preview: 'w-5 h-5' },
];

export function PodcastAspectRatioPicker({ value, onChange, className }: Props) {
  return (
    <div className={cn('space-y-2', className)}>
      <Label className="text-sm font-medium">Aspect Ratio</Label>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value: v, label, hint, icon: Icon, preview }) => {
          const active = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors',
                active
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/50 hover:bg-muted/40',
              )}
            >
              <div className="flex h-8 items-center justify-center">
                <div className={cn('rounded-sm border-2', preview, active ? 'border-primary' : 'border-muted-foreground')} />
              </div>
              <div className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                <span className="text-xs font-semibold">{label}</span>
              </div>
              <span className="text-[10px] text-muted-foreground leading-tight">{hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
