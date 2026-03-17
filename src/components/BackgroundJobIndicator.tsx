import React from 'react';
import { useBackgroundVideo } from '@/contexts/BackgroundVideoContext';
import { Progress } from '@/components/ui/progress';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const BackgroundJobIndicator = () => {
  const { activeJobs, dismissJob } = useBackgroundVideo();

  if (activeJobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {activeJobs.map(job => (
        <div
          key={job.id}
          className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-2 animate-in slide-in-from-bottom-2"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {job.status === 'complete' ? (
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
              ) : job.status === 'failed' ? (
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              ) : (
                <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
              )}
              <span className="text-sm font-medium text-foreground truncate">
                {job.topic.slice(0, 40)}{job.topic.length > 40 ? '...' : ''}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0"
              onClick={() => dismissJob(job.id)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
          
          <Progress value={job.progress} className="h-1.5" />
          
          <p className="text-xs text-muted-foreground">
            {job.status === 'polling' && `Generating videos... ${job.completedVideos.filter(v => v.videoUrl).length}/${job.videoTasks.length} clips`}
            {job.status === 'stitching' && 'Stitching video clips...'}
            {job.status === 'saving' && 'Saving to library...'}
            {job.status === 'complete' && 'Saved to your library! ✓'}
            {job.status === 'failed' && (job.error || 'Generation failed')}
          </p>
        </div>
      ))}
    </div>
  );
};
