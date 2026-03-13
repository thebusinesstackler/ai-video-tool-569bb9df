import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Bot, Camera, Film, Image, Loader2, Mic, Play,
  Send, Sparkles, SlidersHorizontal, Plus, Wand2,
  LayoutGrid, Check, Volume2, Music
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SceneShot {
  id: string;
  imageUrl: string;
  angleLabel: string;
  prompt: string;
  selected: boolean;
  type: 'speaking' | 'broll' | 'transition';
  sfx?: string;
  music?: string;
  narrationSegment?: string;
}

interface EditStatus {
  active: boolean;
  instruction: string;
  stage: 'interpreting' | 'generating-image' | 'done' | 'error';
  stageLabel: string;
  shotSpec?: { angleLabel: string; type: string; sfx?: string; music?: string };
}

interface VideoEditorPanelProps {
  sceneShots: SceneShot[];
  onGenerateShot: (angle: string, type: 'speaking' | 'broll') => Promise<void>;
  onSelectShot: (shotId: string) => void;
  onCreateVideoFromShot: (shot: SceneShot) => void;
  isAddingShot: boolean;
  isGeneratingShots: boolean;
  musicSuggestion?: string;
  onAiEditRequest: (instruction: string) => Promise<void>;
  editStatus?: EditStatus;
}

const QUICK_ANGLES = {
  speaking: [
    { label: 'Close-Up Direct', icon: '🎤' },
    { label: 'Low Angle Power', icon: '🎤' },
    { label: 'Over Shoulder', icon: '🎤' },
    { label: 'Profile Two-Shot', icon: '🎤' },
  ],
  broll: [
    { label: 'Wide Establishing', icon: '🎬' },
    { label: 'Walking Away', icon: '🎬' },
    { label: 'Contemplative Profile', icon: '🎬' },
    { label: 'Hands Detail', icon: '🎬' },
    { label: 'Environment Pan', icon: '🎬' },
    { label: 'Silhouette Backlit', icon: '🎬' },
  ],
};

const AI_EDIT_SUGGESTIONS = [
  'Add a dramatic B-roll opening',
  'Create a cinematic closing shot',
  'Add a slide with key stats',
  'Generate a product showcase cutaway',
  'Add an emotional close-up reaction',
  'Create a walking transition shot',
];

