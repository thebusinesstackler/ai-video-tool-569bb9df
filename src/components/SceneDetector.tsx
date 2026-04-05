import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Scissors, ScanSearch, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SceneBreak {
  timestamp: number;
  confidence: number;
  reason: string;
  accepted?: boolean;
}

interface SceneDetectorProps {
  videoUrl: string;
  audioUrl?: string | null;
  duration: number;
  onSplitAt: (timestamp: number) => void;
  onSplitAll: (timestamps: number[]) => void;
}

export const SceneDetector: React.FC<SceneDetectorProps> = ({
  videoUrl,
  audioUrl,
  duration,
  onSplitAt,
  onSplitAll,
}) => {
  const { toast } = useToast();
  const [isDetecting, setIsDetecting] = useState(false);
  const [sceneBreaks, setSceneBreaks] = useState<SceneBreak[]>([]);
  const [showResults, setShowResults] = useState(false);

  const detectScenes = async () => {
    setIsDetecting(true);
    setSceneBreaks([]);
    setShowResults(false);

    try {
      const { data, error } = await supabase.functions.invoke('detect-scenes', {
        body: { videoUrl, audioUrl, duration },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Scene detection failed');

      const breaks = (data.sceneBreaks || []).map((b: any) => ({ ...b, accepted: true }));
      setSceneBreaks(breaks);
      setShowResults(true);

      if (breaks.length === 0) {
        toast({ title: 'No Scene Breaks Found', description: 'The video appears to be a single continuous scene.' });
      } else {
        toast({ title: `${breaks.length} Scene Breaks Detected`, description: 'Review and split at detected boundaries.' });
      }
    } catch (e: any) {
      console.error('Scene detection failed:', e);
      toast({ title: 'Detection Failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsDetecting(false);
    }
  };

  const toggleBreak = (index: number) => {
    setSceneBreaks(prev => prev.map((b, i) => i === index ? { ...b, accepted: !b.accepted } : b));
  };

  const handleSplitAll = () => {
    const accepted = sceneBreaks.filter(b => b.accepted).map(b => b.timestamp);
    if (accepted.length > 0) {
      onSplitAll(accepted);
      setShowResults(false);
      toast({ title: 'Clips Split', description: `Split at ${accepted.length} scene boundaries.` });
    }
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.85) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (c >= 0.65) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  };

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={detectScenes}
        disabled={isDetecting}
        className="gap-2"
      >
        {isDetecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ScanSearch className="w-4 h-4" />
        )}
        {isDetecting ? 'Detecting…' : 'Detect Scenes'}
      </Button>

      {showResults && sceneBreaks.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground">
              {sceneBreaks.length} scene {sceneBreaks.length === 1 ? 'break' : 'breaks'} detected
            </p>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setShowResults(false)} className="h-7 text-xs">
                Dismiss
              </Button>
              <Button size="sm" onClick={handleSplitAll} className="h-7 text-xs gap-1" disabled={!sceneBreaks.some(b => b.accepted)}>
                <Scissors className="w-3 h-3" />
                Split All ({sceneBreaks.filter(b => b.accepted).length})
              </Button>
            </div>
          </div>

          <div className="space-y-1 max-h-48 overflow-y-auto">
            {sceneBreaks.map((brk, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 p-2 rounded text-xs transition-opacity ${brk.accepted ? 'opacity-100' : 'opacity-40'}`}
              >
                <button
                  onClick={() => toggleBreak(idx)}
                  className={`w-5 h-5 rounded flex items-center justify-center border ${brk.accepted ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground'}`}
                >
                  {brk.accepted && <Check className="w-3 h-3" />}
                </button>

                <Badge variant="outline" className="font-mono text-[10px]">
                  {brk.timestamp.toFixed(1)}s
                </Badge>

                <Badge variant="outline" className={`text-[10px] ${confidenceColor(brk.confidence)}`}>
                  {Math.round(brk.confidence * 100)}%
                </Badge>

                <span className="text-muted-foreground truncate flex-1">{brk.reason}</span>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => { onSplitAt(brk.timestamp); toast({ title: `Split at ${brk.timestamp.toFixed(1)}s` }); }}
                >
                  <Scissors className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
