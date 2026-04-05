import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Scissors, Copy, Trash2, Lock, Unlock, Plus, Upload, Type,
  Package, Music, Film, Layers, GripVertical, ChevronLeft,
  ChevronRight, ZoomIn, ZoomOut, Maximize2, Image as ImageIcon,
  ArrowLeftRight, Mic, SlidersHorizontal, Eye, EyeOff, Wand2,
  Undo2, Redo2, Save, RotateCcw, Camera, User, Zap,
  MoveHorizontal, AlertTriangle, Target, Sparkles, RefreshCw,
  ScanSearch, MessageSquare
} from 'lucide-react';
import { SceneDetector } from '@/components/SceneDetector';
import { TimelineAIDirector, DirectorAction } from '@/components/TimelineAIDirector';

// ─── Types ────────────────────────────────────────────────────────────
interface TimelineScene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  imageUrl: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  audioDuration: number;
  duration: number;
  startTime: number;
  endTime: number;
  locked?: boolean;
  trimStart?: number;
  trimEnd?: number;
  isIntro?: boolean;
  isOutro?: boolean;
  actor?: string;
  product?: string;
  cameraDirection?: string;
  expression?: string;
  movement?: string;
  transitionIn?: string;
  transitionOut?: string;
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
  position: 'top' | 'center' | 'bottom' | 'safe-top' | 'safe-bottom';
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
  backgroundColor: string;
  animation: 'none' | 'fade' | 'slide-up' | 'typewriter' | 'pop';
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
  duration: number;
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

// Undo/redo snapshot
interface EditorSnapshot {
  scenes: TimelineScene[];
  bRollClips: BRollClip[];
  textOverlays: TextOverlay[];
  productOverlays: ProductOverlay[];
  transitions: TransitionMarker[];
  audioTracks: AudioTrack[];
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
  onRegenerateScene?: (sceneNumber: number) => void;
  onReplaceScene?: (sceneNumber: number) => void;
  aspectRatio?: string;
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
  { value: 'pop', label: 'Pop' },
];

const PIP_POSITIONS = [
  { value: 'fullscreen', label: 'Full Screen' },
  { value: 'pip-tl', label: 'Top Left' },
  { value: 'pip-tr', label: 'Top Right' },
  { value: 'pip-bl', label: 'Bottom Left' },
  { value: 'pip-br', label: 'Bottom Right' },
];

const CAMERA_DIRECTIONS = [
  'Static', 'Pan Left', 'Pan Right', 'Tilt Up', 'Tilt Down',
  'Zoom In', 'Zoom Out', 'Dolly In', 'Tracking Shot', 'Whip Pan',
  'Dutch Angle', 'Crane Up', 'Crane Down', 'Orbit', 'Handheld',
];

const EXPRESSIONS = [
  'Neutral', 'Smiling', 'Excited', 'Thoughtful', 'Serious',
  'Surprised', 'Confident', 'Concerned', 'Laughing', 'Determined',
];

const MOVEMENTS = [
  'Standing Still', 'Walking', 'Gesturing', 'Turning',
  'Leaning In', 'Stepping Forward', 'Looking Away', 'Nodding',
  'Pointing', 'Holding Product',
];

