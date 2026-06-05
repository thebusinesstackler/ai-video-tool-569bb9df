import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WaveformVisualizationProps {
  audioUrl: string;
  duration: number;
  width: number;
  height?: number;
  currentTime?: number;
  onSeek?: (time: number) => void;
  color?: string;
  backgroundColor?: string;
}

/**
 * WaveformVisualization
 * ---------------------
 * Renders an audio waveform visualization for precise editing.
 * Shows amplitude over time, making it easy to identify:
 * - Pauses and silence (perfect cut points)
 * - Beat hits (for music videos)
 * - Speech patterns (for dialogue cuts)
 * 
 * Features:
 * - Click to seek
 * - Visual playhead indicator
 * - Adaptive detail based on zoom level
 */
export const WaveformVisualization: React.FC<WaveformVisualizationProps> = ({
  audioUrl,
  duration,
  width,
  height = 60,
  currentTime = 0,
  onSeek,
  color = '#3b82f6',
  backgroundColor = 'rgba(0,0,0,0.1)',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [waveformData, setWaveformData] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate waveform data from audio file
  useEffect(() => {
    if (!audioUrl) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const generateWaveform = async () => {
      try {
        // Fetch audio file
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();

        // Decode audio data
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (cancelled) return;

        // Extract channel data
        const channelData = audioBuffer.getChannelData(0);
        const samples = channelData.length;
        
        // Downsample to reasonable number of bars (based on width)
        const targetBars = Math.min(Math.floor(width / 2), 1000);
        const blockSize = Math.floor(samples / targetBars);
        const amplitudes: number[] = [];

        for (let i = 0; i < targetBars; i++) {
          const start = i * blockSize;
          const end = Math.min(start + blockSize, samples);
          
          // Calculate RMS (root mean square) for this block
          let sum = 0;
          for (let j = start; j < end; j++) {
            sum += channelData[j] * channelData[j];
          }
          const rms = Math.sqrt(sum / (end - start));
          amplitudes.push(rms);
        }

        // Normalize amplitudes to 0-1 range
        const maxAmplitude = Math.max(...amplitudes, 0.01);
        const normalized = amplitudes.map(a => a / maxAmplitude);

        if (!cancelled) {
          setWaveformData(normalized);
          setLoading(false);
        }

        audioContext.close();
      } catch (err) {
        console.error('Waveform generation error:', err);
        if (!cancelled) {
          setError('Failed to generate waveform');
          setLoading(false);
        }
      }
    };

    generateWaveform();

    return () => {
      cancelled = true;
    };
  }, [audioUrl, width]);

  // Draw waveform to canvas
  useEffect(() => {
    if (!waveformData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (account for device pixel ratio)
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw waveform bars
    const barWidth = width / waveformData.length;
    const centerY = height / 2;
    const maxBarHeight = height * 0.85;

    waveformData.forEach((amplitude, i) => {
      const x = i * barWidth;
      const barHeight = amplitude * maxBarHeight / 2;

      // Create gradient for visual depth
      const gradient = ctx.createLinearGradient(x, centerY - barHeight, x, centerY + barHeight);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, color + '80'); // Add transparency at bottom

      ctx.fillStyle = gradient;
      
      // Draw symmetric bars (top and bottom)
      ctx.fillRect(x, centerY - barHeight, barWidth - 1, barHeight * 2);
    });

    // Draw playhead indicator
    if (currentTime >= 0 && duration > 0) {
      const playheadX = (currentTime / duration) * width;
      
      // Playhead line
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead triangle at top
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX - 5, 8);
      ctx.lineTo(playheadX + 5, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [waveformData, width, height, currentTime, duration, color, backgroundColor]);

  // Handle click to seek
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / width;
    const seekTime = percentage * duration;

    onSeek(Math.max(0, Math.min(seekTime, duration)));
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative rounded overflow-hidden',
        onSeek && 'cursor-pointer hover:opacity-90 transition-opacity'
      )}
      style={{ width, height }}
      onClick={handleClick}
      title={onSeek ? 'Click to seek' : undefined}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 backdrop-blur-sm">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 text-destructive text-xs">
          {error}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className={cn(
          'absolute inset-0',
          loading && 'opacity-0'
        )}
      />
    </div>
  );
};
