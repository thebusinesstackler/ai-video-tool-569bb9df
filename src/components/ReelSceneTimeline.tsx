import React, { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowUp, ArrowDown, Plus, Pencil, Play, Trash2,
  Film, Package, Image as ImageIcon, Loader2, GripVertical
} from 'lucide-react';

interface GeneratedScene {
  sceneNumber: number;
  text: string;
  imageUrl: string | null;
  savedImageUrl?: string | null;
  videoUrl?: string | null;
  startTime: number;
  endTime: number;
}

interface VideoClip {
  sceneNumber: number;
  videoUrl: string;
}

interface Voiceover {
  sceneNumber: number;
  audioUrl: string;
  storageUrl?: string;
  duration: number;
}

interface ReelSceneTimelineProps {
  scenes: GeneratedScene[];
  videoClips: VideoClip[];
  voiceovers: Voiceover[];
  onScenesChange: (scenes: GeneratedScene[], clips: VideoClip[], voiceovers: Voiceover[]) => void;
  onEditScene: (sceneNumber: number, text: string) => void;
  productImages?: { id: string; image_url: string; name: string | null }[];
}

export const ReelSceneTimeline: React.FC<ReelSceneTimelineProps> = ({
  scenes, videoClips, voiceovers, onScenesChange, onEditScene, productImages = []
}) => {
  const { toast } = useToast();
  const [brollDialogOpen, setBrollDialogOpen] = useState(false);
  const [brollInsertIndex, setBrollInsertIndex] = useState<number>(0);
  const [brollPrompt, setBrollPrompt] = useState('');
  const [brollGenerating, setBrollGenerating] = useState(false);
  const [productShotDialog, setProductShotDialog] = useState(false);
  const [productShotInsertIndex, setProductShotInsertIndex] = useState<number>(0);
  const [selectedProductUrl, setSelectedProductUrl] = useState('');
  const [productShotType, setProductShotType] = useState<'table' | 'lifestyle' | 'closeup' | 'hero'>('table');
  const [productShotGenerating, setProductShotGenerating] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const renumberAll = (newScenes: GeneratedScene[], newClips: VideoClip[], newVos: Voiceover[]) => {
    // Build old-to-new mapping based on array index
    const oldNums = newScenes.map(s => s.sceneNumber);
    newScenes.forEach((s, i) => { s.sceneNumber = i + 1; });
    oldNums.forEach((oldNum, i) => {
      const newNum = i + 1;
      newClips.forEach(c => { if (c.sceneNumber === oldNum) c.sceneNumber = newNum; });
      newVos.forEach(v => { if (v.sceneNumber === oldNum) v.sceneNumber = newNum; });
    });
  };

  const moveScene = useCallback((fromIdx: number, toIdx: number) => {
    const newScenes = [...scenes];
    const newClips = videoClips.map(c => ({ ...c }));
    const newVos = voiceovers.map(v => ({ ...v }));
    
    const [moved] = newScenes.splice(fromIdx, 1);
    newScenes.splice(toIdx, 0, moved);
    renumberAll(newScenes, newClips, newVos);
    onScenesChange(newScenes, newClips, newVos);
  }, [scenes, videoClips, voiceovers, onScenesChange]);

  const deleteScene = useCallback((idx: number) => {
    const sceneNum = scenes[idx].sceneNumber;
    const newScenes = scenes.filter((_, i) => i !== idx);
    const newClips = videoClips.filter(c => c.sceneNumber !== sceneNum).map(c => ({ ...c }));
    const newVos = voiceovers.filter(v => v.sceneNumber !== sceneNum).map(v => ({ ...v }));
    renumberAll(newScenes, newClips, newVos);
    onScenesChange(newScenes, newClips, newVos);
  }, [scenes, videoClips, voiceovers, onScenesChange]);

  const insertBrollScene = useCallback(async () => {
    if (!brollPrompt.trim()) return;
    setBrollGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: {
          prompt: `Cinematic B-roll shot: ${brollPrompt}. Professional videography, 9:16 vertical format, no text, no people unless specified.`,
          aspectRatio: '9:16'
        }
      });
      if (error || !data?.imageUrl) throw new Error('Failed to generate B-roll image');

      const newScene: GeneratedScene = {
        sceneNumber: 0,
        text: `[B-Roll] ${brollPrompt}`,
        imageUrl: data.imageUrl,
        videoUrl: undefined,
        startTime: 0,
        endTime: 3,
      };

      const newScenes = [...scenes];
      newScenes.splice(brollInsertIndex, 0, newScene);
      const newClips = videoClips.map(c => ({ ...c }));
      const newVos = voiceovers.map(v => ({ ...v }));
      renumberAll(newScenes, newClips, newVos);

      onScenesChange(newScenes, newClips, newVos);
      setBrollDialogOpen(false);
      setBrollPrompt('');
      toast({ title: '🎬 B-Roll Added', description: `Inserted "${brollPrompt}" between scenes.` });
    } catch (err) {
      console.error('B-roll generation error:', err);
      toast({ title: 'B-Roll Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setBrollGenerating(false);
    }
  }, [brollPrompt, brollInsertIndex, scenes, videoClips, voiceovers, onScenesChange, toast]);

  const generateProductShot = useCallback(async () => {
    if (!selectedProductUrl) return;
    setProductShotGenerating(true);
    
    const shotPrompts: Record<string, string> = {
      table: 'Product elegantly placed on a modern table with soft studio lighting, clean minimal background, professional product photography, 9:16 vertical',
      lifestyle: 'Product in a stylish lifestyle setting, warm natural lighting, aspirational mood, professional brand photography, 9:16 vertical',
      closeup: 'Extreme close-up macro shot of product showing fine details and texture, dramatic lighting with bokeh, 9:16 vertical',
      hero: 'Product hero shot with dramatic lighting and gradient background, floating perspective, premium brand commercial look, 9:16 vertical',
    };

    try {
      const { data, error } = await supabase.functions.invoke('edit-scene-image', {
        body: {
          sceneImageUrl: selectedProductUrl,
          referenceImageUrl: selectedProductUrl,
          editPrompt: shotPrompts[productShotType],
          aspectRatio: '9:16'
        }
      });
      if (error || !data?.imageUrl) throw new Error('Failed to generate product shot');

      const newScene: GeneratedScene = {
        sceneNumber: 0,
        text: `[Product Shot - ${productShotType}]`,
        imageUrl: data.imageUrl,
        videoUrl: undefined,
        startTime: 0,
        endTime: 3,
      };

      const newScenes = [...scenes];
      newScenes.splice(productShotInsertIndex, 0, newScene);
      const newClips = videoClips.map(c => ({ ...c }));
      const newVos = voiceovers.map(v => ({ ...v }));
      renumberAll(newScenes, newClips, newVos);

      onScenesChange(newScenes, newClips, newVos);
      setProductShotDialog(false);
      toast({ title: '📦 Product Shot Added', description: `${productShotType} shot inserted into timeline.` });
    } catch (err) {
      console.error('Product shot error:', err);
      toast({ title: 'Product Shot Failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setProductShotGenerating(false);
    }
  }, [selectedProductUrl, productShotType, productShotInsertIndex, scenes, videoClips, voiceovers, onScenesChange, toast]);

  const handleDragStart = (idx: number) => { dragItem.current = idx; };
  const handleDragEnter = (idx: number) => { dragOverItem.current = idx; };
  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      moveScene(dragItem.current, dragOverItem.current);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const InsertPoint = ({ index }: { index: number }) => (
    <div className="flex items-center justify-center gap-1 py-0.5 group/insert">
      <div className="flex-1 h-px bg-border group-hover/insert:bg-primary transition-colors" />
      <div className="flex gap-1 opacity-0 group-hover/insert:opacity-100 transition-opacity">
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[10px] px-2"
          onClick={() => { setBrollInsertIndex(index); setBrollDialogOpen(true); }}
        >
          <Plus className="w-3 h-3 mr-0.5" /> B-Roll
        </Button>
        {productImages.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2"
            onClick={() => {
              setProductShotInsertIndex(index);
              setSelectedProductUrl(productImages[0]?.image_url || '');
              setProductShotDialog(true);
            }}
          >
            <Package className="w-3 h-3 mr-0.5" /> Product
          </Button>
        )}
      </div>
      <div className="flex-1 h-px bg-border group-hover/insert:bg-primary transition-colors" />
    </div>
  );

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Film className="w-4 h-4" />
          Scene Timeline ({scenes.length})
        </h3>
        <span className="text-[10px] text-muted-foreground">Drag to reorder • Hover between scenes to insert</span>
      </div>

      {scenes.map((scene, idx) => {
        const clip = videoClips.find(c => c.sceneNumber === scene.sceneNumber);
        const vo = voiceovers.find(v => v.sceneNumber === scene.sceneNumber);
        const isBroll = scene.text.startsWith('[B-Roll]') || scene.text.startsWith('[Product Shot');

        return (
          <React.Fragment key={`timeline-${idx}-${scene.sceneNumber}`}>
            <InsertPoint index={idx} />

            <div
              className={`flex gap-2 p-2 rounded-lg border transition-all cursor-grab active:cursor-grabbing ${
                isBroll ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
              } hover:shadow-md`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <GripVertical className="w-4 h-4" />
              </div>

              <div className="w-14 h-20 rounded overflow-hidden bg-black flex-shrink-0 relative">
                {clip?.videoUrl ? (
                  <video src={clip.videoUrl} className="w-full h-full object-cover" muted />
                ) : scene.imageUrl ? (
                  <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-[8px]">No media</div>
                )}
                <div className="absolute top-0.5 left-0.5">
                  <Badge variant="outline" className="text-[7px] px-0.5 py-0 bg-background/80 leading-tight">
                    {scene.sceneNumber}
                  </Badge>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[11px] text-foreground line-clamp-2 leading-tight">{scene.text}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {isBroll && <Badge className="text-[7px] bg-primary/20 text-primary border-0 px-1 py-0">B-Roll</Badge>}
                  {vo && <Badge variant="outline" className="text-[7px] px-1 py-0">{Math.round(vo.duration)}s</Badge>}
                  {clip && <Badge variant="outline" className="text-[7px] px-1 py-0 text-primary">Video ✓</Badge>}
                </div>
              </div>

              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => onEditScene(scene.sceneNumber, scene.text)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                {idx > 0 && (
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveScene(idx, idx - 1)}>
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                )}
                {idx < scenes.length - 1 && (
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => moveScene(idx, idx + 1)}>
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                )}
                {scenes.length > 1 && (
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteScene(idx)}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                )}
              </div>
            </div>
          </React.Fragment>
        );
      })}

      {scenes.length > 0 && <InsertPoint index={scenes.length} />}

      {/* B-Roll Dialog */}
      <Dialog open={brollDialogOpen} onOpenChange={setBrollDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="w-5 h-5" /> Insert B-Roll
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Describe the B-roll shot</Label>
              <Textarea
                value={brollPrompt}
                onChange={(e) => setBrollPrompt(e.target.value)}
                placeholder="e.g. coffee pouring into a cup, city skyline at golden hour..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {['coffee pouring', 'city skyline', 'nature montage', 'tech workspace', 'hands typing', 'sunrise timelapse'].map(s => (
                <Button key={s} size="sm" variant="outline" className="text-xs" onClick={() => setBrollPrompt(s)}>
                  {s}
                </Button>
              ))}
            </div>
            <Button className="w-full" onClick={insertBrollScene} disabled={!brollPrompt.trim() || brollGenerating}>
              {brollGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {brollGenerating ? 'Generating B-Roll...' : 'Generate & Insert'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Shot Dialog */}
      <Dialog open={productShotDialog} onOpenChange={setProductShotDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" /> Product Shot Generator
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Product</Label>
              <div className="grid grid-cols-4 gap-2">
                {productImages.map(p => (
                  <div
                    key={p.id}
                    className={`relative cursor-pointer rounded-lg border-2 overflow-hidden aspect-square ${
                      selectedProductUrl === p.image_url ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                    }`}
                    onClick={() => setSelectedProductUrl(p.image_url)}
                  >
                    <img src={p.image_url} alt={p.name || 'Product'} className="w-full h-full object-cover" />
                  </div>
                ))}
                {productImages.length === 0 && (
                  <p className="col-span-4 text-xs text-muted-foreground text-center py-4">No products uploaded yet. Use the Product Swap panel to add products.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Shot Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'table', label: '🪑 On Table', desc: 'Clean product placement' },
                  { key: 'lifestyle', label: '🌟 Lifestyle', desc: 'In-use setting' },
                  { key: 'closeup', label: '🔍 Close-Up', desc: 'Detail macro shot' },
                  { key: 'hero', label: '✨ Hero Shot', desc: 'Dramatic brand shot' },
                ] as const).map(shot => (
                  <Button
                    key={shot.key}
                    size="sm"
                    variant={productShotType === shot.key ? 'default' : 'outline'}
                    className="flex flex-col h-auto py-2 text-xs"
                    onClick={() => setProductShotType(shot.key)}
                  >
                    <span>{shot.label}</span>
                    <span className="text-[10px] opacity-70">{shot.desc}</span>
                  </Button>
                ))}
              </div>
            </div>

            <Button className="w-full" onClick={generateProductShot} disabled={!selectedProductUrl || productShotGenerating}>
              {productShotGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
              {productShotGenerating ? 'Generating...' : 'Generate & Insert'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
