import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VideoClip {
  url: string;
  duration: number;
  caption?: string;
}

interface CreatomateOptions {
  clips: VideoClip[];
  audioUrl?: string;
  transition?: 'fade' | 'slide' | 'none';
  captionStyle?: 'bottom' | 'center' | 'top';
}

interface CreatomateResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
}

export function useCreatomate() {
  const { toast } = useToast();
  const [isStitching, setIsStitching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const stitchWithCreatomate = useCallback(async (options: CreatomateOptions): Promise<CreatomateResult> => {
    setIsStitching(true);
    setProgress(0);
    setStatus('Starting server-side rendering...');

    try {
      // Step 1: Start the render
      const { data: startData, error: startError } = await supabase.functions.invoke('creatomate-stitch', {
        body: options
      });

      if (startError) {
        throw new Error(startError.message || 'Failed to start Creatomate render');
      }

      if (!startData?.success || !startData?.renderId) {
        throw new Error(startData?.error || 'No render ID returned');
      }

      const renderId = startData.renderId;
      console.log('Creatomate render started:', renderId);
      setProgress(10);
      setStatus('Video rendering in progress...');

      // Step 2: Poll for completion
      const maxPollingTime = 300000; // 5 minutes
      const pollInterval = 3000; // 3 seconds
      const startTime = Date.now();

      while (true) {
        if (Date.now() - startTime > maxPollingTime) {
          throw new Error('Render timed out after 5 minutes');
        }

        const { data: statusData, error: statusError } = await supabase.functions.invoke('creatomate-status', {
          body: { renderId }
        });

        if (statusError) {
          console.error('Status check error:', statusError);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }

        console.log('Creatomate status:', statusData);

        if (statusData.status === 'succeeded' && statusData.url) {
          setProgress(100);
          setStatus('Complete!');
          setIsStitching(false);
          
          return {
            success: true,
            videoUrl: statusData.url
          };
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.error || 'Render failed');
        }

        // Update progress (estimate based on time)
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(90, 10 + (elapsed / maxPollingTime) * 80);
        setProgress(Math.round(estimatedProgress));
        
        if (statusData.progress) {
          setProgress(Math.max(10, Math.min(95, statusData.progress)));
        }
        
        setStatus(`Rendering... ${statusData.progress ? `${Math.round(statusData.progress)}%` : ''}`);

        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch (error) {
      console.error('Creatomate error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      toast({
        title: "Server Rendering Failed",
        description: message,
        variant: "destructive"
      });
      
      setIsStitching(false);
      setStatus('');
      setProgress(0);
      
      return {
        success: false,
        error: message
      };
    }
  }, [toast]);

  return {
    stitchWithCreatomate,
    isStitching,
    progress,
    status
  };
}
