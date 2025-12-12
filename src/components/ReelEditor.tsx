import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCreatomate } from '@/hooks/useCreatomate';
import { CaptionStyleSelector } from './CaptionStyleSelector';
import { CaptionSettings } from './KaraokeCaption';
import { VideoPlayer } from './VideoPlayer';
import {
  Loader2,
  Play,
  Image as ImageIcon,
  Video,
  RefreshCw,
  Layers,
  Check,
  AlertCircle,
  X
} from 'lucide-react';

interface ReelScene {
  sceneNumber: number;
  text: string;
  imageUrl: string | null;
  videoUrl?: string | null;
  audioUrl?: string | null;
  startTime: number;
  endTime: number;
}

interface SavedReel {
  id: string;
  topic: string;
  video_url: string | null;
  thumbnail_url: string | null;
  audio_url?: string | null;
  scenes: ReelScene[];
  total_duration: number;
  created_at: string;
  caption_settings?: {
    enabled: boolean;
    style: string;
    background: string;
    position: string;
  };
}

interface ReelEditorProps {
  reel: SavedReel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReelUpdated: (updatedReel: SavedReel) => void;
}

const DEFAULT_CAPTION_SETTINGS: CaptionSettings = {
  enabled: true,
  style: 'karaoke',
  background: 'glass',
  position: 'bottom'
};

