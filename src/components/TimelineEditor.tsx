import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Scissors, Copy, Trash2, Lock, Unlock, Plus, Upload, Type,
  Package, Music, Film, Layers, GripVertical, ChevronLeft,
  ChevronRight, ZoomIn, ZoomOut, Maximize2, Image as ImageIcon,
  ArrowLeftRight, Mic, SlidersHorizontal, Eye, EyeOff, Wand2
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────
interface TimelineScene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  imageUrl: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  audioDuration: number;
  duration: number; // in seconds
  startTime: number;
  endTime: number;
  locked?: boolean;
  trimStart?: number; // trim offset from start (seconds)
  trimEnd?: number;   // trim offset from end (seconds)
}

interface BRollClip {
  id: string;
  url: string;
  name: string;
  startTime: number;
  duration: number;
  trackIndex: number;
  type: 'video' | 'image';
  opacity: number;
  position: 'fullscreen' | 'pip-tl' | 'pip-tr' | 'pip-bl' | 'pip-br';
}

interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  duration: number;
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  backgroundColor: string;
  animation: 'none' | 'fade' | 'slide-up' | 'typewriter';
}

interface ProductOverlay {
  id: string;
  imageUrl: string;
  name: string;
  startTime: number;
  duration: number;
  position: 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  scale: number;
  instructions: string;
}

interface TransitionMarker {
  id: string;
  afterSceneIndex: number;
  type: 'cut' | 'fade' | 'dissolve' | 'slide' | 'zoom' | 'blur' | 'wipe' | 'spin';
  duration: number; // in seconds
}

interface AudioTrack {
  id: string;
  url: string;
  name: string;
  type: 'voiceover' | 'music' | 'sfx';
  startTime: number;
  duration: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  muted: boolean;
}

