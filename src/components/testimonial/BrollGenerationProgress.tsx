import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Image as ImageIcon, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BrollImageStatus {
  segmentId: string;
  segmentIndex: number;
  promptIndex: number;
  prompt: string;
  status: 'pending' | 'generating' | 'complete' | 'error';
  imageUrl?: string;
}

interface BrollGenerationProgressProps {
  images: BrollImageStatus[];
  isGenerating: boolean;
  onClose?: () => void;
}

export function BrollGenerationProgress({ images, isGenerating, onClose }: BrollGenerationProgressProps) {
  const completed = images.filter(img => img.status === 'complete').length;
  const total = images.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  if (!isGenerating && images.length === 0) return null;

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            B-Roll Image Generation
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{completed} / {total}</span>
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Check className="h-4 w-4 text-green-500" />
            )}
          </div>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img, index) => (
            <div
              key={`${img.segmentId}-${img.promptIndex}`}
              className={cn(
                "relative aspect-video rounded-lg overflow-hidden border-2 transition-all duration-300",
                img.status === 'generating' && "border-primary animate-pulse",
                img.status === 'complete' && "border-green-500/50",
                img.status === 'error' && "border-destructive/50",
                img.status === 'pending' && "border-muted"
              )}
            >
              {img.status === 'complete' && img.imageUrl ? (
                <img
                  src={img.imageUrl}
                  alt={`B-roll ${index + 1}`}
                  className="w-full h-full object-cover animate-fade-in"
                />
              ) : (
                <div className="w-full h-full bg-muted/50 flex flex-col items-center justify-center p-2">
                  {img.status === 'generating' ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin text-primary mb-1" />
                      <span className="text-[10px] text-muted-foreground text-center">Generating...</span>
                    </>
                  ) : img.status === 'error' ? (
                    <>
                      <X className="h-5 w-5 text-destructive mb-1" />
                      <span className="text-[10px] text-destructive text-center">Failed</span>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-5 w-5 text-muted-foreground/50 mb-1" />
                      <span className="text-[10px] text-muted-foreground text-center">Pending</span>
                    </>
                  )}
                </div>
              )}
              
              {/* Segment badge */}
              <div className="absolute top-1 left-1 bg-background/80 backdrop-blur-sm rounded px-1.5 py-0.5">
                <span className="text-[10px] font-medium">S{img.segmentIndex + 1}</span>
              </div>
              
              {/* Status indicator */}
              {img.status === 'complete' && (
                <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                  <Check className="h-2.5 w-2.5 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Prompt preview on hover could be added later */}
        {isGenerating && (
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Images are being generated. Thumbnails will appear as they complete.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
