import React, { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCreatomate } from '@/hooks/useCreatomate';
import { CaptionStyleSelector } from './CaptionStyleSelector';
import { CaptionSettings } from './KaraokeCaption';
import { VideoPlayer } from './VideoPlayer';
import { GalleryImagePicker } from './GalleryImagePicker';
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
  Check,
  X,
  Pencil,
  Upload,
  Download,
  ChevronDown,
  Captions,
  Save
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
  style: 'boldPop',
  background: 'glass',
  position: 'bottom',
  fontFamily: 'Montserrat',
  fontSize: 'medium',
  fontColor: '#ffffff',
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
  
  // Regeneration dialog state
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenDialogType, setRegenDialogType] = useState<'image' | 'video'>('image');
  const [regenDialogSceneIndex, setRegenDialogSceneIndex] = useState<number>(0);
  const [regenReferenceUrl, setRegenReferenceUrl] = useState<string>('');
  const [regenEditedText, setRegenEditedText] = useState<string>('');
  
  const originalScenesRef = useRef<ReelScene[]>(reel.scenes || []);

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
  const videoClipCount = scenes.filter(s => s.videoUrl).length;

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
    reader.onloadend = () => setRegenReferenceUrl(reader.result as string);
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
        ({ data, error } = await supabase.functions.invoke('edit-scene-image', {
          body: { prompt: scene.text, referenceImageUrl: referenceUrl }
        }));
      } else {
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
        toast({ title: "Image updated", description: `Scene ${sceneIndex + 1} image refreshed` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setRegeneratingScene(null);
      setRegeneratingType(null);
    }
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: mimeType });
  };

  const regenerateSceneVideo = async (sceneIndex: number, editedText?: string) => {
    const scene = scenes[sceneIndex];
    if (!scene || !scene.imageUrl) {
      toast({ title: "Image needed first", description: "Regenerate the image before creating video", variant: "destructive" });
      return;
    }

    setRegenDialogOpen(false);
    setRegeneratingScene(sceneIndex);
    setRegeneratingType('video');

    const newText = editedText || scene.text;

    try {
      let audioUrl = scene.audioUrl || reel.audio_url;
      
      if (editedText && editedText !== scene.text) {
        const { data: audioData, error: audioError } = await supabase.functions.invoke('generate-reel-voiceover', {
          body: { text: newText, voice: 'alloy' }
        });
        if (audioError) throw audioError;
        if (audioData?.audioUrl) audioUrl = audioData.audioUrl;
      }
      
      if (audioUrl && audioUrl.startsWith('data:audio')) {
        try {
          const base64Data = audioUrl.split(',')[1];
          const audioBlob = base64ToBlob(base64Data, 'audio/mp3');
          const fileName = `audio_scene_${sceneIndex}_${Date.now()}.mp3`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reels')
            .upload(fileName, audioBlob, { contentType: 'audio/mp3', upsert: true });
          if (uploadError) throw new Error(`Failed to upload audio: ${uploadError.message}`);
          const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);
          audioUrl = publicUrl;
        } catch (uploadErr: any) {
          throw new Error(`Audio upload failed: ${uploadErr.message}`);
        }
      }
      
      const { data, error } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          imageUrls: [scene.imageUrl],
          audioUrl: audioUrl,
          model: 'infinitetalk',
          prompt: newText
        }
      });

      if (error) throw error;

      if (data?.taskId) {
        const videoUrl = await pollForVideoCompletion(data.taskId);
        if (videoUrl) {
          const updatedScenes = [...scenes];
          updatedScenes[sceneIndex] = { ...scene, videoUrl, text: newText, audioUrl };
          setScenes(updatedScenes);
          toast({ title: "Video updated", description: `Scene ${sceneIndex + 1} video refreshed` });
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
        if (data?.status === 'completed' && data?.videoUrl) return data.videoUrl;
        if (data?.status === 'failed') throw new Error('Video generation failed');
      } catch (err) {
        console.error('Polling error:', err);
      }
      attempts++;
    }
    return null;
  };

  const restitchVideo = async () => {
    const videoClips = scenes.filter(s => s.videoUrl).map(s => ({
      url: s.videoUrl!,
      duration: s.endTime - s.startTime,
      caption: captionSettings.enabled ? s.text : undefined
    }));

    if (videoClips.length === 0) {
      toast({ title: "No video clips", description: "Your scenes don't have video clips yet", variant: "destructive" });
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
        const { error } = await supabase
          .from('reels')
          .update({
            video_url: result.videoUrl,
            scenes: scenes as any,
            caption_settings: captionSettings as any
          })
          .eq('id', reel.id);

        if (error) throw error;

        originalScenesRef.current = scenes;
        onReelUpdated({
          ...reel,
          video_url: result.videoUrl,
          scenes,
          caption_settings: captionSettings
        });

        toast({ title: "Video updated!", description: "Your reel has been re-created with the latest changes" });
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
    if (scenes.length === 0 && originalScenesRef.current.length > 0) {
      toast({ title: "Cannot save", description: "Scene data is missing.", variant: "destructive" });
      return;
    }

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

      originalScenesRef.current = scenes;
      onReelUpdated({ ...reel, scenes, caption_settings: captionSettings });
      toast({ title: "Saved!", description: "Your changes have been saved" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Regeneration Dialog */}
      <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {regenDialogType === 'image' ? 'Regenerate Image' : 'Regenerate Video'} — Scene {regenDialogSceneIndex + 1}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {regenDialogType === 'image' ? (
              <div className="space-y-2">
                <Label>Reference Image (Optional)</Label>
                <p className="text-xs text-muted-foreground">Upload a reference to maintain character consistency</p>
                
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload</TabsTrigger>
                    <TabsTrigger value="gallery">Gallery</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="upload" className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="file" accept="image/*" onChange={handleReferenceUpload} className="hidden" id="regen-ref-upload" />
                      <label htmlFor="regen-ref-upload" className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-md cursor-pointer hover:bg-muted">
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
                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 w-5 h-5" onClick={() => setRegenReferenceUrl('')}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Edit Script</Label>
                <p className="text-xs text-muted-foreground">Modify the script — new audio will be generated automatically.</p>
                <Textarea value={regenEditedText} onChange={(e) => setRegenEditedText(e.target.value)} rows={4} className="resize-none" />
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegenDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (regenDialogType === 'image') {
                regenerateSceneImage(regenDialogSceneIndex, regenReferenceUrl || undefined);
              } else {
                regenerateSceneVideo(regenDialogSceneIndex, regenEditedText !== scenes[regenDialogSceneIndex]?.text ? regenEditedText : undefined);
              }
            }}>
              {regenDialogType === 'image' ? 'Regenerate Image' : 'Regenerate Video'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Video className="w-5 h-5 text-primary" />
              Edit Reel
            </SheetTitle>
            <SheetDescription className="line-clamp-1">{reel.topic}</SheetDescription>
          </SheetHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-muted-foreground">Loading...</span>
            </div>
          ) : (
          <div className="space-y-5 mt-5">

            {/* ===== FINAL VIDEO PREVIEW ===== */}
            {reel.video_url && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Play className="w-4 h-4" /> Final Video
                </Label>
                <div className="rounded-xl overflow-hidden bg-black border border-border">
                  <video src={reel.video_url} controls playsInline className="w-full aspect-[9/16]" />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(reel.video_url!, '_blank')}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={restitchVideo}
                    disabled={isRestitching || isStitching || videoClipCount === 0}
                  >
                    {isRestitching ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    Rebuild Video
                  </Button>
                </div>
              </div>
            )}

            {/* No video yet — prompt to build */}
            {!reel.video_url && videoClipCount > 0 && (
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">Your {videoClipCount} scene clips are ready</p>
                <p className="text-xs text-muted-foreground">Combine them into one final video</p>
                <Button onClick={restitchVideo} disabled={isRestitching || isStitching} className="bg-primary text-primary-foreground">
                  {isRestitching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Video className="w-4 h-4 mr-2" />}
                  Build Final Video
                </Button>
              </div>
            )}

            {/* Stitching Progress */}
            {(isStitching || isRestitching) && (
              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{stitchStatus || 'Building video...'}</span>
                  <span className="text-primary font-medium">{stitchProgress}%</span>
                </div>
                <Progress value={stitchProgress} className="h-2" />
              </div>
            )}

            {/* ===== SCENES ===== */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Scenes ({scenes.length})</Label>
              
              {scenes.map((scene, idx) => {
                const isRegenerating = regeneratingScene === idx;
                
                return (
                  <div key={idx} className="rounded-xl border border-border overflow-hidden bg-card">
                    <div className="flex gap-3 p-3">
                      {/* Thumbnail */}
                      <div className="w-14 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0 relative">
                        {scene.imageUrl ? (
                          <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        {scene.videoUrl && (
                          <div className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                            <Play className="w-2.5 h-2.5 text-primary-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">Scene {idx + 1}</span>
                          {isRegenerating && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 animate-pulse">
                              <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" />
                              {regeneratingType === 'image' ? 'Image...' : 'Video...'}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{scene.text}</p>
                      </div>
                    </div>

                    {/* Scene Actions */}
                    <div className="flex border-t border-border divide-x divide-border">
                      {scene.videoUrl && (
                        <VideoPlayer
                          videoUrl={scene.videoUrl}
                          title={`Scene ${idx + 1}`}
                          trigger={
                            <button className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-primary hover:bg-primary/5 transition-colors">
                              <Play className="w-3 h-3" /> Preview
                            </button>
                          }
                        />
                      )}
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                        disabled={isRegenerating}
                        onClick={() => openRegenDialog(idx, 'image')}
                      >
                        <ImageIcon className="w-3 h-3" /> New Image
                      </button>
                      <button
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
                        disabled={isRegenerating || !scene.imageUrl}
                        onClick={() => openRegenDialog(idx, 'video')}
                      >
                        <Video className="w-3 h-3" /> New Video
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ===== CAPTIONS ===== */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <Captions className="w-4 h-4" />
                  Captions
                  {captionSettings.enabled && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">ON</Badge>
                  )}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 p-3 rounded-lg border border-border bg-muted/10">
                <CaptionStyleSelector
                  settings={captionSettings}
                  onChange={setCaptionSettings}
                />
                {hasChanges && (
                  <p className="text-[10px] text-primary mt-2">
                    💡 Caption changes will apply when you rebuild the video or save.
                  </p>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* ===== SAVE BAR ===== */}
            <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border pt-3 pb-2 -mx-6 px-6">
              <Button 
                onClick={saveChanges} 
                disabled={isSaving || !hasChanges}
                className="w-full"
                size="lg"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {hasChanges ? 'Save Changes' : 'No Changes'}
              </Button>
            </div>
          </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};
