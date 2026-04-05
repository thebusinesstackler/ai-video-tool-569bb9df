import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Save, X, Loader2 } from 'lucide-react';

interface CaptionPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalVideoUrl: string;
  captionedVideoUrl: string | null;
  isProcessing: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export const CaptionPreviewDialog: React.FC<CaptionPreviewDialogProps> = ({
  open,
  onOpenChange,
  originalVideoUrl,
  captionedVideoUrl,
  isProcessing,
  onSave,
  onDiscard,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Caption Preview</DialogTitle>
        </DialogHeader>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Burning captions into video…</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-2 text-center">Original</p>
              <video
                src={originalVideoUrl}
                className="w-full aspect-[9/16] object-contain bg-black rounded-lg"
                controls
                playsInline
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 text-center">With Captions</p>
              {captionedVideoUrl ? (
                <video
                  src={captionedVideoUrl}
                  className="w-full aspect-[9/16] object-contain bg-black rounded-lg"
                  controls
                  playsInline
                />
              ) : (
                <div className="w-full aspect-[9/16] bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
                  No captioned video yet
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onDiscard} disabled={isProcessing}>
            <X className="w-4 h-4 mr-2" />
            Discard
          </Button>
          <Button onClick={onSave} disabled={isProcessing || !captionedVideoUrl}>
            <Save className="w-4 h-4 mr-2" />
            Save with Captions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
