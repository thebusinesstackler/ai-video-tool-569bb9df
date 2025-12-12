import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Film, Copy, Trash2, ChevronDown, ChevronRight, Image, Play, 
  ArrowRight, Link, Camera, Lightbulb, Music, User, Wand2, 
  Loader2, Video, Volume2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types
export interface KeyframeData {
  imagePrompt: string;
  generatedImage?: string;
  position: string; // e.g., "standing left", "seated center"
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
  
  // New keyframe fields
  startFrame: KeyframeData;
  endFrame: KeyframeData;
  transitionAction: string; // What happens between frames
  transitionCameraMovement: string; // How camera moves
  
  // Existing fields
  imagePrompt: string; // Keep for backward compatibility
  generatedImage?: string;
  generatedVideo?: string;
  videoTaskId?: string;
  selectedCameraAngle?: string;
  selectedLighting?: string;
  mood?: string;
  suggestedMusic?: string;
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
  characterName?: string;
  onUpdateScene: (sceneNumber: number, updates: Partial<MovieSceneWithKeyframes>) => void;
  onUpdateKeyframe: (sceneNumber: number, frame: 'start' | 'end', updates: Partial<KeyframeData>) => void;
  onGenerateStartImage: (sceneNumber: number) => void;
  onGenerateEndImage: (sceneNumber: number) => void;
  onGenerateVideo: (sceneNumber: number) => void;
  onGenerateDialogue: (sceneNumber: number) => void;
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
  characterName,
  onUpdateScene,
  onUpdateKeyframe,
  onGenerateStartImage,
  onGenerateEndImage,
  onGenerateVideo,
  onGenerateDialogue,
  onDuplicate,
  onDelete,
  onLinkToPreviousScene,
  previousSceneEndFrame,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'keyframes' | 'audio' | 'settings'>('keyframes');

  const canLinkToPrevious = sceneIndex > 0 && previousSceneEndFrame?.generatedImage;

