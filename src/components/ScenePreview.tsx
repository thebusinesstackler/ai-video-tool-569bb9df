import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Play, Pause, Image as ImageIcon, Volume2 } from 'lucide-react';

interface PreviewScene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  imageUrl: string | null;
  audioUrl: string | null;
  audioDuration: number;
  isGenerating: boolean;
  isRegenerating?: boolean;
}

interface ScenePreviewProps {
  scenes: PreviewScene[];
  onRegenerateImage: (sceneNumber: number) => void;
  onCreateVideo: () => void;
  isCreatingVideo: boolean;
  disabled?: boolean;
}

export const ScenePreview: React.FC<ScenePreviewProps> = ({
  scenes,
  onRegenerateImage,
  onCreateVideo,
  isCreatingVideo,
  disabled = false
}) => {
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const audioRefs = useRef<Map<number, HTMLAudioElement>>(new Map());

  const allScenesReady = scenes.every(s => s.imageUrl && !s.isGenerating);
  const totalDuration = scenes.reduce((acc, s) => acc + s.audioDuration, 0);

  const handlePlayAudio = (sceneNumber: number, audioUrl: string) => {
    // Stop any currently playing audio
    audioRefs.current.forEach((audio, num) => {
      if (num !== sceneNumber) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    let audio = audioRefs.current.get(sceneNumber);
    if (!audio) {
      audio = new Audio(audioUrl);
      audio.onended = () => setPlayingAudio(null);
      audioRefs.current.set(sceneNumber, audio);
    }

    if (playingAudio === sceneNumber) {
      audio.pause();
      audio.currentTime = 0;
      setPlayingAudio(null);
    } else {
      audio.play();
      setPlayingAudio(sceneNumber);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          Scene Preview
        </CardTitle>
        <CardDescription className="flex items-center justify-between">
          <span>Review and adjust scene images before creating the final video</span>
          <span className="text-primary font-medium">
            {totalDuration.toFixed(1)}s total
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scene Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {scenes.map((scene) => (
            <div key={scene.sceneNumber} className="relative group">
              <div className="aspect-[9/16] bg-muted rounded-lg overflow-hidden relative">
                {scene.isGenerating || scene.isRegenerating ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">
                      {scene.isRegenerating ? 'Regenerating...' : 'Generating...'}
                    </span>
                  </div>
                ) : scene.imageUrl ? (
                  <img
                    src={scene.imageUrl}
                    alt={`Scene ${scene.sceneNumber}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    No image
                  </div>
                )}

                {/* Scene number badge */}
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {scene.sceneNumber}
                </div>

                {/* Duration badge */}
                {scene.audioDuration > 0 && (
                  <div className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm text-foreground text-xs px-1.5 py-0.5 rounded">
                    {scene.audioDuration.toFixed(1)}s
                  </div>
                )}

                {/* Action buttons overlay */}
                {!scene.isGenerating && scene.imageUrl && (
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {/* Play audio button */}
                    {scene.audioUrl && (
                      <Button
                        size="icon"
                        variant="secondary"
                        className="w-10 h-10 rounded-full"
                        onClick={() => handlePlayAudio(scene.sceneNumber, scene.audioUrl!)}
                      >
                        {playingAudio === scene.sceneNumber ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Volume2 className="w-5 h-5" />
                        )}
                      </Button>
                    )}
                    
                    {/* Regenerate button */}
                    <Button
                      size="icon"
                      variant="secondary"
                      className="w-10 h-10 rounded-full"
                      onClick={() => onRegenerateImage(scene.sceneNumber)}
                      disabled={scene.isRegenerating || disabled}
                    >
                      <RefreshCw className={`w-5 h-5 ${scene.isRegenerating ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                )}

                {/* Caption overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs line-clamp-2">{scene.narration}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Create Video Button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={onCreateVideo}
            disabled={!allScenesReady || isCreatingVideo || disabled}
            className="bg-gradient-primary hover:opacity-90 px-8"
            size="lg"
          >
            {isCreatingVideo ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating Video...
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Create Final Video
              </>
            )}
          </Button>
        </div>

        {!allScenesReady && !isCreatingVideo && (
          <p className="text-center text-sm text-muted-foreground">
            {scenes.some(s => s.isGenerating) 
              ? 'Waiting for all scenes to be generated...'
              : 'All scenes need images before creating the video'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