export const VideoEditorPanel: React.FC<VideoEditorPanelProps> = ({
  sceneShots,
  onGenerateShot,
  onSelectShot,
  onCreateVideoFromShot,
  isAddingShot,
  isGeneratingShots,
  musicSuggestion,
  onAiEditRequest,
}) => {
  const [aiInput, setAiInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [activeTab, setActiveTab] = useState('shots');

  const handleAiSubmit = async () => {
    if (!aiInput.trim()) return;
    setIsAiThinking(true);
    try {
      await onAiEditRequest(aiInput);
      setAiInput('');
    } finally {
      setIsAiThinking(false);
    }
  };

  const speakingShots = sceneShots.filter(s => s.type === 'speaking');
  const brollShots = sceneShots.filter(s => s.type !== 'speaking');

  return (
    <Card className="border-border bg-card/80 backdrop-blur-sm h-full flex flex-col">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="w-4 h-4 text-primary" />
          AI Director
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Enhance your video with additional shots, B-roll, and slides
        </p>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 grid grid-cols-3">
          <TabsTrigger value="shots" className="text-xs">
            <Camera className="w-3 h-3 mr-1" />
            Shots
          </TabsTrigger>
          <TabsTrigger value="enhance" className="text-xs">
            <Wand2 className="w-3 h-3 mr-1" />
            AI Edit
          </TabsTrigger>
          <TabsTrigger value="library" className="text-xs">
            <LayoutGrid className="w-3 h-3 mr-1" />
            Library
          </TabsTrigger>
        </TabsList>

        {/* === SHOTS TAB === */}
        <TabsContent value="shots" className="flex-1 min-h-0 m-0 px-3 pb-3">
          <ScrollArea className="h-[calc(100%-8px)]">
            <div className="space-y-3 pt-2">
              {/* Existing shots */}
              {sceneShots.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Generated Shots ({sceneShots.length})
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {sceneShots.map(shot => (
                      <button
                        key={shot.id}
                        onClick={() => onSelectShot(shot.id)}
                        className={cn(
                          "relative rounded-lg border overflow-hidden transition-all text-left",
                          shot.selected
                            ? "border-primary ring-1 ring-primary/30"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="aspect-[9/16] bg-muted relative">
                          <img
                            src={shot.imageUrl}
                            alt={shot.angleLabel}
                            className="w-full h-full object-cover"
                          />
                          <Badge
                            variant={shot.type === 'speaking' ? 'default' : 'secondary'}
                            className="absolute top-1 left-1 text-[8px] h-4 px-1"
                          >
                            {shot.type === 'speaking' ? '🎤' : '🎬'}
                          </Badge>
                          {shot.selected && (
                            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="p-1.5">
                          <p className="text-[9px] text-muted-foreground line-clamp-1">{shot.angleLabel}</p>
                          <div className="flex gap-0.5 mt-0.5">
                            {shot.sfx && <Volume2 className="w-2.5 h-2.5 text-muted-foreground/60" />}
                            {shot.music && <Music className="w-2.5 h-2.5 text-muted-foreground/60" />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isGeneratingShots && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating shots...
                </div>
              )}

              {/* Quick add speaking */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Mic className="w-3 h-3" /> Add Speaking Shot
                </p>
                <div className="flex flex-wrap gap-1">
                  {QUICK_ANGLES.speaking
                    .filter(a => !sceneShots.some(s => s.angleLabel.includes(a.label)))
                    .map(angle => (
                      <Button
                        key={angle.label}
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] px-2"
                        disabled={isAddingShot}
                        onClick={() => onGenerateShot(angle.label, 'speaking')}
                      >
                        {isAddingShot ? <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> : <Plus className="w-2.5 h-2.5 mr-1" />}
                        {angle.label}
                      </Button>
                    ))}
                </div>
              </div>

              {/* Quick add B-roll */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Film className="w-3 h-3" /> Add B-Roll
                </p>
                <div className="flex flex-wrap gap-1">
                  {QUICK_ANGLES.broll
                    .filter(a => !sceneShots.some(s => s.angleLabel.includes(a.label)))
                    .map(angle => (
                      <Button
                        key={angle.label}
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px] px-2"
                        disabled={isAddingShot}
                        onClick={() => onGenerateShot(angle.label, 'broll')}
                      >
                        {isAddingShot ? <Loader2 className="w-2.5 h-2.5 mr-1 animate-spin" /> : <Plus className="w-2.5 h-2.5 mr-1" />}
                        {angle.label}
                      </Button>
                    ))}
                </div>
              </div>

              {musicSuggestion && (
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Music className="w-3 h-3" /> Suggested: {musicSuggestion}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* === AI EDIT TAB === */}
        <TabsContent value="enhance" className="flex-1 min-h-0 m-0 px-3 pb-3 flex flex-col">
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Tell the AI director what to add — new angles, B-roll, slides, transitions:
              </p>
              
              {/* Quick suggestions */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Ideas</p>
                <div className="space-y-1">
                  {AI_EDIT_SUGGESTIONS.map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => setAiInput(suggestion)}
                      className="w-full text-left p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-xs text-muted-foreground"
                    >
                      <Sparkles className="w-3 h-3 inline mr-1.5 text-primary" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected shots preview */}
              {sceneShots.filter(s => s.selected).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Selected for Edit ({sceneShots.filter(s => s.selected).length})
                  </p>
                  <div className="flex gap-1 flex-wrap">
                    {sceneShots.filter(s => s.selected).map(shot => (
                      <div key={shot.id} className="w-10 h-16 rounded border border-primary/50 overflow-hidden">
                        <img src={shot.imageUrl} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* AI Input */}
          <div className="flex gap-1.5 mt-2 pt-2 border-t border-border">
            <Input
              placeholder="e.g. 'Add a dramatic B-roll opening'"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }}
              disabled={isAiThinking}
              className="flex-1 h-8 text-xs"
            />
            <Button
              size="icon"
              className="h-8 w-8"
              disabled={isAiThinking || !aiInput.trim()}
              onClick={handleAiSubmit}
            >
              {isAiThinking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </Button>
          </div>
        </TabsContent>

        {/* === LIBRARY TAB === */}
        <TabsContent value="library" className="flex-1 min-h-0 m-0 px-3 pb-3">
          <ScrollArea className="h-[calc(100%-8px)]">
            <div className="space-y-3 pt-2">
              {sceneShots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Image className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">No shots yet. Generate your first video to populate the library.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {speakingShots.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        🎤 Speaking ({speakingShots.length})
                      </p>
                      {speakingShots.map(shot => (
                        <div key={shot.id} className="flex items-center gap-2 p-1.5 rounded-lg border border-border hover:border-primary/50 transition-all">
                          <div className="w-10 h-16 rounded overflow-hidden flex-shrink-0">
                            <img src={shot.imageUrl} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-foreground line-clamp-1">{shot.angleLabel}</p>
                            {shot.narrationSegment && (
                              <p className="text-[9px] text-muted-foreground line-clamp-1 italic">"{shot.narrationSegment}"</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={() => onCreateVideoFromShot(shot)}
                          >
                            <Play className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                  {brollShots.length > 0 && (
                    <>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2">
                        🎬 B-Roll ({brollShots.length})
                      </p>
                      {brollShots.map(shot => (
                        <div key={shot.id} className="flex items-center gap-2 p-1.5 rounded-lg border border-border hover:border-primary/50 transition-all">
                          <div className="w-10 h-16 rounded overflow-hidden flex-shrink-0">
                            <img src={shot.imageUrl} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-foreground line-clamp-1">{shot.angleLabel}</p>
                            <div className="flex gap-1 mt-0.5">
                              {shot.sfx && <span className="text-[8px] bg-muted px-1 rounded">🔊 {shot.sfx.substring(0, 15)}</span>}
                              {shot.music && <span className="text-[8px] bg-muted px-1 rounded">🎵 {shot.music.substring(0, 15)}</span>}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] px-2"
                            onClick={() => onCreateVideoFromShot(shot)}
                          >
                            <Play className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
};
