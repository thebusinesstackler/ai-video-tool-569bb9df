import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, Volume2, Square, Sparkles, Copy, Check, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/components/AuthProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

interface SavedVoice {
  id: string;
  voice_id: string;
  voice_label: string;
  voice_description: string | null;
  gender: string | null;
  sample_audio_url: string | null;
  created_at: string;
}

// Available WaveSpeed voices for generating new ones
const AVAILABLE_VOICES = [
  { value: 'English_compelling_lady1', label: 'Compelling Lady', gender: 'female', desc: 'Professional & Confident' },
  { value: 'English_radiant_girl', label: 'Radiant Girl', gender: 'female', desc: 'Bright & Energetic' },
  { value: 'Calm_Woman', label: 'Calm Woman', gender: 'female', desc: 'Soothing & Relaxed' },
  { value: 'Inspirational_girl', label: 'Inspirational', gender: 'female', desc: 'Motivational & Warm' },
  { value: 'English_magnetic_voiced_man', label: 'Magnetic Man', gender: 'male', desc: 'Deep & Authoritative' },
  { value: 'English_Trustworth_Man', label: 'Trustworthy', gender: 'male', desc: 'Warm & Reliable' },
  { value: 'Casual_Guy', label: 'Casual Guy', gender: 'male', desc: 'Friendly & Natural' },
  { value: 'Deep_Voice_Man', label: 'Deep Voice', gender: 'male', desc: 'Rich & Cinematic' },
];

