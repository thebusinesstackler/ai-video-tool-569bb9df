import { CommercialSegment } from '@/types/testimonialCommercial';
import { User, Film, Clapperboard } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TimelinePreviewProps {
  segments: CommercialSegment[];
}

const segmentConfig = {
  'twin-speaking': {
    label: 'AI Twin Speaking',
    color: 'bg-primary',
    icon: User,
  },
  'broll-voice-continue': {
    label: 'B-Roll (Voice Continues)',
    color: 'bg-amber-500',
    icon: Film,
  },
  'broll-montage': {
    label: 'B-Roll Montage',
    color: 'bg-emerald-500',
    icon: Clapperboard,
  },
};

export function TimelinePreview({ segments }: TimelinePreviewProps) {
  if (segments.length === 0) return null;

  const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Timeline Preview</span>
        <span className="font-medium">{formatDuration(totalDuration)} total</span>
      </div>

      {/* Timeline Bar */}
      <TooltipProvider delayDuration={100}>
        <div className="flex h-10 rounded-lg overflow-hidden border bg-muted/30">
          {segments.map((segment, index) => {
            const config = segmentConfig[segment.type];
            const widthPercent = totalDuration > 0 ? (segment.duration / totalDuration) * 100 : 0;
            const Icon = config.icon;

            return (
              <Tooltip key={segment.id}>
                <TooltipTrigger asChild>
                  <div
                    className={`${config.color} flex items-center justify-center gap-1 transition-all hover:brightness-110 cursor-pointer relative group`}
                    style={{ width: `${widthPercent}%`, minWidth: widthPercent > 0 ? '24px' : '0' }}
                  >
                    <Icon className="h-4 w-4 text-white shrink-0" />
                    {widthPercent > 12 && (
                      <span className="text-xs text-white font-medium">
                        {segment.duration}s
                      </span>
                    )}
                    {/* Segment divider */}
                    {index < segments.length - 1 && (
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-background/30" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">{config.label}</div>
                  <div className="text-muted-foreground">
                    {segment.duration}s • Segment {index + 1}
                  </div>
                  {segment.type === 'twin-speaking' && segment.script && (
                    <div className="max-w-[200px] truncate text-muted-foreground mt-1">
                      "{segment.script.slice(0, 50)}..."
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(segmentConfig).map(([type, config]) => {
          const count = segments.filter(s => s.type === type).length;
          if (count === 0) return null;
          const Icon = config.icon;
          return (
            <div key={type} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${config.color}`} />
              <Icon className="h-3 w-3" />
              <span>{config.label} ({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
