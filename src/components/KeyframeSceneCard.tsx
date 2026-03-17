import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { 
  Film, Copy, Trash2, ChevronDown, ChevronRight, Image, Play, 
  ArrowRight, Link, Camera, Lightbulb, Music, User, Wand2, 
  Loader2, Video, Volume2, Expand, X, MessageSquare, Settings2, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface KeyframeData {
  imagePrompt: string;
  generatedImage?: string;
  position: string;
  cameraAngle: string;
}

export interface MovieSceneWithKeyframes {
  sceneNumber: number;
  title: string;
  location: string;
  timeOfDay: string;
  description: string;
  dialogue: string | null;
  otherCharacterDialogue?: string | null;
  startFrame: KeyframeData;
  endFrame: KeyframeData;
  transitionAction: string;
  transitionCameraMovement: string;
  imagePrompt: string;
  generatedImage?: string;
  generatedVideo?: string;
  videoTaskId?: string;
  selectedCameraAngle?: string;
  selectedLighting?: string;
  mood?: string;
  suggestedMusic?: string;
  transitionAudioContent?: string; // Base64 audio to sync with silent video
}

export const CAMERA_MOVEMENTS = [
  { id: 'static', name: 'Static', description: 'Camera stays in place' },
  { id: 'tracking', name: 'Tracking', description: 'Camera follows the subject horizontally' },
  { id: 'push-in', name: 'Push In', description: 'Camera moves toward the subject (dolly in)' },
  { id: 'pull-out', name: 'Pull Out', description: 'Camera moves away from the subject (dolly out)' },
  { id: 'pan', name: 'Pan', description: 'Camera rotates horizontally on axis' },
  { id: 'tilt', name: 'Tilt', description: 'Camera rotates vertically on axis' },
  { id: 'crane-up', name: 'Crane Up', description: 'Camera rises vertically' },
  { id: 'crane-down', name: 'Crane Down', description: 'Camera lowers vertically' },
  { id: 'orbit', name: 'Orbit', description: 'Camera circles around the subject' },
  { id: 'handheld', name: 'Handheld', description: 'Natural shaky movement' },
  { id: 'steadicam', name: 'Steadicam', description: 'Smooth gliding movement' },
  { id: 'zoom-in', name: 'Zoom In', description: 'Lens zooms toward subject' },
  { id: 'zoom-out', name: 'Zoom Out', description: 'Lens zooms away from subject' },
];

export const CAMERA_ANGLES_SIMPLE = [
  { id: 'eye-level', name: 'Eye Level', description: 'Standard neutral perspective' },
  { id: 'low-angle', name: 'Low Angle', description: 'Camera looks up, subject appears powerful' },
  { id: 'high-angle', name: 'High Angle', description: 'Camera looks down, subject appears vulnerable' },
  { id: 'birds-eye', name: "Bird's Eye", description: 'Directly overhead, dramatic perspective' },
  { id: 'dutch-angle', name: 'Dutch Angle', description: 'Tilted camera, creates tension' },
  { id: 'close-up', name: 'Close-Up', description: 'Tight shot on subject' },
  { id: 'wide-shot', name: 'Wide Shot', description: 'Full scene establishing shot' },
  { id: 'medium-shot', name: 'Medium Shot', description: 'Waist-up framing' },
  { id: 'over-shoulder', name: 'Over-the-Shoulder', description: 'View from behind character' },
  { id: 'pov', name: 'POV Shot', description: "Character's point of view" },
];

export const LIGHTING_STYLES_SIMPLE = [
  { id: 'natural', name: 'Natural Light', description: 'Soft, realistic daylight' },
  { id: 'golden-hour', name: 'Golden Hour', description: 'Warm sunset/sunrise glow' },
  { id: 'blue-hour', name: 'Blue Hour', description: 'Cool twilight atmosphere' },
  { id: 'noir', name: 'Film Noir', description: 'High contrast, dramatic shadows' },
  { id: 'moonlight', name: 'Moonlight', description: 'Cool, ethereal night lighting' },
  { id: 'neon', name: 'Neon/Cyberpunk', description: 'Vibrant colored lights' },
  { id: 'candlelight', name: 'Candlelight', description: 'Warm, flickering ambiance' },
  { id: 'silhouette', name: 'Silhouette', description: 'Dark figure against bright background' },
];

const MOOD_ICONS: Record<string, string> = {
  tense: '😰',
  romantic: '💕',
  action: '💥',
  melancholic: '😢',
  triumphant: '🏆',
  mysterious: '🔮',
  peaceful: '🕊️',
  horror: '👻',
  comedic: '😄',
  epic: '⚔️',
  nostalgic: '📷',
  inspiring: '✨',
};

interface KeyframeSceneCardProps {
  scene: MovieSceneWithKeyframes;
  sceneIndex: number;
  totalScenes: number;
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  isDescribingScene?: boolean;
  characterName?: string;
  secondCharacterName?: string;
  onUpdateScene: (sceneNumber: number, updates: Partial<MovieSceneWithKeyframes>) => void;
  onUpdateKeyframe: (sceneNumber: number, frame: 'start' | 'end', updates: Partial<KeyframeData>) => void;
  onGenerateStartImage: (sceneNumber: number) => void;
  onGenerateEndImage: (sceneNumber: number) => void;
  onGenerateVideo: (sceneNumber: number) => void;
  onGenerateTransitionVideo?: (sceneNumber: number) => void;
  onCheckVideoStatus?: (sceneNumber: number) => void;
  onGenerateDialogue: (sceneNumber: number) => void;
  onDescribeScene?: (sceneNumber: number, frame: 'start' | 'end') => void;
  onDescribeAndGenerate?: (sceneNumber: number, frame: 'start' | 'end') => void;
  onDuplicate: (sceneNumber: number) => void;
  onDelete: (sceneNumber: number) => void;
  onLinkToPreviousScene?: (sceneNumber: number) => void;
  previousSceneEndFrame?: KeyframeData;
}

export const KeyframeSceneCard: React.FC<KeyframeSceneCardProps> = ({
  scene,
  sceneIndex,
  totalScenes,
  isGeneratingImage,
  isGeneratingVideo,
  isDescribingScene,
  characterName,
  secondCharacterName,
  onUpdateScene,
  onUpdateKeyframe,
  onGenerateStartImage,
  onGenerateEndImage,
  onGenerateVideo,
  onGenerateTransitionVideo,
  onCheckVideoStatus,
  onGenerateDialogue,
  onDescribeScene,
  onDescribeAndGenerate,
  onDuplicate,
  onDelete,
  onLinkToPreviousScene,
  previousSceneEndFrame,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCustomize, setShowCustomize] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ src: string; title: string } | null>(null);
  const [viewingVideo, setViewingVideo] = useState<{ src: string; title: string } | null>(null);

  // Audio sync refs for transition videos with separate audio
  const inlineAudioRef = useRef<HTMLAudioElement | null>(null);
  const inlineVideoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreenAudioRef = useRef<HTMLAudioElement | null>(null);

  const audioDataUrl = scene.transitionAudioContent 
    ? `data:audio/mp3;base64,${scene.transitionAudioContent}` 
    : null;

  // Sync audio with video playback
  const syncAudioToVideo = useCallback((videoEl: HTMLVideoElement, audioEl: HTMLAudioElement | null) => {
    if (!audioEl) return;
    
    const onPlay = () => { audioEl.currentTime = videoEl.currentTime; audioEl.play().catch(() => {}); };
    const onPause = () => { audioEl.pause(); };
    const onSeeked = () => { audioEl.currentTime = videoEl.currentTime; };
    const onEnded = () => { audioEl.pause(); audioEl.currentTime = 0; };

    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    videoEl.addEventListener('seeked', onSeeked);
    videoEl.addEventListener('ended', onEnded);

    return () => {
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
      videoEl.removeEventListener('seeked', onSeeked);
      videoEl.removeEventListener('ended', onEnded);
    };
  }, []);

  // Attach sync to inline video
  useEffect(() => {
    if (inlineVideoRef.current && inlineAudioRef.current) {
      return syncAudioToVideo(inlineVideoRef.current, inlineAudioRef.current);
    }
  }, [scene.generatedVideo, scene.transitionAudioContent, syncAudioToVideo]);

  // Clean up audio when video dialog closes
  useEffect(() => {
    if (!viewingVideo && fullscreenAudioRef.current) {
      fullscreenAudioRef.current.pause();
      fullscreenAudioRef.current.currentTime = 0;
    }
  }, [viewingVideo]);

  const canLinkToPrevious = sceneIndex > 0 && previousSceneEndFrame?.generatedImage;
  const hasStartFrame = !!scene.startFrame?.generatedImage;
  const hasEndFrame = !!scene.endFrame?.generatedImage;
  const hasVideo = !!scene.generatedVideo;

  return (
    <Card className="overflow-hidden border-border/50">
      {/* Compact Header */}
      <CardHeader className="py-3 px-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsExpanded(!isExpanded)} className="p-1 hover:bg-accent rounded">
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            <Badge variant="outline" className="font-mono">{scene.sceneNumber}/{totalScenes}</Badge>
            <span className="font-medium text-sm truncate max-w-[200px]">{scene.title}</span>
            {scene.mood && <span className="text-sm">{MOOD_ICONS[scene.mood] || '🎬'}</span>}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground hidden sm:inline">{scene.location} • {scene.timeOfDay}</span>
            {hasStartFrame && <Badge variant="secondary" className="text-[10px]">📸</Badge>}
            {hasVideo && <Badge variant="default" className="text-[10px]">🎬</Badge>}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onDuplicate(scene.sceneNumber)}><Copy className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onDelete(scene.sceneNumber)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="p-4 space-y-4">
          {/* Description — 2 lines */}
          <p className="text-sm text-muted-foreground line-clamp-2">{scene.description}</p>

          {/* Main Content: Start Frame Image + Video + Generate Scene Button */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Frame Preview */}
            <div 
              className={cn(
                "aspect-video bg-muted rounded-lg overflow-hidden relative group",
                hasStartFrame && "cursor-pointer"
              )}
              onClick={() => hasStartFrame && setViewingImage({ 
                src: scene.startFrame.generatedImage!, 
                title: `Scene ${scene.sceneNumber} - Start Frame` 
              })}
            >
              {hasStartFrame ? (
                <>
                  <img src={scene.startFrame.generatedImage} alt="Start frame" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Expand className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
                  <Image className="w-8 h-8 mb-1" />
                  <span className="text-xs">No image yet</span>
                </div>
              )}
            </div>

            {/* Video Preview or Generate Button */}
            <div 
              className={cn(
                "aspect-video bg-muted rounded-lg overflow-hidden relative",
                hasVideo && "cursor-pointer group"
              )}
              onClick={() => hasVideo && setViewingVideo({ 
                src: scene.generatedVideo!, 
                title: `Scene ${scene.sceneNumber} - ${scene.title}` 
              })}
            >
              {hasVideo ? (
                <>
                  <video 
                    ref={inlineVideoRef}
                    src={scene.generatedVideo} 
                    className="w-full h-full object-cover" 
                    controls 
                    onClick={(e) => e.stopPropagation()} 
                  />
                  {audioDataUrl && <audio ref={inlineAudioRef} src={audioDataUrl} preload="auto" />}
                  <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Expand className="w-3 h-3" />Fullscreen
                  </div>
                  {audioDataUrl && (
                    <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
                      <Volume2 className="w-3 h-3" />Audio synced
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/50">
                  <Video className="w-8 h-8 mb-1" />
                  <span className="text-xs">No video yet</span>
                </div>
              )}
            </div>
          </div>

          {/* Primary Action: Generate Scene ✨ */}
          {onDescribeAndGenerate && !hasStartFrame && (
            <Button
              onClick={() => onDescribeAndGenerate(scene.sceneNumber, 'start')}
              disabled={isGeneratingImage || isDescribingScene}
              className="w-full"
              size="lg"
            >
              {(isGeneratingImage || isDescribingScene) ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Scene...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Generate Scene ✨</>
              )}
            </Button>
          )}

          {/* After start frame exists: show video generation buttons */}
          {hasStartFrame && !hasVideo && (
            <div className="flex gap-2">
              <Button
                onClick={() => onGenerateVideo(scene.sceneNumber)}
                disabled={isGeneratingVideo}
                size="sm"
                variant="outline"
                className="flex-1"
              >
                {isGeneratingVideo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Lip-Sync Video
              </Button>
              {onGenerateTransitionVideo && hasEndFrame && (
                <Button
                  onClick={() => onGenerateTransitionVideo(scene.sceneNumber)}
                  disabled={isGeneratingVideo}
                  size="sm"
                  className="flex-1"
                >
                  {isGeneratingVideo ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ArrowRight className="w-4 h-4 mr-1" />}
                  Transition Video
                </Button>
              )}
            </div>
          )}

          {/* Dialogue — Formatted Chat Bubbles */}
          {scene.dialogue && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> Dialogue
                </Label>
                <Button onClick={() => onGenerateDialogue(scene.sceneNumber)} variant="ghost" size="sm" className="h-6 text-xs">
                  <Wand2 className="w-3 h-3 mr-1" />Regenerate
                </Button>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border max-h-52 overflow-y-auto space-y-2">
                {(() => {
                  const raw = typeof scene.dialogue === 'string' ? scene.dialogue : '';
                  // Parse lines like: Sarah: "Hello there" or SARAH: Hello there
                  const lines = raw.split('\n').filter(l => l.trim());
                  const parsed = lines.map(line => {
                    const match = line.match(/^([A-Za-z\s]+?):\s*"?(.+?)"?\s*$/);
                    if (match) return { character: match[1].trim(), text: match[2].trim() };
                    return { character: '', text: line.trim() };
                  });
                  // Assign alternating colors per unique character
                  const charColors = new Map<string, number>();
                  let colorIdx = 0;
                  parsed.forEach(p => {
                    if (p.character && !charColors.has(p.character.toLowerCase())) {
                      charColors.set(p.character.toLowerCase(), colorIdx++);
                    }
                  });
                  const bubbleStyles = [
                    'bg-primary/10 border-primary/20',
                    'bg-accent border-accent/50',
                    'bg-secondary border-secondary/50',
                    'bg-muted border-border',
                  ];
                  return parsed.map((p, i) => {
                    if (!p.character) {
                      // Stage direction or action line
                      return (
                        <p key={i} className="text-xs text-muted-foreground/70 italic text-center px-4">
                          {p.text}
                        </p>
                      );
                    }
                    const cIdx = charColors.get(p.character.toLowerCase()) || 0;
                    const isEven = cIdx % 2 === 0;
                    return (
                      <div key={i} className={`flex ${isEven ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] rounded-xl px-3 py-2 border ${bubbleStyles[cIdx % bubbleStyles.length]}`}>
                          <p className="text-[10px] font-bold text-foreground/70 uppercase tracking-wider mb-0.5">
                            {p.character}
                          </p>
                          <p className="text-sm text-foreground leading-relaxed">
                            "{p.text}"
                          </p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* ===== Customize — All Advanced Controls ===== */}
          <Collapsible open={showCustomize} onOpenChange={setShowCustomize}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground">
                <span className="flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5" />
                  Customize
                </span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showCustomize && "rotate-180")} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-4">
              {/* Start & End Frame Controls */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                {/* START FRAME */}
                <div className="space-y-2 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                  <Label className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> START
                  </Label>
                  {canLinkToPrevious && (
                    <Button variant="ghost" size="sm" className="h-6 text-xs w-full" onClick={() => onLinkToPreviousScene?.(scene.sceneNumber)}>
                      <Link className="w-3 h-3 mr-1" />Link to Prev
                    </Button>
                  )}
                  <Textarea
                    placeholder="Describe the starting visual..."
                    value={scene.startFrame?.imagePrompt || ''}
                    onChange={(e) => onUpdateKeyframe(scene.sceneNumber, 'start', { imagePrompt: e.target.value })}
                    rows={2} className="text-xs resize-none"
                  />
                  <div className="grid grid-cols-2 gap-1">
                    <Select value={scene.startFrame?.cameraAngle || 'eye-level'} onValueChange={(v) => onUpdateKeyframe(scene.sceneNumber, 'start', { cameraAngle: v })}>
                      <SelectTrigger className="h-7 text-xs"><Camera className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                      <SelectContent>{CAMERA_ANGLES_SIMPLE.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Position" value={scene.startFrame?.position || ''} onChange={(e) => onUpdateKeyframe(scene.sceneNumber, 'start', { position: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="flex gap-1">
                    <Button onClick={() => onGenerateStartImage(scene.sceneNumber)} disabled={isGeneratingImage || !scene.startFrame?.imagePrompt} size="sm" variant="outline" className="flex-1 h-7 text-xs">
                      {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3 mr-1" />}Generate
                    </Button>
                    {onDescribeAndGenerate && (
                      <Button onClick={() => onDescribeAndGenerate(scene.sceneNumber, 'start')} disabled={isGeneratingImage || isDescribingScene} size="sm" className="flex-1 h-7 text-xs">
                        {(isGeneratingImage || isDescribingScene) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}Auto
                      </Button>
                    )}
                  </div>
                </div>

                {/* TRANSITION */}
                <div className="flex flex-col items-center justify-center min-w-[140px] space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Label className="text-xs font-semibold text-primary">TRANSITION</Label>
                  <ArrowRight className="w-6 h-6 text-primary/50" />
                  <Textarea placeholder="What happens..." value={scene.transitionAction || ''} onChange={(e) => onUpdateScene(scene.sceneNumber, { transitionAction: e.target.value })} rows={2} className="text-xs resize-none" />
                  <Select value={scene.transitionCameraMovement || 'static'} onValueChange={(v) => onUpdateScene(scene.sceneNumber, { transitionCameraMovement: v })}>
                    <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CAMERA_MOVEMENTS.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {/* END FRAME */}
                <div className="space-y-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <Label className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" /> END
                  </Label>
                  {hasEndFrame && (
                    <div className="aspect-video bg-muted rounded overflow-hidden cursor-pointer" onClick={() => setViewingImage({ src: scene.endFrame.generatedImage!, title: `Scene ${scene.sceneNumber} - End Frame` })}>
                      <img src={scene.endFrame.generatedImage} alt="End frame" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <Textarea placeholder="Describe the ending visual..." value={scene.endFrame?.imagePrompt || ''} onChange={(e) => onUpdateKeyframe(scene.sceneNumber, 'end', { imagePrompt: e.target.value })} rows={2} className="text-xs resize-none" />
                  <div className="grid grid-cols-2 gap-1">
                    <Select value={scene.endFrame?.cameraAngle || 'eye-level'} onValueChange={(v) => onUpdateKeyframe(scene.sceneNumber, 'end', { cameraAngle: v })}>
                      <SelectTrigger className="h-7 text-xs"><Camera className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
                      <SelectContent>{CAMERA_ANGLES_SIMPLE.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input placeholder="Position" value={scene.endFrame?.position || ''} onChange={(e) => onUpdateKeyframe(scene.sceneNumber, 'end', { position: e.target.value })} className="h-7 text-xs" />
                  </div>
                  <div className="flex gap-1">
                    <Button onClick={() => onGenerateEndImage(scene.sceneNumber)} disabled={isGeneratingImage || !scene.endFrame?.imagePrompt} size="sm" variant="outline" className="flex-1 h-7 text-xs">
                      {isGeneratingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Image className="w-3 h-3 mr-1" />}Generate
                    </Button>
                    {onDescribeAndGenerate && (
                      <Button onClick={() => onDescribeAndGenerate(scene.sceneNumber, 'end')} disabled={isGeneratingImage || isDescribingScene} size="sm" className="flex-1 h-7 text-xs">
                        {(isGeneratingImage || isDescribingScene) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3 mr-1" />}Auto
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Scene Settings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1 block">Location</Label>
                  <Input value={scene.location} onChange={(e) => onUpdateScene(scene.sceneNumber, { location: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Time of Day</Label>
                  <Input value={scene.timeOfDay} onChange={(e) => onUpdateScene(scene.sceneNumber, { timeOfDay: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Lighting</Label>
                  <Select value={scene.selectedLighting || 'natural'} onValueChange={(v) => onUpdateScene(scene.sceneNumber, { selectedLighting: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{LIGHTING_STYLES_SIMPLE.map(l => <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Mood</Label>
                  <Select value={scene.mood || 'peaceful'} onValueChange={(v) => onUpdateScene(scene.sceneNumber, { mood: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(MOOD_ICONS).map(([mood, icon]) => <SelectItem key={mood} value={mood}>{icon} {mood.charAt(0).toUpperCase() + mood.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs mb-1 block">Description</Label>
                  <Textarea value={scene.description} onChange={(e) => onUpdateScene(scene.sceneNumber, { description: e.target.value })} rows={2} className="resize-none text-xs" />
                </div>
              </div>

              {/* Dialogue editing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Dialogue</Label>
                  <Button onClick={() => onGenerateDialogue(scene.sceneNumber)} variant="outline" size="sm" className="h-6 text-xs">
                    <Wand2 className="w-3 h-3 mr-1" />Generate
                  </Button>
                </div>
                <Textarea
                  value={typeof scene.dialogue === 'string' ? scene.dialogue : ''}
                  onChange={(e) => onUpdateScene(scene.sceneNumber, { dialogue: e.target.value })}
                  rows={3} className="resize-none text-xs italic"
                  placeholder={`Enter dialogue for ${characterName || 'the character'}...`}
                />
              </div>

              {scene.suggestedMusic && (
                <div className="p-2 bg-primary/5 rounded border border-primary/20 flex items-center gap-2">
                  <Music className="w-3 h-3 text-primary" />
                  <span className="text-xs text-muted-foreground">{scene.suggestedMusic}</span>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      )}

      {/* Image Lightbox */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background/95 backdrop-blur">
          <DialogTitle className="sr-only">{viewingImage?.title || 'Image Preview'}</DialogTitle>
          <div className="relative">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10 bg-background/80" onClick={() => setViewingImage(null)}><X className="h-4 w-4" /></Button>
            {viewingImage && <img src={viewingImage.src} alt={viewingImage.title} className="w-full h-auto max-h-[80vh] object-contain" />}
            <div className="p-4 border-t border-border"><p className="text-sm text-muted-foreground text-center">{viewingImage?.title}</p></div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Lightbox */}
      <Dialog open={!!viewingVideo} onOpenChange={(open) => !open && setViewingVideo(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-background/95 backdrop-blur">
          <DialogTitle className="sr-only">{viewingVideo?.title || 'Video Preview'}</DialogTitle>
          <div className="relative">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10 bg-background/80" onClick={() => setViewingVideo(null)}><X className="h-4 w-4" /></Button>
            {viewingVideo && (
              <>
                <video 
                  src={viewingVideo.src} 
                  controls 
                  autoPlay 
                  className="w-full h-auto max-h-[80vh]"
                  ref={(el) => {
                    if (el && fullscreenAudioRef.current && audioDataUrl) {
                      syncAudioToVideo(el, fullscreenAudioRef.current);
                    }
                  }}
                />
                {audioDataUrl && <audio ref={fullscreenAudioRef} src={audioDataUrl} preload="auto" />}
              </>
            )}
            <div className="p-4 border-t border-border"><p className="text-sm text-muted-foreground text-center">{viewingVideo?.title}</p></div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
