import React from 'react';
import { cn } from '@/lib/utils';

interface SnapGuidesProps {
  /** Active snap points (in seconds) */
  snapPoints: number[];
  /** Current dragged element time (in seconds) */
  dragTime?: number;
  /** Total duration */
  duration: number;
  /** Pixels per second */
  pixelsPerSecond: number;
  /** Zoom level */
  zoom: number;
  /** Snap tolerance in seconds */
  snapTolerance?: number;
  /** Show vertical guides at snap points */
  showGuides?: boolean;
}

/**
 * SnapGuides
 * ----------
 * Visual guides for magnetic timeline snapping.
 * Shows snap points and guides when dragging elements close to them.
 * 
 * Features:
 * - Magnetic snapping (within tolerance)
 * - Visual guides (vertical lines)
 * - Snaps to: clip edges, playhead, markers, grid intervals
 * - Hold Shift to disable snapping
 */
export const SnapGuides: React.FC<SnapGuidesProps> = ({
  snapPoints,
  dragTime,
  duration,
  pixelsPerSecond,
  zoom,
  snapTolerance = 0.1,
  showGuides = true,
}) => {
  if (!showGuides || dragTime === undefined) return null;

  // Find nearby snap points
  const nearbySnaps = snapPoints.filter(
    snapPoint => Math.abs(dragTime - snapPoint) <= snapTolerance
  );

  // Find closest snap point
  const closestSnap = nearbySnaps.reduce<number | null>((closest, point) => {
    if (closest === null) return point;
    const closestDist = Math.abs(dragTime - closest);
    const pointDist = Math.abs(dragTime - point);
    return pointDist < closestDist ? point : closest;
  }, null);

  if (closestSnap === null || nearbySnaps.length === 0) return null;

  const snapX = closestSnap * pixelsPerSecond * zoom;
  const dragX = dragTime * pixelsPerSecond * zoom;

  return (
    <>
      {/* Snap guide line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-blue-500 pointer-events-none z-50 animate-pulse"
        style={{ left: `${snapX}px` }}
      >
        {/* Guide extends full height */}
        <div className="absolute inset-y-0 w-px bg-blue-500/30 -left-px" style={{ width: '3px' }} />
      </div>

      {/* Connection line between drag position and snap point */}
      {Math.abs(dragX - snapX) > 1 && (
        <svg
          className="absolute top-0 bottom-0 pointer-events-none z-40"
          style={{
            left: `${Math.min(dragX, snapX)}px`,
            width: `${Math.abs(dragX - snapX)}px`,
          }}
        >
          <line
            x1={dragX < snapX ? 0 : Math.abs(dragX - snapX)}
            y1="50%"
            x2={dragX < snapX ? Math.abs(dragX - snapX) : 0}
            y2="50%"
            stroke="#3b82f6"
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
        </svg>
      )}

      {/* Snap distance indicator */}
      <div
        className="absolute top-1/2 -translate-y-1/2 px-2 py-0.5 bg-blue-500 text-white text-[10px] font-mono rounded pointer-events-none z-50"
        style={{
          left: `${(dragX + snapX) / 2}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {Math.abs(dragTime - closestSnap).toFixed(2)}s
      </div>
    </>
  );
};

/**
 * useSnapToGrid
 * -------------
 * Hook to calculate snap points for timeline elements.
 * Returns: { snapTo, isSnapping, snapPoints }
 */
export const useSnapToGrid = (
  duration: number,
  clipStartTimes: number[],
  clipEndTimes: number[],
  markers: number[],
  gridInterval: number = 1,
  snapTolerance: number = 0.1,
  snapEnabled: boolean = true
) => {
  // Generate all snap points
  const snapPoints: number[] = [];

  if (snapEnabled) {
    // Add clip edges
    snapPoints.push(...clipStartTimes, ...clipEndTimes);

    // Add markers
    snapPoints.push(...markers);

    // Add grid intervals
    for (let t = 0; t <= duration; t += gridInterval) {
      snapPoints.push(t);
    }

    // Remove duplicates and sort
    const uniquePoints = Array.from(new Set(snapPoints)).sort((a, b) => a - b);
    snapPoints.length = 0;
    snapPoints.push(...uniquePoints);
  }

  /**
   * Snap a time value to the nearest snap point
   */
  const snapTo = (time: number): { time: number; snapped: boolean } => {
    if (!snapEnabled) return { time, snapped: false };

    // Find closest snap point
    let closest: number | null = null;
    let minDistance = Infinity;

    for (const point of snapPoints) {
      const distance = Math.abs(time - point);
      if (distance < minDistance && distance <= snapTolerance) {
        closest = point;
        minDistance = distance;
      }
    }

    if (closest !== null) {
      return { time: closest, snapped: true };
    }

    return { time, snapped: false };
  };

  return {
    snapTo,
    snapPoints,
    isSnapping: (time: number) => {
      const result = snapTo(time);
      return result.snapped;
    },
  };
};
