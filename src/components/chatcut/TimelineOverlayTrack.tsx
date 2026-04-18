import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Loader2, ImageIcon, Layers, Sparkles, Trash2, Film, Captions, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Generic timeline track for overlays. We render three flavors of this
 * (Motion Graphics, Image Graphics, Text Overlays) so the user can tell at a
 * glance what each clip is, and toggle them independently in the preview.
 */
export interface TimelineOverlayTrackProps {
  kind: 'motion' | 'image' | 'overlay';
  label: string;
  /** Color theme key — drives the border/bg/text accent colors */
  color: 'purple' | 'blue' | 'pink';
  items: Array<{
    id: string;
    text: string;
    start: number;
    duration: number;
    hidden?: boolean;
    imageUrl?: string;
    imageStatus?: 'generating' | 'ready' | 'failed';
    videoStatus?: 'generating' | 'ready' | 'failed';
  }>;
  duration: number;
  laneOf: (id: string) => number;
  laneCount: number;
  overlapIds: Set<string>;
  trackVisible: boolean;
  onToggleTrack: () => void;
  onSeek: (t: number) => void;
  onDragClip: (
    e: React.MouseEvent<HTMLDivElement>,
    id: string,
    mode: 'move' | 'resize-left' | 'resize-right',
  ) => void;
  onToggleClipHidden: (id: string) => void;
  onDelete: (id: string) => void;
  /** Caption indicator shown only on the 'overlay' (text) track. */
  captionsEnabled?: boolean;
  captionsStyleLabel?: string;
  /** Optional "Add image" affordance — currently used by the Graphic track. */
  onAddImage?: () => void;
}

