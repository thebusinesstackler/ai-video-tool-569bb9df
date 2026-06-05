import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimelineZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onFitToWindow: () => void;
  onCenterPlayhead: () => void;
  minZoom?: number;
  maxZoom?: number;
}

/**
 * TimelineZoomControls
 * --------------------
 * Professional zoom controls for the timeline editor.
 * Allows users to zoom in for frame-accurate editing or zoom out
 * for a bird's-eye view of the entire project.
 * 
 * Features:
 * - Zoom slider (1x to 20x)
 * - Quick zoom buttons (+/-)
 * - Fit to window
 * - Center on playhead
 * - Keyboard shortcuts (Cmd/Ctrl + scroll)
 */
export const TimelineZoomControls: React.FC<TimelineZoomControlsProps> = ({
  zoom,
  onZoomChange,
  onFitToWindow,
  onCenterPlayhead,
  minZoom = 0.25,
  maxZoom = 20,
}) => {
  const handleZoomIn = () => {
    const newZoom = Math.min(zoom * 1.5, maxZoom);
    onZoomChange(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoom / 1.5, minZoom);
    onZoomChange(newZoom);
  };

  const handleSliderChange = (value: number[]) => {
    if (value[0] !== undefined) {
      onZoomChange(value[0]);
    }
  };

  // Convert linear slider to logarithmic zoom feel
  const zoomToSlider = (z: number) => {
    return Math.log(z / minZoom) / Math.log(maxZoom / minZoom) * 100;
  };

  const sliderToZoom = (s: number) => {
    return minZoom * Math.pow(maxZoom / minZoom, s / 100);
  };

  const sliderValue = zoomToSlider(zoom);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-background/95 backdrop-blur-sm border border-border rounded-lg">
      {/* Zoom Out Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomOut}
            disabled={zoom <= minZoom}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Zoom Out (Cmd/Ctrl + -)</p>
        </TooltipContent>
      </Tooltip>

      {/* Zoom Slider */}
      <div className="w-32 flex items-center gap-2">
        <Slider
          value={[sliderValue]}
          onValueChange={(values) => {
            const newZoom = sliderToZoom(values[0]);
            onZoomChange(newZoom);
          }}
          min={0}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs font-mono text-muted-foreground min-w-[3rem] text-right">
          {zoom.toFixed(1)}x
        </span>
      </div>

      {/* Zoom In Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleZoomIn}
            disabled={zoom >= maxZoom}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Zoom In (Cmd/Ctrl + +)</p>
        </TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-border mx-1" />

      {/* Fit to Window */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onFitToWindow}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Fit Timeline to Window (Shift + Z)</p>
        </TooltipContent>
      </Tooltip>

      {/* Center Playhead */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCenterPlayhead}
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Center Playhead (F)</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
};
