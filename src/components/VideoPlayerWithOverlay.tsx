import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX, ChevronLeft, ChevronRight, Maximize2, Minimize2, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { KaraokeCaption, CaptionSettings, defaultCaptionSettings } from './KaraokeCaption';
import { CaptionStyleSelector } from './CaptionStyleSelector';

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
  captionSettings?: CaptionSettings;
  onCaptionSettingsChange?: (settings: CaptionSettings) => void;
}

export const VideoPlayerWithOverlay: React.FC<VideoPlayerWithOverlayProps> = ({
  scenes,
  voiceovers,
  videoClips,
  onClipChange,
  captionSettings: externalSettings,
  onCaptionSettingsChange
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const nextVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [theaterMode, setTheaterMode] = useState(false);
  const [internalCaptionSettings, setInternalCaptionSettings] = useState<CaptionSettings>(defaultCaptionSettings);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Use external settings if provided, otherwise use internal
  const captionSettings = externalSettings ?? internalCaptionSettings;
  const setCaptionSettings = onCaptionSettingsChange ?? setInternalCaptionSettings;

  const currentClip = videoClips[currentClipIndex];
  const currentScene = scenes.find(s => s.sceneNumber === currentClip?.sceneNumber) || scenes[currentClipIndex];
  const currentVoiceover = voiceovers.find(v => v.sceneNumber === currentClip?.sceneNumber) || voiceovers[currentClipIndex];
  const nextClipData = videoClips[currentClipIndex + 1];

  // Track audio time for karaoke captions
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setAudioDuration(audio.duration);
    };

    const handleDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setAudioDuration(audio.duration);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
    };
  }, [currentClipIndex]);

  // Preload next video for seamless transitions
  useEffect(() => {
    if (nextVideoRef.current && nextClipData) {
      nextVideoRef.current.src = nextClipData.videoUrl;
      nextVideoRef.current.load();
    }
  }, [nextClipData]);

  // Sync video with audio - loop video if audio is longer
  useEffect(() => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) return;

    const handleVideoEnded = () => {
      // If audio is still playing, loop the video
      if (!audio.paused && audio.currentTime < audio.duration - 0.1) {
        video.currentTime = 0;
        video.play().catch(console.error);
      }
    };

    video.addEventListener('ended', handleVideoEnded);
    return () => video.removeEventListener('ended', handleVideoEnded);
  }, [currentClipIndex]);

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

  // Toggle mute for audio (separate voiceover OR baked video audio)
  const toggleMute = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
    }
    if (videoRef.current && !currentVoiceover) {
      videoRef.current.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  }, [isMuted, currentVoiceover]);

  // Seamless transition to next clip
  const transitionToNextClip = useCallback(() => {
    if (currentClipIndex >= videoClips.length - 1) {
      setIsPlaying(false);
      return;
    }

    setIsTransitioning(true);
    
    // Fade out current clip
    setTimeout(() => {
      setCurrentClipIndex(prev => prev + 1);
      onClipChange?.(currentClipIndex + 1);
      setCurrentTime(0);
      
      // Reset and play new clip
      setTimeout(() => {
        setIsTransitioning(false);
        if (videoRef.current && theaterMode) {
          videoRef.current.play().catch(console.error);
          if (audioRef.current && !isMuted) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(console.error);
          }
        }
      }, 100);
    }, theaterMode ? 200 : 0);
  }, [currentClipIndex, videoClips.length, onClipChange, theaterMode, isMuted]);

  // Handle audio end - advance to next clip
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleAudioEnded = () => {
      if (theaterMode) {
        transitionToNextClip();
      } else {
        setIsPlaying(false);
        if (currentClipIndex < videoClips.length - 1) {
          setTimeout(() => {
            setCurrentClipIndex(prev => prev + 1);
            onClipChange?.(currentClipIndex + 1);
          }, 500);
        }
      }
    };

    audio.addEventListener('ended', handleAudioEnded);
    return () => audio.removeEventListener('ended', handleAudioEnded);
  }, [currentClipIndex, videoClips.length, onClipChange, theaterMode, transitionToNextClip]);

  // Go to next clip manually
  const nextClip = useCallback(() => {
    if (currentClipIndex < videoClips.length - 1) {
      setCurrentClipIndex(currentClipIndex + 1);
      onClipChange?.(currentClipIndex + 1);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [currentClipIndex, videoClips.length, onClipChange]);

  // Go to previous clip
  const prevClip = useCallback(() => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(currentClipIndex - 1);
      onClipChange?.(currentClipIndex - 1);
      setIsPlaying(false);
      setCurrentTime(0);
    }
  }, [currentClipIndex, onClipChange]);

  // Reset audio when clip changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setAudioDuration(0);
    if (!theaterMode) {
      setIsPlaying(false);
    }
  }, [currentClipIndex, theaterMode]);

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

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [isMuted]);

  // Start theater mode playback
  const startTheaterMode = useCallback(() => {
    setTheaterMode(true);
    setCurrentClipIndex(0);
    setCurrentTime(0);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
        setIsPlaying(true);
        if (audioRef.current && !isMuted) {
          audioRef.current.play().catch(console.error);
        }
      }
    }, 100);
  }, [isMuted]);

  // Calculate overall progress
  const overallProgress = ((currentClipIndex + (audioDuration > 0 ? currentTime / audioDuration : 0)) / videoClips.length) * 100;

  if (videoClips.length === 0) {
    return (
      <div className="aspect-[9/16] max-w-sm mx-auto bg-black rounded-lg flex items-center justify-center text-muted-foreground">
        No video clips available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Caption style selector */}
      <CaptionStyleSelector
        settings={captionSettings}
        onChange={setCaptionSettings}
        compact={true}
      />

      {/* Video container with overlay */}
      <div className={`aspect-[9/16] max-w-sm mx-auto bg-black rounded-lg overflow-hidden shadow-xl relative group transition-opacity duration-300 ${
        isTransitioning ? 'opacity-70' : 'opacity-100'
      }`}>
        {/* Video element - mute baked audio only when we have a separate voiceover track */}
        <video
          ref={videoRef}
          src={currentClip?.videoUrl}
          className="w-full h-full object-contain"
          playsInline
          loop={false}
          muted={!!currentVoiceover || isMuted}
          onClick={togglePlay}
        />

        {/* Hidden preload video for next clip */}
        <video
          ref={nextVideoRef}
          className="hidden"
          preload="auto"
          muted
        />

        {/* Hidden audio element for voiceover */}
        {currentVoiceover && (
          <audio
            ref={audioRef}
            src={currentVoiceover.audioUrl}
            preload="auto"
          />
        )}

        {/* Karaoke Caption overlay */}
        {currentScene && captionSettings.enabled && (
          <div className="absolute bottom-16 left-2 right-2 pointer-events-none animate-fade-in">
            <KaraokeCaption
              text={currentScene.text}
              currentTime={currentTime}
              duration={audioDuration}
              isIntro={currentScene.isIntro}
              isOutro={currentScene.isOutro}
              style={captionSettings.style}
              background={captionSettings.background}
            />
          </div>
        )}

        {/* Play/Pause overlay */}
        {!isPlaying && !theaterMode && (
          <div 
            className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer animate-fade-in"
            onClick={togglePlay}
          >
            <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-primary-foreground ml-1" />
            </div>
          </div>
        )}

        {/* Scene indicator badge - hidden in theater mode */}
        {!theaterMode && (
          <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-bold ${
            currentScene?.isIntro 
              ? 'bg-green-500 text-white' 
              : currentScene?.isOutro 
                ? 'bg-orange-500 text-white'
                : 'bg-primary text-primary-foreground'
          }`}>
            {currentScene?.isIntro ? 'INTRO' : currentScene?.isOutro ? 'OUTRO' : `Scene ${currentScene?.sceneNumber}`}
          </div>
        )}

        {/* Theater mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 text-white bg-black/50 hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => theaterMode ? setTheaterMode(false) : startTheaterMode()}
        >
          {theaterMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>

        {/* Overall progress bar (theater mode) */}
        {theaterMode && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/20">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        )}

        {/* Controls bar */}
        <div className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${
          theaterMode ? 'opacity-0 hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
        }`}>
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
              {theaterMode ? (
                <span>Scene {currentClipIndex + 1} / {videoClips.length}</span>
              ) : (
                <span>{currentClipIndex + 1} / {videoClips.length}</span>
              )}
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

          {/* Clip progress bar */}
          {audioDuration > 0 && (
            <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-100"
                style={{ width: `${(currentTime / audioDuration) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Theater mode button */}
      {!theaterMode && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={startTheaterMode}
          >
            <Maximize2 className="w-4 h-4" />
            Play All (Theater Mode)
          </Button>
        </div>
      )}

      {/* Clip navigation - hidden in theater mode */}
      {!theaterMode && videoClips.length > 1 && (
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
                    setCurrentTime(0);
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
              Karaoke captions synced with voiceover
            </p>
          )}
        </div>
      )}

      {/* Exit theater mode */}
      {theaterMode && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTheaterMode(false);
              setIsPlaying(false);
              videoRef.current?.pause();
              audioRef.current?.pause();
            }}
          >
            <Minimize2 className="w-4 h-4 mr-2" />
            Exit Theater Mode
          </Button>
        </div>
      )}
    </div>
  );
};