interface TimelineEditorProps {
  scenes: TimelineScene[];
  voiceovers: { sceneNumber: number; audioUrl: string; duration: number }[];
  backgroundMusicUrl?: string | null;
  totalDuration: number;
  onScenesUpdate: (scenes: TimelineScene[]) => void;
  onClose: () => void;
  onRegenerateVoice?: (sceneNumber: number) => void;
  onPreviewVoice?: (sceneNumber: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────
const TRANSITION_TYPES = [
  { value: 'cut', label: 'Cut', icon: '✂️' },
  { value: 'fade', label: 'Fade', icon: '🌫️' },
  { value: 'dissolve', label: 'Dissolve', icon: '💫' },
  { value: 'slide', label: 'Slide', icon: '➡️' },
  { value: 'zoom', label: 'Zoom', icon: '🔍' },
  { value: 'blur', label: 'Blur', icon: '🌀' },
  { value: 'wipe', label: 'Wipe', icon: '🧹' },
  { value: 'spin', label: 'Spin', icon: '🔄' },
];

const TEXT_ANIMATIONS = [
  { value: 'none', label: 'None' },
  { value: 'fade', label: 'Fade In' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'typewriter', label: 'Typewriter' },
];

const PIP_POSITIONS = [
  { value: 'fullscreen', label: 'Full Screen' },
  { value: 'pip-tl', label: 'Top Left' },
  { value: 'pip-tr', label: 'Top Right' },
  { value: 'pip-bl', label: 'Bottom Left' },
  { value: 'pip-br', label: 'Bottom Right' },
];

const PIXELS_PER_SECOND = 80;

// ─── Component ────────────────────────────────────────────────────────
export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  scenes: initialScenes,
  voiceovers,
  backgroundMusicUrl,
  totalDuration: initialTotalDuration,
  onScenesUpdate,
  onClose,
  onRegenerateVoice,
  onPreviewVoice,
}) => {
  const { toast } = useToast();
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playheadIntervalRef = useRef<number | null>(null);

  // ─── State ──────────────────────────────────────────────────────────
  const [scenes, setScenes] = useState<TimelineScene[]>(initialScenes);
  const [bRollClips, setBRollClips] = useState<BRollClip[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [productOverlays, setProductOverlays] = useState<ProductOverlay[]>([]);
  const [transitions, setTransitions] = useState<TransitionMarker[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackVolume, setPlaybackVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // UI state
  const [zoom, setZoom] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<string>('scenes');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [assetTab, setAssetTab] = useState<string>('broll');
  const [draggedScene, setDraggedScene] = useState<number | null>(null);
  const [showAssetPanel, setShowAssetPanel] = useState(true);

  // Dialogs
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [editingTransitionIndex, setEditingTransitionIndex] = useState<number | null>(null);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [editingText, setEditingText] = useState<TextOverlay | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductOverlay | null>(null);

  // Track visibility
  const [trackVisibility, setTrackVisibility] = useState({
    scenes: true,
    broll: true,
    text: true,
    products: true,
    voiceover: true,
    music: true,
    sfx: true,
  });

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration - (s.trimStart || 0) - (s.trimEnd || 0)), 0);
  const timelineWidth = totalDuration * PIXELS_PER_SECOND * zoom;

  // ─── Initialize audio tracks from voiceovers & music ────────────────
  useEffect(() => {
    const voTracks: AudioTrack[] = voiceovers.map((vo) => ({
      id: `vo-${vo.sceneNumber}`,
      url: vo.audioUrl,
      name: `Scene ${vo.sceneNumber} VO`,
      type: 'voiceover' as const,
      startTime: scenes.find(s => s.sceneNumber === vo.sceneNumber)?.startTime || 0,
      duration: vo.duration,
      volume: 1,
      fadeIn: 0,
      fadeOut: 0,
      muted: false,
    }));

    if (backgroundMusicUrl) {
      voTracks.push({
        id: 'bg-music',
        url: backgroundMusicUrl,
        name: 'Background Music',
        type: 'music',
        startTime: 0,
        duration: totalDuration,
        volume: 0.3,
        fadeIn: 2,
        fadeOut: 2,
        muted: false,
      });
    }

    setAudioTracks(voTracks);
  }, [voiceovers, backgroundMusicUrl]);

  // ─── Playback ───────────────────────────────────────────────────────
  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
    } else {
      setIsPlaying(true);
      const startedAt = Date.now() - currentTime * 1000;
      playheadIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        if (elapsed >= totalDuration) {
          setCurrentTime(0);
          setIsPlaying(false);
          if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
        } else {
          setCurrentTime(elapsed);
        }
      }, 50);
    }
  };

  useEffect(() => {
    return () => {
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
    };
  }, []);

  const seekTo = (time: number) => {
    setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  };

  const skipForward = () => seekTo(currentTime + 2);
  const skipBackward = () => seekTo(Math.max(0, currentTime - 2));

  // ─── Scene Management ──────────────────────────────────────────────
  const moveScene = (fromIndex: number, toIndex: number) => {
    const updated = [...scenes];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    recalcTimings(updated);
  };

  const duplicateScene = (index: number) => {
    const scene = scenes[index];
    const newScene = {
      ...scene,
      sceneNumber: scenes.length + 1,
    };
    const updated = [...scenes];
    updated.splice(index + 1, 0, newScene);
    recalcTimings(updated);
    toast({ title: 'Scene Duplicated' });
  };

  const deleteScene = (index: number) => {
    if (scenes.length <= 1) {
      toast({ title: 'Cannot delete', description: 'At least one scene is required', variant: 'destructive' });
      return;
    }
    const updated = scenes.filter((_, i) => i !== index);
    recalcTimings(updated);
    toast({ title: 'Scene Deleted' });
  };

  const toggleLockScene = (index: number) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], locked: !updated[index].locked };
    setScenes(updated);
  };

  const adjustDuration = (index: number, newDuration: number) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], duration: Math.max(2, newDuration) };
    recalcTimings(updated);
  };

  const trimScene = (index: number, trimStart: number, trimEnd: number) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], trimStart, trimEnd };
    recalcTimings(updated);
  };

  const recalcTimings = (updatedScenes: TimelineScene[]) => {
    let time = 0;
    const reindexed = updatedScenes.map((s, i) => {
      const effectiveDuration = s.duration - (s.trimStart || 0) - (s.trimEnd || 0);
      const scene = {
        ...s,
        sceneNumber: i + 1,
        startTime: time,
        endTime: time + effectiveDuration,
      };
      time += effectiveDuration;
      return scene;
    });
    setScenes(reindexed);
    onScenesUpdate(reindexed);
  };

  // ─── Transitions ───────────────────────────────────────────────────
  const addTransition = (afterSceneIndex: number) => {
    setEditingTransitionIndex(afterSceneIndex);
    setTransitionDialogOpen(true);
  };

  const saveTransition = (type: string, duration: number) => {
    if (editingTransitionIndex === null) return;
    const existing = transitions.find(t => t.afterSceneIndex === editingTransitionIndex);
    if (existing) {
      setTransitions(prev => prev.map(t =>
        t.afterSceneIndex === editingTransitionIndex
          ? { ...t, type: type as TransitionMarker['type'], duration }
          : t
      ));
    } else {
      setTransitions(prev => [...prev, {
        id: `tr-${Date.now()}`,
        afterSceneIndex: editingTransitionIndex,
        type: type as TransitionMarker['type'],
        duration,
      }]);
    }
    setTransitionDialogOpen(false);
    toast({ title: 'Transition Applied' });
  };

  const removeTransition = (afterSceneIndex: number) => {
    setTransitions(prev => prev.filter(t => t.afterSceneIndex !== afterSceneIndex));
  };

  // ─── Text Overlays ─────────────────────────────────────────────────
  const addTextOverlay = () => {
    const newText: TextOverlay = {
      id: `text-${Date.now()}`,
      text: 'Your text here',
      startTime: currentTime,
      duration: 3,
      position: 'bottom',
      fontSize: 24,
      fontWeight: 'bold',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.5)',
      animation: 'fade',
    };
    setEditingText(newText);
    setTextDialogOpen(true);
  };

  const saveTextOverlay = (overlay: TextOverlay) => {
    setTextOverlays(prev => {
      const exists = prev.find(t => t.id === overlay.id);
      if (exists) return prev.map(t => t.id === overlay.id ? overlay : t);
      return [...prev, overlay];
    });
    setTextDialogOpen(false);
  };

  const deleteTextOverlay = (id: string) => {
    setTextOverlays(prev => prev.filter(t => t.id !== id));
  };

  // ─── Product Overlays ──────────────────────────────────────────────
  const addProductOverlay = () => {
    const newProduct: ProductOverlay = {
      id: `prod-${Date.now()}`,
      imageUrl: '',
      name: '',
      startTime: currentTime,
      duration: 5,
      position: 'bottom-right',
      scale: 0.3,
      instructions: '',
    };
    setEditingProduct(newProduct);
    setProductDialogOpen(true);
  };

  const saveProductOverlay = (overlay: ProductOverlay) => {
    setProductOverlays(prev => {
      const exists = prev.find(p => p.id === overlay.id);
      if (exists) return prev.map(p => p.id === overlay.id ? overlay : p);
      return [...prev, overlay];
    });
    setProductDialogOpen(false);
  };

  // ─── B-Roll ────────────────────────────────────────────────────────
  const addBRollClip = (url: string, name: string, type: 'video' | 'image') => {
    setBRollClips(prev => [...prev, {
      id: `broll-${Date.now()}`,
      url,
      name,
      startTime: currentTime,
      duration: 5,
      trackIndex: 0,
      type,
      opacity: 1,
      position: 'fullscreen',
    }]);
    toast({ title: 'B-Roll Added' });
  };

  // ─── Audio Controls ────────────────────────────────────────────────
  const updateAudioTrack = (id: string, updates: Partial<AudioTrack>) => {
    setAudioTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  // ─── Format time ───────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  // ─── Find current scene ────────────────────────────────────────────
  const currentSceneIndex = scenes.findIndex(s => currentTime >= s.startTime && currentTime < s.endTime);
  const currentScene = currentSceneIndex >= 0 ? scenes[currentSceneIndex] : scenes[0];

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      {/* ─── Top Bar ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Back to Preview
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Badge variant="secondary" className="text-xs">
            {scenes.length} scenes · {formatTime(totalDuration)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAssetPanel(!showAssetPanel)}>
            <Layers className="w-4 h-4 mr-1" /> Assets
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Preview + Properties ─────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* ─── Video Preview ─────────────────────────────────── */}
          <div className="flex items-center justify-center bg-black/90 p-4" style={{ minHeight: 280 }}>
            <div className="relative max-w-md w-full aspect-[9/16] bg-muted rounded-lg overflow-hidden">
              {currentScene?.videoUrl ? (
                <video
                  ref={videoRef}
                  src={currentScene.videoUrl}
                  className="w-full h-full object-cover"
                  muted={isMuted}
                />
              ) : currentScene?.imageUrl ? (
                <img src={currentScene.imageUrl} alt="Scene" className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Film className="w-8 h-8" />
                </div>
              )}

              {/* Text Overlays Preview */}
              {textOverlays
                .filter(t => currentTime >= t.startTime && currentTime < t.startTime + t.duration)
                .map(t => (
                  <div
                    key={t.id}
                    className={cn(
                      "absolute left-0 right-0 px-4 py-2 text-center",
                      t.position === 'top' && 'top-4',
                      t.position === 'center' && 'top-1/2 -translate-y-1/2',
                      t.position === 'bottom' && 'bottom-4',
                    )}
                    style={{
                      fontSize: t.fontSize * 0.5,
                      fontWeight: t.fontWeight,
                      color: t.color,
                      backgroundColor: t.backgroundColor,
                    }}
                  >
                    {t.text}
                  </div>
                ))}

              {/* Product Overlays Preview */}
              {productOverlays
                .filter(p => currentTime >= p.startTime && currentTime < p.startTime + p.duration)
                .map(p => (
                  <div
                    key={p.id}
                    className={cn(
                      "absolute",
                      p.position === 'center' && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                      p.position === 'bottom-right' && 'bottom-4 right-4',
                      p.position === 'bottom-left' && 'bottom-4 left-4',
                      p.position === 'top-right' && 'top-4 right-4',
                      p.position === 'top-left' && 'top-4 left-4',
                    )}
                    style={{ width: `${p.scale * 100}%` }}
                  >
                    {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full rounded" />}
                  </div>
                ))}

              {/* Scene Info */}
              <div className="absolute top-2 left-2">
                <Badge variant="secondary" className="text-[10px]">
                  Scene {currentScene?.sceneNumber || 1}
                </Badge>
              </div>
              <div className="absolute bottom-2 right-2">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {formatTime(currentTime)}
                </Badge>
              </div>
            </div>
          </div>

          {/* ─── Transport Controls ──────────────────────────── */}
          <div className="flex items-center justify-center gap-3 px-4 py-2 border-b bg-card">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={skipBackward}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              variant={isPlaying ? 'secondary' : 'default'}
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={skipForward}>
              <SkipForward className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-xs font-mono text-muted-foreground w-20">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </span>
            <Separator orientation="vertical" className="h-6" />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMuted(!isMuted)}>
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <div className="w-20">
              <Slider
                value={[isMuted ? 0 : playbackVolume * 100]}
                onValueChange={([v]) => { setPlaybackVolume(v / 100); if (v > 0) setIsMuted(false); }}
                max={100}
                step={1}
              />
            </div>
          </div>

          {/* ─── Timeline Panel ──────────────────────────────── */}
          <div className="flex-1 overflow-hidden flex flex-col border-t">
            {/* Track Headers + Timeline */}
            <div className="flex flex-1 overflow-hidden">
              {/* Track Labels */}
              <div className="w-36 flex-shrink-0 border-r bg-card overflow-y-auto">
                {[
                  { key: 'scenes', icon: Film, label: 'Scenes' },
                  { key: 'broll', icon: Layers, label: 'B-Roll' },
                  { key: 'text', icon: Type, label: 'Text' },
                  { key: 'products', icon: Package, label: 'Products' },
                  { key: 'voiceover', icon: Mic, label: 'Voiceover' },
                  { key: 'music', icon: Music, label: 'Music' },
                  { key: 'sfx', icon: SlidersHorizontal, label: 'SFX' },
                ].map(track => (
                  <div
                    key={track.key}
                    className={cn(
                      "flex items-center gap-2 px-2 py-2.5 border-b text-xs cursor-pointer transition-colors",
                      selectedTrack === track.key ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50'
                    )}
                    onClick={() => setSelectedTrack(track.key)}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTrackVisibility(prev => ({ ...prev, [track.key]: !prev[track.key as keyof typeof prev] }));
                      }}
                    >
                      {trackVisibility[track.key as keyof typeof trackVisibility]
                        ? <Eye className="w-3 h-3" />
                        : <EyeOff className="w-3 h-3 text-muted-foreground" />
                      }
                    </Button>
                    <track.icon className="w-3.5 h-3.5" />
                    <span className="truncate">{track.label}</span>
                  </div>
                ))}
              </div>

              {/* Timeline Tracks */}
              <ScrollArea className="flex-1">
                <div className="relative" style={{ width: timelineWidth, minHeight: '100%' }}>
                  {/* Time Ruler */}
                  <div className="h-6 border-b bg-muted/30 relative sticky top-0 z-10">
                    {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                      <div
                        key={i}
                        className="absolute top-0 flex flex-col items-center"
                        style={{ left: i * PIXELS_PER_SECOND * zoom }}
                      >
                        <div className="w-px h-3 bg-border" />
                        <span className="text-[9px] text-muted-foreground font-mono">{formatTime(i)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Playhead */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                    style={{ left: currentTime * PIXELS_PER_SECOND * zoom }}
                  >
                    <div className="w-3 h-3 bg-primary rounded-full -ml-[5px] -mt-0.5" />
                  </div>

                  {/* Click to seek */}
                  <div
                    className="absolute top-0 left-0 right-0 h-6 z-10 cursor-pointer"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      seekTo(x / (PIXELS_PER_SECOND * zoom));
                    }}
                  />

                  {/* Track 1: Scenes */}
                  {trackVisibility.scenes && (
                    <div className="h-14 border-b relative">
                      {scenes.map((scene, index) => {
                        const effectiveDuration = scene.duration - (scene.trimStart || 0) - (scene.trimEnd || 0);
                        const width = effectiveDuration * PIXELS_PER_SECOND * zoom;
                        const left = scene.startTime * PIXELS_PER_SECOND * zoom;
                        const transition = transitions.find(t => t.afterSceneIndex === index);

                        return (
                          <React.Fragment key={scene.sceneNumber}>
                            <div
                              className={cn(
                                "absolute top-1 bottom-1 rounded-md border-2 overflow-hidden cursor-pointer transition-colors group",
                                selectedItemId === `scene-${index}`
                                  ? 'border-primary ring-1 ring-primary/30'
                                  : 'border-border hover:border-primary/50',
                                scene.locked && 'opacity-70'
                              )}
                              style={{ left, width: Math.max(width, 20) }}
                              onClick={() => {
                                setSelectedItemId(`scene-${index}`);
                                seekTo(scene.startTime);
                              }}
                              draggable={!scene.locked}
                              onDragStart={() => setDraggedScene(index)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() => {
                                if (draggedScene !== null && draggedScene !== index) {
                                  moveScene(draggedScene, index);
                                }
                                setDraggedScene(null);
                              }}
                            >
                              {/* Scene thumbnail */}
                              <div className="absolute inset-0 flex">
                                {scene.imageUrl && (
                                  <img src={scene.imageUrl} alt="" className="h-full w-12 object-cover flex-shrink-0" />
                                )}
                                <div className="flex-1 px-1.5 py-1 min-w-0">
                                  <p className="text-[10px] font-medium truncate">Scene {scene.sceneNumber}</p>
                                  <p className="text-[9px] text-muted-foreground truncate">{effectiveDuration.toFixed(1)}s</p>
                                </div>
                              </div>

                              {/* Scene actions (on hover) */}
                              <div className="absolute top-0.5 right-0.5 hidden group-hover:flex gap-0.5">
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={(e) => { e.stopPropagation(); toggleLockScene(index); }}>
                                  {scene.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                                </Button>
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={(e) => { e.stopPropagation(); duplicateScene(index); }}>
                                  <Copy className="w-2.5 h-2.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-4 w-4 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); deleteScene(index); }}>
                                  <Trash2 className="w-2.5 h-2.5" />
                                </Button>
                              </div>

                              {/* Drag handle */}
                              {!scene.locked && (
                                <div className="absolute left-0 top-0 bottom-0 w-2 flex items-center justify-center cursor-grab">
                                  <GripVertical className="w-2 h-2 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Transition marker */}
                            {index < scenes.length - 1 && (
                              <div
                                className={cn(
                                  "absolute top-2 bottom-2 w-6 flex items-center justify-center cursor-pointer z-10 rounded",
                                  transition ? 'bg-primary/20' : 'hover:bg-accent/50'
                                )}
                                style={{ left: left + width - 3 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (transition) {
                                    setEditingTransitionIndex(index);
                                    setTransitionDialogOpen(true);
                                  } else {
                                    addTransition(index);
                                  }
                                }}
                                title={transition ? `${transition.type} (${transition.duration}s)` : 'Add transition'}
                              >
                                <ArrowLeftRight className={cn("w-3 h-3", transition ? 'text-primary' : 'text-muted-foreground/50')} />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}

                  {/* Track 2: B-Roll */}
                  {trackVisibility.broll && (
                    <div className="h-10 border-b relative bg-accent/5">
                      {bRollClips.map(clip => (
                        <div
                          key={clip.id}
                          className={cn(
                            "absolute top-1 bottom-1 rounded bg-accent/30 border border-accent/50 px-1 flex items-center text-[9px] cursor-pointer",
                            selectedItemId === clip.id && 'border-primary ring-1 ring-primary/30'
                          )}
                          style={{
                            left: clip.startTime * PIXELS_PER_SECOND * zoom,
                            width: clip.duration * PIXELS_PER_SECOND * zoom,
                          }}
                          onClick={() => { setSelectedItemId(clip.id); seekTo(clip.startTime); }}
                        >
                          <ImageIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{clip.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Track 3: Text Overlays */}
                  {trackVisibility.text && (
                    <div className="h-10 border-b relative bg-primary/5">
                      {textOverlays.map(overlay => (
                        <div
                          key={overlay.id}
                          className={cn(
                            "absolute top-1 bottom-1 rounded bg-primary/20 border border-primary/30 px-1 flex items-center text-[9px] cursor-pointer",
                            selectedItemId === overlay.id && 'border-primary ring-1 ring-primary/30'
                          )}
                          style={{
                            left: overlay.startTime * PIXELS_PER_SECOND * zoom,
                            width: overlay.duration * PIXELS_PER_SECOND * zoom,
                          }}
                          onClick={() => {
                            setSelectedItemId(overlay.id);
                            setEditingText(overlay);
                            setTextDialogOpen(true);
                          }}
                        >
                          <Type className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{overlay.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Track 4: Product Overlays */}
                  {trackVisibility.products && (
                    <div className="h-10 border-b relative bg-secondary/5">
                      {productOverlays.map(overlay => (
                        <div
                          key={overlay.id}
                          className={cn(
                            "absolute top-1 bottom-1 rounded bg-secondary/20 border border-secondary/30 px-1 flex items-center text-[9px] cursor-pointer",
                            selectedItemId === overlay.id && 'border-primary ring-1 ring-primary/30'
                          )}
                          style={{
                            left: overlay.startTime * PIXELS_PER_SECOND * zoom,
                            width: overlay.duration * PIXELS_PER_SECOND * zoom,
                          }}
                          onClick={() => {
                            setSelectedItemId(overlay.id);
                            setEditingProduct(overlay);
                            setProductDialogOpen(true);
                          }}
                        >
                          <Package className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{overlay.name || 'Product'}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Track 5: Voiceover */}
                  {trackVisibility.voiceover && (
                    <div className="h-10 border-b relative bg-chart-1/5">
                      {audioTracks.filter(a => a.type === 'voiceover').map(track => (
                        <div
                          key={track.id}
                          className={cn(
                            "absolute top-1 bottom-1 rounded border px-1 flex items-center text-[9px] cursor-pointer",
                            track.muted ? 'bg-muted/30 border-muted' : 'bg-chart-1/20 border-chart-1/30',
                            selectedItemId === track.id && 'border-primary ring-1 ring-primary/30'
                          )}
                          style={{
                            left: track.startTime * PIXELS_PER_SECOND * zoom,
                            width: Math.max(track.duration * PIXELS_PER_SECOND * zoom, 20),
                          }}
                          onClick={() => setSelectedItemId(track.id)}
                        >
                          <Mic className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{track.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Track 6: Music */}
                  {trackVisibility.music && (
                    <div className="h-10 border-b relative bg-chart-2/5">
                      {audioTracks.filter(a => a.type === 'music').map(track => (
                        <div
                          key={track.id}
                          className={cn(
                            "absolute top-1 bottom-1 rounded border px-1 flex items-center text-[9px] cursor-pointer",
                            track.muted ? 'bg-muted/30 border-muted' : 'bg-chart-2/20 border-chart-2/30',
                            selectedItemId === track.id && 'border-primary ring-1 ring-primary/30'
                          )}
                          style={{
                            left: track.startTime * PIXELS_PER_SECOND * zoom,
                            width: Math.max(track.duration * PIXELS_PER_SECOND * zoom, 20),
                          }}
                          onClick={() => setSelectedItemId(track.id)}
                        >
                          <Music className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{track.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Track 7: SFX */}
                  {trackVisibility.sfx && (
                    <div className="h-10 border-b relative bg-chart-3/5">
                      {audioTracks.filter(a => a.type === 'sfx').map(track => (
                        <div
                          key={track.id}
                          className={cn(
                            "absolute top-1 bottom-1 rounded border px-1 flex items-center text-[9px] cursor-pointer bg-chart-3/20 border-chart-3/30",
                            selectedItemId === track.id && 'border-primary ring-1 ring-primary/30'
                          )}
                          style={{
                            left: track.startTime * PIXELS_PER_SECOND * zoom,
                            width: Math.max(track.duration * PIXELS_PER_SECOND * zoom, 20),
                          }}
                          onClick={() => setSelectedItemId(track.id)}
                        >
                          <SlidersHorizontal className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{track.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </div>
        </div>

        {/* ─── Asset / Properties Sidebar ──────────────────────── */}
        {showAssetPanel && (
          <div className="w-72 border-l flex flex-col bg-card overflow-hidden">
            <Tabs value={assetTab} onValueChange={setAssetTab} className="flex flex-col flex-1">
              <TabsList className="w-full grid grid-cols-4 mx-0 rounded-none border-b">
                <TabsTrigger value="broll" className="text-xs px-1">B-Roll</TabsTrigger>
                <TabsTrigger value="text" className="text-xs px-1">Text</TabsTrigger>
                <TabsTrigger value="product" className="text-xs px-1">Product</TabsTrigger>
                <TabsTrigger value="audio" className="text-xs px-1">Audio</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1">
                {/* B-Roll Tab */}
                <TabsContent value="broll" className="p-3 space-y-3 mt-0">
                  <Button className="w-full" size="sm" variant="outline" onClick={() => {
                    // Placeholder: upload b-roll
                    toast({ title: 'Upload B-Roll', description: 'Drag a video or image file to add B-roll' });
                  }}>
                    <Upload className="w-4 h-4 mr-2" /> Upload B-Roll
                  </Button>

                  {bRollClips.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No B-roll clips yet</p>
                      <p className="text-[10px]">Upload videos or images to overlay on your scenes</p>
                    </div>
                  )}

                  {bRollClips.map(clip => (
                    <div key={clip.id} className="p-2 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate">{clip.name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setBRollClips(prev => prev.filter(c => c.id !== clip.id))}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px]">Start</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={clip.startTime}
                            onChange={e => setBRollClips(prev => prev.map(c => c.id === clip.id ? { ...c, startTime: Number(e.target.value) } : c))}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-[10px]">Duration</Label>
                          <Input
                            type="number"
                            step={0.5}
                            min={0.5}
                            value={clip.duration}
                            onChange={e => setBRollClips(prev => prev.map(c => c.id === clip.id ? { ...c, duration: Number(e.target.value) } : c))}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px]">Position</Label>
                        <Select value={clip.position} onValueChange={v => setBRollClips(prev => prev.map(c => c.id === clip.id ? { ...c, position: v as BRollClip['position'] } : c))}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PIP_POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </TabsContent>

                {/* Text Tab */}
                <TabsContent value="text" className="p-3 space-y-3 mt-0">
                  <Button className="w-full" size="sm" onClick={addTextOverlay}>
                    <Plus className="w-4 h-4 mr-2" /> Add Text Overlay
                  </Button>

                  {textOverlays.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No text overlays yet</p>
                      <p className="text-[10px]">Add headlines, captions, or CTAs</p>
                    </div>
                  )}

                  {textOverlays.map(t => (
                    <div key={t.id} className="p-2 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate">"{t.text}"</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingText(t); setTextDialogOpen(true); }}>
                            <Wand2 className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteTextOverlay(t.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{formatTime(t.startTime)} → {formatTime(t.startTime + t.duration)}</p>
                    </div>
                  ))}
                </TabsContent>

                {/* Product Tab */}
                <TabsContent value="product" className="p-3 space-y-3 mt-0">
                  <Button className="w-full" size="sm" onClick={addProductOverlay}>
                    <Package className="w-4 h-4 mr-2" /> Add Product
                  </Button>

                  {productOverlays.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No product placements yet</p>
                      <p className="text-[10px]">Add products with positioning instructions</p>
                    </div>
                  )}

                  {productOverlays.map(p => (
                    <div key={p.id} className="p-2 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">{p.name || 'Product'}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingProduct(p); setProductDialogOpen(true); }}>
                          <Wand2 className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{formatTime(p.startTime)} → {formatTime(p.startTime + p.duration)}</p>
                    </div>
                  ))}
                </TabsContent>

                {/* Audio Tab */}
                <TabsContent value="audio" className="p-3 space-y-3 mt-0">
                  {audioTracks.map(track => (
                    <div key={track.id} className="p-2 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {track.type === 'voiceover' && <Mic className="w-3 h-3 text-primary" />}
                          {track.type === 'music' && <Music className="w-3 h-3 text-primary" />}
                          {track.type === 'sfx' && <SlidersHorizontal className="w-3 h-3 text-primary" />}
                          <span className="text-xs font-medium">{track.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          onClick={() => updateAudioTrack(track.id, { muted: !track.muted })}
                        >
                          {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                        </Button>
                      </div>
                      <div>
                        <Label className="text-[10px]">Volume</Label>
                        <Slider
                          value={[track.volume * 100]}
                          onValueChange={([v]) => updateAudioTrack(track.id, { volume: v / 100 })}
                          max={100}
                          step={1}
                        />
                      </div>
                      {track.type === 'music' && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Fade In (s)</Label>
                            <Input
                              type="number"
                              step={0.5}
                              min={0}
                              value={track.fadeIn}
                              onChange={e => updateAudioTrack(track.id, { fadeIn: Number(e.target.value) })}
                              className="h-7 text-xs"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Fade Out (s)</Label>
                            <Input
                              type="number"
                              step={0.5}
                              min={0}
                              value={track.fadeOut}
                              onChange={e => updateAudioTrack(track.id, { fadeOut: Number(e.target.value) })}
                              className="h-7 text-xs"
                            />
                          </div>
                        </div>
                      )}
                      {track.type === 'voiceover' && onRegenerateVoice && (
                        <div className="flex gap-1">
                          {onPreviewVoice && (
                            <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => {
                              const num = parseInt(track.id.replace('vo-', ''));
                              onPreviewVoice(num);
                            }}>
                              <Play className="w-3 h-3 mr-1" /> Preview
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => {
                            const num = parseInt(track.id.replace('vo-', ''));
                            onRegenerateVoice(num);
                          }}>
                            <Mic className="w-3 h-3 mr-1" /> Regenerate
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {audioTracks.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-xs">No audio tracks</p>
                    </div>
                  )}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            {/* Scene Properties (when a scene is selected) */}
            {selectedItemId?.startsWith('scene-') && (() => {
              const idx = parseInt(selectedItemId.replace('scene-', ''));
              const scene = scenes[idx];
              if (!scene) return null;
              return (
                <div className="border-t p-3 space-y-3 max-h-64 overflow-y-auto">
                  <h4 className="text-xs font-semibold">Scene {scene.sceneNumber} Properties</h4>
                  <div>
                    <Label className="text-[10px]">Duration (seconds)</Label>
                    <Slider
                      value={[scene.duration]}
                      onValueChange={([v]) => adjustDuration(idx, v)}
                      min={2}
                      max={30}
                      step={0.5}
                    />
                    <span className="text-[10px] text-muted-foreground">{scene.duration}s</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Trim Start</Label>
                      <Input
                        type="number"
                        step={0.5}
                        min={0}
                        max={scene.duration - 1}
                        value={scene.trimStart || 0}
                        onChange={e => trimScene(idx, Number(e.target.value), scene.trimEnd || 0)}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Trim End</Label>
                      <Input
                        type="number"
                        step={0.5}
                        min={0}
                        max={scene.duration - 1}
                        value={scene.trimEnd || 0}
                        onChange={e => trimScene(idx, scene.trimStart || 0, Number(e.target.value))}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{scene.narration}</p>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ─── Transition Dialog ───────────────────────────────────── */}
      <Dialog open={transitionDialogOpen} onOpenChange={setTransitionDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Transition</DialogTitle>
            <DialogDescription>Choose a transition effect between scenes</DialogDescription>
          </DialogHeader>
          <TransitionPicker
            currentType={transitions.find(t => t.afterSceneIndex === editingTransitionIndex)?.type || 'fade'}
            currentDuration={transitions.find(t => t.afterSceneIndex === editingTransitionIndex)?.duration || 0.5}
            onSave={saveTransition}
            onRemove={() => { if (editingTransitionIndex !== null) removeTransition(editingTransitionIndex); setTransitionDialogOpen(false); }}
          />
        </DialogContent>
      </Dialog>

      {/* ─── Text Overlay Dialog ─────────────────────────────────── */}
      <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Text Overlay</DialogTitle>
            <DialogDescription>Configure text appearance and timing</DialogDescription>
          </DialogHeader>
          {editingText && (
            <TextOverlayEditor
              overlay={editingText}
              onSave={saveTextOverlay}
              onDelete={() => { deleteTextOverlay(editingText.id); setTextDialogOpen(false); }}
              totalDuration={totalDuration}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Product Overlay Dialog ──────────────────────────────── */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Product Placement</DialogTitle>
            <DialogDescription>Position your product in the scene</DialogDescription>
          </DialogHeader>
          {editingProduct && (
            <ProductOverlayEditor
              overlay={editingProduct}
              onSave={saveProductOverlay}
              totalDuration={totalDuration}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────

const TransitionPicker: React.FC<{
  currentType: string;
  currentDuration: number;
  onSave: (type: string, duration: number) => void;
  onRemove: () => void;
}> = ({ currentType, currentDuration, onSave, onRemove }) => {
  const [type, setType] = useState(currentType);
  const [duration, setDuration] = useState(currentDuration);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {TRANSITION_TYPES.map(t => (
          <Button
            key={t.value}
            variant={type === t.value ? 'default' : 'outline'}
            size="sm"
            className="flex flex-col h-14 text-[10px]"
            onClick={() => setType(t.value)}
          >
            <span className="text-lg">{t.icon}</span>
            {t.label}
          </Button>
        ))}
      </div>
      <div>
        <Label className="text-xs">Duration (seconds)</Label>
        <Slider
          value={[duration * 10]}
          onValueChange={([v]) => setDuration(v / 10)}
          min={1}
          max={20}
          step={1}
        />
        <span className="text-xs text-muted-foreground">{duration}s</span>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onSave(type, duration)}>Apply</Button>
        <Button variant="destructive" size="sm" onClick={onRemove}>Remove</Button>
      </div>
    </div>
  );
};

const TextOverlayEditor: React.FC<{
  overlay: TextOverlay;
  onSave: (overlay: TextOverlay) => void;
  onDelete: () => void;
  totalDuration: number;
}> = ({ overlay, onSave, onDelete, totalDuration }) => {
  const [local, setLocal] = useState(overlay);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Text</Label>
        <Textarea value={local.text} onChange={e => setLocal(prev => ({ ...prev, text: e.target.value }))} className="h-20" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Start Time (s)</Label>
          <Input type="number" step={0.5} min={0} max={totalDuration} value={local.startTime} onChange={e => setLocal(prev => ({ ...prev, startTime: Number(e.target.value) }))} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Duration (s)</Label>
          <Input type="number" step={0.5} min={0.5} value={local.duration} onChange={e => setLocal(prev => ({ ...prev, duration: Number(e.target.value) }))} className="h-8" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Position</Label>
          <Select value={local.position} onValueChange={v => setLocal(prev => ({ ...prev, position: v as TextOverlay['position'] }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Animation</Label>
          <Select value={local.animation} onValueChange={v => setLocal(prev => ({ ...prev, animation: v as TextOverlay['animation'] }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEXT_ANIMATIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Size</Label>
          <Input type="number" min={12} max={72} value={local.fontSize} onChange={e => setLocal(prev => ({ ...prev, fontSize: Number(e.target.value) }))} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Weight</Label>
          <Select value={local.fontWeight} onValueChange={v => setLocal(prev => ({ ...prev, fontWeight: v as TextOverlay['fontWeight'] }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Color</Label>
          <Input type="color" value={local.color} onChange={e => setLocal(prev => ({ ...prev, color: e.target.value }))} className="h-8 p-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onSave(local)}>Save</Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
};

const ProductOverlayEditor: React.FC<{
  overlay: ProductOverlay;
  onSave: (overlay: ProductOverlay) => void;
  totalDuration: number;
}> = ({ overlay, onSave, totalDuration }) => {
  const [local, setLocal] = useState(overlay);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">Product Image URL</Label>
        <Input value={local.imageUrl} onChange={e => setLocal(prev => ({ ...prev, imageUrl: e.target.value }))} placeholder="Paste product image URL" className="h-8" />
      </div>
      <div>
        <Label className="text-xs">Product Name</Label>
        <Input value={local.name} onChange={e => setLocal(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. SuperDrink Energy" className="h-8" />
      </div>
      <div>
        <Label className="text-xs">Placement Instructions</Label>
        <Textarea
          value={local.instructions}
          onChange={e => setLocal(prev => ({ ...prev, instructions: e.target.value }))}
          placeholder="e.g. Person holding this product in their hand"
          className="h-16"
        />
        <div className="flex flex-wrap gap-1 mt-1">
          {['Holding in hand', 'On the table', 'Beside the actor', 'Close-up shot'].map(preset => (
            <Button key={preset} variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setLocal(prev => ({ ...prev, instructions: preset }))}>
              {preset}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Start Time (s)</Label>
          <Input type="number" step={0.5} min={0} max={totalDuration} value={local.startTime} onChange={e => setLocal(prev => ({ ...prev, startTime: Number(e.target.value) }))} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Duration (s)</Label>
          <Input type="number" step={0.5} min={0.5} value={local.duration} onChange={e => setLocal(prev => ({ ...prev, duration: Number(e.target.value) }))} className="h-8" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Position</Label>
          <Select value={local.position} onValueChange={v => setLocal(prev => ({ ...prev, position: v as ProductOverlay['position'] }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="bottom-right">Bottom Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem>
              <SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="top-left">Top Left</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Scale</Label>
          <Slider
            value={[local.scale * 100]}
            onValueChange={([v]) => setLocal(prev => ({ ...prev, scale: v / 100 }))}
            min={10}
            max={100}
            step={5}
          />
          <span className="text-[10px] text-muted-foreground">{Math.round(local.scale * 100)}%</span>
        </div>
      </div>
      <Button className="w-full" onClick={() => onSave(local)}>Save Product Placement</Button>
    </div>
  );
};
