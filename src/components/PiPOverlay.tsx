import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Move } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PiPOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  enabled: boolean;
}

const SIZES = [
  { label: 'S', scale: 0.2 },
  { label: 'M', scale: 0.35 },
  { label: 'L', scale: 0.5 },
];

export const PiPOverlay: React.FC<PiPOverlayProps> = ({ videoRef, containerRef, enabled }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const [sizeIndex, setSizeIndex] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const [corner, setCorner] = useState<'top-left' | 'bottom-right'>('bottom-right');

  const scale = SIZES[sizeIndex].scale;

  // Sync PiP video with main video
  useEffect(() => {
    if (!enabled) return;
    const main = videoRef.current;
    const pip = pipVideoRef.current;
    if (!main || !pip) return;

    // Set same src
    if (pip.src !== main.src) {
      pip.src = main.src;
    }

    const sync = () => {
      if (!main || !pip) return;
      // Sync time
      if (Math.abs(pip.currentTime - main.currentTime) > 0.3) {
        pip.currentTime = main.currentTime;
      }
      // Sync play/pause state
      if (main.paused && !pip.paused) pip.pause();
      if (!main.paused && pip.paused) pip.play().catch(() => {});
    };

    const onPlay = () => pip.play().catch(() => {});
    const onPause = () => pip.pause();
    const onSeeked = () => { pip.currentTime = main.currentTime; };

    syncIntervalRef.current = setInterval(sync, 500);
    main.addEventListener('play', onPlay);
    main.addEventListener('pause', onPause);
    main.addEventListener('seeked', onSeeked);

    // Initial sync
    pip.currentTime = main.currentTime;
    if (main.paused) pip.pause();

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      main.removeEventListener('play', onPlay);
      main.removeEventListener('pause', onPause);
      main.removeEventListener('seeked', onSeeked);
    };
  }, [enabled, videoRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    dragStart.current = { x: e.clientX, y: e.clientY, posX: rect.left, posY: rect.top };
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      const overlay = overlayRef.current;
      if (!container || !overlay) return;
      const containerRect = container.getBoundingClientRect();
      let newX = dragStart.current.posX + (e.clientX - dragStart.current.x) - containerRect.left;
      let newY = dragStart.current.posY + (e.clientY - dragStart.current.y) - containerRect.top;
      newX = Math.max(0, Math.min(containerRect.width - overlay.offsetWidth, newX));
      newY = Math.max(0, Math.min(containerRect.height - overlay.offsetHeight, newY));
      setPosition({ x: newX, y: newY });
      setCorner('top-left');
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
      style={{ width: `${scale * 100}%`, ...positionStyle }}
      onMouseDown={handleMouseDown}
    >
      <video
        ref={pipVideoRef}
        className="w-full h-full object-cover pointer-events-none"
        muted
        playsInline
      />
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
