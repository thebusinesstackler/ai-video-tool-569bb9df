import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FileImage, Download, Loader2, Film, ArrowRight } from 'lucide-react';
import { MovieSceneWithKeyframes } from './KeyframeSceneCard';
import { useToast } from '@/hooks/use-toast';

interface StoryboardExportProps {
  scenes: MovieSceneWithKeyframes[];
  projectTitle: string;
}

type ExportFormat = 'png' | 'jpg' | 'pdf';
type LayoutOption = 'grid' | 'filmstrip' | 'detailed';

export const StoryboardExport: React.FC<StoryboardExportProps> = ({ scenes, projectTitle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('png');
  const [layout, setLayout] = useState<LayoutOption>('grid');
  const [includeDialogue, setIncludeDialogue] = useState(true);
  const [includeTransitions, setIncludeTransitions] = useState(true);
  const [columnsPerRow, setColumnsPerRow] = useState(3);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const scenesWithFrames = scenes.filter(
    s => s.startFrame?.generatedImage || s.endFrame?.generatedImage || s.generatedImage
  );

  const exportStoryboard = async () => {
    if (scenesWithFrames.length === 0) {
      toast({
        title: 'No images to export',
        description: 'Generate scene images first before exporting storyboard.',
        variant: 'destructive'
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Canvas not available');
      
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Calculate dimensions based on layout
      const frameWidth = 400;
      const frameHeight = 225; // 16:9 aspect ratio
      const padding = 20;
      const textHeight = includeDialogue ? 80 : 40;
      const transitionWidth = includeTransitions ? 60 : 0;
      
      let canvasWidth: number;
      let canvasHeight: number;
      
      if (layout === 'filmstrip') {
        // Horizontal filmstrip layout
        const framesPerScene = 2; // start + end
        const totalFrames = scenesWithFrames.length * framesPerScene;
        canvasWidth = (frameWidth + transitionWidth) * totalFrames + padding * 2;
        canvasHeight = frameHeight + textHeight + padding * 2 + 60; // 60 for header
      } else if (layout === 'detailed') {
        // One scene per row with full details
        canvasWidth = frameWidth * 2 + transitionWidth + padding * 3;
        canvasHeight = (frameHeight + textHeight + 40) * scenesWithFrames.length + padding * 2 + 80;
      } else {
        // Grid layout
        const cols = columnsPerRow;
        const rows = Math.ceil(scenesWithFrames.length / cols);
        canvasWidth = (frameWidth + padding) * cols + padding;
        canvasHeight = (frameHeight + textHeight + padding) * rows + padding + 80;
      }
      
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      // Background
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Header
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px system-ui';
      ctx.fillText(projectTitle || 'Storyboard', padding, 45);
      ctx.font = '14px system-ui';
      ctx.fillStyle = '#888888';
      ctx.fillText(`${scenesWithFrames.length} scenes • Generated with Movie Scene Creator`, padding, 70);
      
      // Load and draw images
      const loadImage = (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = url;
        });
      };
      
      const yOffset = 90;
      
      for (let i = 0; i < scenesWithFrames.length; i++) {
        const scene = scenesWithFrames[i];
        
        let x: number, y: number;
        
        if (layout === 'filmstrip') {
          x = padding + i * (frameWidth * 2 + transitionWidth + padding);
          y = yOffset;
        } else if (layout === 'detailed') {
          x = padding;
          y = yOffset + i * (frameHeight + textHeight + 40);
        } else {
          const col = i % columnsPerRow;
          const row = Math.floor(i / columnsPerRow);
          x = padding + col * (frameWidth + padding);
          y = yOffset + row * (frameHeight + textHeight + padding);
        }
        
        // For keyframe layouts, draw start and end frames
        if (layout === 'filmstrip' || layout === 'detailed') {
          // Start frame
          const startImg = scene.startFrame?.generatedImage || scene.generatedImage;
          if (startImg) {
            try {
              const img = await loadImage(startImg);
              ctx.drawImage(img, x, y, frameWidth, frameHeight);
              // Green indicator for start
              ctx.fillStyle = '#22c55e';
              ctx.fillRect(x, y, 4, 20);
            } catch (e) {
              ctx.fillStyle = '#333';
              ctx.fillRect(x, y, frameWidth, frameHeight);
            }
          }
          
          // Transition arrow
          if (includeTransitions) {
            ctx.fillStyle = '#6366f1';
            ctx.font = 'bold 24px system-ui';
            ctx.fillText('→', x + frameWidth + 15, y + frameHeight / 2 + 8);
            
            if (scene.transitionCameraMovement) {
              ctx.font = '10px system-ui';
              ctx.fillStyle = '#888';
              ctx.fillText(scene.transitionCameraMovement, x + frameWidth + 5, y + frameHeight / 2 + 25);
            }
          }
          
          // End frame
          const endImg = scene.endFrame?.generatedImage;
          const endX = x + frameWidth + transitionWidth;
          if (endImg) {
            try {
              const img = await loadImage(endImg);
              ctx.drawImage(img, endX, y, frameWidth, frameHeight);
              // Red indicator for end
              ctx.fillStyle = '#ef4444';
              ctx.fillRect(endX + frameWidth - 4, y, 4, 20);
            } catch (e) {
              ctx.fillStyle = '#333';
              ctx.fillRect(endX, y, frameWidth, frameHeight);
            }
          }
          
          // Scene label
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 14px system-ui';
          ctx.fillText(`Scene ${scene.sceneNumber}: ${scene.title}`, x, y + frameHeight + 20);
          
          if (includeDialogue && scene.dialogue) {
            ctx.font = '11px system-ui';
            ctx.fillStyle = '#aaaaaa';
            const truncatedDialogue = scene.dialogue.slice(0, 100) + (scene.dialogue.length > 100 ? '...' : '');
            ctx.fillText(truncatedDialogue, x, y + frameHeight + 40);
          }
        } else {
          // Grid layout - single image per scene
          const imgUrl = scene.startFrame?.generatedImage || scene.generatedImage;
          if (imgUrl) {
            try {
              const img = await loadImage(imgUrl);
              ctx.drawImage(img, x, y, frameWidth, frameHeight);
            } catch (e) {
              ctx.fillStyle = '#333';
              ctx.fillRect(x, y, frameWidth, frameHeight);
            }
          } else {
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y, frameWidth, frameHeight);
          }
          
          // Scene number badge
          ctx.fillStyle = '#6366f1';
          ctx.fillRect(x, y, 30, 24);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px system-ui';
          ctx.fillText(String(scene.sceneNumber), x + 8, y + 16);
          
          // Scene title
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px system-ui';
          ctx.fillText(scene.title.slice(0, 40), x, y + frameHeight + 18);
          
          // Mood badge
          if (scene.mood) {
            ctx.fillStyle = '#333';
            ctx.fillRect(x, y + frameHeight + 25, 80, 18);
            ctx.fillStyle = '#888';
            ctx.font = '10px system-ui';
            ctx.fillText(scene.mood, x + 5, y + frameHeight + 38);
          }
          
          if (includeDialogue && scene.dialogue) {
            ctx.font = '10px system-ui';
            ctx.fillStyle = '#888888';
            const truncated = scene.dialogue.slice(0, 60) + (scene.dialogue.length > 60 ? '...' : '');
            ctx.fillText(truncated, x, y + frameHeight + 55);
          }
        }
      }
      
      // Convert to image and download
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, 0.95);
      
      const link = document.createElement('a');
      link.download = `${projectTitle || 'storyboard'}_storyboard.${format}`;
      link.href = dataUrl;
      link.click();
      
      toast({
        title: 'Storyboard exported!',
        description: `Saved as ${projectTitle || 'storyboard'}_storyboard.${format}`
      });
      
      setIsOpen(false);
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export storyboard',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-2">
            <FileImage className="w-4 h-4" />
            Export Storyboard
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileImage className="w-5 h-5" />
              Export Storyboard
            </DialogTitle>
            <DialogDescription>
              Export your scenes as a visual storyboard image.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {scenesWithFrames.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No scene images generated yet.</p>
                <p className="text-sm">Generate scene images first to export a storyboard.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Layout</Label>
                  <Select value={layout} onValueChange={(v) => setLayout(v as LayoutOption)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grid (Compact overview)</SelectItem>
                      <SelectItem value="filmstrip">Filmstrip (Keyframes with transitions)</SelectItem>
                      <SelectItem value="detailed">Detailed (Full scene info)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {layout === 'grid' && (
                  <div className="space-y-2">
                    <Label>Columns per row</Label>
                    <Select value={String(columnsPerRow)} onValueChange={(v) => setColumnsPerRow(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 columns</SelectItem>
                        <SelectItem value="3">3 columns</SelectItem>
                        <SelectItem value="4">4 columns</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG (High quality)</SelectItem>
                      <SelectItem value="jpg">JPG (Smaller file)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="includeDialogue" 
                      checked={includeDialogue}
                      onCheckedChange={(v) => setIncludeDialogue(v === true)}
                    />
                    <Label htmlFor="includeDialogue" className="text-sm">Include dialogue text</Label>
                  </div>
                  
                  {(layout === 'filmstrip' || layout === 'detailed') && (
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="includeTransitions" 
                        checked={includeTransitions}
                        onCheckedChange={(v) => setIncludeTransitions(v === true)}
                      />
                      <Label htmlFor="includeTransitions" className="text-sm">Include transition arrows</Label>
                    </div>
                  )}
                </div>
                
                <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                  <p>{scenesWithFrames.length} scenes will be exported</p>
                  {layout === 'filmstrip' || layout === 'detailed' ? (
                    <p className="text-xs mt-1">Shows START → END keyframes for each scene</p>
                  ) : null}
                </div>
              </>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={exportStoryboard} 
              disabled={isExporting || scenesWithFrames.length === 0}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </>
  );
};
