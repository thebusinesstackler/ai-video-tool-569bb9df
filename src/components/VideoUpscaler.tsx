import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { Wand2, Upload, Download, Loader2, Sparkles, Video, Image as ImageIcon } from 'lucide-react';

interface VideoUpscalerProps {
  videoUrl?: string | null;
  onUpscaleComplete?: (upscaledUrl: string) => void;
  disabled?: boolean;
}

type UpscaleMode = '2x' | '4x' | 'enhance';

const UPSCALE_OPTIONS = [
  { value: '2x', label: '2x Resolution', description: 'Double the resolution' },
  { value: '4x', label: '4x Resolution', description: 'Quadruple the resolution' },
  { value: 'enhance', label: 'AI Enhance', description: 'Improve quality and sharpness' },
];

export function VideoUpscaler({
  videoUrl,
  onUpscaleComplete,
  disabled = false
}: VideoUpscalerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [upscaleMode, setUpscaleMode] = useState<UpscaleMode>('2x');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [upscaledResult, setUpscaledResult] = useState<string | null>(null);

  const effectiveVideoUrl = videoUrl || uploadedVideoUrl;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid File",
        description: "Please upload a video file (MP4, MOV, etc.)",
        variant: "destructive"
      });
      return;
    }

    // Max 100MB for upload
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Maximum file size is 100MB",
        variant: "destructive"
      });
      return;
    }

    setProgress(10);
    setProgressStatus('Uploading video...');

    try {
      const fileName = `${user.id}/upscale/${Date.now()}-input.${file.name.split('.').pop()}`;
      const { data, error } = await supabase.storage
        .from('reels')
        .upload(fileName, file, { contentType: file.type });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('reels').getPublicUrl(fileName);
      setUploadedVideoUrl(urlData.publicUrl);
      setProgress(0);
      setProgressStatus('');

      toast({
        title: "Video Uploaded",
        description: "Ready to upscale"
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload video",
        variant: "destructive"
      });
      setProgress(0);
      setProgressStatus('');
    }
  };

  const upscaleVideo = async () => {
    if (!effectiveVideoUrl) {
      toast({
        title: "No Video",
        description: "Please provide or upload a video first",
        variant: "destructive"
      });
      return;
    }

    setIsUpscaling(true);
    setProgress(5);
    setProgressStatus('Initializing AI upscaler...');
    setUpscaledResult(null);

    try {
      // Call edge function for upscaling
      const { data, error } = await supabase.functions.invoke('upscale-video', {
        body: {
          videoUrl: effectiveVideoUrl,
          mode: upscaleMode,
          userId: user?.id
        }
      });

      if (error) throw error;

      if (data?.taskId) {
        // Poll for completion
        setProgressStatus('Processing frames with AI...');
        const maxWait = 600000; // 10 minutes
        const pollInterval = 5000;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
          await new Promise(r => setTimeout(r, pollInterval));
          
          const { data: statusData, error: statusError } = await supabase.functions.invoke('upscale-video', {
            body: { action: 'status', taskId: data.taskId }
          });

          if (statusError) {
            console.error('Status check error:', statusError);
            continue;
          }

          if (statusData?.progress) {
            setProgress(statusData.progress);
          }

          if (statusData?.status === 'completed' && statusData?.videoUrl) {
            setUpscaledResult(statusData.videoUrl);
            setProgress(100);
            setProgressStatus('Complete!');
            
            if (onUpscaleComplete) {
              onUpscaleComplete(statusData.videoUrl);
            }

            toast({
              title: "Upscale Complete",
              description: `Video enhanced with ${upscaleMode} mode`
            });
            break;
          } else if (statusData?.status === 'failed') {
            throw new Error(statusData?.error || 'Upscaling failed');
          }

          setProgressStatus(statusData?.statusMessage || 'Processing...');
        }
      } else if (data?.videoUrl) {
        // Immediate result
        setUpscaledResult(data.videoUrl);
        setProgress(100);
        setProgressStatus('Complete!');
        
        if (onUpscaleComplete) {
          onUpscaleComplete(data.videoUrl);
        }

        toast({
          title: "Upscale Complete",
          description: `Video enhanced with ${upscaleMode} mode`
        });
      }
    } catch (error: any) {
      console.error('Upscale error:', error);
      toast({
        title: "Upscale Failed",
        description: error.message || "Failed to upscale video",
        variant: "destructive"
      });
    } finally {
      setIsUpscaling(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          Video Upscaler
        </CardTitle>
        <CardDescription>
          Enhance video resolution and quality with AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Video Source */}
        <div className="space-y-2">
          <Label>Video Source</Label>
          {effectiveVideoUrl ? (
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
              <video 
                src={effectiveVideoUrl}
                className="w-full h-full object-contain"
                controls
                muted
              />
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload a video
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  MP4, MOV up to 100MB
                </p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="video/*"
                onChange={handleFileUpload}
                disabled={disabled || isUpscaling}
              />
            </label>
          )}
        </div>

        {/* Upscale Mode */}
        <div className="space-y-2">
          <Label>Enhancement Mode</Label>
          <Select 
            value={upscaleMode} 
            onValueChange={(v) => setUpscaleMode(v as UpscaleMode)}
            disabled={disabled || isUpscaling}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UPSCALE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div className="flex flex-col">
                    <span>{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Progress */}
        {isUpscaling && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{progressStatus}</span>
              <span className="text-primary font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Upscaled Result */}
        {upscaledResult && (
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Upscaled Result
            </Label>
            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
              <video 
                src={upscaledResult}
                className="w-full h-full object-contain"
                controls
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.open(upscaledResult, '_blank')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download Upscaled Video
            </Button>
          </div>
        )}

        {/* Action Button */}
        <Button
          onClick={upscaleVideo}
          disabled={disabled || isUpscaling || !effectiveVideoUrl}
          className="w-full"
        >
          {isUpscaling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Upscaling...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Upscale Video
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
