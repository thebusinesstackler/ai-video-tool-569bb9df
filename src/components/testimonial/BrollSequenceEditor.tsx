import { useState, useRef } from 'react';
import { BrollSequence, ShotVariation, CameraAngle, CameraMovement } from '@/types/testimonialCommercial';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Film, Loader2, CheckCircle, RefreshCw, ImagePlus, 
  GripVertical, X, Upload, Eye, Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BrollSequenceEditorProps {
  sequence: BrollSequence;
  onUpdate: (sequence: BrollSequence) => void;
  isGenerating?: boolean;
}

const angleLabels: Record<CameraAngle, string> = {
  'wide': 'Wide',
  'medium': 'Med',
  'close-up': 'CU',
  'over-shoulder': 'OTS',
  'low-angle': 'Low',
  'high-angle': 'High',
  'dutch-angle': 'Dutch',
  'pov': 'POV'
};

const movementIcons: Record<CameraMovement, string> = {
  'static': '●',
  'push-in': '→●',
  'pull-out': '←●',
  'pan-left': '←',
  'pan-right': '→',
  'tracking': '↔',
  'handheld': '~',
  'dolly': '⇄'
};

export function BrollSequenceEditor({
  sequence,
  onUpdate,
  isGenerating
}: BrollSequenceEditorProps) {
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const generateImage = async (index: number) => {
    const shot = sequence.shots[index];
    if (!shot?.prompt) return;

    setGeneratingIndex(index);

    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt: shot.prompt, sceneType: 'commercial' }
      });

      if (error) throw error;

      const updatedShots = [...sequence.shots];
      updatedShots[index] = {
        ...updatedShots[index],
        imageUrl: data?.imageUrl,
        status: data?.imageUrl ? 'complete' : 'error'
      };

      onUpdate({ ...sequence, shots: updatedShots });
      toast.success(`Generated shot ${index + 1}`);
    } catch (error) {
      console.error('Failed to generate image:', error);
      toast.error('Failed to generate image');
    } finally {
      setGeneratingIndex(null);
    }
  };

  const generateAllMissing = async () => {
    for (let i = 0; i < sequence.shots.length; i++) {
      if (!sequence.shots[i].imageUrl) {
        await generateImage(i);
      }
    }
  };

  const removeShot = (index: number) => {
    const updatedShots = sequence.shots.filter((_, i) => i !== index);
    onUpdate({ ...sequence, shots: updatedShots });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    
    const updatedShots = [...sequence.shots];
    const [removed] = updatedShots.splice(dragIndex, 1);
    updatedShots.splice(targetIndex, 0, removed);
    
    onUpdate({ ...sequence, shots: updatedShots });
    setDragIndex(null);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploadingIndex(index);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop()}`;
      const { error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('reels')
        .getPublicUrl(fileName);

      const updatedShots = [...sequence.shots];
      updatedShots[index] = {
        ...updatedShots[index],
        imageUrl: publicUrl,
        status: 'complete'
      };

      onUpdate({ ...sequence, shots: updatedShots });
      toast.success('Image uploaded');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingIndex(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const totalDuration = sequence.shots.reduce((sum, shot) => sum + (shot.duration || 2), 0);
  const hasAllImages = sequence.shots.every(s => s.imageUrl);
  const hasMissingImages = sequence.shots.some(s => !s.imageUrl);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" />
            B-Roll Sequence
            <Badge variant="outline" className="ml-2">
              {sequence.isMontage ? 'Montage' : 'Contextual'}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" />
              {totalDuration.toFixed(1)}s
            </Badge>
            {hasMissingImages && (
              <Button
                size="sm"
                variant="outline"
                onClick={generateAllMissing}
                disabled={isGenerating || generatingIndex !== null}
                className="gap-1"
              >
                {isGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ImagePlus className="h-3 w-3" />
                )}
                Generate Missing
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Horizontal scrolling storyboard */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sequence.shots.map((shot, index) => (
            <div
              key={shot.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(index)}
              className={`relative flex-shrink-0 w-28 rounded-lg overflow-hidden border-2 cursor-grab active:cursor-grabbing transition-all ${
                dragIndex === index ? 'opacity-50 scale-95' : 'border-border hover:border-primary/50'
              }`}
            >
              {/* Shot thumbnail */}
              <div className="aspect-video bg-muted relative group">
                {shot.imageUrl ? (
                  <img 
                    src={shot.imageUrl} 
                    alt={`Shot ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                ) : shot.status === 'generating' || generatingIndex === index ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
                    <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-1 bg-muted">
                    <ImagePlus className="h-4 w-4 text-muted-foreground mb-1" />
                    <span className="text-[8px] text-center text-muted-foreground line-clamp-2">
                      {shot.prompt?.slice(0, 30)}...
                    </span>
                  </div>
                )}

                {/* Drag handle */}
                <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="h-3 w-3 text-white drop-shadow-lg" />
                </div>

                {/* Hover controls */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  {shot.imageUrl && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-6 w-6"
                      onClick={() => setPreviewIndex(index)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6"
                    onClick={() => generateImage(index)}
                    disabled={generatingIndex === index}
                  >
                    {generatingIndex === index ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6"
                    onClick={() => {
                      setUploadingIndex(index);
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-6 w-6"
                    onClick={() => removeShot(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {/* Duration badge */}
                <div className="absolute bottom-1 right-1">
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">
                    {shot.duration}s
                  </Badge>
                </div>
              </div>

              {/* Shot info */}
              <div className="p-1.5 bg-card">
                <div className="flex items-center justify-between gap-1">
                  <Badge variant="outline" className="text-[9px] px-1 py-0">
                    {angleLabels[shot.angle]}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {movementIcons[shot.movement]}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Timeline preview bar */}
        <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden flex">
          {sequence.shots.map((shot, index) => {
            const widthPercent = ((shot.duration || 2) / totalDuration) * 100;
            return (
              <div
                key={shot.id}
                className={`h-full ${
                  shot.imageUrl 
                    ? 'bg-primary' 
                    : shot.status === 'generating' 
                    ? 'bg-amber-500 animate-pulse' 
                    : 'bg-muted-foreground/30'
                }`}
                style={{ width: `${widthPercent}%` }}
                title={`Shot ${index + 1}: ${shot.duration}s - ${angleLabels[shot.angle]}`}
              />
            );
          })}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => uploadingIndex !== null && handleUpload(e, uploadingIndex)}
        />

        {/* Preview modal */}
        {previewIndex !== null && sequence.shots[previewIndex]?.imageUrl && (
          <div 
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPreviewIndex(null)}
          >
            <img 
              src={sequence.shots[previewIndex].imageUrl} 
              alt="Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
