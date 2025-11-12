import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, RefreshCw, RotateCcw, Play, Download, AlertCircle, Loader2, Trash } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';

interface VideoSegment {
  id: string;
  sceneNumber: number;
  timeRange: string;
  description: string;
  dialogue: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  jobId?: string;
  outputUrl?: string;
  localVideoUrl?: string;
  error?: string;
}

interface VideoProcessingStatusProps {
  segments: VideoSegment[];
  onRefreshSegment: (segmentId: string) => void;
  onPlayVideo: (url: string) => void;
  onDownloadVideo: (url: string, filename: string) => void;
  onResetSegment?: (segmentId: string) => void;
  onDeleteProject?: () => void;
}

export const VideoProcessingStatus: React.FC<VideoProcessingStatusProps> = ({
  segments,
  onRefreshSegment,
  onPlayVideo,
  onDownloadVideo,
  onResetSegment,
  onDeleteProject
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'failed':
        return 'text-destructive';
      case 'processing':
        return 'text-blue-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const isStuck = (segment: VideoSegment) => {
    if (segment.status !== 'processing') return false;
    return segment.progress === 75 || segment.progress === 50;
  };

  const overallProgress = segments.length > 0 
    ? Math.round(segments.reduce((acc, seg) => acc + seg.progress, 0) / segments.length)
    : 0;

  const completedCount = segments.filter(seg => seg.status === 'completed').length;
  const processingCount = segments.filter(seg => seg.status === 'processing').length;
  const failedCount = segments.filter(seg => seg.status === 'failed').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Video Processing Status</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-2 text-sm">
              <Badge variant="outline" className="text-green-600">
                ✓ {completedCount}
              </Badge>
              <Badge variant="outline" className="text-blue-600">
                ⟳ {processingCount}
              </Badge>
              <Badge variant="outline" className="text-red-600">
                ✗ {failedCount}
              </Badge>
            </div>
            {onDeleteProject && (
              <Button
                variant="outline" 
                size="sm"
                onClick={onDeleteProject}
                className="text-red-600 hover:text-red-700"
              >
                <Trash className="w-3 h-3 mr-1" />
                Delete Project
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Overall Progress</span>
            <span>{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="w-full" />
        </div>

        <div className="space-y-3">
          {segments.map((segment) => (
            <div key={segment.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(segment.status)}
                  <span className="font-medium">Scene {segment.sceneNumber}</span>
                  <Badge className={getStatusColor(segment.status)}>
                    {segment.status.toUpperCase()}
                  </Badge>
                  {isStuck(segment) && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      May be stuck
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {isStuck(segment) && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onResetSegment?.(segment.id)}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                  )}
                  {segment.status === 'processing' || segment.status === 'pending' ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRefreshSegment(segment.id)}
                    >
                      <RefreshCw className="w-3 h-3" />
                    </Button>
                  ) : null}
                  {(segment.status === 'failed' || segment.status === 'pending') && onResetSegment && !isStuck(segment) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResetSegment(segment.id)}
                      className="text-orange-600 hover:text-orange-700"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  )}
                  {(segment.outputUrl || segment.localVideoUrl) && (
                    <>
                      <VideoPlayer
                        videoUrl={segment.localVideoUrl || segment.outputUrl!}
                        title={`Scene ${segment.sceneNumber} - ${segment.description}`}
                        trigger={
                          <Button variant="outline" size="sm">
                            <Play className="w-3 h-3" />
                          </Button>
                        }
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDownloadVideo(segment.localVideoUrl || segment.outputUrl!, `scene-${segment.sceneNumber}.mp4`)}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground mb-2">
                {segment.timeRange} • {segment.description}
              </div>
              
              {segment.status === 'processing' && (
                <div className="mb-2">
                  <Progress value={segment.progress} className="w-full h-2" />
                </div>
              )}
              
              {segment.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  Error: {segment.error}
                </div>
              )}
              
              <div className="text-xs text-muted-foreground truncate">
                "{segment.dialogue}"
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};