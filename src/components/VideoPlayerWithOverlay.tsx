import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight } from 'lucide-react';

interface Scene {
  sceneNumber: number;
  text: string;
  imageUrl: string | null;
  videoUrl?: string | null;
  startTime: number;
  endTime: number;
  isIntro?: boolean;
  isOutro?: boolean;
}

interface Voiceover {
  sceneNumber: number;
  audioUrl: string;
}

interface VideoPlayerWithOverlayProps {
  scenes: Scene[];
  voiceovers: Voiceover[];
  videoClips: { sceneNumber: number; videoUrl: string }[];
  onClipChange?: (index: number) => void;
}

export const VideoPlayerWithOverlay: React.FC<VideoPlayerWithOverlayProps> = ({
  scenes,
  voiceovers,
  videoClips,
  onClipChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showCaption, setShowCaption] = useState(true);

  const currentClip = videoClips[currentClipIndex];
  const currentScene = scenes.find(s => s.sceneNumber === currentClip?.sceneNumber) || scenes[currentClipIndex];
  const currentVoiceover = voiceovers.find(v => v.sceneNumber === currentClip?.sceneNumber) || voiceovers[currentClipIndex];

  // Sync audio with video playback
  const syncAudio = useCallback(() => {
    if (audioRef.current && videoRef.current) {
      audioRef.current.currentTime = videoRef.current.currentTime;
    }
  }, []);

  // Play/pause both video and audio together
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying) {
      videoRef.current.pause();
      audioRef.current?.pause();
    } else {
      videoRef.current.play();
      if (audioRef.current && !isMuted) {
        audioRef.current.play().catch(console.error);
      }
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, isMuted]);

  // Toggle mute for audio
  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Go to next clip
  const nextClip = useCallback(() => {
    if (currentClipIndex < videoClips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
      onClipChange?.(currentClipIndex + 1);
      setIsPlaying(false);
    }
  }, [currentClipIndex, videoClips.length, onClipChange]);

  // Go to previous clip
  const prevClip = useCallback(() => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(currentClipIndex - 1);
      onClipChange?.(currentClipIndex - 1);
      setIsPlaying(false);
    }
  }, [currentClipIndex, onClipChange]);

  // Handle video end - auto advance to next clip
  const handleVideoEnd = useCallback(() => {
    setIsPlaying(false);
    if (currentClipIndex < videoClips.length - 1) {
      setTimeout(() => {
        nextClip();
        // Auto-play next clip
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.play();
            setIsPlaying(true);
            if (audioRef.current && !isMuted) {
              audioRef.current.play().catch(console.error);
            }
          }
        }, 100);
      }, 500);
    }
  }, [currentClipIndex, videoClips.length, nextClip, isMuted]);

  // Reset audio when clip changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, [currentClipIndex]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      if (audioRef.current && !isMuted) {
        audioRef.current.play().catch(console.error);
      }
    };

    const handlePause = () => {
      setIsPlaying(false);
      audioRef.current?.pause();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleVideoEnd);
    video.addEventListener('seeked', syncAudio);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleVideoEnd);
      video.removeEventListener('seeked', syncAudio);
    };
  }, [handleVideoEnd, syncAudio, isMuted]);

  if (videoClips.length === 0) {
    return (
      <div className="aspect-[9/16] max-w-sm mx-auto bg-black rounded-lg flex items-center justify-center text-muted-foreground">
        No video clips available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video container with overlay */}
      <div className="aspect-[9/16] max-w-sm mx-auto bg-black rounded-lg overflow-hidden shadow-xl relative group">
        {/* Video element */}
        <video
          ref={videoRef}
          src={currentClip?.videoUrl}
          className="w-full h-full object-contain"
          playsInline
          onClick={togglePlay}
        />

        {/* Hidden audio element for voiceover */}
        {currentVoiceover && (
          <audio
            ref={audioRef}
            src={currentVoiceover.audioUrl}
            preload="auto"
          />
        )}

        {/* Caption overlay */}
        {showCaption && currentScene && (
          <div className="absolute bottom-16 left-2 right-2 pointer-events-none">
            <div className={`text-center px-4 py-3 rounded-lg ${
              currentScene.isIntro || currentScene.isOutro 
                ? 'bg-primary/90 text-primary-foreground'
                : 'bg-black/80 text-white'
            }`}>
              <p className={`font-bold ${
                currentScene.isIntro || currentScene.isOutro 
                  ? 'text-lg' 
                  : 'text-sm'
              }`}>
                {currentScene.text}
              </p>
            </div>
          </div>
        )}

        {/* Play/Pause overlay */}
        {!isPlaying && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
            onClick={togglePlay}
          >
            <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center">
              <Play className="w-8 h-8 text-primary-foreground ml-1" />
            </div>
          </div>
        )}

        {/* Scene indicator badge */}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-bold ${
          currentScene?.isIntro 
            ? 'bg-green-500 text-white' 
            : currentScene?.isOutro 
              ? 'bg-orange-500 text-white'
              : 'bg-primary text-primary-foreground'
        }`}>
          {currentScene?.isIntro ? 'INTRO' : currentScene?.isOutro ? 'OUTRO' : `Scene ${currentScene?.sceneNumber}`}
        </div>

        {/* Controls bar */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            
            <div className="flex-1 text-center text-white text-xs">
              {currentClipIndex + 1} / {videoClips.length}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={toggleMute}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Clip navigation */}
      {videoClips.length > 1 && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={prevClip}
              disabled={currentClipIndex === 0}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-3">
              Clip {currentClipIndex + 1} of {videoClips.length}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={nextClip}
              disabled={currentClipIndex === videoClips.length - 1}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {/* Clip thumbnails */}
          <div className="flex gap-2 overflow-x-auto max-w-full pb-2">
            {videoClips.map((clip, index) => {
              const scene = scenes.find(s => s.sceneNumber === clip.sceneNumber) || scenes[index];
              return (
                <button
                  key={clip.sceneNumber}
                  onClick={() => {
                    setCurrentClipIndex(index);
                    onClipChange?.(index);
                  }}
                  className={`flex-shrink-0 w-14 h-24 rounded-md overflow-hidden border-2 transition-all relative ${
                    index === currentClipIndex 
                      ? 'border-primary ring-2 ring-primary/30 scale-105' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {scene?.imageUrl ? (
                    <img 
                      src={scene.imageUrl} 
                      alt={`Scene ${clip.sceneNumber}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Play className="w-3 h-3 text-muted-foreground" />
                    </div>
                  )}
                  <div className={`absolute bottom-0 left-0 right-0 text-[10px] text-white text-center py-0.5 ${
                    scene?.isIntro 
                      ? 'bg-green-500' 
                      : scene?.isOutro 
                        ? 'bg-orange-500'
                        : 'bg-black/70'
                  }`}>
                    {scene?.isIntro ? 'I' : scene?.isOutro ? 'O' : clip.sceneNumber}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Voiceover indicator */}
          {currentVoiceover && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              Voiceover synced with video
            </p>
          )}
        </div>
      )}
    </div>
  );
};