export const ReelEditor: React.FC<ReelEditorProps> = ({
  reel,
  open,
  onOpenChange,
  onReelUpdated
}) => {
  const { toast } = useToast();
  const { stitchWithCreatomate, isStitching, progress: stitchProgress, status: stitchStatus } = useCreatomate();
  
  const [scenes, setScenes] = useState<ReelScene[]>(reel.scenes || []);
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(
    (reel.caption_settings as CaptionSettings) || DEFAULT_CAPTION_SETTINGS
  );
  const [regeneratingScene, setRegeneratingScene] = useState<number | null>(null);
  const [regeneratingType, setRegeneratingType] = useState<'image' | 'video' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestitching, setIsRestitching] = useState(false);

  const hasChanges = JSON.stringify(captionSettings) !== JSON.stringify(reel.caption_settings || DEFAULT_CAPTION_SETTINGS);

  const getMissingScenes = () => {
    return scenes.filter(scene => !scene.imageUrl || !scene.videoUrl);
  };

  const regenerateSceneImage = async (sceneIndex: number) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    setRegeneratingScene(sceneIndex);
    setRegeneratingType('image');

    try {
      const { data, error } = await supabase.functions.invoke('generate-reel-video', {
        body: {
          scenes: [{ sceneNumber: scene.sceneNumber, narration: scene.text, visualDescription: scene.text }],
          generateImagesOnly: true
        }
      });

      if (error) throw error;

      const generatedImage = data?.scenes?.[0]?.imageUrl;
      if (generatedImage) {
        const updatedScenes = [...scenes];
        updatedScenes[sceneIndex] = { ...scene, imageUrl: generatedImage };
        setScenes(updatedScenes);
        toast({ title: "Image regenerated", description: `Scene ${sceneIndex + 1} image updated` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setRegeneratingScene(null);
      setRegeneratingType(null);
    }
  };

  const regenerateSceneVideo = async (sceneIndex: number) => {
    const scene = scenes[sceneIndex];
    if (!scene || !scene.imageUrl) {
      toast({ title: "Image required", description: "Generate the image first", variant: "destructive" });
      return;
    }

    setRegeneratingScene(sceneIndex);
    setRegeneratingType('video');

    try {
      // Use the wavespeed-video function with infinitetalk model
      const { data, error } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          image_url: scene.imageUrl,
          audio_url: scene.audioUrl || reel.audio_url,
          model: 'infinitetalk'
        }
      });

      if (error) throw error;

      // Poll for video completion
      if (data?.taskId) {
        const videoUrl = await pollForVideoCompletion(data.taskId);
        if (videoUrl) {
          const updatedScenes = [...scenes];
          updatedScenes[sceneIndex] = { ...scene, videoUrl };
          setScenes(updatedScenes);
          toast({ title: "Video regenerated", description: `Scene ${sceneIndex + 1} video updated (same script)` });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setRegeneratingScene(null);
      setRegeneratingType(null);
    }
  };

  const pollForVideoCompletion = async (taskId: string): Promise<string | null> => {
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const { data, error } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId }
        });

        if (error) throw error;

        if (data?.status === 'completed' && data?.videoUrl) {
          return data.videoUrl;
        } else if (data?.status === 'failed') {
          throw new Error('Video generation failed');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }

      attempts++;
    }

    return null;
  };

  const regenerateAllMissing = async () => {
    const missing = getMissingScenes();
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (!scene.imageUrl) {
        await regenerateSceneImage(i);
      }
      if (!scene.videoUrl && scenes[i].imageUrl) {
        await regenerateSceneVideo(i);
      }
    }
  };

  const restitchVideo = async () => {
    const videoClips = scenes.filter(s => s.videoUrl).map(s => ({
      url: s.videoUrl!,
      duration: s.endTime - s.startTime,
      caption: captionSettings.enabled ? s.text : undefined
    }));

    if (videoClips.length === 0) {
      toast({ title: "No videos", description: "Generate scene videos first", variant: "destructive" });
      return;
    }

    setIsRestitching(true);

    try {
      const result = await stitchWithCreatomate({
        clips: videoClips,
        audioUrl: reel.audio_url || undefined,
        transition: 'crossfade',
        captionStyle: captionSettings.enabled ? captionSettings.style : undefined,
        captionBackground: captionSettings.enabled ? captionSettings.background : undefined
      } as any);

      if (result.success && result.videoUrl) {
        // Save updated reel
        const { error } = await supabase
          .from('reels')
          .update({
            video_url: result.videoUrl,
            scenes: scenes as any,
            caption_settings: captionSettings as any
          })
          .eq('id', reel.id);

        if (error) throw error;

        onReelUpdated({
          ...reel,
          video_url: result.videoUrl,
          scenes,
          caption_settings: captionSettings
        });

        toast({ title: "Video re-stitched", description: "Your reel has been updated with new captions" });
      } else {
        throw new Error(result.error || 'Stitching failed');
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsRestitching(false);
    }
  };

  const saveChanges = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('reels')
        .update({
          scenes: scenes as any,
          caption_settings: captionSettings as any
        })
        .eq('id', reel.id);

      if (error) throw error;

      onReelUpdated({
        ...reel,
        scenes,
        caption_settings: captionSettings
      });

      toast({ title: "Saved", description: "Caption settings saved" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const missingCount = getMissingScenes().length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Edit Reel
          </SheetTitle>
          <p className="text-sm text-muted-foreground line-clamp-1">{reel.topic}</p>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Caption Settings */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Caption Settings</Label>
            <CaptionStyleSelector
              settings={captionSettings}
              onChange={setCaptionSettings}
            />
          </div>

          {/* Scenes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Scenes ({scenes.length})</Label>
              {missingCount > 0 && (
                <Badge variant="secondary" className="text-orange-600">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {missingCount} incomplete
                </Badge>
              )}
            </div>

            <div className="space-y-3">
              {scenes.map((scene, idx) => {
                const hasImage = !!scene.imageUrl;
                const hasVideo = !!scene.videoUrl;
                const isRegenerating = regeneratingScene === idx;

                return (
                  <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      <div className="w-16 h-24 bg-muted rounded overflow-hidden flex-shrink-0">
                        {scene.imageUrl ? (
                          <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">Scene {idx + 1}</span>
                          <div className="flex gap-1">
                            {hasImage ? (
                              <Badge variant="outline" className="text-green-600 text-[10px] px-1">
                                <Check className="w-2 h-2 mr-0.5" /> IMG
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-600 text-[10px] px-1">
                                <X className="w-2 h-2 mr-0.5" /> IMG
                              </Badge>
                            )}
                            {hasVideo ? (
                              <Badge variant="outline" className="text-green-600 text-[10px] px-1">
                                <Check className="w-2 h-2 mr-0.5" /> VID
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-orange-600 text-[10px] px-1">
                                <X className="w-2 h-2 mr-0.5" /> VID
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{scene.text}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {hasVideo && scene.videoUrl && (
                        <VideoPlayer
                          videoUrl={scene.videoUrl}
                          title={`Scene ${idx + 1}`}
                          trigger={
                            <Button variant="outline" size="sm" className="h-7 text-xs">
                              <Play className="w-3 h-3 mr-1" /> Play
                            </Button>
                          }
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={isRegenerating}
                        onClick={() => regenerateSceneImage(idx)}
                      >
                        {isRegenerating && regeneratingType === 'image' ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <ImageIcon className="w-3 h-3 mr-1" />
                        )}
                        {hasImage ? 'Regen Image' : 'Gen Image'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={isRegenerating || !hasImage}
                        onClick={() => regenerateSceneVideo(idx)}
                        title={!hasImage ? 'Generate image first' : 'Regenerate video (keeps same script)'}
                      >
                        {isRegenerating && regeneratingType === 'video' ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Video className="w-3 h-3 mr-1" />
                        )}
                        {hasVideo ? 'Regen Video' : 'Gen Video'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress */}
          {(isStitching || isRestitching) && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{stitchStatus || 'Stitching video...'}</span>
                <span className="text-primary">{stitchProgress}%</span>
              </div>
              <Progress value={stitchProgress} className="h-2" />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
            {missingCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={regenerateAllMissing}
                disabled={regeneratingScene !== null}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate Missing ({missingCount})
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={restitchVideo}
              disabled={isStitching || isRestitching || scenes.filter(s => s.videoUrl).length === 0}
            >
              {isRestitching ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Layers className="w-4 h-4 mr-2" />
              )}
              Re-stitch Video
            </Button>
            <Button
              size="sm"
              onClick={saveChanges}
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
