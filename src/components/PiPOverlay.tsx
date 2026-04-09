import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Move, Minimize2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PiPOverlayProps {
  /** The main video element (AI Twin) to render as PiP */
  videoRef: React.RefObject<HTMLVideoElement>;
  /** Container element to constrain dragging within */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Whether PiP mode is active */
  enabled: boolean;
}

const SIZES = [
  { label: 'S', scale: 0.2 },
  { label: 'M', scale: 0.35 },
  { label: 'L', scale: 0.5 },
];

export const PiPOverlay: React.FC<PiPOverlayProps> = ({ videoRef, containerRef, enabled }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 16, y: 16 }); // bottom-right offset from corner
  const [sizeIndex, setSizeIndex] = useState(1); // default M
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const [corner, setCorner] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('bottom-right');

  const scale = SIZES[sizeIndex].scale;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      posX: rect.left,
      posY: rect.top,
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      const overlay = overlayRef.current;
      if (!container || !overlay) return;

      const containerRect = container.getBoundingClientRect();
      const overlayW = overlay.offsetWidth;
      const overlayH = overlay.offsetHeight;

      let newX = dragStart.current.posX + (e.clientX - dragStart.current.x) - containerRect.left;
      let newY = dragStart.current.posY + (e.clientY - dragStart.current.y) - containerRect.top;

      // Clamp within container
      newX = Math.max(0, Math.min(containerRect.width - overlayW, newX));
      newY = Math.max(0, Math.min(containerRect.height - overlayH, newY));

      setPosition({ x: newX, y: newY });
      setCorner('top-left'); // Switch to absolute positioning once dragged
    };

    const handleMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, containerRef]);

  const cycleSize = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSizeIndex(prev => (prev + 1) % SIZES.length);
  }, []);

  if (!enabled) return null;

  const positionStyle: React.CSSProperties = corner === 'top-left'
    ? { left: position.x, top: position.y }
    : { right: 16, bottom: 16 };

  return (
    <div
      ref={overlayRef}
      className={cn(
        "absolute z-30 rounded-lg overflow-hidden border-2 border-primary/60 shadow-xl cursor-grab",
        isDragging && "cursor-grabbing opacity-90",
        "group/pip"
      )}
      style={{
        width: `${scale * 100}%`,
        ...positionStyle,
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Mirror the main video into PiP via a cloned video element */}
      <video
        src={videoRef.current?.src || ''}
        className="w-full h-full object-cover pointer-events-none"
        muted
        autoPlay
        loop
        playsInline
        ref={(el) => {
          if (!el || !videoRef.current) return;
          // Sync time with main video
          const sync = () => {
            if (videoRef.current && el) {
              if (Math.abs(el.currentTime - videoRef.current.currentTime) > 0.3) {
                el.currentTime = videoRef.current.currentTime;
              }
              if (videoRef.current.paused && !el.paused) el.pause();
              if (!videoRef.current.paused && el.paused) el.play().catch(() => {});
            }
          };
          const interval = setInterval(sync, 200);
          el.dataset.syncInterval = String(interval);
          el.onloadeddata = sync;
          // Cleanup on unmount handled by React
          const origSrc = el.src;
          const observer = new MutationObserver(() => {
            if (el.src !== origSrc) clearInterval(interval);
          });
        }}
      />

      {/* Controls overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover/pip:opacity-100 transition-opacity pointer-events-none" />
      <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover/pip:opacity-100 transition-opacity">
        <button
          onClick={cycleSize}
          onMouseDown={e => e.stopPropagation()}
          className="bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded hover:bg-black/80"
        >
          {SIZES[sizeIndex].label}
        </button>
      </div>
      <div className="absolute top-1 left-1 opacity-0 group-hover/pip:opacity-100 transition-opacity pointer-events-none">
        <Move className="w-3.5 h-3.5 text-white/80" />
      </div>
    </div>
  );
};