const colorPresets = {
  purple: {
    label: 'text-purple-400',
    icon: 'text-purple-300',
    item: 'text-purple-100',
    dur: 'text-purple-300/70',
    handle: 'bg-purple-400/0 hover:bg-purple-400/70',
    btn: 'text-purple-200',
    bgGen: 'bg-purple-500/10 border-purple-500/30',
    bgReady: 'bg-purple-500/30 border-purple-500/60 hover:bg-purple-500/40',
    bgIdle: 'bg-purple-500/25 border-purple-500/50 hover:bg-purple-500/35',
    captionBg: 'bg-purple-500/15 border-purple-500/30',
    captionText: 'text-purple-300',
    captionIcon: 'text-purple-400',
    badge: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  blue: {
    label: 'text-blue-400',
    icon: 'text-blue-300',
    item: 'text-blue-100',
    dur: 'text-blue-300/70',
    handle: 'bg-blue-400/0 hover:bg-blue-400/70',
    btn: 'text-blue-200',
    bgGen: 'bg-blue-500/10 border-blue-500/30',
    bgReady: 'bg-blue-500/30 border-blue-500/60 hover:bg-blue-500/40',
    bgIdle: 'bg-blue-500/25 border-blue-500/50 hover:bg-blue-500/35',
    captionBg: 'bg-blue-500/15 border-blue-500/30',
    captionText: 'text-blue-300',
    captionIcon: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  pink: {
    label: 'text-pink-400',
    icon: 'text-pink-300',
    item: 'text-pink-100',
    dur: 'text-pink-300/70',
    handle: 'bg-pink-400/0 hover:bg-pink-400/70',
    btn: 'text-pink-200',
    bgGen: 'bg-pink-500/10 border-pink-500/30',
    bgReady: 'bg-pink-500/30 border-pink-500/60 hover:bg-pink-500/40',
    bgIdle: 'bg-pink-500/25 border-pink-500/50 hover:bg-pink-500/35',
    captionBg: 'bg-pink-500/15 border-pink-500/30',
    captionText: 'text-pink-300',
    captionIcon: 'text-pink-400',
    badge: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  },
} as const;

export const TimelineOverlayTrack: React.FC<TimelineOverlayTrackProps> = ({
  kind, label, color, items, duration, laneOf, laneCount, overlapIds,
  trackVisible, onToggleTrack, onSeek, onDragClip, onToggleClipHidden,
  onDelete, captionsEnabled, captionsStyleLabel, onAddImage,
}) => {
  const c = colorPresets[color];
  const rowH = Math.max(40, 12 + laneCount * 22);
  const Icon = kind === 'motion' ? Film : kind === 'image' ? ImageIcon : Sparkles;

  return (
    <div
      className="flex items-stretch border-b border-border/50 group hover:bg-muted/20"
      style={{ height: `${rowH}px` }}
    >
      <div className="w-[80px] flex-shrink-0 flex items-center gap-1 px-2" title={`${label} — ${kind === 'motion' ? 'animated VEO graphics' : kind === 'image' ? 'static image graphics' : 'text overlays & captions'}`}>
        <span className={cn('text-[10px] font-semibold truncate', c.label)}>{label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 opacity-60 hover:opacity-100"
          onClick={onToggleTrack}
          title={trackVisible
            ? `Hide ${label.toLowerCase()} from video preview (track stays on timeline)`
            : `Show ${label.toLowerCase()} in video preview`}
        >
          {trackVisible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 text-muted-foreground" />}
        </Button>
        {onAddImage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 opacity-60 hover:opacity-100"
            onClick={onAddImage}
            title="Upload an image to this track (placed at the playhead)"
          >
            <Plus className="w-2.5 h-2.5" />
          </Button>
        )}
        {kind === 'overlay' && captionsEnabled && (
          <Badge className={cn('text-[7px] px-1 py-0 h-3', c.badge)}>CC</Badge>
        )}
      </div>
      <div className="flex-1 relative my-1 mx-1" data-overlay-track data-overlay-kind={kind}>
        {items.length > 0 ? (
          items.map((ov) => {
            const laneIdx = laneOf(ov.id);
            const previewHidden = !trackVisible || ov.hidden;
            const status = ov.imageStatus === 'generating' || ov.videoStatus === 'generating'
              ? 'generating'
              : ov.imageStatus === 'ready' || ov.videoStatus === 'ready' ? 'ready' : 'idle';
            return (
              <div
                key={ov.id}
                className={cn(
                  'absolute rounded border flex items-center cursor-grab active:cursor-grabbing transition-colors group/clip select-none',
                  previewHidden && 'opacity-40',
                  overlapIds.has(ov.id) && 'ring-2 ring-red-500 ring-offset-1 ring-offset-background',
                  status === 'generating' ? cn(c.bgGen, 'animate-pulse')
                    : status === 'ready' ? c.bgReady
                    : c.bgIdle,
                )}
                style={{
                  left: `${(ov.start / Math.max(duration, 1)) * 100}%`,
                  width: `${(ov.duration / Math.max(duration, 1)) * 100}%`,
                  top: `${laneIdx * 22}px`,
                  height: '20px',
                }}
                onClick={() => onSeek(ov.start)}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  const target = e.target as HTMLElement;
                  if (target.closest('[data-overlay-handle]') || target.closest('button')) return;
                  onDragClip(e, ov.id, 'move');
                }}
                title={`${ov.text} — drag body to move, drag edges to trim · drag on the video preview to reposition (start ${ov.start.toFixed(1)}s · ${ov.duration.toFixed(1)}s long)${previewHidden ? ' · hidden in preview' : ''}`}
              >
                <div
                  data-overlay-handle
                  className={cn('absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize rounded-l z-10', c.handle)}
                  onMouseDown={(e) => onDragClip(e, ov.id, 'resize-left')}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex items-center px-2 flex-1 min-w-0 pointer-events-none">
                  {status === 'generating' ? (
                    <Loader2 className={cn('w-3 h-3 mr-1.5 flex-shrink-0 animate-spin', c.icon)} />
                  ) : kind === 'image' && ov.imageUrl ? (
                    <ImageIcon className={cn('w-3 h-3 mr-1.5 flex-shrink-0', c.icon)} />
                  ) : kind === 'motion' ? (
                    <Film className={cn('w-3 h-3 mr-1.5 flex-shrink-0', c.icon)} />
                  ) : (
                    <Icon className={cn('w-3 h-3 mr-1.5 flex-shrink-0', c.icon)} />
                  )}
                  <span className={cn('text-[11px] font-medium truncate flex-1 leading-tight', c.item)}>{ov.text}</span>
                  <span className={cn('text-[9px] ml-1 flex-shrink-0 tabular-nums', c.dur)}>{ov.duration.toFixed(1)}s</span>
                </div>
                <button
                  className="hidden group-hover/clip:flex w-4 h-4 items-center justify-center rounded bg-background/70 hover:bg-background flex-shrink-0 mr-1 z-10 relative"
                  onClick={(e) => { e.stopPropagation(); onToggleClipHidden(ov.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={ov.hidden ? 'Show this clip in preview' : 'Hide this clip from preview (stays on timeline)'}
                >
                  {ov.hidden ? <EyeOff className="w-2 h-2 text-muted-foreground" /> : <Eye className={cn('w-2 h-2', c.btn)} />}
                </button>
                <button
                  className="hidden group-hover/clip:flex w-4 h-4 items-center justify-center rounded bg-destructive/80 hover:bg-destructive flex-shrink-0 mr-1 z-10 relative"
                  onClick={(e) => { e.stopPropagation(); onDelete(ov.id); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Delete"
                >
                  <Trash2 className="w-2 h-2 text-white" />
                </button>
                <div
                  data-overlay-handle
                  className={cn('absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize rounded-r z-10', c.handle)}
                  onMouseDown={(e) => onDragClip(e, ov.id, 'resize-right')}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            );
          })
        ) : kind === 'overlay' && captionsEnabled ? (
          <div className={cn('absolute inset-y-0 left-0 right-0 rounded border flex items-center px-2', c.captionBg)}>
            <Captions className={cn('w-3 h-3 mr-1.5', c.captionIcon)} />
            <span className={cn('text-[10px]', c.captionText)}>Captions — {captionsStyleLabel?.toUpperCase()}</span>
          </div>
        ) : (
          <div className="absolute inset-0 border border-dashed border-border/30 rounded" />
        )}
      </div>
      <div className="w-10 flex-shrink-0" />
    </div>
  );
};
