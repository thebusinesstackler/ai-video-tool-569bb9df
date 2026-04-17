import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Camera, Play, Pause, SkipBack, SkipForward, Loader2, Sparkles, Trash2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface FrameExtractorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  projectId?: string | null;
  projectLabel?: string;
}

interface CapturedFrame {
  dataUrl: string;
  blob: Blob;
  time: number;
  label: string;
}

export const FrameExtractorDialog: React.FC<FrameExtractorDialogProps> = ({
  open,
  onOpenChange,
  videoUrl,
  projectId,
  projectLabel,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [frames, setFrames] = useState<CapturedFrame[]>([]);
  const [saving, setSaving] = useState(false);
  const [autoExtracting, setAutoExtracting] = useState(false);

  useEffect(() => {
    if (!open) {
      setFrames([]);
      setCurrentTime(0);
      setIsPlaying(false);
    }
  }, [open]);

  const grabFrameAtCurrentTime = useCallback(async (): Promise<CapturedFrame | null> => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
    );
    if (!blob) return null;
    return {
      dataUrl,
      blob,
      time: video.currentTime,
      label: `${projectLabel || 'B-Roll'} @ ${video.currentTime.toFixed(1)}s`,
    };
  }, [projectLabel]);

  const captureCurrent = useCallback(async () => {
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    const f = await grabFrameAtCurrentTime();
    if (f) setFrames((prev) => [...prev, f]);
  }, [grabFrameAtCurrentTime]);

  const seekTo = useCallback((time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const skipFrames = (n: number) => {
    if (!videoRef.current) return;
    const t = Math.max(0, Math.min(duration, currentTime + n * 0.033));
    seekTo(t);
  };

  const seekAndWait = (time: number): Promise<void> =>
    new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) return resolve();
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        // small buffer to ensure frame painted
        setTimeout(resolve, 80);
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });

  const autoExtractSix = useCallback(async () => {
    if (!videoRef.current || !duration) return;
    setAutoExtracting(true);
    videoRef.current.pause();
    setIsPlaying(false);
    const newFrames: CapturedFrame[] = [];
    try {
      for (let i = 1; i <= 6; i++) {
        const t = (duration * i) / 7;
        await seekAndWait(t);
        const f = await grabFrameAtCurrentTime();
        if (f) newFrames.push(f);
      }
      setFrames((prev) => [...prev, ...newFrames]);
      toast({ title: 'Extracted 6 frames', description: 'Review and save the ones you want.' });
    } catch (e: any) {
      toast({ title: 'Auto-extract failed', description: e.message, variant: 'destructive' });
    } finally {
      setAutoExtracting(false);
    }
  }, [duration, grabFrameAtCurrentTime, toast]);

  const updateLabel = (idx: number, label: string) => {
    setFrames((prev) => prev.map((f, i) => (i === idx ? { ...f, label } : f)));
  };

  const removeFrame = (idx: number) => {
    setFrames((prev) => prev.filter((_, i) => i !== idx));
  };

  const saveAllFrames = async () => {
    if (!user || frames.length === 0) return;
    setSaving(true);
    try {
      let saved = 0;
      for (const frame of frames) {
        const fileName = `broll-frames/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('reels')
          .upload(fileName, frame.blob, { contentType: 'image/jpeg', upsert: false });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('reels').getPublicUrl(fileName);
        const { error: insErr } = await supabase.from('generated_images').insert({
          user_id: user.id,
          image_url: urlData.publicUrl,
          source: 'broll-frame',
          project_id: projectId || null,
          prompt: frame.label,
          reference_image_url: videoUrl,
        });
        if (insErr) throw insErr;
        saved++;
      }
      toast({ title: `Saved ${saved} frame${saved !== 1 ? 's' : ''} to B-Roll Library` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Failed to save frames', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Extract B-Roll Frames</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden max-h-[45vh] mx-auto">
            <video
              ref={videoRef}
              src={videoUrl}
              crossOrigin="anonymous"
              className="w-full h-full max-h-[45vh] object-contain"
              onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
              onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              playsInline
            />
            <div className="absolute top-2 right-2 bg-black/70 px-2 py-1 rounded text-xs text-white font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />

          <div className="px-2">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 1}
              step={0.01}
              onValueChange={(v) => seekTo(v[0])}
            />
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" onClick={() => skipFrames(-10)}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button variant="default" size="icon" onClick={togglePlay} className="w-12 h-12">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            <Button variant="outline" size="icon" onClick={() => skipFrames(10)}>
              <SkipForward className="w-4 h-4" />
            </Button>
            <div className="w-px h-8 bg-border mx-1" />
            <Button onClick={captureCurrent} className="gap-2">
              <Camera className="w-4 h-4" /> Capture Frame
            </Button>
            <Button
              variant="secondary"
              onClick={autoExtractSix}
              disabled={autoExtracting || !duration}
              className="gap-2"
            >
              {autoExtracting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Auto-extract 6
            </Button>
          </div>

          {frames.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{frames.length} frame{frames.length !== 1 ? 's' : ''} ready to save</p>
                <Button onClick={saveAllFrames} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save to B-Roll Library
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto">
                {frames.map((f, i) => (
                  <div key={i} className="space-y-1.5 border rounded-lg p-2 bg-card">
                    <div className="relative">
                      <img src={f.dataUrl} alt="" className="w-full aspect-video object-cover rounded" />
                      <Button
                        size="icon"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => removeFrame(i)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                    <Input
                      value={f.label}
                      onChange={(e) => updateLabel(i, e.target.value)}
                      className="h-7 text-xs"
                      placeholder="Label (e.g. Lion's Mane pour)"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
