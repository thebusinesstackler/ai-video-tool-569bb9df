import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useVideoQueue, QueuedVideo } from '@/hooks/useVideoQueue';
import { ContentStrategy } from '@/components/TopicStrategist';
import {
  ListChecks,
  Clock,
  Layers,
  Play,
  Trash2,
  ArrowUp,
  ArrowDown,
  Megaphone,
  BookOpen,
  Smile,
  Target
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface VideoQueueProps {
  onSelectVideo: (video: QueuedVideo) => void;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  educational: <BookOpen className="w-3 h-3" />,
  entertainment: <Smile className="w-3 h-3" />,
  promotional: <Megaphone className="w-3 h-3" />,
  motivational: <Target className="w-3 h-3" />,
  storytelling: <Play className="w-3 h-3" />,
};

const contentTypeColors: Record<string, string> = {
  educational: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  entertainment: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  promotional: 'bg-green-500/20 text-green-400 border-green-500/30',
  motivational: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  storytelling: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

export const VideoQueue: React.FC<VideoQueueProps> = ({ onSelectVideo }) => {
  const { queue, removeFromQueue, clearQueue, moveInQueue } = useVideoQueue();

  if (queue.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="pt-6 text-center">
          <ListChecks className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No Queued Videos</h3>
          <p className="text-muted-foreground mb-4">
            Use the AI Content Strategist to generate ideas, then select and save them to your queue.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" />
          <h3 className="font-medium">Video Queue</h3>
          <Badge variant="secondary">{queue.length} videos</Badge>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={clearQueue}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Clear All
        </Button>
      </div>

      <ScrollArea className="h-[600px]">
        <div className="space-y-3 pr-4">
          {queue.map((video, idx) => (
            <Card 
              key={video.id} 
              className="bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
              onClick={() => onSelectVideo(video)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-1 justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveInQueue(idx, idx - 1);
                      }}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </Button>
                    <span className="text-xs text-center text-muted-foreground">{idx + 1}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      disabled={idx === queue.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveInQueue(idx, idx + 1);
                      }}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="outline" className="text-xs shrink-0">
                            {video.niche}
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${contentTypeColors[video.contentType] || ''}`}
                          >
                            {contentTypeIcons[video.contentType]}
                            <span className="ml-1 capitalize">{video.contentType}</span>
                          </Badge>
                        </div>
                        <h4 className="font-medium text-sm leading-tight line-clamp-2">
                          {video.title}
                        </h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromQueue(video.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <p className="text-xs text-muted-foreground italic line-clamp-2">
                      "{video.hookText}"
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {video.targetDuration}s
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <Layers className="w-3 h-3 mr-1" />
                        {video.sceneCount} scenes
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Added {formatDistanceToNow(new Date(video.addedAt), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Scene Duration Preview */}
                    <div className="flex gap-1 pt-1">
                      {video.sceneDurations.map((dur, sIdx) => (
                        <div
                          key={sIdx}
                          className="flex-1 h-1.5 bg-primary/30 rounded-full"
                          style={{
                            flex: dur,
                            backgroundColor: sIdx === 0 
                              ? 'hsl(var(--primary))' 
                              : sIdx === video.sceneDurations.length - 1 
                                ? 'hsl(var(--accent))' 
                                : undefined
                          }}
                          title={`Scene ${sIdx + 1}: ${dur}s`}
                        />
                      ))}
                    </div>

                    {/* Generate Button */}
                    <Button 
                      size="sm" 
                      className="w-full mt-2 group-hover:bg-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectVideo(video);
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Generate This Reel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