  return (
    <Card className="overflow-hidden border-border/50">
      {/* Compact Header */}
      <CardHeader className="py-3 px-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
            
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {scene.sceneNumber}/{totalScenes}
              </Badge>
              <Input
                value={scene.title}
                onChange={(e) => onUpdateScene(scene.sceneNumber, { title: e.target.value })}
                className="h-8 w-64 font-medium bg-transparent border-transparent hover:border-border focus:border-border"
              />
            </div>
            
            {scene.mood && (
              <Badge variant="secondary" className="capitalize">
                {MOOD_ICONS[scene.mood] || '🎬'} {scene.mood}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {scene.location} • {scene.timeOfDay}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onDuplicate(scene.sceneNumber)}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(scene.sceneNumber)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <Collapsible open={isExpanded}>
        <CollapsibleContent>
          <CardContent className="p-4 space-y-4">
            {/* Tab Navigation */}
            <div className="flex gap-2 border-b border-border pb-2">
              <Button
                variant={activeTab === 'keyframes' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('keyframes')}
              >
                <Film className="w-4 h-4 mr-1" />
                Keyframes
              </Button>
              <Button
                variant={activeTab === 'audio' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('audio')}
              >
                <Volume2 className="w-4 h-4 mr-1" />
                Audio & Dialogue
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('settings')}
              >
                <Lightbulb className="w-4 h-4 mr-1" />
                Settings
              </Button>
            </div>

            {/* Keyframes Tab */}
            {activeTab === 'keyframes' && (
              <div className="space-y-4">
                {/* Keyframe Timeline */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
                  {/* START FRAME */}
                  <div className="space-y-3 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        START FRAME
                      </Label>
                      {canLinkToPrevious && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onLinkToPreviousScene?.(scene.sceneNumber)}
                        >
                          <Link className="w-3 h-3 mr-1" />
                          Link to Prev
                        </Button>
                      )}
                    </div>
                    
                    {/* Image Preview */}
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                      {scene.startFrame?.generatedImage ? (
                        <img 
                          src={scene.startFrame.generatedImage} 
                          alt="Start frame"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Image className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    
                    {/* Start Frame Controls */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Describe the starting visual..."
                        value={scene.startFrame?.imagePrompt || ''}
                        onChange={(e) => onUpdateKeyframe(scene.sceneNumber, 'start', { imagePrompt: e.target.value })}
                        rows={2}
                        className="text-xs resize-none"
                      />
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={scene.startFrame?.cameraAngle || 'eye-level'}
                          onValueChange={(v) => onUpdateKeyframe(scene.sceneNumber, 'start', { cameraAngle: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <Camera className="w-3 h-3 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CAMERA_ANGLES_SIMPLE.map(a => (
                              <SelectItem key={a.id} value={a.id} className="text-xs">
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Input
                          placeholder="Position (e.g., standing left)"
                          value={scene.startFrame?.position || ''}
                          onChange={(e) => onUpdateKeyframe(scene.sceneNumber, 'start', { position: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      
                      <Button
                        onClick={() => onGenerateStartImage(scene.sceneNumber)}
                        disabled={isGeneratingImage}
                        size="sm"
                        className="w-full"
                      >
                        {isGeneratingImage ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Image className="w-4 h-4 mr-1" />
                        )}
                        Generate Start
                      </Button>
                    </div>
                  </div>

                  {/* TRANSITION (Center) */}
                  <div className="flex flex-col items-center justify-center min-w-[200px] space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-center">
                      <Label className="text-sm font-semibold text-primary">TRANSITION</Label>
                    </div>
                    
                    <ArrowRight className="w-8 h-8 text-primary/50" />
                    
                    {/* Action Description */}
                    <div className="w-full space-y-2">
                      <Label className="text-xs text-muted-foreground">Action</Label>
                      <Textarea
                        placeholder="What happens between frames..."
                        value={scene.transitionAction || ''}
                        onChange={(e) => onUpdateScene(scene.sceneNumber, { transitionAction: e.target.value })}
                        rows={2}
                        className="text-xs resize-none"
                      />
                    </div>
                    
                    {/* Camera Movement */}
                    <div className="w-full space-y-2">
                      <Label className="text-xs text-muted-foreground">Camera Movement</Label>
                      <Select
                        value={scene.transitionCameraMovement || 'static'}
                        onValueChange={(v) => onUpdateScene(scene.sceneNumber, { transitionCameraMovement: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMERA_MOVEMENTS.map(m => (
                            <SelectItem key={m.id} value={m.id} className="text-xs">
                              <div>
                                <div>{m.name}</div>
                                <div className="text-muted-foreground text-[10px]">{m.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* END FRAME */}
                  <div className="space-y-3 p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        END FRAME
                      </Label>
                    </div>
                    
                    {/* Image Preview */}
                    <div className="aspect-video bg-muted rounded-lg overflow-hidden relative">
                      {scene.endFrame?.generatedImage ? (
                        <img 
                          src={scene.endFrame.generatedImage} 
                          alt="End frame"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Image className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    
                    {/* End Frame Controls */}
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Describe the ending visual..."
                        value={scene.endFrame?.imagePrompt || ''}
                        onChange={(e) => onUpdateKeyframe(scene.sceneNumber, 'end', { imagePrompt: e.target.value })}
                        rows={2}
                        className="text-xs resize-none"
                      />
                      
                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={scene.endFrame?.cameraAngle || 'eye-level'}
                          onValueChange={(v) => onUpdateKeyframe(scene.sceneNumber, 'end', { cameraAngle: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <Camera className="w-3 h-3 mr-1" />
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CAMERA_ANGLES_SIMPLE.map(a => (
                              <SelectItem key={a.id} value={a.id} className="text-xs">
                                {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        <Input
                          placeholder="Position (e.g., walking away)"
                          value={scene.endFrame?.position || ''}
                          onChange={(e) => onUpdateKeyframe(scene.sceneNumber, 'end', { position: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      
                      <Button
                        onClick={() => onGenerateEndImage(scene.sceneNumber)}
                        disabled={isGeneratingImage}
                        size="sm"
                        className="w-full"
                      >
                        {isGeneratingImage ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Image className="w-4 h-4 mr-1" />
                        )}
                        Generate End
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Video Generation */}
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {scene.generatedVideo ? (
                      <video 
                        src={scene.generatedVideo} 
                        className="h-16 rounded"
                        controls
                      />
                    ) : (
                      <div className="w-28 h-16 bg-muted rounded flex items-center justify-center">
                        <Video className="w-6 h-6 text-muted-foreground/50" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">Scene Video</p>
                      <p className="text-xs text-muted-foreground">
                        {scene.generatedVideo ? 'Video generated' : 'Generate both frames first'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => onGenerateVideo(scene.sceneNumber)}
                    disabled={isGeneratingVideo || !scene.startFrame?.generatedImage || !scene.endFrame?.generatedImage}
                    size="sm"
                  >
                    {isGeneratingVideo ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-1" />
                    )}
                    Generate Video
                  </Button>
                </div>
              </div>
            )}

            {/* Audio Tab */}
            {activeTab === 'audio' && (
              <div className="space-y-4">
                {/* Main Character Dialogue */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      {characterName || 'Main Character'} Dialogue
                    </Label>
                    <Button
                      onClick={() => onGenerateDialogue(scene.sceneNumber)}
                      variant="outline"
                      size="sm"
                    >
                      <Wand2 className="w-3 h-3 mr-1" />
                      Generate
                    </Button>
                  </div>
                  <Textarea
                    value={scene.dialogue || ''}
                    onChange={(e) => onUpdateScene(scene.sceneNumber, { dialogue: e.target.value })}
                    rows={3}
                    className="resize-none italic"
                    placeholder={`Enter what ${characterName || 'the main character'} will say...`}
                  />
                </div>

                {/* Other Character Dialogue */}
                {scene.otherCharacterDialogue !== undefined && (
                  <div>
                    <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      Other Character Dialogue
                    </Label>
                    <Textarea
                      value={scene.otherCharacterDialogue || ''}
                      onChange={(e) => onUpdateScene(scene.sceneNumber, { otherCharacterDialogue: e.target.value })}
                      rows={2}
                      className="resize-none italic opacity-80"
                      placeholder="Other character's lines..."
                    />
                  </div>
                )}

                {/* Music Suggestion */}
                {scene.suggestedMusic && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Music className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">Suggested Music</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{scene.suggestedMusic}</p>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Location</Label>
                  <Input
                    value={scene.location}
                    onChange={(e) => onUpdateScene(scene.sceneNumber, { location: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Time of Day</Label>
                  <Input
                    value={scene.timeOfDay}
                    onChange={(e) => onUpdateScene(scene.sceneNumber, { timeOfDay: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-sm font-semibold mb-2 block">Scene Description</Label>
                  <Textarea
                    value={scene.description}
                    onChange={(e) => onUpdateScene(scene.sceneNumber, { description: e.target.value })}
                    rows={3}
                    className="resize-none"
                  />
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Lighting Style</Label>
                  <Select
                    value={scene.selectedLighting || 'natural'}
                    onValueChange={(v) => onUpdateScene(scene.sceneNumber, { selectedLighting: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LIGHTING_STYLES_SIMPLE.map(l => (
                        <SelectItem key={l.id} value={l.id}>
                          <div>
                            <div>{l.name}</div>
                            <div className="text-xs text-muted-foreground">{l.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-2 block">Scene Mood</Label>
                  <Select
                    value={scene.mood || 'peaceful'}
                    onValueChange={(v) => onUpdateScene(scene.sceneNumber, { mood: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MOOD_ICONS).map(([mood, icon]) => (
                        <SelectItem key={mood} value={mood}>
                          {icon} {mood.charAt(0).toUpperCase() + mood.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
