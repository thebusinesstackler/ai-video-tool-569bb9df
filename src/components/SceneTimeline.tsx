import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ArrowRight, Link, Image, Check, Video } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MovieSceneWithKeyframes } from './KeyframeSceneCard';

interface SceneTimelineProps {
  scenes: MovieSceneWithKeyframes[];
  activeSceneIndex: number;
  onSelectScene: (index: number) => void;
  autoLinkEnabled: boolean;
  onToggleAutoLink: () => void;
  onBuildMovie?: () => void;
  isBuildingMovie?: boolean;
  buildProgress?: number;
  hasVideos?: boolean;
}

export const SceneTimeline: React.FC<SceneTimelineProps> = ({
  scenes,
  activeSceneIndex,
  onSelectScene,
  autoLinkEnabled,
  onToggleAutoLink,
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
        <Button
          variant={autoLinkEnabled ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleAutoLink}
          className="h-7 text-xs"
        >
          <Link className="w-3 h-3 mr-1" />
          Auto-Link Scenes
          {autoLinkEnabled && <Check className="w-3 h-3 ml-1" />}
        </Button>
      </div>

      {/* Timeline Scroll Area */}
      <ScrollArea className="w-full">
        <div className="flex items-center gap-2 p-2">
          {scenes.map((scene, index) => {
            const hasStartFrame = !!scene.startFrame?.generatedImage;
            const hasEndFrame = !!scene.endFrame?.generatedImage;
            const hasVideo = !!scene.generatedVideo;
            const isActive = index === activeSceneIndex;
            const isLinked = index > 0 && autoLinkEnabled;
            
            return (
              <React.Fragment key={scene.sceneNumber}>
                {/* Scene Connection Arrow */}
                {index > 0 && (
                  <div className={cn(
                    "flex items-center gap-1",
                    isLinked ? "text-primary" : "text-muted-foreground/30"
                  )}>
                    {isLinked && <Link className="w-3 h-3" />}
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
      
      {/* Auto-Link Explanation */}
      {autoLinkEnabled && (
        <p className="text-xs text-muted-foreground px-2">
          Scene endings will automatically link to the next scene's start for continuity.
        </p>
      )}
    </div>
  );
};
