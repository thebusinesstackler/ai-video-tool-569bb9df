import React, { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCreatomate } from '@/hooks/useCreatomate';
import { CaptionStyleSelector } from './CaptionStyleSelector';
import { CaptionSettings } from './KaraokeCaption';
import { VideoPlayer } from './VideoPlayer';
import { GalleryImagePicker } from './GalleryImagePicker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Loader2,
  Play,
  Image as ImageIcon,
  Video,
  RefreshCw,
  Layers,
  Check,
  AlertCircle,
  X,
  Pencil,
  Upload
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
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showRestitchConfirm, setShowRestitchConfirm] = useState(false);
  
  // Regeneration dialog state
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenDialogType, setRegenDialogType] = useState<'image' | 'video'>('image');
  const [regenDialogSceneIndex, setRegenDialogSceneIndex] = useState<number>(0);
  const [regenReferenceUrl, setRegenReferenceUrl] = useState<string>('');
  const [regenEditedText, setRegenEditedText] = useState<string>('');
  
  // Store original scenes from DB to compare and prevent data loss
  const originalScenesRef = useRef<ReelScene[]>(reel.scenes || []);

  // Fetch fresh data from database when editor opens
  useEffect(() => {
    if (open) {
      fetchFreshReelData();
    }
  }, [open, reel.id]);

  const fetchFreshReelData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('reels')
        .select('*')
        .eq('id', reel.id)
        .single();

      if (error) throw error;

      if (data) {
        const freshScenes = (data.scenes as unknown as ReelScene[]) || [];
        setScenes(freshScenes);
        originalScenesRef.current = freshScenes;
        setCaptionSettings((data.caption_settings as unknown as CaptionSettings) || DEFAULT_CAPTION_SETTINGS);
      }
    } catch (error: any) {
      console.error('Error fetching reel:', error);
      toast({ title: "Error loading reel", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const hasChanges = JSON.stringify(captionSettings) !== JSON.stringify(reel.caption_settings || DEFAULT_CAPTION_SETTINGS);

  const getMissingScenes = () => {
    return scenes.filter(scene => !scene.imageUrl || !scene.videoUrl);
  };

  const openRegenDialog = (sceneIndex: number, type: 'image' | 'video') => {
    const scene = scenes[sceneIndex];
    setRegenDialogSceneIndex(sceneIndex);
    setRegenDialogType(type);
    setRegenReferenceUrl('');
    setRegenEditedText(scene?.text || '');
    setRegenDialogOpen(true);
  };

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setRegenReferenceUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const regenerateSceneImage = async (sceneIndex: number, referenceUrl?: string) => {
    const scene = scenes[sceneIndex];
    if (!scene) return;

    setRegenDialogOpen(false);
    setRegeneratingScene(sceneIndex);
    setRegeneratingType('image');

    try {
      let data, error;
      
      if (referenceUrl) {
        // Use edit-scene-image with reference
        ({ data, error } = await supabase.functions.invoke('edit-scene-image', {
          body: {
            prompt: scene.text,
            referenceImageUrl: referenceUrl
          }
        }));
      } else {
        // Standard generation
        ({ data, error } = await supabase.functions.invoke('generate-reel-video', {
          body: {
            scenes: [{ sceneNumber: scene.sceneNumber, narration: scene.text, visualDescription: scene.text }],
            generateImagesOnly: true
          }
        }));
      }

      if (error) throw error;

      const generatedImage = referenceUrl ? data?.imageUrl : data?.scenes?.[0]?.imageUrl;
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

  const regenerateSceneVideo = async (sceneIndex: number, editedText?: string) => {
    const scene = scenes[sceneIndex];
    if (!scene || !scene.imageUrl) {
      toast({ title: "Image required", description: "Generate the image first", variant: "destructive" });
      return;
    }

    setRegenDialogOpen(false);
    setRegeneratingScene(sceneIndex);
    setRegeneratingType('video');

    const newText = editedText || scene.text;

    try {
      // If text changed, regenerate audio first
      let audioUrl = scene.audioUrl || reel.audio_url;
      
      if (editedText && editedText !== scene.text) {
        // Generate new voiceover for this scene
        const { data: audioData, error: audioError } = await supabase.functions.invoke('generate-reel-voiceover', {
          body: {
            text: newText,
            voice: 'alloy'
          }
        });
        
        if (audioError) throw audioError;
        if (audioData?.audioUrl) {
          audioUrl = audioData.audioUrl;
        }
      }
      
      // Use the wavespeed-video function with infinitetalk model
      const { data, error } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          image_url: scene.imageUrl,
          audio_url: audioUrl,
          model: 'infinitetalk'
        }
      });

      if (error) throw error;

      // Poll for video completion
      if (data?.taskId) {
        const videoUrl = await pollForVideoCompletion(data.taskId);
        if (videoUrl) {
          const updatedScenes = [...scenes];
          updatedScenes[sceneIndex] = { 
            ...scene, 
            videoUrl,
            text: newText,
            audioUrl: audioUrl
          };
          setScenes(updatedScenes);
          toast({ title: "Video regenerated", description: `Scene ${sceneIndex + 1} video updated${editedText ? ' with new script' : ''}` });
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

  const validateBeforeSave = (): boolean => {
    // Prevent saving if scenes array is empty but original had scenes
    if (scenes.length === 0 && originalScenesRef.current.length > 0) {
      toast({ 
        title: "Cannot save", 
        description: "Scenes data is missing. This would erase your reel data.", 
        variant: "destructive" 
      });
      return false;
    }
    return true;
  };

  const handleRestitchClick = () => {
    if (!validateBeforeSave()) return;
    setShowRestitchConfirm(true);
  };

  const handleSaveClick = () => {
    if (!validateBeforeSave()) return;
    setShowSaveConfirm(true);
  };

  const restitchVideo = async () => {
    setShowRestitchConfirm(false);
    
    const videoClips = scenes.filter(s => s.videoUrl).map(s => ({
      url: s.videoUrl!,
      duration: s.endTime - s.startTime,
      caption: captionSettings.enabled ? s.text : undefined
    }));

    if (videoClips.length === 0) {
      toast({ title: "No videos", description: "Generate scene videos first", variant: "destructive" });
      return;
    }

    if (!validateBeforeSave()) return;

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

        originalScenesRef.current = scenes; // Update reference after successful save
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
    setShowSaveConfirm(false);
    
    if (!validateBeforeSave()) return;

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

      originalScenesRef.current = scenes; // Update reference after successful save
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
    <>
      {/* Regeneration Dialog */}
      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {regenDialogType === 'image' ? 'Regenerate Image' : 'Regenerate Video'} - Scene {regenDialogSceneIndex + 1}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {regenDialogType === 'image' ? (
              <>
                <div className="space-y-2">
                  <Label>Reference Image (Optional)</Label>
                  <p className="text-xs text-muted-foreground">Select a reference image to maintain character consistency</p>
                  
                  <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="upload">Upload</TabsTrigger>
                      <TabsTrigger value="gallery">Gallery</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload" className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleReferenceUpload}
                          className="hidden"
                          id="regen-ref-upload"
                        />
                        <label
                          htmlFor="regen-ref-upload"
                          className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md cursor-pointer hover:bg-muted"
                        >
                          <Upload className="w-4 h-4" />
                          Upload Image
                        </label>
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="gallery">
                      <GalleryImagePicker
                        onSelect={(url) => setRegenReferenceUrl(url)}
                        trigger={
                          <Button variant="outline" size="sm" className="w-full">
                            <ImageIcon className="w-4 h-4 mr-2" />
                            Select from Gallery
                          </Button>
                        }
                      />
                    </TabsContent>
                  </Tabs>
                  
                  {regenReferenceUrl && (
                    <div className="relative w-24 h-24 rounded overflow-hidden border border-border">
                      <img src={regenReferenceUrl} alt="Reference" className="w-full h-full object-cover" />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 w-5 h-5"
                        onClick={() => setRegenReferenceUrl('')}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Edit Script</Label>
                  <p className="text-xs text-muted-foreground">Modify the script for this scene. New audio will be generated.</p>
                  <Textarea
                    value={regenEditedText}
                    onChange={(e) => setRegenEditedText(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (regenDialogType === 'image') {
                  regenerateSceneImage(regenDialogSceneIndex, regenReferenceUrl || undefined);
                } else {
                  regenerateSceneVideo(regenDialogSceneIndex, regenEditedText !== scenes[regenDialogSceneIndex]?.text ? regenEditedText : undefined);
                }
              }}
            >
              {regenDialogType === 'image' ? 'Regenerate Image' : 'Regenerate Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation Dialog */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update your reel with the current {scenes.length} scenes and caption settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={saveChanges}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restitch Confirmation Dialog */}
      <AlertDialog open={showRestitchConfirm} onOpenChange={setShowRestitchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-stitch Video?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new stitched video from your {scenes.filter(s => s.videoUrl).length} scene clips and update the reel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={restitchVideo}>Re-stitch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Edit Reel
            </SheetTitle>
            <p className="text-sm text-muted-foreground line-clamp-1">{reel.topic}</p>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading reel data...</span>
            </div>
          ) : (
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
                        onClick={() => openRegenDialog(idx, 'image')}
                      >
                        {isRegenerating && regeneratingType === 'image' ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Pencil className="w-3 h-3 mr-1" />
                        )}
                        {hasImage ? 'Regen Image' : 'Gen Image'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={isRegenerating || !hasImage}
                        onClick={() => openRegenDialog(idx, 'video')}
                        title={!hasImage ? 'Generate image first' : 'Regenerate video'}
                      >
                        {isRegenerating && regeneratingType === 'video' ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Pencil className="w-3 h-3 mr-1" />
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
              onClick={handleRestitchClick}
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
              onClick={handleSaveClick}
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
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