// Keep export for backward compatibility
export const VOICE_LIST = {
  female: AVAILABLE_VOICES.filter(v => v.gender === 'female').map(v => ({ ...v, tier: 'Pro', sample: '' })),
  male: AVAILABLE_VOICES.filter(v => v.gender === 'male').map(v => ({ ...v, tier: 'Pro', sample: '' })),
};

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onVoiceSelect,
  disabled = false,
  compact = false,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [copiedVoiceId, setCopiedVoiceId] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateVoiceId, setGenerateVoiceId] = useState('');
  const [generateLabel, setGenerateLabel] = useState('');
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load saved voices
  useEffect(() => {
    if (!user) return;
    loadSavedVoices();
  }, [user]);

  const loadSavedVoices = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('saved_voices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavedVoices((data as any[]) || []);
    } catch (err) {
      console.error('Failed to load saved voices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingVoice(null);
  };

  const copyVoiceId = (voiceId: string) => {
    navigator.clipboard.writeText(voiceId);
    setCopiedVoiceId(true);
    toast({ title: "Voice ID Copied", description: `${voiceId} copied to clipboard` });
    setTimeout(() => setCopiedVoiceId(false), 2000);
  };

  const previewVoice = async (voiceId: string) => {
    if (playingVoice === voiceId) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    setPreviewingVoice(voiceId);

    try {
      const sampleText = "Hello! This is a preview of how your voiceover will sound in the final video.";
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: sampleText, voice: voiceId }
      });
      if (error) throw error;

      const audioUrl = data?.audioUrl || data?.url;
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); audioRef.current = null; };
        audio.onerror = () => { setPlayingVoice(null); audioRef.current = null; };
        await audio.play();
        setPlayingVoice(voiceId);

        // Update sample_audio_url in saved voice
        const sv = savedVoices.find(v => v.voice_id === voiceId);
        if (sv && !sv.sample_audio_url) {
          await supabase.from('saved_voices').update({ sample_audio_url: audioUrl } as any).eq('id', sv.id);
        }
      } else if (data?.audioContent) {
        const dataUrl = `data:audio/mp3;base64,${data.audioContent}`;
        const audio = new Audio(dataUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); audioRef.current = null; };
        await audio.play();
        setPlayingVoice(voiceId);
      }
    } catch (error: any) {
      toast({ title: "Preview Failed", description: error.message, variant: "destructive" });
    } finally {
      setPreviewingVoice(null);
    }
  };

  const generateAndSaveVoice = async () => {
    if (!user || !generateVoiceId) return;
    const voiceInfo = AVAILABLE_VOICES.find(v => v.value === generateVoiceId);
    if (!voiceInfo) return;

    setIsGeneratingNew(true);
    try {
      // Generate a preview
      const sampleText = "Hello! This is a preview of how your voiceover will sound in the final video.";
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: sampleText, voice: generateVoiceId }
      });
      if (error) throw error;

      const audioUrl = data?.audioUrl || data?.url || null;
      const label = generateLabel.trim() || voiceInfo.label;

      // Save to database
      const { error: insertError } = await supabase.from('saved_voices').insert({
        user_id: user.id,
        voice_id: generateVoiceId,
        voice_label: label,
        voice_description: voiceInfo.desc,
        gender: voiceInfo.gender,
        sample_audio_url: audioUrl,
      } as any);

      if (insertError) {
        if (insertError.message?.includes('duplicate')) {
          toast({ title: "Already Saved", description: "This voice is already in your collection." });
        } else {
          throw insertError;
        }
      } else {
        toast({ title: "Voice Saved! ✨", description: `${label} added to your voice collection.` });
        await loadSavedVoices();
        onVoiceSelect(generateVoiceId);
      }

      // Play the preview
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); audioRef.current = null; };
        await audio.play();
        setPlayingVoice(generateVoiceId);
      }

      setShowGenerateDialog(false);
      setGenerateVoiceId('');
      setGenerateLabel('');
    } catch (err: any) {
      toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsGeneratingNew(false);
    }
  };

  const deleteVoice = async (id: string) => {
    try {
      const { error } = await supabase.from('saved_voices').delete().eq('id', id);
      if (error) throw error;
      setSavedVoices(prev => prev.filter(v => v.id !== id));
      toast({ title: "Voice Removed" });
    } catch (err: any) {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  };

  const femaleVoices = savedVoices.filter(v => v.gender === 'female');
  const maleVoices = savedVoices.filter(v => v.gender === 'male');
  const otherVoices = savedVoices.filter(v => v.gender !== 'female' && v.gender !== 'male');

  const renderVoiceItem = (voice: SavedVoice) => {
    const isSelected = selectedVoice === voice.voice_id;
    const isPreviewing = previewingVoice === voice.voice_id;
    const isPlaying = playingVoice === voice.voice_id;

    return (
      <div
        key={voice.id}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
          isSelected 
            ? 'border-primary bg-primary/10 shadow-sm' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }`}
      >
        <button
          onClick={() => onVoiceSelect(voice.voice_id)}
          disabled={disabled}
          className={`flex-1 text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`font-medium text-sm ${isSelected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {voice.voice_label}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
              {voice.gender === 'female' ? '♀' : voice.gender === 'male' ? '♂' : '🎙️'}
            </Badge>
          </div>
          {voice.voice_description && (
            <div className="text-xs text-muted-foreground">{voice.voice_description}</div>
          )}
        </button>
        
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${isPlaying ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={(e) => { e.stopPropagation(); previewVoice(voice.voice_id); }}
            disabled={disabled || isPreviewing}
          >
            {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> 
              : isPlaying ? <Square className="h-3.5 w-3.5 fill-current" /> 
              : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); deleteVoice(voice.id); }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  };

  const renderVoiceGroup = (label: string, voices: SavedVoice[]) => {
    if (voices.length === 0) return null;
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</Label>
        <div className="space-y-1.5">
          {voices.map(renderVoiceItem)}
        </div>
      </div>
    );
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="w-5 h-5 text-primary" />
          Narrator Voice
          <Badge variant="outline" className="ml-auto text-xs bg-primary/10 text-primary border-primary/30">
            <Sparkles className="w-3 h-3 mr-1" />
            My Voices
          </Badge>
        </CardTitle>
        {!compact && (
          <CardDescription>
            {savedVoices.length > 0 
              ? <>Select from your generated voices. Click <Volume2 className="inline h-3 w-3" /> to preview.</>
              : 'Generate a voice to get started.'}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : savedVoices.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <Mic className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No voices generated yet</p>
            <p className="text-xs text-muted-foreground">Generate a voice to hear and save it to your collection</p>
          </div>
        ) : (
          <div className="space-y-4">
            {femaleVoices.length > 0 && maleVoices.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {renderVoiceGroup('Female Voices', femaleVoices)}
                {renderVoiceGroup('Male Voices', maleVoices)}
              </div>
            ) : (
              <>
                {renderVoiceGroup('Female Voices', femaleVoices)}
                {renderVoiceGroup('Male Voices', maleVoices)}
              </>
            )}
            {renderVoiceGroup('Other Voices', otherVoices)}
          </div>
        )}

        {/* Generate New Voice Button */}
        <Button
          variant="outline"
          className="w-full border-dashed border-primary/40 text-primary hover:bg-primary/5"
          onClick={() => setShowGenerateDialog(true)}
          disabled={disabled}
        >
          <Plus className="w-4 h-4 mr-2" />
          Generate New Voice
        </Button>

        {/* Selected voice ID */}
        {selectedVoice && selectedVoice !== 'ai-auto' && (
          <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg border border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">Selected Voice ID</p>
              <p className="text-xs font-mono truncate">{selectedVoice}</p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px] shrink-0" onClick={() => copyVoiceId(selectedVoice)}>
                    {copiedVoiceId ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    {copiedVoiceId ? 'Copied!' : 'Copy ID'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy voice ID to reuse this exact voice later</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </CardContent>

      {/* Generate Voice Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              Generate & Save Voice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm">Choose a voice to generate</Label>
              <Select value={generateVoiceId} onValueChange={(v) => {
                setGenerateVoiceId(v);
                const info = AVAILABLE_VOICES.find(av => av.value === v);
                if (info) setGenerateLabel(info.label);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a voice..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="header-female" disabled className="font-semibold text-xs text-muted-foreground">— Female —</SelectItem>
                  {AVAILABLE_VOICES.filter(v => v.gender === 'female').map(v => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label} — {v.desc}
                    </SelectItem>
                  ))}
                  <SelectItem value="header-male" disabled className="font-semibold text-xs text-muted-foreground">— Male —</SelectItem>
                  {AVAILABLE_VOICES.filter(v => v.gender === 'male').map(v => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label} — {v.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Custom Label (optional)</Label>
              <Input
                value={generateLabel}
                onChange={(e) => setGenerateLabel(e.target.value)}
                placeholder="E.g., My Brand Voice"
              />
            </div>

            <Button
              className="w-full"
              onClick={generateAndSaveVoice}
              disabled={!generateVoiceId || isGeneratingNew}
            >
              {isGeneratingNew ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating & Saving...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" />Generate & Save Voice</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
