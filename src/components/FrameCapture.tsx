import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera, Play, Pause, SkipBack, SkipForward } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface FrameCaptureProps {
  videoUrl: string;
  onFrameCaptured: (frameDataUrl: string) => void;
  trigger?: React.ReactNode;
}

export const FrameCapture: React.FC<FrameCaptureProps> = ({
  videoUrl,
  onFrameCaptured,
  trigger
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [open, setOpen] = useState(false);
  const [capturedFrame, setCapturedFrame] = useState<string | null>(null);

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleSliderChange = useCallback((values: number[]) => {
    seekTo(values[0]);
  }, [seekTo]);

  const skipFrames = useCallback((frames: number) => {
    if (videoRef.current) {
      // Assuming 30fps, each frame is ~0.033 seconds
      const newTime = Math.max(0, Math.min(duration, currentTime + (frames * 0.033)));
      seekTo(newTime);
    }
  }, [currentTime, duration, seekTo]);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Pause video for clean capture
    video.pause();
    setIsPlaying(false);
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current frame to canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedFrame(dataUrl);
    }
  }, []);

  const confirmCapture = useCallback(() => {
    if (capturedFrame) {
      onFrameCaptured(capturedFrame);
      setOpen(false);
      setCapturedFrame(null);
    }
  }, [capturedFrame, onFrameCaptured]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Camera className="w-4 h-4" />
            Capture Frame
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Capture Frame as Reference</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Video player */}
          <div className="relative bg-black rounded-lg overflow-hidden aspect-[9/16] max-h-[50vh] mx-auto">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              playsInline
            />
            
            {/* Time display */}
            <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          {/* Hidden canvas for frame capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Timeline slider */}
          <div className="px-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 1}
              step={0.01}
              onValueChange={handleSliderChange}
              className="cursor-pointer"
            />
          </div>

          {/* Playback controls */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => skipFrames(-10)}
              title="Back 10 frames"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => skipFrames(-1)}
              title="Back 1 frame"
            >
              <SkipBack className="w-3 h-3" />
            </Button>
            
            <Button
              variant="default"
              size="icon"
              onClick={togglePlay}
              className="w-12 h-12"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => skipFrames(1)}
              title="Forward 1 frame"
            >
              <SkipForward className="w-3 h-3" />
            </Button>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => skipFrames(10)}
              title="Forward 10 frames"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Capture button */}
          <div className="flex justify-center">
            <Button onClick={captureFrame} className="gap-2">
              <Camera className="w-4 h-4" />
              Capture This Frame
            </Button>
          </div>

          {/* Preview captured frame */}
          {capturedFrame && (
            <div className="space-y-3 border-t pt-4">
              <p className="text-sm text-muted-foreground text-center">Captured frame preview:</p>
              <div className="flex justify-center">
                <img 
                  src={capturedFrame} 
                  alt="Captured frame" 
                  className="max-h-40 rounded-lg border"
                />
              </div>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={() => setCapturedFrame(null)}>
                  Retake
                </Button>
                <Button onClick={confirmCapture} className="gap-2">
                  Use as Reference
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
