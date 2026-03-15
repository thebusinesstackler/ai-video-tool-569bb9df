import { useState, useRef } from 'react';
import { CommercialSegment, TransitionType } from '@/types/testimonialCommercial';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { 
  GripVertical, Trash2, User, Film, Loader2, CheckCircle, AlertCircle, 
  Wand2, ImageIcon, Sparkles, Check, Play, Pause, Volume2, Maximize2, Pencil, X,
  Copy, Headphones, Package, Upload
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SegmentCardProps {
  segment: CommercialSegment;
  index: number;
  typeNumber: number; // Type-specific number (Scene #1, B-Roll #1)
  onUpdate: (id: string, updates: Partial<CommercialSegment>) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onGenerateCharacter?: (segmentId: string, description: string) => Promise<void>;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Loader2 }> = {
  'pending': { label: 'Pending', color: 'bg-muted text-muted-foreground', icon: AlertCircle },
  'generating-character': { label: 'Generating Character...', color: 'bg-accent/20 text-accent-foreground', icon: Loader2 },
  'character-ready': { label: 'Ready', color: 'bg-primary/20 text-primary', icon: ImageIcon },
  'approved': { label: 'Approved', color: 'bg-primary/20 text-primary', icon: CheckCircle },
  'generating': { label: 'Generating Video...', color: 'bg-accent/20 text-accent-foreground', icon: Loader2 },
  'complete': { label: 'Complete', color: 'bg-primary/20 text-primary', icon: CheckCircle },
  'error': { label: 'Error', color: 'bg-destructive/20 text-destructive', icon: AlertCircle },
};

export function SegmentCard({
  segment,
  index,
  typeNumber,
  onUpdate,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onGenerateCharacter,
}: SegmentCardProps) {
  const rawStatus = segment.status || 'pending';
  const status = (rawStatus === 'error' && segment.type === 'broll' && segment.brollImages && segment.brollImages.length > 0)
    ? 'character-ready'
    : rawStatus;
  const statusInfo = statusConfig[status] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;
  const [charDescription, setCharDescription] = useState(segment.character?.description || '');
  const isGeneratingChar = status === 'generating-character';

  // Media playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [isGeneratingNewVoice, setIsGeneratingNewVoice] = useState(false);
  const [isGeneratingBroll, setIsGeneratingBroll] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Lightbox state
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [expandedImageLabel, setExpandedImageLabel] = useState('');

  // Product image swap state
  const [isUploadingProduct, setIsUploadingProduct] = useState(false);
  const [isSwappingProduct, setIsSwappingProduct] = useState(false);
  const productInputRef = useRef<HTMLInputElement | null>(null);

  // Edit image description state
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState('');

  // Detect gender from character description to pick the right voice
  const detectVoiceId = (): string => {
    const desc = (segment.character?.description || '').toLowerCase();
    const gender = (segment.character?.gender || '').toLowerCase();
    const isFemale = gender.includes('female') || gender.includes('woman') ||
      /\b(woman|female|girl|lady|she|her|mother|actress)\b/.test(desc);
    const isMale = gender.includes('male') || gender.includes('man') ||
      /\b(man|male|boy|guy|he|his|father|actor|beard|bearded)\b/.test(desc);
    
    if (isFemale) return 'English_compelling_lady1';
    if (isMale) return 'English_Trustworth_Man';
    return 'Friendly_Person'; // fallback
  };

  const handlePreviewVoice = async () => {
    if (!segment.script?.trim()) { toast.error('Add a script first'); return; }
    setIsPreviewingVoice(true);
    try {
      const voiceId = detectVoiceId();
      console.log('Voice preview using:', voiceId, 'for character:', segment.character?.name);
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: segment.script.slice(0, 200), voice_id: voiceId }
      });
      if (error) throw error;
      if (data?.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play();
        toast.success(`Playing ${voiceId.replace(/_/g, ' ')} voice`);
      }
    } catch (err) {
      console.error('Voice preview failed:', err);
      toast.error('Voice preview failed');
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  // Generate a brand new voice — picks a random matching voice, calls TTS, saves to segment
  const handleGenerateNewVoice = async () => {
    if (!segment.script?.trim()) { toast.error('Add a script first'); return; }
    setIsGeneratingNewVoice(true);
    try {
      // Pick a random voice matching character gender
      const desc = (segment.character?.description || '').toLowerCase();
      const gender = (segment.character?.gender || '').toLowerCase();
      const isFemale = gender.includes('female') || gender.includes('woman') ||
        /\b(woman|female|girl|lady|she|her|mother|actress)\b/.test(desc);
      
      const femaleVoices = ['English_compelling_lady1', 'English_radiant_girl', 'Calm_Woman', 'Inspirational_girl'];
      const maleVoices = ['English_magnetic_voiced_man', 'English_Trustworth_Man', 'Casual_Guy', 'Deep_Voice_Man'];
      const pool = isFemale ? femaleVoices : maleVoices;
      const voiceId = pool[Math.floor(Math.random() * pool.length)];

      toast.info(`🎙️ Generating new ${isFemale ? 'female' : 'male'} voice (${voiceId.replace(/_/g, ' ')})...`);

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: segment.script, voice: voiceId }
      });
      if (error) throw error;
      
      if (data?.audioUrl) {
        const usedVoiceId = data.voiceUsed || voiceId;
        
        // Save to segment
        onUpdate(segment.id, { audioUrl: data.audioUrl, voiceoverId: usedVoiceId });
        
        // Stop any existing playback
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
        
        // Play new audio
        const audio = new Audio(data.audioUrl);
        audioRef.current = audio;
        audio.onended = () => setIsPlayingAudio(false);
        audio.play();
        setIsPlayingAudio(true);
        
        toast.success(`🎙️ New voice generated — ${usedVoiceId.replace(/_/g, ' ')}`, {
          action: {
            label: 'Copy Voice ID',
            onClick: () => {
              navigator.clipboard.writeText(usedVoiceId);
              toast.info(`Voice ID "${usedVoiceId}" copied`);
            },
          },
          duration: 8000,
        });
      }
    } catch (err) {
      console.error('New voice generation failed:', err);
      toast.error('Failed to generate new voice');
    } finally {
      setIsGeneratingNewVoice(false);
    }
  };

  const handleConfirmDelete = () => {
    onDelete(segment.id);
    setShowDeleteConfirm(false);
  };
  const handleGenerateChar = () => {
    if (!charDescription.trim() || !onGenerateCharacter) return;
    onGenerateCharacter(segment.id, charDescription);
  };

  const toggleAudio = () => {
    if (!segment.audioUrl) return;
    if (isPlayingAudio) {
      audioRef.current?.pause();
      setIsPlayingAudio(false);
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(segment.audioUrl);
        audioRef.current.onended = () => setIsPlayingAudio(false);
      }
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  const openImageExpand = (url: string, label: string) => {
    setExpandedImage(url);
    setExpandedImageLabel(label);
  };

  const startEditImage = (imgIndex: number) => {
    setEditingImageIndex(imgIndex);
    setEditDescription('');
  };

  const submitEditDescription = () => {
    if (editingImageIndex === null || !editDescription.trim() || !onGenerateCharacter) return;
    // Re-generate character with updated description
    const newDesc = `${segment.character?.description || ''}\n\nEdit for angle ${editingImageIndex + 1}: ${editDescription}`;
    onGenerateCharacter(segment.id, newDesc);
    setEditingImageIndex(null);
    setEditDescription('');
  };

  const handleProductUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProduct(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const fileName = `products/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);
      onUpdate(segment.id, { productImageUrl: publicUrl });
      toast.success('Product image uploaded');
    } catch (err) {
      console.error('Product upload error:', err);
      toast.error('Failed to upload product image');
    } finally {
      setIsUploadingProduct(false);
      if (productInputRef.current) productInputRef.current.value = '';
    }
  };

  const handleSwapProduct = async () => {
    if (!segment.productImageUrl || !segment.character?.referenceImages?.[0]) return;
    setIsSwappingProduct(true);
    try {
      const refImage = segment.character.referenceImages[0]; // Use front angle
      const { data, error } = await supabase.functions.invoke('edit-scene-image', {
        body: {
          prompt: `Replace any product/item the person is holding with the product shown in the second reference image. Keep the person EXACTLY the same — same face, pose, clothing, lighting, and background. Only swap the product/item in their hand with the new product.`,
          referenceImages: [refImage, segment.productImageUrl],
          characterDescription: segment.character.description,
        }
      });
      if (error) throw error;
      if (data?.imageUrl) {
        const updatedImages = [...segment.character.referenceImages];
        updatedImages[0] = data.imageUrl;
        onUpdate(segment.id, {
          character: { ...segment.character, referenceImages: updatedImages }
        });
        toast.success('Product swapped in character image');
      }
    } catch (err) {
      console.error('Product swap error:', err);
      toast.error('Failed to swap product');
    } finally {
      setIsSwappingProduct(false);
    }
  };

  const angleLabels = ['Front', '3/4 Left', 'Side', 'Low Angle', '3/4 Right', 'Wide'];

  return (
    <>
      <Card
        className="relative group hover:shadow-md transition-shadow"
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <Badge variant="outline" className="gap-1 text-xs">
                {segment.type === 'speaking' ? <User className="h-3 w-3" /> : <Film className="h-3 w-3" />}
                {segment.type === 'speaking' ? 'Speaking' : 'B-Roll'}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">#{index + 1}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {/* Play cached audio */}
              {segment.audioUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={toggleAudio}
                  title={isPlayingAudio ? 'Pause voice' : 'Play voice'}
                >
                  {isPlayingAudio ? (
                    <Pause className="h-3 w-3 text-primary" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                </Button>
              )}
              {/* Generate New Voice — always available for speaking segments with script */}
              {segment.type === 'speaking' && segment.script && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleGenerateNewVoice}
                  disabled={isGeneratingNewVoice}
                  title={segment.audioUrl ? 'Generate new voice' : 'Preview voice'}
                >
                  {isGeneratingNewVoice ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Headphones className="h-3 w-3" />
                  )}
                </Button>
              )}
              {/* Voice ID badge — click to copy */}
              {segment.voiceoverId && (
                <button
                  className="text-[9px] font-mono bg-muted/60 rounded px-1.5 py-0.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors border border-border/50"
                  onClick={() => {
                    navigator.clipboard.writeText(segment.voiceoverId!);
                    toast.success(`Voice ID "${segment.voiceoverId}" copied — reuse this voice anytime`);
                  }}
                  title="Copy voice ID to reuse this voice"
                >
                  🎙️ {segment.voiceoverId.slice(0, 16)}…
                </button>
              )}
              {/* Play video button */}
              {segment.videoUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsPlayingVideo(!isPlayingVideo)}
                  title={isPlayingVideo ? 'Hide video' : 'Play video'}
                >
                  {isPlayingVideo ? (
                    <Pause className="h-3 w-3 text-primary" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </Button>
              )}
              <Badge className={`${statusInfo.color} text-xs gap-1`}>
                <StatusIcon className={`h-3 w-3 ${isGeneratingChar || status === 'generating' ? 'animate-spin' : ''}`} />
                {statusInfo.label}
              </Badge>
              {/* Duplicate */}
              {onDuplicate && (
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onDuplicate(segment.id)} title="Duplicate">
                  <Copy className="h-3 w-3" />
                </Button>
              )}
              {/* Delete with confirmation */}
              {showDeleteConfirm ? (
                <div className="flex items-center gap-1">
                  <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2" onClick={handleConfirmDelete}>Delete</Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                </div>
              ) : (
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Inline video player */}
          {isPlayingVideo && segment.videoUrl && (
            <div className="rounded-lg overflow-hidden border border-border">
              <video src={segment.videoUrl} controls autoPlay className="w-full max-h-[200px]" />
            </div>
          )}

          {/* Speaking segment */}
          {segment.type === 'speaking' && (
            <>
              {segment.character && segment.character.referenceImages.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-3 w-3 text-primary" />
                      {segment.character.name}
                    </Label>
                    {status === 'character-ready' && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 h-7 text-xs"
                        onClick={() => onUpdate(segment.id, { status: 'approved' })}
                      >
                        <Check className="h-3 w-3" />
                        Approve
                      </Button>
                    )}
                    {status === 'approved' && (
                      <Badge className="bg-primary/20 text-primary gap-1">
                        <CheckCircle className="h-3 w-3" /> Approved
                      </Badge>
                    )}
                  </div>

                  {/* 6 Angle Grid with expand + edit */}
                  <div className="grid grid-cols-3 gap-2">
                    {segment.character.referenceImages.slice(0, 6).map((img, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30 group/img">
                        <img src={img} alt={`Angle ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                          <span className="text-[10px] text-white font-medium">
                            {angleLabels[i] || `Angle ${i + 1}`}
                          </span>
                        </div>
                        {/* Hover overlay with expand + edit */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={(e) => { e.stopPropagation(); openImageExpand(img, angleLabels[i] || `Angle ${i + 1}`); }}
                            title="Expand image"
                          >
                            <Maximize2 className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-7 w-7 rounded-full"
                            onClick={(e) => { e.stopPropagation(); startEditImage(i); }}
                            title="Edit this angle"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Inline edit description input */}
                  {editingImageIndex !== null && (
                    <div className="border border-primary/30 rounded-lg p-3 bg-primary/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium flex items-center gap-1.5">
                          <Pencil className="h-3 w-3 text-primary" />
                          Edit {angleLabels[editingImageIndex] || `Angle ${editingImageIndex + 1}`}
                        </Label>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingImageIndex(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Describe what you want changed... e.g. 'Make the lighting warmer' or 'Change outfit to a red jacket'"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <Button
                        size="sm"
                        className="w-full gap-1 text-xs"
                        onClick={submitEditDescription}
                        disabled={!editDescription.trim() || isGeneratingChar}
                      >
                        <Wand2 className="h-3 w-3" />
                        Regenerate Character
                      </Button>
                    </div>
                  )}

                  {/* Product Image Swap */}
                  <div className="border border-dashed border-muted-foreground/30 rounded-lg p-3 bg-muted/20 space-y-2">
                    <div className="flex items-center gap-2">
                      <Package className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">Product Image</span>
                    </div>
                    {segment.productImageUrl ? (
                      <div className="flex items-center gap-3">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                          <img src={segment.productImageUrl} alt="Product" className="w-full h-full object-cover" />
                          <button
                            className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                            onClick={() => onUpdate(segment.id, { productImageUrl: undefined })}
                          >
                            <X className="h-2.5 w-2.5 text-white" />
                          </button>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1 text-xs h-8"
                          onClick={handleSwapProduct}
                          disabled={isSwappingProduct || !segment.character?.referenceImages?.[0]}
                        >
                          {isSwappingProduct ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Wand2 className="h-3 w-3" />
                          )}
                          Swap Product In
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <input
                          ref={productInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleProductUpload}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs h-8"
                          onClick={() => productInputRef.current?.click()}
                          disabled={isUploadingProduct}
                        >
                          {isUploadingProduct ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          Upload Product Image
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-dashed border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Describe the actor</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI will generate a photorealistic character with 6 cinematic angles
                  </p>
                  <Textarea
                    placeholder="e.g. Confident woman in her 30s, professional business attire, warm smile..."
                    value={charDescription}
                    onChange={(e) => setCharDescription(e.target.value)}
                    className="min-h-[60px] text-sm"
                    rows={2}
                  />
                  <Button
                    onClick={handleGenerateChar}
                    disabled={isGeneratingChar || !charDescription.trim()}
                    className="w-full gap-2"
                    size="sm"
                  >
                    {isGeneratingChar ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Wand2 className="h-3 w-3" />
                    )}
                    Generate Character (6 Angles)
                  </Button>
                </div>
              )}

              {/* Script */}
              <div className="space-y-2">
                <Label className="text-sm">Script</Label>
                <Textarea
                  placeholder="What the character will say..."
                  value={segment.script || ''}
                  onChange={(e) => onUpdate(segment.id, { script: e.target.value })}
                  rows={3}
                  className="text-sm"
                />
              </div>
            </>
          )}

          {/* B-Roll segment */}
          {segment.type === 'broll' && (
            <>
              <div className="space-y-2">
                <Label className="text-sm">Visual Description</Label>
                <Textarea
                  placeholder="Describe the B-roll visuals..."
                  value={segment.brollPrompts?.[0] || ''}
                  onChange={(e) => onUpdate(segment.id, { brollPrompts: [e.target.value] })}
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Voiceover (optional)</Label>
                <Textarea
                  placeholder="Narration over B-roll..."
                  value={segment.voiceoverText || ''}
                  onChange={(e) => onUpdate(segment.id, { voiceoverText: e.target.value })}
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Generate / Preview / Approve B-Roll */}
              {segment.brollImages && segment.brollImages.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <ImageIcon className="h-3 w-3 text-primary" />
                      B-Roll Preview
                    </Label>
                    <div className="flex items-center gap-1.5">
                      {status !== 'approved' && (
                        <Button
                          size="sm"
                          variant="default"
                          className="gap-1 h-7 text-xs"
                          onClick={() => onUpdate(segment.id, { status: 'approved' })}
                        >
                          <Check className="h-3 w-3" />
                          Approve
                        </Button>
                      )}
                      {status === 'approved' && (
                        <Badge className="bg-primary/20 text-primary gap-1">
                          <CheckCircle className="h-3 w-3" /> Approved
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        disabled={isGeneratingBroll}
                        onClick={async () => {
                          const prompt = segment.brollPrompts?.[0];
                          if (!prompt?.trim()) { toast.error('Add a visual description first'); return; }
                          setIsGeneratingBroll(true);
                          onUpdate(segment.id, { status: 'generating-character' });
                          try {
                            const { data, error } = await supabase.functions.invoke('generate-scene-image', {
                              body: { prompt, aspectRatio: '16:9' }
                            });
                            if (error) throw error;
                            if (data?.imageUrl) {
                              onUpdate(segment.id, { brollImages: [data.imageUrl], status: 'character-ready' });
                              toast.success('B-roll preview regenerated');
                            }
                          } catch (err) {
                            console.error('B-roll regen error:', err);
                            onUpdate(segment.id, { status: 'character-ready' });
                            toast.error('Failed to regenerate');
                          } finally {
                            setIsGeneratingBroll(false);
                          }
                        }}
                      >
                        {isGeneratingBroll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                        Regenerate
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {segment.brollImages.map((img, i) => (
                      <div key={i} className="relative aspect-video rounded-md overflow-hidden border border-border group/broll cursor-pointer"
                        onClick={() => openImageExpand(img, `B-roll ${i + 1}`)}
                      >
                        <img src={img} alt={`B-roll ${i + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/broll:opacity-100 transition-opacity flex items-center justify-center">
                          <Maximize2 className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Button
                  size="sm"
                  className="w-full gap-2"
                  disabled={isGeneratingBroll || !segment.brollPrompts?.[0]?.trim()}
                  onClick={async () => {
                    const prompt = segment.brollPrompts?.[0];
                    if (!prompt?.trim()) { toast.error('Add a visual description first'); return; }
                    setIsGeneratingBroll(true);
                    onUpdate(segment.id, { status: 'generating-character' });
                    try {
                      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
                        body: { prompt, aspectRatio: '16:9' }
                      });
                      if (error) throw error;
                      if (data?.imageUrl) {
                        onUpdate(segment.id, { brollImages: [data.imageUrl], status: 'character-ready' });
                        toast.success('B-roll preview generated');
                      }
                    } catch (err) {
                      console.error('B-roll gen error:', err);
                      onUpdate(segment.id, { status: 'pending' });
                      toast.error('Failed to generate B-roll preview');
                    } finally {
                      setIsGeneratingBroll(false);
                    }
                  }}
                >
                  {isGeneratingBroll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                  Generate B-Roll Preview
                </Button>
              )}
            </>
          )}

          {/* Duration & Transition */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Transition</Label>
              <Select value={segment.transition} onValueChange={(v: TransitionType) => onUpdate(segment.id, { transition: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fade-in">Fade In</SelectItem>
                  <SelectItem value="cut">Cut</SelectItem>
                  <SelectItem value="crossfade">Crossfade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration</Label>
              <Select value={segment.duration.toString()} onValueChange={(v) => onUpdate(segment.id, { duration: parseInt(v) })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 8, 10, 15, 20, 30].map(d => (
                    <SelectItem key={d} value={d.toString()}>{d}s</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Image Lightbox Dialog */}
      <Dialog open={!!expandedImage} onOpenChange={() => setExpandedImage(null)}>
        <DialogContent className="max-w-2xl p-2">
          <DialogHeader className="pb-0">
            <DialogTitle className="text-sm">{expandedImageLabel}</DialogTitle>
          </DialogHeader>
          {expandedImage && (
            <img src={expandedImage} alt={expandedImageLabel} className="w-full rounded-lg object-contain max-h-[70vh]" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
