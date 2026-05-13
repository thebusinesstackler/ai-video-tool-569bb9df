import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ArrowRight, Image, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MovieSceneWithKeyframes } from './KeyframeSceneCard';

interface SceneTimelineProps {
  scenes: MovieSceneWithKeyframes[];
  activeSceneIndex: number;
  onSelectScene: (index: number) => void;
  onBuildMovie?: () => void;
  isBuildingMovie?: boolean;
  buildProgress?: number;
  hasVideos?: boolean;
}

export const SceneTimeline: React.FC<SceneTimelineProps> = ({
  scenes,
  activeSceneIndex,
  onSelectScene,
  onBuildMovie,
  isBuildingMovie = false,
  buildProgress = 0,
  hasVideos = false,
}) => {
  const readyScenes = scenes.filter(s => s.startFrame?.generatedImage && s.endFrame?.generatedImage);
  const videoScenes = scenes.filter(s => !!s.generatedVideo);
  return (
    <div className="space-y-2">
      {/* Timeline Header */}
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Scene Timeline</h3>
        <Badge variant="secondary" className="h-6 text-[10px] font-normal">Film flow</Badge>
      </div>

      {/* Timeline Scroll Area */}
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 p-2">
          {scenes.map((scene, index) => {
            const hasStartFrame = !!scene.startFrame?.generatedImage;
            const hasEndFrame = !!scene.endFrame?.generatedImage;
            const hasVideo = !!scene.generatedVideo;
            const isActive = index === activeSceneIndex;
            return (
              <React.Fragment key={scene.sceneNumber}>
                {/* Scene Connection Arrow */}
                {index > 0 && (
                  <div className="flex items-center gap-1 text-primary">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
                
                {/* Scene Thumbnail Card */}
                <button
                  onClick={() => onSelectScene(index)}
                  className={cn(
                    "flex-shrink-0 group relative",
                    "w-32 rounded-lg overflow-hidden border-2 transition-all",
                    isActive 
                      ? "border-primary ring-2 ring-primary/20" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {/* Thumbnails Row */}
                  <div className="flex">
                    {/* Start Frame Thumbnail */}
                    <div className={cn(
                      "w-1/2 aspect-[4/3] relative",
                      hasStartFrame ? "" : "bg-muted"
                    )}>
                      {hasStartFrame ? (
                        <img 
                          src={scene.startFrame.generatedImage} 
                          alt="Start"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Image className="w-3 h-3 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute top-0 left-0 w-2 h-2 bg-green-500 rounded-br" />
                    </div>
                    
                    {/* End Frame Thumbnail */}
                    <div className={cn(
                      "w-1/2 aspect-[4/3] relative border-l border-border/50",
                      hasEndFrame ? "" : "bg-muted"
                    )}>
                      {hasEndFrame ? (
                        <img 
                          src={scene.endFrame.generatedImage} 
                          alt="End"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Image className="w-3 h-3 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-bl" />
                    </div>
                  </div>
                  
                  {/* Scene Label */}
                  <div className="p-1.5 bg-background/90 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <Badge 
                        variant={isActive ? "default" : "secondary"} 
                        className="text-[10px] h-4 px-1"
                      >
                        {scene.sceneNumber}
                      </Badge>
                      {hasVideo && (
                        <Video className="w-3 h-3 text-primary" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {scene.title}
                    </p>
                  </div>
                  
                  {/* Status Indicators */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-1">
                    {hasStartFrame && hasEndFrame && !hasVideo && (
                      <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="Ready for video" />
                    )}
                    {hasVideo && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Video complete" />
                    )}
                  </div>
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      
      {/* Build Movie Bar */}
      {hasVideos && onBuildMovie && (
        <div className="flex items-center justify-between px-2 py-2 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-sm">
            <Video className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">
              {videoScenes.length}/{scenes.length} scenes have videos
            </span>
          </div>
          {isBuildingMovie ? (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${buildProgress}%` }} />
              </div>
              <span className="text-xs font-mono text-muted-foreground">{buildProgress}%</span>
            </div>
          ) : (
            <Button onClick={onBuildMovie} size="sm" className="h-7 text-xs gap-1.5">
              <Video className="w-3 h-3" />
              Build Movie
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
