import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Play, Pause, Image as ImageIcon, Volume2, Star, X, User, Users, Upload, FolderOpen, Pencil, Plus, Film, Type, Trash2, Package, Camera, Mic, Copy, ClipboardPaste, Check } from 'lucide-react';
import { GalleryImagePicker } from '@/components/GalleryImagePicker';
import { CAMERA_ANGLES, CAMERA_CATEGORIES, CameraAngle } from '@/data/cameraAngles';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

interface PreviewScene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioDuration: number;
  isGenerating: boolean;
  isGeneratingImage?: boolean;
  isGeneratingVoice?: boolean;
  isRegenerating?: boolean;
  isReference?: boolean;
}

interface VoiceSampleRequest {
  sceneNumber: number;
  narration: string;
  voiceId: string;
  voiceLabel: string;
}

interface ScenePreviewProps {
  scenes: PreviewScene[];
  onRegenerateImage: (sceneNumber: number, customPrompt?: string, referenceUrl?: string) => void;
  onRegenerateVoice?: (sceneNumber: number, genderOverride?: 'male' | 'female') => void;
  onGenerateVoiceSample?: (req: VoiceSampleRequest) => Promise<{ audioUrl: string } | null>;
  onApplyVoiceSample?: (sceneNumber: number, audioUrl: string) => void;
  onApplyVoiceToAll?: (voiceId: string) => void;
  onCopyVoiceFromScene?: (targetSceneNumber: number, sourceSceneNumber: number) => void;
  onApplyVoiceToAllScenes?: (sourceSceneNumber: number) => void;
  availableVoices?: { id: string; label: string; gender?: string }[];
  onCreateVideo: () => void;
  isCreatingVideo: boolean;
  disabled?: boolean;
  referenceImageUrl?: string | null;
  onSetReference?: (sceneNumber: number) => void;
  onClearReference?: () => void;
  characterTransformation?: string;
  onCharacterTransformationChange?: (value: string) => void;
  onInsertScene?: (insertIndex: number, type: 'broll' | 'intro' | 'outro', prompt: string) => Promise<void>;
  onDeleteScene?: (sceneNumber: number) => void;
  currentScenes?: { sceneNumber: number; narration: string; visualDescription: string; duration: number }[];
  onApplyProductScript?: (scenes: { sceneNumber: number; narration: string; visualDescription: string }[]) => void;
}

const QUICK_TRANSFORMATIONS = [
  { label: 'Male', value: 'Make this character male' },
  { label: 'Female', value: 'Make this character female' },
  { label: 'Older', value: 'Make this character older, middle-aged' },
  { label: 'Younger', value: 'Make this character younger, early 20s' },
  { label: 'Asian', value: 'Make this character Asian ethnicity' },
  { label: 'Black', value: 'Make this character Black/African ethnicity' },
  { label: 'Hispanic', value: 'Make this character Hispanic/Latino ethnicity' },
  { label: 'White', value: 'Make this character White/Caucasian ethnicity' },
  { label: 'Glasses', value: 'Add glasses to this character' },
  { label: 'Blonde Hair', value: 'Change hair color to blonde' },
  { label: 'Dark Hair', value: 'Change hair color to dark brown/black' },
  { label: 'Red Hair', value: 'Change hair color to red/auburn' },
];

const SETTING_PRESETS = [
  { label: 'Coffee Shop', value: 'in a cozy coffee shop with warm lighting' },
  { label: 'Office', value: 'in a modern office environment' },
  { label: 'Beach', value: 'on a beautiful beach at sunset' },
  { label: 'City Street', value: 'on a bustling city street' },
  { label: 'Nature', value: 'in a lush green forest or park' },
  { label: 'Studio', value: 'in a professional photography studio with clean backdrop' },
  { label: 'Home', value: 'in a comfortable home living room' },
  { label: 'Gym', value: 'in a modern fitness gym' },
];

