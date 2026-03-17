import { useState, useRef, useCallback, useEffect } from 'react';
import { CommercialSegment } from '@/types/testimonialCommercial';
import { User, Film, Play, Pause, ChevronUp, ChevronDown, Volume2, Clock, RefreshCw, Mic, Pencil, Trash2, Copy, FileText, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TimelinePreviewProps {
  segments: CommercialSegment[];
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onSelectSegment?: (id: string) => void;
  onUpdateSegment?: (id: string, updates: Partial<CommercialSegment>) => void;
  onDeleteSegment?: (id: string) => void;
  onDuplicateSegment?: (id: string) => void;
}

interface AITwinVoiceOption {
  id: string;
  name: string;
  voice_cloning_key: string;
}

const segmentConfig = {
  speaking: { label: 'Speaking', color: 'bg-primary', border: 'border-primary/60', icon: User },
  broll: { label: 'B-Roll', color: 'bg-amber-500', border: 'border-amber-500/60', icon: Film },
};

function detectGender(segment: CommercialSegment): 'male' | 'female' {
  const desc = (segment.character?.description || '').toLowerCase();
  const gender = (segment.character?.gender || '').toLowerCase();
  if (gender.includes('female') || gender.includes('woman') || /\b(woman|female|girl|lady|she|her|mother|actress)\b/.test(desc)) return 'female';
  return 'male';
}

export function TimelinePreview({ segments, onReorder, onSelectSegment, onUpdateSegment, onDeleteSegment, onDuplicateSegment }: TimelinePreviewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [showScriptFlow, setShowScriptFlow] = useState(false);
  const { user } = useAuth();
  const [twinVoices, setTwinVoices] = useState<AITwinVoiceOption[]>([]);

  // Load AI Twin voices
  useEffect(() => {
    if (!user) return;
    supabase.rpc('get_twins_summary', { _user_id: user.id }).then(({ data }) => {
      const withVoice = (data || [])
        .filter((t: any) => t.voice_cloning_key)
        .map((t: any) => ({ id: t.id, name: t.name, voice_cloning_key: t.voice_cloning_key }));
      setTwinVoices(withVoice);
    });
  }, [user]);
  const [editingScriptId, setEditingScriptId] = useState<string | null>(null);
  const [editScriptText, setEditScriptText] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Detect if single character commercial — lock voice
  const speakingSegs = segments.filter(s => s.type === 'speaking');
  const uniqueCharIds = new Set(speakingSegs.map(s => s.character?.twinId || s.character?.description?.split('.')[0]?.trim().toLowerCase().slice(0, 50) || ''));
  const isSingleCharacter = uniqueCharIds.size <= 1 && speakingSegs.length > 0;
  const lockedVoiceId = isSingleCharacter ? speakingSegs.find(s => s.voiceoverId)?.voiceoverId : null;

  const togglePlay = useCallback((segment: CommercialSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingId === segment.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (!segment.audioUrl) return;
    const audio = new Audio(segment.audioUrl);
    audioRef.current = audio;
    setPlayingId(segment.id);
    audio.onended = () => { setPlayingId(null); audioRef.current = null; };
    audio.play().catch(() => setPlayingId(null));
  }, [playingId]);

  const handleVoiceChange = async (segmentId: string, voiceId: string) => {
    const seg = segments.find(s => s.id === segmentId);
    if (!seg?.script) return;

    // If single character, apply to ALL speaking segments
    const targetSegs = isSingleCharacter ? speakingSegs : [seg];

    for (const targetSeg of targetSegs) {
      if (!targetSeg.script) continue;
      setRegeneratingId(targetSeg.id);
      try {
        // Check if voiceId is a Speechify cloned voice (not a WaveSpeed preset ID)
        const isTwinVoice = twinVoices.some(t => t.voice_cloning_key === voiceId);
        const { data, error } = await supabase.functions.invoke('text-to-speech', {
          body: { 
            text: targetSeg.script, 
            ...(isTwinVoice ? { speechifyVoiceId: voiceId } : { voice: voiceId })
          }
        });
        if (error) throw error;
        if (data?.audioUrl) {
          const usedVoice = data.voiceUsed || voiceId;
          onUpdateSegment?.(targetSeg.id, { audioUrl: data.audioUrl, voiceoverId: usedVoice });
        }
      } catch (err) {
        console.error('Voice regen failed:', err);
        toast.error('Failed to regenerate voice');
      }
    }
    setRegeneratingId(null);
    toast.success(isSingleCharacter ? `Voice updated across all ${targetSegs.length} scenes` : 'Voice updated');
  };

  const handleRegenerateAudio = async (segment: CommercialSegment) => {
    if (!segment.script) return;
    const voiceId = lockedVoiceId || segment.voiceoverId || 'English_Trustworth_Man';
    setRegeneratingId(segment.id);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: segment.script, voice: voiceId }
      });
      if (error) throw error;
      if (data?.audioUrl) {
        onUpdateSegment?.(segment.id, { audioUrl: data.audioUrl, voiceoverId: data.voiceUsed || voiceId });
        toast.success('Audio regenerated');
      }
    } catch {
      toast.error('Failed to regenerate audio');
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleSaveScript = (segId: string) => {
    onUpdateSegment?.(segId, { script: editScriptText, audioUrl: undefined, voiceoverId: undefined });
    setEditingScriptId(null);
    toast.success('Script updated. Regenerate audio to hear the change.');
  };

  const getTypeNumber = (index: number) => {
    const seg = segments[index];
    let count = 0;
    for (let i = 0; i <= index; i++) {
      if (segments[i].type === seg.type) count++;
    }
    return count;
  };

  const getNarrativeLabel = (index: number): string | null => {
    const seg = segments[index];
    if (seg.type !== 'speaking') return null;
    const speakingOnly = segments.filter(s => s.type === 'speaking');
    const speakIdx = speakingOnly.indexOf(seg);
    if (speakIdx === 0) return 'HOOK';
    if (speakIdx === speakingOnly.length - 1) return 'CLOSING';
    return null;
  };

  if (segments.length === 0) return null;

  const totalDuration = segments.reduce((sum, seg) => sum + (seg.duration || 0), 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimecode = (index: number) => {
    let elapsed = 0;
    for (let i = 0; i < index; i++) elapsed += segments[i].duration || 0;
    return formatTime(elapsed);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && index !== draggedIndex) setDropTargetIndex(index);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== toIndex && onReorder) onReorder(draggedIndex, toIndex);
    setDraggedIndex(null);
    setDropTargetIndex(null);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id === selectedId ? null : id);
    onSelectSegment?.(id);
  };

  const getThumbnail = (segment: CommercialSegment) => {
    if (segment.brollImages?.[0]) return segment.brollImages[0];
    if (segment.character?.referenceImages?.[0]) return segment.character.referenceImages[0];
    return null;
  };

  const selectedSeg = selectedId ? segments.find(s => s.id === selectedId) : null;
  const selectedIndex = selectedId ? segments.findIndex(s => s.id === selectedId) : -1;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Timeline</span>
          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{formatTime(totalDuration)}</Badge>
          {isSingleCharacter && lockedVoiceId && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
              <Lock className="h-2.5 w-2.5" />
              Voice locked
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => setShowScriptFlow(true)}>
            <FileText className="h-3 w-3" />
            Script Flow
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <TooltipProvider delayDuration={100}>
        <div className="flex h-3 rounded-full overflow-hidden border bg-muted/30">
          {segments.map((segment, index) => {
            const config = segmentConfig[segment.type] || segmentConfig.speaking;
            const widthPercent = totalDuration > 0 ? (segment.duration / totalDuration) * 100 : 0;
            return (
              <Tooltip key={segment.id}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      config.color, 'transition-all cursor-pointer relative',
                      selectedId === segment.id && 'brightness-125 ring-1 ring-white ring-inset',
                    )}
                    style={{ width: `${widthPercent}%`, minWidth: '4px' }}
                    onClick={() => handleSelect(segment.id)}
                  >
                    {index < segments.length - 1 && (
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-background/40" />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  <div className="font-medium">
                    {config.label} #{getTypeNumber(index)}
                    {getNarrativeLabel(index) && <span className="ml-1 text-primary font-bold">({getNarrativeLabel(index)})</span>}
                  </div>
                  <div className="text-muted-foreground">{segment.duration}s — {getTimecode(index)}</div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {expanded && (
        <div className="w-full overflow-x-auto pb-2">
          <div className="flex gap-1.5 pt-2 pb-1 min-w-max">
            {segments.map((segment, index) => {
              const config = segmentConfig[segment.type] || segmentConfig.speaking;
              const Icon = config.icon;
              const isDragging = draggedIndex === index;
              const isDropTarget = dropTargetIndex === index;
              const isSelected = selectedId === segment.id;
              const thumb = getThumbnail(segment);
              const hasAudio = !!segment.audioUrl;
              const hasVideo = !!segment.videoUrl;
              const isPlaying = playingId === segment.id;
              const isRegen = regeneratingId === segment.id;

              return (
                <div
                  key={segment.id}
                  draggable={!!onReorder}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={() => setDropTargetIndex(null)}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={() => { setDraggedIndex(null); setDropTargetIndex(null); }}
                  onClick={() => handleSelect(segment.id)}
                  className={cn(
                    'relative rounded-lg border overflow-hidden cursor-pointer transition-all group flex-shrink-0',
                    'hover:ring-1 hover:ring-primary/40',
                    isDragging && 'opacity-40 scale-95',
                    isDropTarget && 'ring-2 ring-primary',
                    isSelected ? `ring-2 ${config.border} bg-accent/50` : 'bg-card',
                  )}
                  style={{ width: `${Math.max(segment.duration * 6, 80)}px` }}
                >
                  <div className="h-14 relative overflow-hidden bg-muted/50">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className={cn('w-full h-full flex items-center justify-center', config.color, 'bg-opacity-20')}>
                        <Icon className="h-5 w-5 text-muted-foreground/60" />
                      </div>
                    )}

                    {hasAudio && (
                      <button
                        onClick={(e) => togglePlay(segment, e)}
                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white" />}
                      </button>
                    )}
                    {isPlaying && (
                      <div className="absolute top-0.5 right-0.5">
                        <Volume2 className="h-3 w-3 text-white animate-pulse" />
                      </div>
                    )}
                    {isRegen && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <RefreshCw className="h-4 w-4 text-white animate-spin" />
                      </div>
                    )}

                    <div className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded font-mono">
                      {getTimecode(index)}
                    </div>
                    <div className={cn('absolute top-0.5 left-0.5 h-4 w-4 rounded-full flex items-center justify-center', config.color)}>
                      <Icon className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>

                  <div className="px-1.5 py-1 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-medium truncate leading-tight">
                        {segment.type === 'broll' ? `B-Roll #${getTypeNumber(index)}` : `Scene #${getTypeNumber(index)}`}
                      </span>
                      {getNarrativeLabel(index) && (
                        <Badge
                          variant={getNarrativeLabel(index) === 'HOOK' ? 'default' : 'secondary'}
                          className="text-[7px] h-3.5 px-1 py-0 shrink-0"
                        >
                          {getNarrativeLabel(index) === 'HOOK' ? '🎣 HOOK' : '🎬 CLOSING'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-muted-foreground">{segment.duration}s</span>
                      {hasAudio && <Volume2 className="h-2.5 w-2.5 text-muted-foreground/60" />}
                      {hasVideo && <Film className="h-2.5 w-2.5 text-primary/70" />}
                      {segment.voiceoverId && (
                        <span className="text-[8px] text-muted-foreground/50 truncate max-w-[50px]">{segment.voiceoverId.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                    {segment.script && (
                      <p className="text-[9px] text-muted-foreground/70 truncate leading-tight">{segment.script}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline editing panel for selected segment */}
      {selectedSeg && selectedIndex >= 0 && expanded && (
        <div className="border border-border/60 rounded-lg p-2.5 bg-card/80 space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">
              {selectedSeg.type === 'speaking' ? `Scene #${getTypeNumber(selectedIndex)}` : `B-Roll #${getTypeNumber(selectedIndex)}`}
              {getNarrativeLabel(selectedIndex) && <span className="ml-1 text-primary">({getNarrativeLabel(selectedIndex)})</span>}
            </span>
            <div className="flex items-center gap-1">
              {onDuplicateSegment && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDuplicateSegment(selectedSeg.id)} title="Duplicate">
                  <Copy className="h-3 w-3" />
                </Button>
              )}
              {onDeleteSegment && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => { onDeleteSegment(selectedSeg.id); setSelectedId(null); }} title="Delete">
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Script editing */}
          {selectedSeg.type === 'speaking' && (
            <div className="space-y-1.5">
              {editingScriptId === selectedSeg.id ? (
                <div className="space-y-1">
                  <Textarea
                    value={editScriptText}
                    onChange={(e) => setEditScriptText(e.target.value)}
                    className="text-xs min-h-[60px]"
                    rows={3}
                  />
                  <div className="flex gap-1">
                    <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => handleSaveScript(selectedSeg.id)}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setEditingScriptId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => { setEditingScriptId(selectedSeg.id); setEditScriptText(selectedSeg.script || ''); }}
                  title="Click to edit script"
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    <Pencil className="h-2.5 w-2.5" />
                    <span className="font-medium">Script</span>
                  </div>
                  {selectedSeg.script || <span className="italic">No script yet</span>}
                </div>
              )}

              {/* Voice selector */}
              <div className="flex items-center gap-1.5">
                <Mic className="h-3 w-3 text-muted-foreground" />
                <Select
                  value={lockedVoiceId || selectedSeg.voiceoverId || ''}
                  onValueChange={(v) => handleVoiceChange(selectedSeg.id, v)}
                >
                  <SelectTrigger className="h-6 text-[10px] flex-1">
                    <SelectValue placeholder="Select voice..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="text-[9px] font-medium text-muted-foreground px-2 py-1">Male Voices</div>
                    {WAVESPEED_VOICES.male.map(v => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">{v.label}</SelectItem>
                    ))}
                    <div className="text-[9px] font-medium text-muted-foreground px-2 py-1 mt-1">Female Voices</div>
                    {WAVESPEED_VOICES.female.map(v => (
                      <SelectItem key={v.id} value={v.id} className="text-xs">{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleRegenerateAudio(selectedSeg)}
                  disabled={!!regeneratingId || !selectedSeg.script}
                  title="Regenerate audio"
                >
                  <RefreshCw className={cn("h-3 w-3", regeneratingId === selectedSeg.id && "animate-spin")} />
                </Button>
                {selectedSeg.audioUrl && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={(e) => togglePlay(selectedSeg, e)}
                    title={playingId === selectedSeg.id ? 'Pause' : 'Play'}
                  >
                    {playingId === selectedSeg.id ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                )}
              </div>
              {isSingleCharacter && (
                <p className="text-[9px] text-muted-foreground/60 flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" /> Single character detected. Changing voice applies to all scenes.
                </p>
              )}
            </div>
          )}

          {/* B-roll voiceover editing */}
          {selectedSeg.type === 'broll' && selectedSeg.voiceoverText && (
            <div className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
              <span className="font-medium">Voiceover:</span> {selectedSeg.voiceoverText}
            </div>
          )}

          {/* Duration quick adjust */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Duration:</span>
            {[3, 5, 8, 10].map(d => (
              <Button
                key={d}
                variant={selectedSeg.duration === d ? 'default' : 'outline'}
                size="sm"
                className="h-5 px-2 text-[9px]"
                onClick={() => onUpdateSegment?.(selectedSeg.id, { duration: d })}
              >
                {d}s
              </Button>
            ))}
          </div>

          {/* Transition selector */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">Transition:</span>
            {(['fade-in', 'cut', 'crossfade'] as const).map(t => (
              <Button
                key={t}
                variant={selectedSeg.transition === t ? 'default' : 'outline'}
                size="sm"
                className="h-5 px-2 text-[9px]"
                onClick={() => onUpdateSegment?.(selectedSeg.id, { transition: t })}
              >
                {t}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Script Flow Dialog */}
      <Dialog open={showScriptFlow} onOpenChange={setShowScriptFlow}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Script Flow
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {segments.map((seg, i) => {
                const narrativeLabel = getNarrativeLabel(i);
                const typeNum = getTypeNumber(i);
                const timecode = getTimecode(i);
                const isSpeaking = seg.type === 'speaking';

                return (
                  <div key={seg.id} className={cn(
                    'rounded-lg border p-3 space-y-1',
                    isSpeaking ? 'border-primary/30 bg-primary/5' : 'border-amber-500/30 bg-amber-500/5'
                  )}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={isSpeaking ? 'default' : 'secondary'} className="text-[10px] h-5">
                          {isSpeaking ? `Scene #${typeNum}` : `B-Roll #${typeNum}`}
                        </Badge>
                        {narrativeLabel && (
                          <Badge variant="outline" className="text-[10px] h-5">
                            {narrativeLabel === 'HOOK' ? '🎣 HOOK' : '🎬 CLOSING'}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{timecode} — {seg.duration}s</span>
                    </div>

                    {isSpeaking && seg.script && (
                      <p className="text-sm leading-relaxed">{seg.script}</p>
                    )}
                    {!isSpeaking && seg.voiceoverText && (
                      <p className="text-sm leading-relaxed italic text-muted-foreground">
                        <span className="text-[10px] font-medium not-italic text-foreground">VO: </span>
                        {seg.voiceoverText}
                      </p>
                    )}
                    {!isSpeaking && !seg.voiceoverText && (
                      <p className="text-xs text-muted-foreground/50 italic">No voiceover — visual only</p>
                    )}

                    {seg.character?.name && (
                      <p className="text-[10px] text-muted-foreground">
                        🎭 {seg.character.name.slice(0, 40)}
                        {seg.voiceoverId && <span className="ml-2">🎙️ {seg.voiceoverId.replace(/_/g, ' ')}</span>}
                      </p>
                    )}

                    {i < segments.length - 1 && (
                      <div className="text-[9px] text-muted-foreground/40 text-center pt-1">
                        ↓ {seg.transition || 'cut'}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Total summary */}
              <div className="border-t pt-2 mt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{segments.length} segments — {speakingSegs.length} speaking, {segments.filter(s => s.type === 'broll').length} B-roll</span>
                  <span className="font-mono">{formatTime(totalDuration)} total</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  ~{segments.filter(s => s.script).reduce((sum, s) => sum + (s.script?.split(/\s+/).length || 0), 0)} words spoken
                </div>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