const PIXELS_PER_SECOND = 80;
const MAX_UNDO_HISTORY = 50;

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
  onRegenerateScene,
  onReplaceScene,
  aspectRatio = '9:16',
}) => {
  const { toast } = useToast();
  const timelineRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playheadIntervalRef = useRef<number | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  // ─── Core State ─────────────────────────────────────────────────────
  const [scenes, setScenes] = useState<TimelineScene[]>(initialScenes);
  const [bRollClips, setBRollClips] = useState<BRollClip[]>([]);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [productOverlays, setProductOverlays] = useState<ProductOverlay[]>([]);
  const [transitions, setTransitions] = useState<TransitionMarker[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackVolume, setPlaybackVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // UI
  const [zoom, setZoom] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<string>('scenes');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [assetTab, setAssetTab] = useState<string>('scenes');
  const [draggedScene, setDraggedScene] = useState<number | null>(null);
  const [showAssetPanel, setShowAssetPanel] = useState(true);
  const [showSafeZones, setShowSafeZones] = useState(true);
  const [resizingClip, setResizingClip] = useState<{ id: string; edge: 'left' | 'right'; startX: number; startDuration: number; startTime: number } | null>(null);

  // Dialogs
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [editingTransitionIndex, setEditingTransitionIndex] = useState<number | null>(null);
  const [textDialogOpen, setTextDialogOpen] = useState(false);
  const [editingText, setEditingText] = useState<TextOverlay | null>(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductOverlay | null>(null);

  // Undo/Redo
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // AI Director
  const [showAIDirector, setShowAIDirector] = useState(false);

  // Track visibility
  const [trackVisibility, setTrackVisibility] = useState({
    scenes: true, broll: true, text: true, products: true,
    voiceover: true, music: true, sfx: true,
  });

  const totalDuration = useMemo(() =>
    scenes.reduce((sum, s) => sum + (s.duration - (s.trimStart || 0) - (s.trimEnd || 0)), 0),
    [scenes]
  );
  const timelineWidth = totalDuration * PIXELS_PER_SECOND * zoom;

  // ─── Snapshot for undo/redo ─────────────────────────────────────────
  const takeSnapshot = useCallback((): EditorSnapshot => ({
    scenes: JSON.parse(JSON.stringify(scenes)),
    bRollClips: JSON.parse(JSON.stringify(bRollClips)),
    textOverlays: JSON.parse(JSON.stringify(textOverlays)),
    productOverlays: JSON.parse(JSON.stringify(productOverlays)),
    transitions: JSON.parse(JSON.stringify(transitions)),
    audioTracks: JSON.parse(JSON.stringify(audioTracks)),
  }), [scenes, bRollClips, textOverlays, productOverlays, transitions, audioTracks]);

  const pushUndo = useCallback(() => {
    const snap = takeSnapshot();
    setUndoStack(prev => [...prev.slice(-MAX_UNDO_HISTORY), snap]);
    setRedoStack([]);
    setHasUnsavedChanges(true);
  }, [takeSnapshot]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const current = takeSnapshot();
    setRedoStack(prev => [...prev, current]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(stack => stack.slice(0, -1));
    setScenes(prev.scenes);
    setBRollClips(prev.bRollClips);
    setTextOverlays(prev.textOverlays);
    setProductOverlays(prev.productOverlays);
    setTransitions(prev.transitions);
    setAudioTracks(prev.audioTracks);
    onScenesUpdate(prev.scenes);
    toast({ title: 'Undo' });
  }, [undoStack, takeSnapshot, onScenesUpdate, toast]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const current = takeSnapshot();
    setUndoStack(prev => [...prev, current]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack(stack => stack.slice(0, -1));
    setScenes(next.scenes);
    setBRollClips(next.bRollClips);
    setTextOverlays(next.textOverlays);
    setProductOverlays(next.productOverlays);
    setTransitions(next.transitions);
    setAudioTracks(next.audioTracks);
    onScenesUpdate(next.scenes);
    toast({ title: 'Redo' });
  }, [redoStack, takeSnapshot, onScenesUpdate, toast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) { e.preventDefault(); togglePlayback(); }
      if (e.key === 'Delete' && selectedItemId) { handleDeleteSelected(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedItemId]);

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveTimerRef.current = window.setInterval(() => {
      if (hasUnsavedChanges) {
        onScenesUpdate(scenes);
        setLastSavedAt(new Date());
        setHasUnsavedChanges(false);
      }
    }, 30000);
    return () => { if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current); };
  }, [hasUnsavedChanges, scenes, onScenesUpdate]);

  const manualSave = () => {
    onScenesUpdate(scenes);
    setLastSavedAt(new Date());
    setHasUnsavedChanges(false);
    toast({ title: 'Saved', description: 'Timeline changes saved' });
  };

  // ─── Initialize audio tracks ────────────────────────────────────────
  useEffect(() => {
    const voTracks: AudioTrack[] = voiceovers.map((vo) => ({
      id: `vo-${vo.sceneNumber}`,
      url: vo.audioUrl,
      name: `Scene ${vo.sceneNumber} VO`,
      type: 'voiceover' as const,
      startTime: scenes.find(s => s.sceneNumber === vo.sceneNumber)?.startTime || 0,
      duration: vo.duration,
      volume: 1, fadeIn: 0, fadeOut: 0, muted: false,
    }));
    if (backgroundMusicUrl) {
      voTracks.push({
        id: 'bg-music', url: backgroundMusicUrl, name: 'Background Music',
        type: 'music', startTime: 0, duration: totalDuration,
        volume: 0.3, fadeIn: 2, fadeOut: 2, muted: false,
      });
    }
    setAudioTracks(voTracks);
  }, [voiceovers, backgroundMusicUrl]);

  // ─── Playback ───────────────────────────────────────────────────────
  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
    } else {
      setIsPlaying(true);
      const startedAt = Date.now() - currentTime * 1000;
      playheadIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        if (elapsed >= totalDuration) {
          setCurrentTime(0); setIsPlaying(false);
          if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
        } else { setCurrentTime(elapsed); }
      }, 50);
    }
  }, [isPlaying, currentTime, totalDuration]);

  useEffect(() => () => { if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current); }, []);

  const seekTo = (time: number) => setCurrentTime(Math.max(0, Math.min(time, totalDuration)));
  const skipForward = () => seekTo(currentTime + 2);
  const skipBackward = () => seekTo(Math.max(0, currentTime - 2));

  // ─── Scene Management (with undo) ──────────────────────────────────
  const moveScene = (fromIndex: number, toIndex: number) => {
    pushUndo();
    const updated = [...scenes];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    recalcTimings(updated);
  };

  const duplicateScene = (index: number) => {
    pushUndo();
    const newScene = { ...scenes[index], sceneNumber: scenes.length + 1 };
    const updated = [...scenes];
    updated.splice(index + 1, 0, newScene);
    recalcTimings(updated);
    toast({ title: 'Scene Duplicated' });
  };

  const deleteScene = (index: number) => {
    if (scenes.length <= 1) { toast({ title: 'Cannot delete', description: 'At least one scene is required', variant: 'destructive' }); return; }
    pushUndo();
    recalcTimings(scenes.filter((_, i) => i !== index));
    toast({ title: 'Scene Deleted' });
  };

  const toggleLockScene = (index: number) => {
    const updated = [...scenes];
    updated[index] = { ...updated[index], locked: !updated[index].locked };
    setScenes(updated);
  };

  const adjustDuration = (index: number, newDuration: number) => {
    pushUndo();
    const updated = [...scenes];
    updated[index] = { ...updated[index], duration: Math.max(2, newDuration) };
    recalcTimings(updated);
  };

  const trimScene = (index: number, trimStart: number, trimEnd: number) => {
    pushUndo();
    const updated = [...scenes];
    updated[index] = { ...updated[index], trimStart, trimEnd };
    recalcTimings(updated);
  };

  const updateSceneProperty = (index: number, updates: Partial<TimelineScene>) => {
    pushUndo();
    const updated = [...scenes];
    updated[index] = { ...updated[index], ...updates };
    setScenes(updated);
    onScenesUpdate(updated);
    setHasUnsavedChanges(true);
  };

  const recalcTimings = (updatedScenes: TimelineScene[]) => {
    let time = 0;
    const reindexed = updatedScenes.map((s, i) => {
      const effectiveDuration = s.duration - (s.trimStart || 0) - (s.trimEnd || 0);
      const scene = { ...s, sceneNumber: i + 1, startTime: time, endTime: time + effectiveDuration };
      time += effectiveDuration;
      return scene;
    });
    setScenes(reindexed);
    onScenesUpdate(reindexed);
    setHasUnsavedChanges(true);
  };

  // ─── AI Director Action Handler ────────────────────────────────────
  const handleDirectorAction = useCallback((action: DirectorAction) => {
    switch (action.type) {
      case 'split_clip': {
        if (action.clipIndex !== undefined && action.timestamp !== undefined) {
          pushUndo();
          const idx = action.clipIndex;
          if (idx < 0 || idx >= scenes.length) return;
          const scene = scenes[idx];
          const splitAt = action.timestamp;
          if (splitAt <= 0 || splitAt >= scene.duration) return;
          const first = { ...scene, duration: splitAt, endTime: scene.startTime + splitAt };
          const second = { ...scene, duration: scene.duration - splitAt, startTime: scene.startTime + splitAt, sceneNumber: scene.sceneNumber + 1 };
          const updated = [...scenes.slice(0, idx), first, second, ...scenes.slice(idx + 1)];
          recalcTimings(updated);
          toast({ title: `Split clip #${idx + 1} at ${splitAt.toFixed(1)}s` });
        }
        break;
      }
      case 'trim_clip': {
        if (action.clipIndex !== undefined) {
          trimScene(action.clipIndex, action.trimStart || 0, action.trimEnd || 0);
        }
        break;
      }
      case 'delete_clip': {
        if (action.clipIndex !== undefined) deleteScene(action.clipIndex);
        break;
      }
      case 'reorder_clips': {
        if (action.fromIndex !== undefined && action.toIndex !== undefined) {
          moveScene(action.fromIndex, action.toIndex);
        }
        break;
      }
      case 'regenerate_clip': {
        if (action.clipIndex !== undefined && onRegenerateScene) {
          onRegenerateScene(scenes[action.clipIndex]?.sceneNumber);
        }
        break;
      }
      case 'add_caption': {
        if (action.clipIndex !== undefined && action.text) {
          updateSceneProperty(action.clipIndex, { narration: action.text });
        }
        break;
      }
      case 'set_transition': {
        // Handled after transition functions are defined
        break;
      }
      default:
        break;
    }
  }, [scenes, pushUndo, recalcTimings, trimScene, deleteScene, moveScene, updateSceneProperty, onRegenerateScene, toast]);

  const handleSplitAt = useCallback((timestamp: number) => {
    // Find which scene this timestamp falls into
    const sceneIdx = scenes.findIndex(s => timestamp >= s.startTime && timestamp < s.endTime);
    if (sceneIdx >= 0) {
      const localTime = timestamp - scenes[sceneIdx].startTime;
      handleDirectorAction({ type: 'split_clip', clipIndex: sceneIdx, timestamp: localTime });
    }
  }, [scenes, handleDirectorAction]);

  const handleSplitAll = useCallback((timestamps: number[]) => {
    // Sort descending so indices don't shift
    const sorted = [...timestamps].sort((a, b) => b - a);
    for (const ts of sorted) {
      handleSplitAt(ts);
    }
  }, [handleSplitAt]);

  // ─── Transitions ───────────────────────────────────────────────────
  const addTransition = (afterSceneIndex: number) => { setEditingTransitionIndex(afterSceneIndex); setTransitionDialogOpen(true); };
  const saveTransition = (type: string, duration: number) => {
    if (editingTransitionIndex === null) return;
    pushUndo();
    const existing = transitions.find(t => t.afterSceneIndex === editingTransitionIndex);
    if (existing) {
      setTransitions(prev => prev.map(t => t.afterSceneIndex === editingTransitionIndex ? { ...t, type: type as TransitionMarker['type'], duration } : t));
    } else {
      setTransitions(prev => [...prev, { id: `tr-${Date.now()}`, afterSceneIndex: editingTransitionIndex, type: type as TransitionMarker['type'], duration }]);
    }
    setTransitionDialogOpen(false);
    toast({ title: 'Transition Applied' });
  };
  const removeTransition = (afterSceneIndex: number) => { pushUndo(); setTransitions(prev => prev.filter(t => t.afterSceneIndex !== afterSceneIndex)); };

  // ─── Text Overlays ─────────────────────────────────────────────────
  const addTextOverlay = (preset?: Partial<TextOverlay>) => {
    const newText: TextOverlay = {
      id: `text-${Date.now()}`, text: preset?.text || 'Your text here',
      startTime: currentTime, duration: 3, position: preset?.position || 'bottom',
      fontSize: preset?.fontSize || 24, fontWeight: 'bold',
      color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.5)',
      animation: preset?.animation || 'fade', ...preset,
    };
    setEditingText(newText);
    setTextDialogOpen(true);
  };

  const saveTextOverlay = (overlay: TextOverlay) => {
    pushUndo();
    setTextOverlays(prev => {
      const exists = prev.find(t => t.id === overlay.id);
      if (exists) return prev.map(t => t.id === overlay.id ? overlay : t);
      return [...prev, overlay];
    });
    setTextDialogOpen(false);
  };

  const deleteTextOverlay = (id: string) => { pushUndo(); setTextOverlays(prev => prev.filter(t => t.id !== id)); };

  // ─── Product Overlays ──────────────────────────────────────────────
  const addProductOverlay = () => {
    const newProduct: ProductOverlay = {
      id: `prod-${Date.now()}`, imageUrl: '', name: '', startTime: currentTime,
      duration: 5, position: 'bottom-right', scale: 0.3, instructions: '',
    };
    setEditingProduct(newProduct);
    setProductDialogOpen(true);
  };
  const saveProductOverlay = (overlay: ProductOverlay) => {
    pushUndo();
    setProductOverlays(prev => {
      const exists = prev.find(p => p.id === overlay.id);
      if (exists) return prev.map(p => p.id === overlay.id ? overlay : p);
      return [...prev, overlay];
    });
    setProductDialogOpen(false);
  };

  // ─── B-Roll ────────────────────────────────────────────────────────
  const addBRollClip = (url: string, name: string, type: 'video' | 'image') => {
    pushUndo();
    setBRollClips(prev => [...prev, {
      id: `broll-${Date.now()}`, url, name, startTime: currentTime, duration: 5,
      trackIndex: 0, type, opacity: 1, position: 'fullscreen',
    }]);
    toast({ title: 'B-Roll Added' });
  };

  // ─── Audio ─────────────────────────────────────────────────────────
  const updateAudioTrack = (id: string, updates: Partial<AudioTrack>) => {
    pushUndo();
    setAudioTracks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  // ─── Delete selected ──────────────────────────────────────────────
  const handleDeleteSelected = () => {
    if (!selectedItemId) return;
    if (selectedItemId.startsWith('scene-')) { deleteScene(parseInt(selectedItemId.replace('scene-', ''))); }
    else if (selectedItemId.startsWith('broll-')) { pushUndo(); setBRollClips(prev => prev.filter(c => c.id !== selectedItemId)); }
    else if (selectedItemId.startsWith('text-')) { deleteTextOverlay(selectedItemId); }
    else if (selectedItemId.startsWith('prod-')) { pushUndo(); setProductOverlays(prev => prev.filter(p => p.id !== selectedItemId)); }
    setSelectedItemId(null);
  };

  // ─── Resize handle interactions ────────────────────────────────────
  const handleResizeStart = (e: React.MouseEvent, clipId: string, edge: 'left' | 'right', currentDuration: number, currentStartTime: number) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingClip({ id: clipId, edge, startX: e.clientX, startDuration: currentDuration, startTime: currentStartTime });
  };

  useEffect(() => {
    if (!resizingClip) return;
    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizingClip.startX;
      const deltaSec = deltaX / (PIXELS_PER_SECOND * zoom);
      if (resizingClip.id.startsWith('scene-')) {
        const idx = parseInt(resizingClip.id.replace('scene-', ''));
        if (resizingClip.edge === 'right') {
          const newDur = Math.max(2, resizingClip.startDuration + deltaSec);
          const updated = [...scenes];
          updated[idx] = { ...updated[idx], duration: newDur };
          recalcTimingsNoUndo(updated);
        }
      } else {
        // B-roll, text, product resize
        const updateFn = (items: any[], setter: React.Dispatch<React.SetStateAction<any[]>>) => {
          setter(items.map(item => {
            if (item.id !== resizingClip.id) return item;
            if (resizingClip.edge === 'right') return { ...item, duration: Math.max(0.5, resizingClip.startDuration + deltaSec) };
            if (resizingClip.edge === 'left') {
              const newStart = Math.max(0, resizingClip.startTime + deltaSec);
              const newDur = resizingClip.startDuration - deltaSec;
              return newDur > 0.5 ? { ...item, startTime: newStart, duration: newDur } : item;
            }
            return item;
          }));
        };
        if (resizingClip.id.startsWith('broll-')) updateFn(bRollClips, setBRollClips);
        if (resizingClip.id.startsWith('text-')) updateFn(textOverlays, setTextOverlays as any);
        if (resizingClip.id.startsWith('prod-')) updateFn(productOverlays, setProductOverlays as any);
      }
    };
    const handleUp = () => { pushUndo(); setResizingClip(null); };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [resizingClip, zoom, scenes, bRollClips, textOverlays, productOverlays]);

  const recalcTimingsNoUndo = (updatedScenes: TimelineScene[]) => {
    let time = 0;
    const reindexed = updatedScenes.map((s, i) => {
      const effectiveDuration = s.duration - (s.trimStart || 0) - (s.trimEnd || 0);
      return { ...s, sceneNumber: i + 1, startTime: time, endTime: time + (time += effectiveDuration, effectiveDuration) - effectiveDuration + effectiveDuration };
    });
    // Simplified recalc
    let t2 = 0;
    const final = updatedScenes.map((s, i) => {
      const eff = s.duration - (s.trimStart || 0) - (s.trimEnd || 0);
      const out = { ...s, sceneNumber: i + 1, startTime: t2, endTime: t2 + eff };
      t2 += eff;
      return out;
    });
    setScenes(final);
  };

  // ─── Drag and drop for non-scene items ─────────────────────────────
  const handleTimelineDrop = (e: React.DragEvent, trackType: string) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dropTime = x / (PIXELS_PER_SECOND * zoom);
    
    try {
      const item = JSON.parse(data);
      if (item.type === 'broll' && trackType === 'broll') {
        addBRollClip(item.url, item.name, item.mediaType || 'image');
      } else if (item.type === 'transition' && trackType === 'scenes') {
        const sceneIdx = scenes.findIndex(s => dropTime >= s.startTime && dropTime < s.endTime);
        if (sceneIdx >= 0 && sceneIdx < scenes.length - 1) addTransition(sceneIdx);
      }
    } catch {} // Not JSON, ignore
  };

  // ─── Helpers ───────────────────────────────────────────────────────
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${m}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  const currentSceneIndex = scenes.findIndex(s => currentTime >= s.startTime && currentTime < s.endTime);
  const currentScene = currentSceneIndex >= 0 ? scenes[currentSceneIndex] : scenes[0];
  const selectedSceneIndex = selectedItemId?.startsWith('scene-') ? parseInt(selectedItemId.replace('scene-', '')) : null;
  const selectedSceneData = selectedSceneIndex !== null ? scenes[selectedSceneIndex] : null;

  // Quick text presets for reels
  const addHookText = () => addTextOverlay({ text: '🔥 Watch This!', startTime: 0, duration: 2, position: 'safe-top', fontSize: 32, animation: 'pop' });
  const addCTAText = () => addTextOverlay({ text: 'Follow for more! 👆', startTime: Math.max(0, totalDuration - 3), duration: 3, position: 'safe-bottom', fontSize: 28, animation: 'slide-up' });
  const addAutoBRoll = () => {
    // Insert b-roll markers every ~4 seconds
    for (let t = 4; t < totalDuration - 2; t += 8) {
      setBRollClips(prev => [...prev, {
        id: `broll-${Date.now()}-${t}`, url: '', name: `B-Roll ${Math.ceil(t / 4)}`,
        startTime: t, duration: 3, trackIndex: 0, type: 'image', opacity: 1, position: 'fullscreen',
      }]);
    }
    toast({ title: 'B-Roll Markers Added', description: 'Upload visuals for each marker' });
  };

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-[hsl(var(--background))] text-foreground">
        {/* ─── Top Bar (CapCut-style dark toolbar) ───────────────── */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-card/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="w-4 h-4" /> Exit Timeline
            </Button>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">{scenes.length} Scenes</span>
              <Badge variant="secondary" className="text-[10px] font-mono bg-muted">
                {formatTime(totalDuration)}
              </Badge>
            </div>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-[10px] border-yellow-500/40 text-yellow-500 animate-pulse">
                ● Unsaved
              </Badge>
            )}
            {lastSavedAt && !hasUnsavedChanges && (
              <span className="text-[10px] text-muted-foreground">
                ✓ Saved {lastSavedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={undo} disabled={undoStack.length === 0}>
                <Undo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Undo (Ctrl+Z)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={redo} disabled={redoStack.length === 0}>
                <Redo2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent></Tooltip>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={manualSave}>
              <Save className="w-3.5 h-3.5" /> Save
            </Button>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <Tooltip><TooltipTrigger asChild>
              <Button variant={showSafeZones ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => setShowSafeZones(!showSafeZones)}>
                <Target className="w-4 h-4" />
              </Button>
            </TooltipTrigger><TooltipContent>Safe Zones</TooltipContent></Tooltip>
            <Button variant={showAssetPanel ? 'secondary' : 'ghost'} size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowAssetPanel(!showAssetPanel)}>
              <Layers className="w-3.5 h-3.5" /> Properties
            </Button>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <div className="flex items-center gap-0.5 bg-muted/50 rounded-md px-1 py-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[10px] text-muted-foreground w-9 text-center font-mono">{Math.round(zoom * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Main Content ────────────────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col flex-1 min-w-0">

            {/* ─── Video Preview ─────────────────────────────── */}
            <div className="flex items-center justify-center bg-muted/80 p-4" style={{ minHeight: 280 }}>
              <div className={cn(
                "relative rounded-xl overflow-hidden shadow-2xl ring-1 ring-border/50",
                aspectRatio === '9:16' ? 'aspect-[9/16] max-h-[250px]' :
                aspectRatio === '1:1' ? 'aspect-square max-h-[250px]' :
                'aspect-video max-h-[250px]'
              )} style={{ width: aspectRatio === '9:16' ? 130 : aspectRatio === '1:1' ? 230 : 400 }}>
                {currentScene?.videoUrl ? (
                  <video ref={videoRef} src={currentScene.videoUrl} className="w-full h-full object-cover" muted={isMuted} />
                ) : currentScene?.imageUrl ? (
                  <img src={currentScene.imageUrl} alt="Scene" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground"><Film className="w-8 h-8" /></div>
                )}

                {/* Safe Zone Overlays */}
                {showSafeZones && (
                  <>
                    {/* Top safe zone (profile/username area on TikTok/Reels) */}
                    <div className="absolute top-0 left-0 right-0 h-[12%] border-b border-dashed border-yellow-500/40 bg-yellow-500/5">
                      <span className="absolute top-0.5 left-1 text-[7px] text-yellow-600/60">Profile Area</span>
                    </div>
                    {/* Bottom safe zone (caption/interaction area) */}
                    <div className="absolute bottom-0 left-0 right-0 h-[18%] border-t border-dashed border-yellow-500/40 bg-yellow-500/5">
                      <span className="absolute bottom-0.5 left-1 text-[7px] text-yellow-600/60">Caption Zone</span>
                    </div>
                    {/* Right side safe zone (like/comment/share buttons) */}
                    <div className="absolute top-[20%] bottom-[20%] right-0 w-[12%] border-l border-dashed border-yellow-500/40 bg-yellow-500/5">
                      <span className="absolute top-0.5 right-0.5 text-[7px] text-yellow-600/60 writing-mode-vertical" style={{ writingMode: 'vertical-rl' }}>Buttons</span>
                    </div>
                  </>
                )}

                {/* Text Overlays Preview */}
                {textOverlays
                  .filter(t => currentTime >= t.startTime && currentTime < t.startTime + t.duration)
                  .map(t => (
                    <div key={t.id} className={cn("absolute left-0 right-0 px-2 py-1 text-center",
                      t.position === 'top' && 'top-2', t.position === 'center' && 'top-1/2 -translate-y-1/2',
                      t.position === 'bottom' && 'bottom-2', t.position === 'safe-top' && 'top-[14%]',
                      t.position === 'safe-bottom' && 'bottom-[20%]',
                    )} style={{ fontSize: t.fontSize * 0.35, fontWeight: t.fontWeight, color: t.color, backgroundColor: t.backgroundColor }}>
                      {t.text}
                    </div>
                  ))}

                {/* Product Overlays Preview */}
                {productOverlays
                  .filter(p => currentTime >= p.startTime && currentTime < p.startTime + p.duration)
                  .map(p => (
                    <div key={p.id} className={cn("absolute",
                      p.position === 'center' && 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
                      p.position === 'bottom-right' && 'bottom-4 right-4',
                      p.position === 'bottom-left' && 'bottom-4 left-4',
                      p.position === 'top-right' && 'top-4 right-4',
                      p.position === 'top-left' && 'top-4 left-4',
                    )} style={{ width: `${p.scale * 100}%` }}>
                      {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full rounded" />}
                    </div>
                  ))}

                {/* Scene badges */}
                <div className="absolute top-1 left-1 flex gap-1">
                  <Badge variant="secondary" className="text-[8px] h-3.5 px-1">S{currentScene?.sceneNumber || 1}</Badge>
                  {currentScene?.isIntro && <Badge className="text-[8px] h-3.5 px-1 bg-chart-1">Hook</Badge>}
                  {currentScene?.isOutro && <Badge className="text-[8px] h-3.5 px-1 bg-chart-2">CTA</Badge>}
                </div>
                <Badge variant="secondary" className="absolute bottom-1 right-1 text-[8px] h-3.5 px-1 font-mono">{formatTime(currentTime)}</Badge>
              </div>
            </div>

            {/* ─── Transport Controls ──────────────────────── */}
            <div className="flex items-center justify-center gap-3 px-4 py-2 border-b bg-card/60 backdrop-blur-sm">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={skipBackward}><SkipBack className="w-4 h-4" /></Button>
              <Button variant={isPlaying ? 'secondary' : 'default'} size="icon" className="h-10 w-10 rounded-full shadow-md" onClick={togglePlayback}>
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={skipForward}><SkipForward className="w-4 h-4" /></Button>
              <Separator orientation="vertical" className="h-6" />
              <span className="text-xs font-mono text-muted-foreground w-24 text-center">{formatTime(currentTime)} / {formatTime(totalDuration)}</span>
              <Separator orientation="vertical" className="h-6" />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMuted(!isMuted)}>
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </Button>
              <div className="w-20"><Slider value={[isMuted ? 0 : playbackVolume * 100]} onValueChange={([v]) => { setPlaybackVolume(v / 100); if (v > 0) setIsMuted(false); }} max={100} step={1} /></div>
            </div>

            {/* ─── Timeline Panel ────────────────────────────── */}
            <div className="flex-1 overflow-hidden flex flex-col border-t">
              <div className="flex flex-1 overflow-hidden">
                {/* Track Labels */}
                <div className="w-32 flex-shrink-0 border-r bg-card overflow-y-auto">
                  {[
                    { key: 'scenes', icon: Film, label: 'Scenes', color: 'text-primary' },
                    { key: 'broll', icon: Layers, label: 'B-Roll', color: 'text-accent-foreground' },
                    { key: 'text', icon: Type, label: 'Text', color: 'text-primary' },
                    { key: 'products', icon: Package, label: 'Products', color: 'text-secondary-foreground' },
                    { key: 'voiceover', icon: Mic, label: 'Voiceover', color: 'text-primary' },
                    { key: 'music', icon: Music, label: 'Music', color: 'text-primary' },
                    { key: 'sfx', icon: SlidersHorizontal, label: 'SFX', color: 'text-muted-foreground' },
                  ].map(track => (
                    <div key={track.key} className={cn(
                      "flex items-center gap-1.5 px-2 py-2 border-b text-[11px] cursor-pointer transition-colors",
                      selectedTrack === track.key ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-accent/50'
                    )} onClick={() => setSelectedTrack(track.key)}>
                      <Button variant="ghost" size="icon" className="h-4 w-4 p-0" onClick={(e) => {
                        e.stopPropagation();
                        setTrackVisibility(prev => ({ ...prev, [track.key]: !prev[track.key as keyof typeof prev] }));
                      }}>
                        {trackVisibility[track.key as keyof typeof trackVisibility] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground" />}
                      </Button>
                      <track.icon className={cn("w-3 h-3", track.color)} />
                      <span className="truncate">{track.label}</span>
                    </div>
                  ))}
                </div>

                {/* Timeline Tracks */}
                <ScrollArea className="flex-1">
                  <div className="relative" style={{ width: timelineWidth, minHeight: '100%' }}>
                    {/* Time Ruler */}
                    <div className="h-5 border-b bg-muted/30 relative sticky top-0 z-10"
                      onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); seekTo((e.clientX - rect.left) / (PIXELS_PER_SECOND * zoom)); }}
                    >
                      {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                        <div key={i} className="absolute top-0 flex flex-col items-center" style={{ left: i * PIXELS_PER_SECOND * zoom }}>
                          <div className="w-px h-2.5 bg-border" />
                          <span className="text-[8px] text-muted-foreground font-mono">{formatTime(i)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Playhead */}
                    <div className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none" style={{ left: currentTime * PIXELS_PER_SECOND * zoom }}>
                      <div className="w-2.5 h-2.5 bg-primary rounded-full -ml-[4px] -mt-0.5" />
                    </div>

                    {/* Track 1: Scenes */}
                    {trackVisibility.scenes && (
                      <div className="h-12 border-b relative"
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleTimelineDrop(e, 'scenes')}
                      >
                        {scenes.map((scene, index) => {
                          const eff = scene.duration - (scene.trimStart || 0) - (scene.trimEnd || 0);
                          const width = eff * PIXELS_PER_SECOND * zoom;
                          const left = scene.startTime * PIXELS_PER_SECOND * zoom;
                          const transition = transitions.find(t => t.afterSceneIndex === index);
                          return (
                            <React.Fragment key={`scene-${index}`}>
                              <div
                                className={cn(
                                  "absolute top-1 bottom-1 rounded border-2 overflow-hidden cursor-pointer group transition-all",
                                  selectedItemId === `scene-${index}` ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-primary/50',
                                  scene.locked && 'opacity-60',
                                  draggedScene === index && 'opacity-40',
                                  scene.isIntro && 'border-l-4 border-l-chart-1',
                                  scene.isOutro && 'border-r-4 border-r-chart-2',
                                )}
                                style={{ left, width: Math.max(width, 24) }}
                                onClick={() => { setSelectedItemId(`scene-${index}`); setAssetTab('scenes'); seekTo(scene.startTime); }}
                                draggable={!scene.locked}
                                onDragStart={() => setDraggedScene(index)}
                                onDragEnd={() => setDraggedScene(null)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.stopPropagation(); if (draggedScene !== null && draggedScene !== index) moveScene(draggedScene, index); setDraggedScene(null); }}
                              >
                                <div className="absolute inset-0 flex">
                                  {scene.imageUrl && <img src={scene.imageUrl} alt="" className="h-full w-10 object-cover flex-shrink-0" />}
                                  <div className="flex-1 px-1 py-0.5 min-w-0">
                                    <div className="flex items-center gap-0.5">
                                      <span className="text-[9px] font-medium">S{scene.sceneNumber}</span>
                                      {scene.isIntro && <Zap className="w-2 h-2 text-chart-1" />}
                                      {scene.isOutro && <Target className="w-2 h-2 text-chart-2" />}
                                    </div>
                                    <p className="text-[8px] text-muted-foreground">{eff.toFixed(1)}s</p>
                                  </div>
                                </div>

                                {/* Hover actions */}
                                <div className="absolute top-0 right-0 hidden group-hover:flex gap-0.5 bg-background/80 rounded-bl px-0.5">
                                  <button className="p-0.5" onClick={e => { e.stopPropagation(); toggleLockScene(index); }}>
                                    {scene.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                                  </button>
                                  <button className="p-0.5" onClick={e => { e.stopPropagation(); duplicateScene(index); }}><Copy className="w-2.5 h-2.5" /></button>
                                  <button className="p-0.5 text-destructive" onClick={e => { e.stopPropagation(); deleteScene(index); }}><Trash2 className="w-2.5 h-2.5" /></button>
                                </div>

                                {/* Drag handle */}
                                {!scene.locked && <div className="absolute left-0 top-0 bottom-0 w-1.5 flex items-center cursor-grab"><GripVertical className="w-2 h-2 text-muted-foreground" /></div>}

                                {/* Resize handles */}
                                <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/30"
                                  onMouseDown={e => handleResizeStart(e, `scene-${index}`, 'right', scene.duration, scene.startTime)} />
                              </div>

                              {/* Transition marker between scenes */}
                              {index < scenes.length - 1 && (
                                <div
                                  className={cn("absolute top-1.5 bottom-1.5 w-5 flex items-center justify-center cursor-pointer z-10 rounded",
                                    transition ? 'bg-primary/20' : 'hover:bg-accent/50'
                                  )}
                                  style={{ left: left + width - 2 }}
                                  onClick={e => { e.stopPropagation(); transition ? (setEditingTransitionIndex(index), setTransitionDialogOpen(true)) : addTransition(index); }}
                                  title={transition ? `${transition.type} (${transition.duration}s)` : 'Add transition'}
                                >
                                  <ArrowLeftRight className={cn("w-2.5 h-2.5", transition ? 'text-primary' : 'text-muted-foreground/40')} />
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}

                    {/* Track 2: B-Roll */}
                    {trackVisibility.broll && (
                      <div className="h-9 border-b relative bg-accent/5"
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => handleTimelineDrop(e, 'broll')}
                      >
                        {bRollClips.map(clip => (
                          <div key={clip.id}
                            className={cn("absolute top-0.5 bottom-0.5 rounded bg-accent/30 border border-accent/50 px-1 flex items-center text-[8px] cursor-pointer group",
                              selectedItemId === clip.id && 'border-primary ring-1 ring-primary/30'
                            )}
                            style={{ left: clip.startTime * PIXELS_PER_SECOND * zoom, width: clip.duration * PIXELS_PER_SECOND * zoom }}
                            onClick={() => { setSelectedItemId(clip.id); seekTo(clip.startTime); }}
                          >
                            <ImageIcon className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
                            <span className="truncate">{clip.name}</span>
                            {/* Resize handles */}
                            <div className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/30" onMouseDown={e => handleResizeStart(e, clip.id, 'left', clip.duration, clip.startTime)} />
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/30" onMouseDown={e => handleResizeStart(e, clip.id, 'right', clip.duration, clip.startTime)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Track 3: Text */}
                    {trackVisibility.text && (
                      <div className="h-9 border-b relative bg-primary/5">
                        {textOverlays.map(ov => (
                          <div key={ov.id}
                            className={cn("absolute top-0.5 bottom-0.5 rounded bg-primary/20 border border-primary/30 px-1 flex items-center text-[8px] cursor-pointer group",
                              selectedItemId === ov.id && 'border-primary ring-1 ring-primary/30'
                            )}
                            style={{ left: ov.startTime * PIXELS_PER_SECOND * zoom, width: ov.duration * PIXELS_PER_SECOND * zoom }}
                            onClick={() => { setSelectedItemId(ov.id); setEditingText(ov); setTextDialogOpen(true); }}
                          >
                            <Type className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
                            <span className="truncate">{ov.text}</span>
                            <div className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/30" onMouseDown={e => handleResizeStart(e, ov.id, 'left', ov.duration, ov.startTime)} />
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/30" onMouseDown={e => handleResizeStart(e, ov.id, 'right', ov.duration, ov.startTime)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Track 4: Products */}
                    {trackVisibility.products && (
                      <div className="h-9 border-b relative bg-secondary/5">
                        {productOverlays.map(ov => (
                          <div key={ov.id}
                            className={cn("absolute top-0.5 bottom-0.5 rounded bg-secondary/20 border border-secondary/30 px-1 flex items-center text-[8px] cursor-pointer",
                              selectedItemId === ov.id && 'border-primary ring-1 ring-primary/30'
                            )}
                            style={{ left: ov.startTime * PIXELS_PER_SECOND * zoom, width: ov.duration * PIXELS_PER_SECOND * zoom }}
                            onClick={() => { setSelectedItemId(ov.id); setEditingProduct(ov); setProductDialogOpen(true); }}
                          >
                            <Package className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
                            <span className="truncate">{ov.name || 'Product'}</span>
                            <div className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/30" onMouseDown={e => handleResizeStart(e, ov.id, 'left', ov.duration, ov.startTime)} />
                            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/30" onMouseDown={e => handleResizeStart(e, ov.id, 'right', ov.duration, ov.startTime)} />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Track 5: Voiceover */}
                    {trackVisibility.voiceover && (
                      <div className="h-9 border-b relative bg-chart-1/5">
                        {audioTracks.filter(a => a.type === 'voiceover').map(track => (
                          <div key={track.id}
                            className={cn("absolute top-0.5 bottom-0.5 rounded border px-1 flex items-center text-[8px] cursor-pointer",
                              track.muted ? 'bg-muted/30 border-muted' : 'bg-chart-1/20 border-chart-1/30',
                              selectedItemId === track.id && 'border-primary ring-1 ring-primary/30'
                            )}
                            style={{ left: track.startTime * PIXELS_PER_SECOND * zoom, width: Math.max(track.duration * PIXELS_PER_SECOND * zoom, 20) }}
                            onClick={() => { setSelectedItemId(track.id); setAssetTab('audio'); }}
                          >
                            <Mic className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
                            <span className="truncate">{track.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Track 6: Music */}
                    {trackVisibility.music && (
                      <div className="h-9 border-b relative bg-chart-2/5">
                        {audioTracks.filter(a => a.type === 'music').map(track => (
                          <div key={track.id}
                            className={cn("absolute top-0.5 bottom-0.5 rounded border px-1 flex items-center text-[8px] cursor-pointer",
                              track.muted ? 'bg-muted/30 border-muted' : 'bg-chart-2/20 border-chart-2/30',
                              selectedItemId === track.id && 'border-primary ring-1 ring-primary/30'
                            )}
                            style={{ left: track.startTime * PIXELS_PER_SECOND * zoom, width: Math.max(track.duration * PIXELS_PER_SECOND * zoom, 20) }}
                            onClick={() => { setSelectedItemId(track.id); setAssetTab('audio'); }}
                          >
                            <Music className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
                            <span className="truncate">{track.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Track 7: SFX */}
                    {trackVisibility.sfx && (
                      <div className="h-9 border-b relative bg-chart-3/5">
                        {audioTracks.filter(a => a.type === 'sfx').map(track => (
                          <div key={track.id}
                            className={cn("absolute top-0.5 bottom-0.5 rounded border px-1 flex items-center text-[8px] cursor-pointer bg-chart-3/20 border-chart-3/30",
                              selectedItemId === track.id && 'border-primary ring-1 ring-primary/30'
                            )}
                            style={{ left: track.startTime * PIXELS_PER_SECOND * zoom, width: Math.max(track.duration * PIXELS_PER_SECOND * zoom, 20) }}
                            onClick={() => { setSelectedItemId(track.id); setAssetTab('audio'); }}
                          >
                            <SlidersHorizontal className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
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

          {/* ─── Properties / Asset Sidebar ────────────────────── */}
          {showAssetPanel && (
            <div className="w-72 border-l flex flex-col bg-card overflow-hidden">
              <Tabs value={assetTab} onValueChange={setAssetTab} className="flex flex-col flex-1">
                <TabsList className="w-full grid grid-cols-5 mx-0 rounded-none border-b h-8">
                  <TabsTrigger value="scenes" className="text-[10px] px-1 h-7">Scene</TabsTrigger>
                  <TabsTrigger value="broll" className="text-[10px] px-1 h-7">B-Roll</TabsTrigger>
                  <TabsTrigger value="text" className="text-[10px] px-1 h-7">Text</TabsTrigger>
                  <TabsTrigger value="product" className="text-[10px] px-1 h-7">Product</TabsTrigger>
                  <TabsTrigger value="audio" className="text-[10px] px-1 h-7">Audio</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1">
                  {/* ─── Scene Properties Tab ─────────────────── */}
                  <TabsContent value="scenes" className="p-3 space-y-3 mt-0">
                    {selectedSceneData ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold flex items-center gap-1">
                            <Film className="w-3 h-3" /> Scene {selectedSceneData.sceneNumber}
                            {selectedSceneData.isIntro && <Badge className="text-[8px] h-3.5 px-1 bg-chart-1 ml-1">Hook</Badge>}
                            {selectedSceneData.isOutro && <Badge className="text-[8px] h-3.5 px-1 bg-chart-2 ml-1">CTA</Badge>}
                          </h4>
                          {selectedSceneData.locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                        </div>

                        {/* Thumbnail */}
                        {selectedSceneData.imageUrl && (
                          <div className="rounded-md overflow-hidden border aspect-video">
                            <img src={selectedSceneData.imageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}

                        {/* Duration */}
                        <div>
                          <Label className="text-[10px]">Duration ({selectedSceneData.duration.toFixed(1)}s)</Label>
                          <Slider value={[selectedSceneData.duration]} onValueChange={([v]) => adjustDuration(selectedSceneIndex!, v)} min={2} max={30} step={0.5} />
                        </div>

                        {/* Trim */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Trim Start</Label>
                            <Input type="number" step={0.5} min={0} max={selectedSceneData.duration - 1} value={selectedSceneData.trimStart || 0}
                              onChange={e => trimScene(selectedSceneIndex!, Number(e.target.value), selectedSceneData.trimEnd || 0)} className="h-7 text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px]">Trim End</Label>
                            <Input type="number" step={0.5} min={0} max={selectedSceneData.duration - 1} value={selectedSceneData.trimEnd || 0}
                              onChange={e => trimScene(selectedSceneIndex!, selectedSceneData.trimStart || 0, Number(e.target.value))} className="h-7 text-xs" />
                          </div>
                        </div>

                        <Separator />

                        {/* Camera & Expression */}
                        <div>
                          <Label className="text-[10px]">Camera Direction</Label>
                          <Select value={selectedSceneData.cameraDirection || ''} onValueChange={v => updateSceneProperty(selectedSceneIndex!, { cameraDirection: v })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Choose..." /></SelectTrigger>
                            <SelectContent>{CAMERA_DIRECTIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[10px]">Facial Expression</Label>
                          <Select value={selectedSceneData.expression || ''} onValueChange={v => updateSceneProperty(selectedSceneIndex!, { expression: v })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Choose..." /></SelectTrigger>
                            <SelectContent>{EXPRESSIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[10px]">Movement</Label>
                          <Select value={selectedSceneData.movement || ''} onValueChange={v => updateSceneProperty(selectedSceneIndex!, { movement: v })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Choose..." /></SelectTrigger>
                            <SelectContent>{MOVEMENTS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>

                        <Separator />

                        {/* Transition In/Out */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Transition In</Label>
                            <Select value={selectedSceneData.transitionIn || 'cut'} onValueChange={v => updateSceneProperty(selectedSceneIndex!, { transitionIn: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{TRANSITION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Transition Out</Label>
                            <Select value={selectedSceneData.transitionOut || 'cut'} onValueChange={v => updateSceneProperty(selectedSceneIndex!, { transitionOut: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>{TRANSITION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Separator />

                        {/* Narration */}
                        <div>
                          <Label className="text-[10px]">Narration</Label>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-3">{selectedSceneData.narration}</p>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {onRegenerateScene && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onRegenerateScene(selectedSceneData.sceneNumber)}>
                              <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
                            </Button>
                          )}
                          {onReplaceScene && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onReplaceScene(selectedSceneData.sceneNumber)}>
                              <RotateCcw className="w-3 h-3 mr-1" /> Replace
                            </Button>
                          )}
                          {onRegenerateVoice && (
                            <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => onRegenerateVoice(selectedSceneData.sceneNumber)}>
                              <Mic className="w-3 h-3 mr-1" /> Re-Voice
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => duplicateScene(selectedSceneIndex!)}>
                            <Copy className="w-3 h-3 mr-1" /> Duplicate
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">Click a scene on the timeline</p>
                        <p className="text-[10px]">to view and edit its properties</p>

                        {/* Quick reel actions */}
                        <div className="mt-4 space-y-1.5">
                          <p className="text-[10px] font-medium text-foreground">Quick Actions</p>
                          <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={addHookText}>
                            <Zap className="w-3 h-3 mr-1" /> Add Hook Text
                          </Button>
                          <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={addCTAText}>
                            <Target className="w-3 h-3 mr-1" /> Add CTA Ending
                          </Button>
                          <Button variant="outline" size="sm" className="w-full h-7 text-[10px]" onClick={addAutoBRoll}>
                            <Sparkles className="w-3 h-3 mr-1" /> Auto B-Roll Markers
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* ─── B-Roll Tab ─────────────────────────────── */}
                  <TabsContent value="broll" className="p-3 space-y-3 mt-0">
                    <Button className="w-full" size="sm" variant="outline" onClick={() => toast({ title: 'Upload B-Roll', description: 'Drag a video or image onto the B-Roll track' })}>
                      <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload B-Roll
                    </Button>
                    <Button className="w-full" size="sm" variant="outline" onClick={addAutoBRoll}>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Auto-Insert Every 4s
                    </Button>

                    {bRollClips.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Layers className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No B-roll clips yet</p>
                        <p className="text-[10px]">Upload videos or images to overlay</p>
                      </div>
                    ) : bRollClips.map(clip => (
                      <div key={clip.id} className="p-2 border rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate">{clip.name}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { pushUndo(); setBRollClips(prev => prev.filter(c => c.id !== clip.id)); }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><Label className="text-[10px]">Start</Label><Input type="number" step={0.1} value={clip.startTime} onChange={e => { pushUndo(); setBRollClips(prev => prev.map(c => c.id === clip.id ? { ...c, startTime: Number(e.target.value) } : c)); }} className="h-7 text-xs" /></div>
                          <div><Label className="text-[10px]">Duration</Label><Input type="number" step={0.5} min={0.5} value={clip.duration} onChange={e => { pushUndo(); setBRollClips(prev => prev.map(c => c.id === clip.id ? { ...c, duration: Number(e.target.value) } : c)); }} className="h-7 text-xs" /></div>
                        </div>
                        <div>
                          <Label className="text-[10px]">Position</Label>
                          <Select value={clip.position} onValueChange={v => { pushUndo(); setBRollClips(prev => prev.map(c => c.id === clip.id ? { ...c, position: v as BRollClip['position'] } : c)); }}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{PIP_POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* ─── Text Tab ──────────────────────────────── */}
                  <TabsContent value="text" className="p-3 space-y-3 mt-0">
                    <Button className="w-full" size="sm" onClick={() => addTextOverlay()}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Text Overlay
                    </Button>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={addHookText}><Zap className="w-3 h-3 mr-0.5" /> Hook</Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={addCTAText}><Target className="w-3 h-3 mr-0.5" /> CTA</Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => addTextOverlay({ text: 'Caption text', position: 'safe-bottom', fontSize: 20, fontWeight: 'normal', animation: 'typewriter' })}>
                        <Type className="w-3 h-3 mr-0.5" /> Caption
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => addTextOverlay({ text: 'HEADLINE', position: 'safe-top', fontSize: 36, fontWeight: 'bold', animation: 'pop' })}>
                        <Type className="w-3 h-3 mr-0.5" /> Headline
                      </Button>
                    </div>

                    {textOverlays.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No text overlays yet</p>
                      </div>
                    ) : textOverlays.map(t => (
                      <div key={t.id} className="p-2 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium truncate max-w-[160px]">"{t.text}"</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingText(t); setTextDialogOpen(true); }}><Wand2 className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteTextOverlay(t.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{formatTime(t.startTime)} → {formatTime(t.startTime + t.duration)} · {t.position}</p>
                      </div>
                    ))}
                  </TabsContent>

                  {/* ─── Product Tab ───────────────────────────── */}
                  <TabsContent value="product" className="p-3 space-y-3 mt-0">
                    <Button className="w-full" size="sm" onClick={addProductOverlay}>
                      <Package className="w-3.5 h-3.5 mr-1.5" /> Add Product
                    </Button>

                    {productOverlays.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-xs">No product placements yet</p>
                        <p className="text-[10px]">Upload products to place in scenes</p>
                      </div>
                    ) : productOverlays.map(p => (
                      <div key={p.id} className="p-2 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium">{p.name || 'Product'}</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingProduct(p); setProductDialogOpen(true); }}><Wand2 className="w-3 h-3" /></Button>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{formatTime(p.startTime)} → {formatTime(p.startTime + p.duration)}</p>
                        {p.instructions && <p className="text-[10px] text-muted-foreground italic truncate">"{p.instructions}"</p>}
                      </div>
                    ))}
                  </TabsContent>

                  {/* ─── Audio Tab ─────────────────────────────── */}
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
                          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => updateAudioTrack(track.id, { muted: !track.muted })}>
                            {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                          </Button>
                        </div>
                        <div><Label className="text-[10px]">Volume</Label><Slider value={[track.volume * 100]} onValueChange={([v]) => updateAudioTrack(track.id, { volume: v / 100 })} max={100} step={1} /></div>
                        {track.type === 'music' && (
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-[10px]">Fade In (s)</Label><Input type="number" step={0.5} min={0} value={track.fadeIn} onChange={e => updateAudioTrack(track.id, { fadeIn: Number(e.target.value) })} className="h-7 text-xs" /></div>
                            <div><Label className="text-[10px]">Fade Out (s)</Label><Input type="number" step={0.5} min={0} value={track.fadeOut} onChange={e => updateAudioTrack(track.id, { fadeOut: Number(e.target.value) })} className="h-7 text-xs" /></div>
                          </div>
                        )}
                        {track.type === 'voiceover' && (
                          <div className="flex gap-1">
                            {onPreviewVoice && <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => onPreviewVoice(parseInt(track.id.replace('vo-', '')))}><Play className="w-3 h-3 mr-1" /> Preview</Button>}
                            {onRegenerateVoice && <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1" onClick={() => onRegenerateVoice(parseInt(track.id.replace('vo-', '')))}><Mic className="w-3 h-3 mr-1" /> Regen</Button>}
                          </div>
                        )}
                      </div>
                    ))}
                    {audioTracks.length === 0 && (
                      <div className="text-center py-6 text-muted-foreground"><Volume2 className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-xs">No audio tracks</p></div>
                    )}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </div>
          )}
        </div>

        {/* ─── Dialogs ─────────────────────────────────────────── */}
        <Dialog open={transitionDialogOpen} onOpenChange={setTransitionDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Add Transition</DialogTitle><DialogDescription>Choose a transition effect</DialogDescription></DialogHeader>
            <TransitionPicker
              currentType={transitions.find(t => t.afterSceneIndex === editingTransitionIndex)?.type || 'fade'}
              currentDuration={transitions.find(t => t.afterSceneIndex === editingTransitionIndex)?.duration || 0.5}
              onSave={saveTransition}
              onRemove={() => { if (editingTransitionIndex !== null) removeTransition(editingTransitionIndex); setTransitionDialogOpen(false); }}
            />
          </DialogContent>
        </Dialog>

        <Dialog open={textDialogOpen} onOpenChange={setTextDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Text Overlay</DialogTitle><DialogDescription>Configure text appearance and timing</DialogDescription></DialogHeader>
            {editingText && <TextOverlayEditor overlay={editingText} onSave={saveTextOverlay} onDelete={() => { deleteTextOverlay(editingText.id); setTextDialogOpen(false); }} totalDuration={totalDuration} />}
          </DialogContent>
        </Dialog>

        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Product Placement</DialogTitle><DialogDescription>Position your product in the scene</DialogDescription></DialogHeader>
            {editingProduct && <ProductOverlayEditor overlay={editingProduct} onSave={saveProductOverlay} totalDuration={totalDuration} />}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

// ─── Sub-components ──────────────────────────────────────────────────

const TransitionPicker: React.FC<{
  currentType: string; currentDuration: number;
  onSave: (type: string, duration: number) => void; onRemove: () => void;
}> = ({ currentType, currentDuration, onSave, onRemove }) => {
  const [type, setType] = useState(currentType);
  const [duration, setDuration] = useState(currentDuration);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        {TRANSITION_TYPES.map(t => (
          <Button key={t.value} variant={type === t.value ? 'default' : 'outline'} size="sm" className="flex flex-col h-14 text-[10px]" onClick={() => setType(t.value)}>
            <span className="text-lg">{t.icon}</span>{t.label}
          </Button>
        ))}
      </div>
      <div>
        <Label className="text-xs">Duration ({duration}s)</Label>
        <Slider value={[duration * 10]} onValueChange={([v]) => setDuration(v / 10)} min={1} max={20} step={1} />
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onSave(type, duration)}>Apply</Button>
        <Button variant="destructive" size="sm" onClick={onRemove}>Remove</Button>
      </div>
    </div>
  );
};

const TextOverlayEditor: React.FC<{
  overlay: TextOverlay; onSave: (o: TextOverlay) => void; onDelete: () => void; totalDuration: number;
}> = ({ overlay, onSave, onDelete, totalDuration }) => {
  const [local, setLocal] = useState(overlay);
  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Text</Label><Textarea value={local.text} onChange={e => setLocal(p => ({ ...p, text: e.target.value }))} className="h-20" /></div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Start (s)</Label><Input type="number" step={0.5} min={0} max={totalDuration} value={local.startTime} onChange={e => setLocal(p => ({ ...p, startTime: Number(e.target.value) }))} className="h-8" /></div>
        <div><Label className="text-xs">Duration (s)</Label><Input type="number" step={0.5} min={0.5} value={local.duration} onChange={e => setLocal(p => ({ ...p, duration: Number(e.target.value) }))} className="h-8" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Position</Label>
          <Select value={local.position} onValueChange={v => setLocal(p => ({ ...p, position: v as TextOverlay['position'] }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="top">Top</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="safe-top">Safe Top (below profile)</SelectItem>
              <SelectItem value="safe-bottom">Safe Bottom (above captions)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Animation</Label>
          <Select value={local.animation} onValueChange={v => setLocal(p => ({ ...p, animation: v as TextOverlay['animation'] }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{TEXT_ANIMATIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Size</Label><Input type="number" min={12} max={72} value={local.fontSize} onChange={e => setLocal(p => ({ ...p, fontSize: Number(e.target.value) }))} className="h-8" /></div>
        <div>
          <Label className="text-xs">Weight</Label>
          <Select value={local.fontWeight} onValueChange={v => setLocal(p => ({ ...p, fontWeight: v as TextOverlay['fontWeight'] }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="normal">Normal</SelectItem><SelectItem value="bold">Bold</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Color</Label><Input type="color" value={local.color} onChange={e => setLocal(p => ({ ...p, color: e.target.value }))} className="h-8 p-1" /></div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => onSave(local)}>Save</Button>
        <Button variant="destructive" size="sm" onClick={onDelete}>Delete</Button>
      </div>
    </div>
  );
};

const ProductOverlayEditor: React.FC<{
  overlay: ProductOverlay; onSave: (o: ProductOverlay) => void; totalDuration: number;
}> = ({ overlay, onSave, totalDuration }) => {
  const [local, setLocal] = useState(overlay);
  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Product Image URL</Label><Input value={local.imageUrl} onChange={e => setLocal(p => ({ ...p, imageUrl: e.target.value }))} placeholder="Paste product image URL" className="h-8" /></div>
      <div><Label className="text-xs">Product Name</Label><Input value={local.name} onChange={e => setLocal(p => ({ ...p, name: e.target.value }))} placeholder="e.g. SuperDrink Energy" className="h-8" /></div>
      <div>
        <Label className="text-xs">Placement Instructions</Label>
        <Textarea value={local.instructions} onChange={e => setLocal(p => ({ ...p, instructions: e.target.value }))} placeholder="e.g. Person holding this product" className="h-16" />
        <div className="flex flex-wrap gap-1 mt-1">
          {['Holding in hand', 'On the table', 'Beside the actor', 'Close-up shot'].map(preset => (
            <Button key={preset} variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => setLocal(p => ({ ...p, instructions: preset }))}>{preset}</Button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Start (s)</Label><Input type="number" step={0.5} min={0} max={totalDuration} value={local.startTime} onChange={e => setLocal(p => ({ ...p, startTime: Number(e.target.value) }))} className="h-8" /></div>
        <div><Label className="text-xs">Duration (s)</Label><Input type="number" step={0.5} min={0.5} value={local.duration} onChange={e => setLocal(p => ({ ...p, duration: Number(e.target.value) }))} className="h-8" /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Position</Label>
          <Select value={local.position} onValueChange={v => setLocal(p => ({ ...p, position: v as ProductOverlay['position'] }))}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Center</SelectItem><SelectItem value="bottom-right">Bottom Right</SelectItem>
              <SelectItem value="bottom-left">Bottom Left</SelectItem><SelectItem value="top-right">Top Right</SelectItem>
              <SelectItem value="top-left">Top Left</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Scale ({Math.round(local.scale * 100)}%)</Label>
          <Slider value={[local.scale * 100]} onValueChange={([v]) => setLocal(p => ({ ...p, scale: v / 100 }))} min={10} max={100} step={5} />
        </div>
      </div>
      <Button className="w-full" onClick={() => onSave(local)}>Save Product Placement</Button>
    </div>
  );
};
