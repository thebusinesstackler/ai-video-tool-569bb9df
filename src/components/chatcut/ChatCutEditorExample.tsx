/**
 * ChatCutEditorExample
 * --------------------
 * Example integration of all new ChatCut improvements.
 * This shows how to wire up the new components together.
 * 
 * Copy this pattern into your existing TimelineEditor component.
 */

import React, { useState, useRef, useMemo } from 'react';
import { WaveformVisualization } from './WaveformVisualization';
import { TimelineZoomControls } from './TimelineZoomControls';
import { TimelineRuler } from './TimelineRuler';
import { SnapGuides, useSnapToGrid } from './SnapGuides';
import { SmartCutSuggestions, generateSmartCutSuggestions } from './SmartCutSuggestions';
import { TimelineSplitTool } from './TimelineSplitTool';
import { useTimelineKeyboardShortcuts } from '@/hooks/useTimelineKeyboardShortcuts';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ExampleProps {
  audioUrl: string;
  duration: number;
  onSave: () => void;
}

export const ChatCutEditorExample: React.FC<ExampleProps> = ({
  audioUrl,
  duration,
  onSave,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);

  // State
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [razorActive, setRazorActive] = useState(false);
  const [clips, setClips] = useState([
    { id: 'clip-1', startTime: 0, endTime: 10 },
    { id: 'clip-2', startTime: 10, endTime: 20 },
    { id: 'clip-3', startTime: 20, endTime: 30 },
  ]);
  const [cutSuggestions, setCutSuggestions] = useState<any[]>([]);

  const PIXELS_PER_SECOND = 80;

  // Snap to grid
  const clipStartTimes = clips.map(c => c.startTime);
  const clipEndTimes = clips.map(c => c.endTime);
  const { snapTo, snapPoints } = useSnapToGrid(
    duration,
    clipStartTimes,
    clipEndTimes,
    [currentTime], // markers
    1, // grid interval
    0.1, // tolerance
    true // enabled
  );

  // Keyboard shortcuts
  useTimelineKeyboardShortcuts({
    onPlayPause: () => setIsPlaying(!isPlaying),
    onStepForward: () => setCurrentTime(t => Math.min(t + 0.1, duration)),
    onStepBackward: () => setCurrentTime(t => Math.max(t - 0.1, 0)),
    onToggleRazor: () => setRazorActive(!razorActive),
    onSplitAtPlayhead: handleSplit,
    onZoomIn: () => setZoom(z => Math.min(z * 1.5, 20)),
    onZoomOut: () => setZoom(z => Math.max(z / 1.5, 0.25)),
    onFitToWindow: () => setZoom(1),
    onCenterPlayhead: () => {
      // Center playhead in viewport
      if (timelineRef.current) {
        const playheadX = currentTime * PIXELS_PER_SECOND * zoom;
        const containerWidth = timelineRef.current.clientWidth;
        timelineRef.current.scrollLeft = playheadX - containerWidth / 2;
      }
    },
    onSave,
    disabled: false,
  });

  // Load smart cut suggestions
  React.useEffect(() => {
    generateSmartCutSuggestions(audioUrl, duration).then(setCutSuggestions);
  }, [audioUrl, duration]);

  // Handlers
  const handleSplit = () => {
    console.log('Split at', currentTime);
    // Find clip that contains currentTime and split it
    const clipIndex = clips.findIndex(
      c => currentTime >= c.startTime && currentTime < c.endTime
    );
    if (clipIndex >= 0) {
      const clip = clips[clipIndex];
      const newClips = [
        ...clips.slice(0, clipIndex),
        { ...clip, endTime: currentTime, id: `${clip.id}-a` },
        { ...clip, startTime: currentTime, id: `${clip.id}-b` },
        ...clips.slice(clipIndex + 1),
      ];
      setClips(newClips);
      setRazorActive(false);
    }
  };

  const handleApplyCut = (time: number) => {
    setCurrentTime(time);
    handleSplit();
  };

  const handleApplyAllCuts = () => {
    // Apply all suggestions (sort descending so indices don't shift)
    const sortedSuggestions = [...cutSuggestions].sort((a, b) => b.time - a.time);
    sortedSuggestions.forEach(s => {
      setCurrentTime(s.time);
      handleSplit();
    });
  };

  const handleFitToWindow = () => {
    if (!timelineRef.current) return;
    const containerWidth = timelineRef.current.clientWidth;
    const neededWidth = duration * PIXELS_PER_SECOND;
    const newZoom = containerWidth / neededWidth;
    setZoom(newZoom);
  };

  const handleCenterPlayhead = () => {
    if (!timelineRef.current) return;
    const playheadX = currentTime * PIXELS_PER_SECOND * zoom;
    const containerWidth = timelineRef.current.clientWidth;
    timelineRef.current.scrollLeft = playheadX - containerWidth / 2;
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen bg-background">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b border-border">
          <h1 className="text-xl font-bold">ChatCut AI Editor</h1>
          
          {/* Zoom Controls */}
          <TimelineZoomControls
            zoom={zoom}
            onZoomChange={setZoom}
            onFitToWindow={handleFitToWindow}
            onCenterPlayhead={handleCenterPlayhead}
          />

          {/* Split Tool */}
          <TimelineSplitTool
            active={razorActive}
            onToggle={setRazorActive}
            currentTime={currentTime}
            onSplit={handleSplit}
          />

          <div className="flex-1" />

          {/* Playback controls */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Ruler */}
          <TimelineRuler
            duration={duration}
            zoom={zoom}
            pixelsPerSecond={PIXELS_PER_SECOND}
            currentTime={currentTime}
            onSeek={setCurrentTime}
          />

          {/* Timeline tracks */}
          <div
            ref={timelineRef}
            className="flex-1 overflow-auto relative"
          >
            {/* Waveform Track */}
            <div className="border-b border-border p-2">
              <div className="text-xs font-semibold mb-2">Audio</div>
              <WaveformVisualization
                audioUrl={audioUrl}
                duration={duration}
                width={duration * PIXELS_PER_SECOND * zoom}
                height={60}
                currentTime={currentTime}
                onSeek={setCurrentTime}
              />
            </div>

            {/* Smart Cut Suggestions */}
            <div className="relative">
              <SmartCutSuggestions
                suggestions={cutSuggestions}
                duration={duration}
                pixelsPerSecond={PIXELS_PER_SECOND}
                zoom={zoom}
                onApplyCut={handleApplyCut}
                onApplyAll={handleApplyAllCuts}
              />
            </div>

            {/* Video Clips Track */}
            <div className="border-b border-border p-2 relative min-h-[100px]">
              <div className="text-xs font-semibold mb-2">Video</div>
              <div className="relative h-16">
                {clips.map((clip) => (
                  <div
                    key={clip.id}
                    className={cn(
                      'absolute h-14 bg-blue-500/30 border border-blue-500 rounded',
                      'hover:bg-blue-500/40 cursor-pointer transition-colors'
                    )}
                    style={{
                      left: `${clip.startTime * PIXELS_PER_SECOND * zoom}px`,
                      width: `${(clip.endTime - clip.startTime) * PIXELS_PER_SECOND * zoom}px`,
                    }}
                    onClick={() => setCurrentTime(clip.startTime)}
                  >
                    <div className="p-1 text-xs truncate">
                      Clip {clip.id}
                    </div>
                  </div>
                ))}

                {/* Snap Guides (shown when dragging) */}
                <SnapGuides
                  snapPoints={snapPoints}
                  dragTime={undefined} // Set when dragging
                  duration={duration}
                  pixelsPerSecond={PIXELS_PER_SECOND}
                  zoom={zoom}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-2 flex items-center gap-4 text-sm text-muted-foreground">
          <div>
            Time: {currentTime.toFixed(2)}s / {duration.toFixed(2)}s
          </div>
          <div>
            Zoom: {zoom.toFixed(1)}x
          </div>
          <div>
            Clips: {clips.length}
          </div>
          <div>
            Suggestions: {cutSuggestions.length}
          </div>
          <div className="flex-1" />
          <div>
            Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">C</kbd> for razor tool,{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Space</kbd> to play/pause
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};

/**
 * INTEGRATION NOTES:
 * ------------------
 * 
 * 1. Replace your existing timeline render with this structure
 * 2. Wire up your real clip data instead of the mock clips array
 * 3. Connect playback state to your video player
 * 4. Hook up the save function to your backend
 * 5. Add more tracks (text overlays, B-roll, etc.) following the same pattern
 * 
 * KEY PATTERNS:
 * 
 * - All components use `pixelsPerSecond * zoom` for positioning
 * - Snap guides activate during drag operations (pass dragTime)
 * - Keyboard shortcuts work automatically via the hook
 * - Waveform generates asynchronously (shows loading state)
 * - Smart cut suggestions are fetched once and cached
 * 
 * PERFORMANCE TIPS:
 * 
 * - Memoize expensive calculations (clip positions, snap points)
 * - Use React.memo for track components
 * - Virtualize timeline for 100+ clips
 * - Debounce zoom/scroll handlers
 */