export const ScenePreview: React.FC<ScenePreviewProps> = ({
  scenes,
  onRegenerateImage,
  onRegenerateVoice,
  onGenerateVoiceSample,
  onApplyVoiceSample,
  onApplyVoiceToAll,
  onCopyVoiceFromScene,
  onApplyVoiceToAllScenes,
  availableVoices = [],
  onCreateVideo,
  isCreatingVideo,
  disabled = false,
  referenceImageUrl,
  onSetReference,
  onClearReference,
  characterTransformation = '',
  onCharacterTransformationChange,
  onInsertScene,
  onDeleteScene,
  currentScenes,
  onApplyProductScript,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const audioRefs = useRef<Map<number, HTMLAudioElement>>(new Map());
  
  // Regeneration dialog state
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [selectedScene, setSelectedScene] = useState<PreviewScene | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [localReferenceUrl, setLocalReferenceUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Insert scene dialog state
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState(0);
  const [insertType, setInsertType] = useState<'broll' | 'intro' | 'outro'>('broll');
  const [insertPrompt, setInsertPrompt] = useState('');
  const [isInserting, setIsInserting] = useState(false);
  const [selectedAngleCategory, setSelectedAngleCategory] = useState<string>('framing');
  const [insertAngleCategory, setInsertAngleCategory] = useState<string>('framing');
  // Product library state
  const [productImages, setProductImages] = useState<{ id: string; image_url: string; name: string | null }[]>([]);
  const [selectedProductUrl, setSelectedProductUrl] = useState<string | null>(null);
  const [selectedProductName, setSelectedProductName] = useState<string | null>(null);
  const [productPlacementInstructions, setProductPlacementInstructions] = useState('');
  const [insertProductUrl, setInsertProductUrl] = useState<string | null>(null);
  const productFileRef = useRef<HTMLInputElement>(null);

  // Multi-voice preview state
  const [voicePreviewDialogOpen, setVoicePreviewDialogOpen] = useState(false);
  const [voicePreviewScene, setVoicePreviewScene] = useState<PreviewScene | null>(null);
  const [voiceSamples, setVoiceSamples] = useState<{ id: string; audioUrl: string; label: string; voiceId: string; isGenerating?: boolean }[]>([]);
  const [isGeneratingVoices, setIsGeneratingVoices] = useState(false);
  const [playingVoiceSample, setPlayingVoiceSample] = useState<string | null>(null);
  const voiceSampleRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Voice clipboard: scene number whose voice the user wants to copy to others
  const [copiedVoiceSceneNumber, setCopiedVoiceSceneNumber] = useState<number | null>(null);

  // Product analysis state
  const [productAnalysisOpen, setProductAnalysisOpen] = useState(false);
  const [isAnalyzingProduct, setIsAnalyzingProduct] = useState(false);
  const [analyzedProduct, setAnalyzedProduct] = useState<any>(null);
  const [rewrittenScenes, setRewrittenScenes] = useState<any[] | null>(null);
  const [productUploadUrl, setProductUploadUrl] = useState<string | null>(null);
  const productUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      supabase.from('product_images').select('id, image_url, name').eq('user_id', user.id).order('created_at', { ascending: false })
        .then(({ data }) => { if (data) setProductImages(data); });
    }
  }, [user]);

  const allScenesReady = scenes.every(s => s.imageUrl && !s.isGenerating);
  const totalDuration = scenes.reduce((acc, s) => acc + s.audioDuration, 0);

  const handlePlayAudio = (sceneNumber: number, audioUrl: string) => {
    // Stop any currently playing audio
    audioRefs.current.forEach((audio, num) => {
      if (num !== sceneNumber) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    let audio = audioRefs.current.get(sceneNumber);
    
    // Always recreate audio if URL changed or doesn't exist
    if (!audio || audio.src !== audioUrl) {
      audio = new Audio(audioUrl);
      audio.onended = () => setPlayingAudio(null);
      audio.onerror = (e) => {
        console.error('Audio playback error for scene', sceneNumber, ':', e);
        setPlayingAudio(null);
      };
      audioRefs.current.set(sceneNumber, audio);
    }

    if (playingAudio === sceneNumber) {
      audio.pause();
      audio.currentTime = 0;
      setPlayingAudio(null);
    } else {
      audio.play().catch(err => {
        console.error('Failed to play audio:', err);
        setPlayingAudio(null);
      });
      setPlayingAudio(sceneNumber);
    }
  };

  const openRegenerateDialog = (scene: PreviewScene) => {
    setSelectedScene(scene);
    setCustomPrompt(scene.visualDescription);
    setLocalReferenceUrl(referenceImageUrl || null);
    setSelectedProductUrl(null);
    setSelectedProductName(null);
    setProductPlacementInstructions('');
    setRegenerateDialogOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      setLocalReferenceUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRegenerate = () => {
    if (!selectedScene) return;
    let finalPrompt = customPrompt;
    if (selectedProductUrl) {
      const placement = productPlacementInstructions.trim() || `Feature ${selectedProductName || 'this product'} prominently in the scene`;
      finalPrompt = `${customPrompt}. ${placement}. The product must be clearly visible, photorealistic, with accurate colors and branding. Hyper-realistic cinematic lighting.`;
      onRegenerateImage(selectedScene.sceneNumber, finalPrompt, selectedProductUrl);
    } else {
      onRegenerateImage(selectedScene.sceneNumber, customPrompt, localReferenceUrl || undefined);
    }
    setRegenerateDialogOpen(false);
    setSelectedScene(null);
    setCustomPrompt('');
    setLocalReferenceUrl(null);
    setSelectedProductUrl(null);
    setSelectedProductName(null);
    setProductPlacementInstructions('');
  };

  // Voice preview functions
  const openVoicePreview = (scene: PreviewScene) => {
    setVoicePreviewScene(scene);
    setVoiceSamples([]);
    setPlayingVoiceSample(null);
    setVoicePreviewDialogOpen(true);
  };

  const generateVoiceSample = async (voiceId: string, voiceLabel: string) => {
    if (!voicePreviewScene || !onGenerateVoiceSample) return;
    const sampleId = `${voiceId}-${Date.now()}`;
    setVoiceSamples(prev => [...prev, { id: sampleId, audioUrl: '', label: voiceLabel, voiceId, isGenerating: true }]);
    
    try {
      const result = await onGenerateVoiceSample({
        sceneNumber: voicePreviewScene.sceneNumber,
        narration: voicePreviewScene.narration || '',
        voiceId,
        voiceLabel,
      });
      if (result?.audioUrl) {
        setVoiceSamples(prev => prev.map(s => s.id === sampleId ? { ...s, audioUrl: result.audioUrl, isGenerating: false } : s));
      } else {
        setVoiceSamples(prev => prev.filter(s => s.id !== sampleId));
      }
    } catch {
      setVoiceSamples(prev => prev.filter(s => s.id !== sampleId));
    }
  };

  const playVoiceSample = (sampleId: string, audioUrl: string) => {
    voiceSampleRefs.current.forEach((a, id) => { if (id !== sampleId) { a.pause(); a.currentTime = 0; } });
    let audio = voiceSampleRefs.current.get(sampleId);
    if (!audio || audio.src !== audioUrl) {
      audio = new Audio(audioUrl);
      audio.onended = () => setPlayingVoiceSample(null);
      voiceSampleRefs.current.set(sampleId, audio);
    }
    if (playingVoiceSample === sampleId) {
      audio.pause(); audio.currentTime = 0; setPlayingVoiceSample(null);
    } else {
      audio.play().catch(() => setPlayingVoiceSample(null));
      setPlayingVoiceSample(sampleId);
    }
  };

  const applyVoiceSampleToScene = (audioUrl: string) => {
    if (!voicePreviewScene || !onApplyVoiceSample) return;
    onApplyVoiceSample(voicePreviewScene.sceneNumber, audioUrl);
    setVoicePreviewDialogOpen(false);
    voiceSampleRefs.current.forEach(a => { a.pause(); a.currentTime = 0; });
  };

  // Product analysis functions
  const handleProductUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setProductUploadUrl(event.target?.result as string);
      setAnalyzedProduct(null);
      setRewrittenScenes(null);
    };
    reader.readAsDataURL(file);
  };

  const analyzeProduct = async () => {
    if (!productUploadUrl) return;
    setIsAnalyzingProduct(true);
    setAnalyzedProduct(null);
    setRewrittenScenes(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-product', {
        body: {
          imageUrl: productUploadUrl,
          currentScript: currentScenes || scenes.map(s => ({
            sceneNumber: s.sceneNumber,
            narration: s.narration,
            visualDescription: s.visualDescription,
          })),
        }
      });
      
      if (error) throw error;
      
      setAnalyzedProduct(data.productInfo);
      if (data.rewrittenScenes) {
        setRewrittenScenes(data.rewrittenScenes);
      }

      // Save product to library
      if (user) {
        await supabase.from('product_images').insert({
          user_id: user.id,
          image_url: productUploadUrl,
          name: data.productInfo?.productName || 'Product',
        });
        // Refresh product list
        const { data: refreshed } = await supabase.from('product_images').select('id, image_url, name').eq('user_id', user.id).order('created_at', { ascending: false });
        if (refreshed) setProductImages(refreshed);
      }

      toast({ title: 'Product Analyzed!', description: `Identified: ${data.productInfo?.productName || 'Product'}` });
    } catch (err: any) {
      console.error('Product analysis failed:', err);
      toast({ title: 'Analysis Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsAnalyzingProduct(false);
    }
  };

  const applyProductScript = () => {
    if (!rewrittenScenes || !onApplyProductScript) return;
    onApplyProductScript(rewrittenScenes);
    setProductAnalysisOpen(false);
    toast({ title: 'Script Updated', description: 'Scenes rewritten around your product. Regenerate preview to see changes.' });
  };

  const addPlacementPreset = (setting: string) => {
    if (customPrompt) {
      setCustomPrompt(`${customPrompt} ${setting}`);
    } else {
      setCustomPrompt(setting);
    }
  };

  const handleInsertScene = async () => {
    if (!insertPrompt.trim() || !onInsertScene) return;
    setIsInserting(true);
    try {
      await onInsertScene(insertIndex, insertType, insertPrompt);
      setInsertDialogOpen(false);
      setInsertPrompt('');
    } finally {
      setIsInserting(false);
    }
  };

  const openInsertDialog = (index: number, type: 'broll' | 'intro' | 'outro') => {
    setInsertIndex(index);
    setInsertType(type);
    setInsertPrompt('');
    setInsertProductUrl(null);
    setInsertDialogOpen(true);
  };

  const InsertButton = ({ index }: { index: number }) => {
    if (!onInsertScene) return null;
    return (
      <div className="flex items-center justify-center col-span-full md:col-span-full py-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
              <Plus className="w-3 h-3" /> Insert Scene
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => openInsertDialog(index, 'broll')}>
              <Film className="w-4 h-4 mr-2" /> B-Roll Shot
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openInsertDialog(index, 'intro')}>
              <Type className="w-4 h-4 mr-2" /> Intro / Title Card
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openInsertDialog(index, 'outro')}>
              <Type className="w-4 h-4 mr-2" /> Outro / CTA Slide
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              Scene Preview
            </div>
            {onApplyProductScript && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setProductAnalysisOpen(true)}
              >
                <Package className="w-3.5 h-3.5" />
                Add Product
              </Button>
            )}
          </CardTitle>
          <CardDescription className="flex items-center justify-between">
            <span>Review and adjust scene images before creating the final video</span>
            <span className="text-primary font-medium">
              {totalDuration.toFixed(1)}s total
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reference indicator with transformation options */}
          {referenceImageUrl && (
            <div className="space-y-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md overflow-hidden border-2 border-amber-500">
                    <img 
                      src={referenceImageUrl} 
                      alt="Reference" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Reference Active
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {characterTransformation 
                        ? `Transforming: ${characterTransformation}` 
                        : 'Regenerated scenes will match this character'}
                    </p>
                  </div>
                </div>
                {onClearReference && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={onClearReference}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              
              {/* Character Transformation Input */}
              {onCharacterTransformationChange && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Character Transformation (optional)
                  </label>
                  <Input
                    placeholder="e.g., Make this character male instead of female"
                    value={characterTransformation}
                    onChange={(e) => onCharacterTransformationChange(e.target.value)}
                    className="bg-background/50 text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TRANSFORMATIONS.map((t) => (
                      <Button
                        key={t.label}
                        variant={characterTransformation === t.value ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onCharacterTransformationChange(
                          characterTransformation === t.value ? '' : t.value
                        )}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Scene Grid with Insert Points */}
          <div className="space-y-2">
            <InsertButton index={0} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {scenes.map((scene, idx) => (
                <React.Fragment key={scene.sceneNumber}>
                  <div className="relative group">
                    <div className={`aspect-[9/16] bg-muted rounded-lg overflow-hidden relative ${
                      scene.isReference ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-background' : ''
                    }`}>
                      {(scene.isGeneratingImage ?? scene.isGenerating) || scene.isRegenerating ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <span className="text-xs text-muted-foreground">
                            {scene.isRegenerating ? 'Regenerating image…' : 'Generating image…'}
                          </span>
                        </div>
                      ) : scene.imageUrl ? (
                        <img
                          src={scene.imageUrl}
                          alt={`Scene ${scene.sceneNumber}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                          <ImageIcon className="w-6 h-6" />
                          <span className="text-xs">No image</span>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-1"
                            onClick={() => onRegenerateImage(scene.sceneNumber, scene.visualDescription)}
                            disabled={disabled}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Generate
                          </Button>
                        </div>
                      )}

                      {/* Scene number badge */}
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {scene.sceneNumber}
                      </div>

                      {/* Delete button */}
                      {onDeleteScene && (
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-10 w-5 h-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => onDeleteScene(scene.sceneNumber)}
                          title="Remove scene"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}

                      {/* Reference badge */}
                      {scene.isReference && (
                        <div className="absolute top-2 right-8 bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current" />
                          Ref
                        </div>
                      )}

                      {/* Duration badge */}
                      {scene.audioDuration > 0 && (
                        <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-xs px-1.5 py-0.5 rounded">
                          {scene.audioDuration.toFixed(1)}s
                        </div>
                      )}

                      {/* Action buttons overlay */}
                      {!scene.isGenerating && scene.imageUrl && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          {scene.audioUrl && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="w-10 h-10 rounded-full"
                              onClick={() => handlePlayAudio(scene.sceneNumber, scene.audioUrl!)}
                            >
                              {playingAudio === scene.sceneNumber ? (
                                <Pause className="w-5 h-5" />
                              ) : (
                                <Volume2 className="w-5 h-5" />
                              )}
                            </Button>
                          )}

                          {/* Regenerate voice button */}
                          {onRegenerateVoice && scene.narration?.trim() && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="w-10 h-10 rounded-full bg-primary/80 hover:bg-primary"
                              onClick={() => onRegenerateVoice(scene.sceneNumber)}
                              disabled={scene.isRegenerating || disabled}
                              title="Regenerate voice for this scene"
                            >
                              {scene.isRegenerating ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Mic className="w-5 h-5" />
                              )}
                            </Button>
                          )}
                          
                          {onSetReference && !scene.isReference && (
                            <Button
                              size="icon"
                              variant="secondary"
                              className="w-10 h-10 rounded-full bg-amber-500/80 hover:bg-amber-500"
                              onClick={() => onSetReference(scene.sceneNumber)}
                              title="Use as reference for character consistency"
                            >
                              <Star className="w-5 h-5" />
                            </Button>
                          )}
                          
                          <Button
                            size="icon"
                            variant="secondary"
                            className="w-10 h-10 rounded-full"
                            onClick={() => openRegenerateDialog(scene)}
                            disabled={scene.isRegenerating || disabled}
                            title="Edit & Regenerate"
                          >
                            <Pencil className="w-5 h-5" />
                          </Button>
                        </div>
                      )}

                      {/* Caption overlay */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-white text-xs line-clamp-2">{scene.narration}</p>
                      </div>
                    </div>

                    {/* Voice — generating placeholder */}
                    {!scene.audioUrl && scene.isGeneratingVoice && scene.narration?.trim() && (
                      <div className="mt-1.5 flex items-center gap-2 px-2 py-1.5 rounded bg-muted/60 border border-border">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />
                        <span className="text-[11px] text-muted-foreground">Generating voice…</span>
                      </div>
                    )}

                    {/* Audio player below card */}
                    {scene.audioUrl && (
                      <div className="mt-1.5 space-y-1">
                        <div className="flex items-center gap-1">
                          <audio controls src={scene.audioUrl} className="w-full h-7" />
                          {onRegenerateVoice && scene.narration?.trim() && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                              onClick={() => onRegenerateVoice(scene.sceneNumber)}
                              disabled={scene.isRegenerating || disabled}
                              title="Regenerate voice"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        {onRegenerateVoice && scene.narration?.trim() && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 flex-1 text-[10px]"
                              onClick={() => onRegenerateVoice(scene.sceneNumber, 'female')}
                              disabled={scene.isRegenerating || disabled}
                              title="Regenerate with a female voice"
                            >
                              ♀ Female voice
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 flex-1 text-[10px]"
                              onClick={() => onRegenerateVoice(scene.sceneNumber, 'male')}
                              disabled={scene.isRegenerating || disabled}
                              title="Regenerate with a male voice"
                            >
                              ♂ Male voice
                            </Button>
                          </div>
                        )}
                        {onCopyVoiceFromScene && scenes.length > 1 && (
                          <div className="flex items-center gap-1">
                            {copiedVoiceSceneNumber === null ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 flex-1 text-[10px]"
                                onClick={() => setCopiedVoiceSceneNumber(scene.sceneNumber)}
                                disabled={disabled}
                                title="Copy this voice to use on another scene"
                              >
                                <Copy className="w-3 h-3 mr-1" />
                                Copy voice
                              </Button>
                            ) : copiedVoiceSceneNumber === scene.sceneNumber ? (
                              <>
                                <Badge variant="outline" className="h-6 px-2 text-[10px] bg-primary/10 text-primary border-primary/30 flex items-center">
                                  <Check className="w-3 h-3 mr-1" /> Copied
                                </Badge>
                                {onApplyVoiceToAllScenes && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 flex-1 text-[10px]"
                                    onClick={() => {
                                      onApplyVoiceToAllScenes(scene.sceneNumber);
                                      setCopiedVoiceSceneNumber(null);
                                    }}
                                    disabled={disabled}
                                    title="Apply this voice to every other scene"
                                  >
                                    Apply to all
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => setCopiedVoiceSceneNumber(null)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 flex-1 text-[10px] border-primary/40 text-primary hover:bg-primary/10"
                                onClick={() => {
                                  onCopyVoiceFromScene(scene.sceneNumber, copiedVoiceSceneNumber);
                                  setCopiedVoiceSceneNumber(null);
                                }}
                                disabled={scene.isRegenerating || disabled}
                                title={`Paste voice from scene ${copiedVoiceSceneNumber}`}
                              >
                                <ClipboardPaste className="w-3 h-3 mr-1" />
                                Paste voice from #{copiedVoiceSceneNumber}
                              </Button>
                            )}
                          </div>
                        )}
                        {onGenerateVoiceSample && availableVoices.length > 0 && scene.narration?.trim() && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] w-full text-muted-foreground hover:text-primary"
                            onClick={() => openVoicePreview(scene)}
                          >
                            <Mic className="w-3 h-3 mr-1" />
                            Preview Different Voices
                          </Button>
                        )}
                      </div>
                    )}
                    {/* Voice failed — offer regenerate */}
                    {!scene.audioUrl && !scene.isGeneratingVoice && scene.narration?.trim() && onRegenerateVoice && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-1.5 h-7 text-[11px] w-full text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                        onClick={() => onRegenerateVoice(scene.sceneNumber)}
                        disabled={disabled}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Voice failed — Generate
                      </Button>
                    )}
                    {!scene.audioUrl && !scene.isGeneratingVoice && onGenerateVoiceSample && availableVoices.length > 0 && scene.narration?.trim() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 text-[10px] w-full text-muted-foreground hover:text-primary"
                        onClick={() => openVoicePreview(scene)}
                      >
                        <Mic className="w-3 h-3 mr-1" />
                        Preview Voices
                      </Button>
                    )}
                  </div>
                  {/* Insert point after every 4th scene (end of row) or last scene */}
                  {((idx + 1) % 4 === 0 || idx === scenes.length - 1) && (
                    <InsertButton index={idx + 1} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Create Video Button */}
          <div className="flex justify-center pt-4">
            <Button
              onClick={onCreateVideo}
              disabled={!allScenesReady || isCreatingVideo || disabled}
              className="bg-gradient-primary hover:opacity-90 px-8"
              size="lg"
            >
              {isCreatingVideo ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Creating Video...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  Create Final Video
                </>
              )}
            </Button>
          </div>

          {!allScenesReady && !isCreatingVideo && (
            <p className="text-center text-sm text-muted-foreground">
              {scenes.some(s => s.isGenerating) 
                ? 'Waiting for all scenes to be generated...'
                : 'All scenes need images before creating the video'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Regenerate Scene Dialog */}
      <Dialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Regenerate Scene {selectedScene?.sceneNumber}
            </DialogTitle>
            <DialogDescription>
              Edit the scene description or add a reference image to customize the regeneration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Current image preview */}
            {selectedScene?.imageUrl && (
              <div className="flex justify-center">
                <div className="w-32 aspect-[9/16] rounded-lg overflow-hidden border">
                  <img 
                    src={selectedScene.imageUrl} 
                    alt="Current scene" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Scene Description Editor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Scene Description</label>
              <Textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what you want in this scene..."
                className="min-h-[100px]"
              />
              
              {/* Setting presets */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Quick Settings (click to add)</label>
                <div className="flex flex-wrap gap-1.5">
                  {SETTING_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => addPlacementPreset(preset.value)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Camera Angle Selector */}
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Camera className="w-3 h-3" />
                  Camera Angle (click to add to description)
                </label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {CAMERA_CATEGORIES.filter(c => ['static', 'framing', 'movement', 'character'].includes(c.id)).map((cat) => (
                    <Button
                      key={cat.id}
                      variant={selectedAngleCategory === cat.id ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setSelectedAngleCategory(cat.id)}
                    >
                      {cat.name}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CAMERA_ANGLES.filter(a => a.category === selectedAngleCategory).slice(0, 8).map((angle) => (
                    <Button
                      key={angle.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setCustomPrompt(prev => `${prev}. ${angle.promptModifier}`)}
                      title={angle.description}
                    >
                      {angle.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reference Image Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <User className="w-4 h-4" />
                Reference Image (optional)
              </label>
              <p className="text-xs text-muted-foreground">
                Add a reference to keep character consistency or put this person in a new setting
              </p>

              {localReferenceUrl ? (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-primary">
                    <img 
                      src={localReferenceUrl} 
                      alt="Reference" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">Reference image selected</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setLocalReferenceUrl(null)}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Tabs defaultValue="upload" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="upload">Upload Image</TabsTrigger>
                    <TabsTrigger value="gallery">From Gallery</TabsTrigger>
                  </TabsList>
                  <TabsContent value="upload" className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button 
                      variant="outline" 
                      className="w-full h-20"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      Upload Reference Image
                    </Button>
                  </TabsContent>
                  <TabsContent value="gallery">
                    <GalleryImagePicker
                      onSelect={(imageUrl) => setLocalReferenceUrl(imageUrl)}
                      trigger={
                        <Button 
                          variant="outline" 
                          className="w-full h-20"
                        >
                          <FolderOpen className="w-5 h-5 mr-2" />
                          Select from Gallery
                        </Button>
                      }
                      title="Select Reference Image"
                    />
                  </TabsContent>
                </Tabs>
              )}
            </div>

            {/* Product Library */}
            {productImages.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Place a Product in This Scene
                </label>
                <p className="text-xs text-muted-foreground">
                  Select a product and describe exactly where and how it should appear
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {productImages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const isDeselecting = selectedProductUrl === p.image_url;
                        setSelectedProductUrl(isDeselecting ? null : p.image_url);
                        setSelectedProductName(isDeselecting ? null : (p.name || 'product'));
                        if (isDeselecting) setProductPlacementInstructions('');
                      }}
                      className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedProductUrl === p.image_url ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <img src={p.image_url} alt={p.name || 'Product'} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                {/* Placement Instructions - shown when product is selected */}
                {selectedProductUrl && (
                  <div className="space-y-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <label className="text-sm font-medium text-primary flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5" />
                      Product Placement Instructions
                    </label>
                    <Textarea
                      value={productPlacementInstructions}
                      onChange={(e) => setProductPlacementInstructions(e.target.value)}
                      placeholder="e.g., Person holding this product in their right hand, product placed on the table in front of them, close-up of product next to the speaker..."
                      className="min-h-[70px] text-sm"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: '🤲 Holding in hand', value: `Person holding ${selectedProductName || 'this product'} in their hand, clearly visible, natural grip` },
                        { label: '🪑 On table', value: `${selectedProductName || 'Product'} placed on the table in front of the person, well-lit, in focus` },
                        { label: '👀 Close-up hero', value: `Extreme close-up of ${selectedProductName || 'this product'}, dramatic cinematic lighting, shallow depth of field, premium product shot` },
                        { label: '🎁 Presenting', value: `Person presenting ${selectedProductName || 'this product'} to camera, showing it off with both hands, proud expression` },
                        { label: '📦 Unboxing', value: `Person unboxing ${selectedProductName || 'this product'}, excited expression, product emerging from packaging` },
                      ].map(preset => (
                        <Button
                          key={preset.label}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setProductPlacementInstructions(preset.value)}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-primary/70">✓ Product selected — placement instructions will guide the AI on how to render it</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setRegenerateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleRegenerate}
                disabled={!customPrompt.trim()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Scene
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Insert Scene Dialog */}
      <Dialog open={insertDialogOpen} onOpenChange={setInsertDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {insertType === 'broll' ? <Film className="w-5 h-5" /> : <Type className="w-5 h-5" />}
              Insert {insertType === 'broll' ? 'B-Roll' : insertType === 'intro' ? 'Intro Slide' : 'Outro / CTA'}
            </DialogTitle>
            <DialogDescription>
              {insertType === 'broll'
                ? 'Describe the cinematic B-roll shot you want to generate'
                : insertType === 'intro'
                ? 'Enter your intro title or hook text'
                : 'Enter your call-to-action or closing text'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              value={insertPrompt}
              onChange={(e) => setInsertPrompt(e.target.value)}
              placeholder={
                insertType === 'broll'
                  ? 'e.g. Steaming cup of coffee on a wooden table, golden hour light...'
                  : insertType === 'intro'
                  ? 'e.g. The Secret Nobody Tells You'
                  : 'e.g. Follow for more tips!'
              }
              className="min-h-[80px]"
            />
            {insertType === 'broll' && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {['Product close-up', 'Nature scenery', 'City timelapse', 'Hands working', 'Food preparation', 'Tech gadget'].map(preset => (
                    <Button key={preset} variant="outline" size="sm" className="h-7 text-xs"
                      onClick={() => setInsertPrompt(preset)}>
                      {preset}
                    </Button>
                  ))}
                </div>

                {/* Camera Angle Quick-Picks for Insert */}
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Camera className="w-3 h-3" />
                    Camera Angle
                  </label>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {CAMERA_CATEGORIES.filter(c => ['static', 'framing', 'movement'].includes(c.id)).map((cat) => (
                      <Button
                        key={cat.id}
                        variant={insertAngleCategory === cat.id ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setInsertAngleCategory(cat.id)}
                      >
                        {cat.name}
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {CAMERA_ANGLES.filter(a => a.category === insertAngleCategory).slice(0, 6).map((angle) => (
                      <Button
                        key={angle.id}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setInsertPrompt(prev => prev ? `${prev}. ${angle.promptModifier}` : angle.promptModifier)}
                        title={angle.description}
                      >
                        {angle.name}
                      </Button>
                    ))}
                  </div>
                </div>
                {productImages.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                      <Package className="w-3 h-3" />
                      Use a Product Image
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {productImages.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            const url = insertProductUrl === p.image_url ? null : p.image_url;
                            setInsertProductUrl(url);
                            if (url && !insertPrompt) {
                              setInsertPrompt(`Extreme close-up of ${p.name || 'this product'} with cinematic lighting, shallow depth of field, premium product photography`);
                            }
                          }}
                          className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            insertProductUrl === p.image_url ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <img src={p.image_url} alt={p.name || 'Product'} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setInsertDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleInsertScene} disabled={!insertPrompt.trim() || isInserting}>
                {isInserting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {isInserting ? 'Generating...' : 'Insert Scene'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Voice Preview Dialog */}
      <Dialog open={voicePreviewDialogOpen} onOpenChange={setVoicePreviewDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Preview Voices — Scene {voicePreviewScene?.sceneNumber}
            </DialogTitle>
            <DialogDescription>
              Generate samples with different voices, listen, and apply the one that fits best
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Narration text preview */}
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Scene narration:</p>
              <p className="text-sm italic">"{voicePreviewScene?.narration}"</p>
            </div>

            {/* Voice options to generate */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Generate a Sample</label>
              <div className="grid grid-cols-2 gap-2">
                {availableVoices.map((voice) => (
                  <Button
                    key={voice.id}
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs justify-start"
                    onClick={() => generateVoiceSample(voice.id, voice.label)}
                    disabled={isGeneratingVoices || disabled}
                  >
                    <Mic className="w-3 h-3 mr-1.5 shrink-0" />
                    <span className="truncate">{voice.label}</span>
                    {voice.gender && <Badge variant="secondary" className="ml-auto text-[9px] h-4">{voice.gender}</Badge>}
                  </Button>
                ))}
              </div>
            </div>

            {/* Generated samples */}
            {voiceSamples.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Generated Samples</label>
                <div className="space-y-2">
                  {voiceSamples.map((sample) => (
                    <div key={sample.id} className="flex items-center gap-2 p-2 border rounded-lg bg-card">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{sample.label}</p>
                      </div>
                      {sample.isGenerating ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Generating...
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => playVoiceSample(sample.id, sample.audioUrl)}
                          >
                            {playingVoiceSample === sample.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 text-xs"
                            onClick={() => applyVoiceSampleToScene(sample.audioUrl)}
                          >
                            Apply to Scene
                          </Button>
                          {onApplyVoiceToAll && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs border-primary/50 text-primary hover:bg-primary/10"
                              onClick={() => {
                                onApplyVoiceToAll(sample.voiceId);
                                applyVoiceSampleToScene(sample.audioUrl);
                              }}
                            >
                              Apply to All
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setVoicePreviewDialogOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Analysis Dialog */}
      <Dialog open={productAnalysisOpen} onOpenChange={setProductAnalysisOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Add Product to Your Reel
            </DialogTitle>
            <DialogDescription>
              Upload a product image — AI will identify it and rewrite your script to feature it naturally
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Upload */}
            <input ref={productUploadRef} type="file" accept="image/*" onChange={handleProductUpload} className="hidden" />
            {productUploadUrl ? (
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-primary">
                  <img src={productUploadUrl} alt="Product" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 space-y-2">
                  {analyzedProduct ? (
                    <div>
                      <p className="text-sm font-medium">{analyzedProduct.productName}</p>
                      <p className="text-xs text-muted-foreground">{analyzedProduct.category}</p>
                      <p className="text-xs text-muted-foreground mt-1">{analyzedProduct.description}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Product uploaded — click Analyze to identify it</p>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setProductUploadUrl(null); setAnalyzedProduct(null); setRewrittenScenes(null); }}>
                      <X className="w-3 h-3 mr-1" /> Remove
                    </Button>
                    {!analyzedProduct && (
                      <Button size="sm" onClick={analyzeProduct} disabled={isAnalyzingProduct}>
                        {isAnalyzingProduct ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Package className="w-3 h-3 mr-1" />}
                        {isAnalyzingProduct ? 'Analyzing...' : 'Analyze Product'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button variant="outline" className="w-full h-20" onClick={() => productUploadRef.current?.click()}>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Product Image
                </Button>
                {productImages.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Or select from your product library:</label>
                    <div className="grid grid-cols-5 gap-2">
                      {productImages.map((p) => (
                        <button key={p.id} onClick={() => { setProductUploadUrl(p.image_url); setAnalyzedProduct(null); setRewrittenScenes(null); }}
                          className="aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary/50 transition-all">
                          <img src={p.image_url} alt={p.name || 'Product'} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Analysis Results */}
            {analyzedProduct?.sellingPoints && (
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <p className="text-xs font-medium">Key Selling Points:</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {analyzedProduct.sellingPoints.map((p: string, i: number) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rewritten Script Preview */}
            {rewrittenScenes && rewrittenScenes.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">AI-Rewritten Script Preview</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {rewrittenScenes.map((s: any) => (
                    <div key={s.sceneNumber} className="p-2 bg-card border rounded-lg">
                      <p className="text-xs font-medium text-primary">Scene {s.sceneNumber}</p>
                      <p className="text-xs mt-1">"{s.narration}"</p>
                    </div>
                  ))}
                </div>
                <Button className="w-full" onClick={applyProductScript}>
                  Apply Product Script
                </Button>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => setProductAnalysisOpen(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
