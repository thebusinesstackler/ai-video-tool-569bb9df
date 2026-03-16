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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  disabled?: boolean;
  compact?: boolean;
  characterDescription?: string;
  characterGender?: 'male' | 'female';
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

// WaveSpeed MiniMax voice IDs mapped by gender for matching
const GENDER_VOICE_POOLS = {
  female: [
    { value: 'English_compelling_lady1', label: 'Compelling Lady', desc: 'Professional & Confident' },
    { value: 'English_radiant_girl', label: 'Radiant Girl', desc: 'Bright & Energetic' },
    { value: 'Calm_Woman', label: 'Calm Woman', desc: 'Soothing & Relaxed' },
    { value: 'Inspirational_girl', label: 'Inspirational', desc: 'Motivational & Warm' },
    { value: 'Lovely_Girl', label: 'Lovely Girl', desc: 'Sweet & Cheerful' },
    { value: 'Lively_Girl', label: 'Lively Girl', desc: 'Upbeat & Dynamic' },
    { value: 'Wise_Woman', label: 'Wise Woman', desc: 'Mature & Thoughtful' },
  ],
  male: [
    { value: 'English_magnetic_voiced_man', label: 'Magnetic Man', desc: 'Deep & Authoritative' },
    { value: 'English_Trustworth_Man', label: 'Trustworthy', desc: 'Warm & Reliable' },
    { value: 'Casual_Guy', label: 'Casual Guy', desc: 'Friendly & Natural' },
    { value: 'Deep_Voice_Man', label: 'Deep Voice', desc: 'Rich & Cinematic' },
    { value: 'English_expressive_narrator', label: 'Expressive Narrator', desc: 'Dramatic & Storytelling' },
    { value: 'English_Aussie_Bloke', label: 'Aussie Bloke', desc: 'Casual Australian' },
    { value: 'Elegant_Man', label: 'Elegant Man', desc: 'Refined & Polished' },
    { value: 'Determined_Man', label: 'Determined Man', desc: 'Strong & Driven' },
    { value: 'Patient_Man', label: 'Patient Man', desc: 'Calm & Measured' },
    { value: 'Decent_Boy', label: 'Decent Boy', desc: 'Young & Approachable' },
  ],
};

// Keep export for backward compatibility
export const VOICE_LIST = {
  female: GENDER_VOICE_POOLS.female.map(v => ({ ...v, gender: 'female', tier: 'Pro', sample: '' })),
  male: GENDER_VOICE_POOLS.male.map(v => ({ ...v, gender: 'male', tier: 'Pro', sample: '' })),
};

// Pick the best voice ID for a character description
function pickVoiceForCharacter(description: string, gender: 'male' | 'female'): { value: string; label: string; desc: string } {
  const pool = GENDER_VOICE_POOLS[gender];
  const descLower = description.toLowerCase();
  
  if (gender === 'female') {
    if (descLower.match(/calm|gentle|soft|soothing|meditat/)) return pool[2]; // Calm_Woman
    if (descLower.match(/inspir|motivat|uplift|coach/)) return pool[3]; // Inspirational_girl
    if (descLower.match(/young|teen|bright|energ|fun|playful/)) return pool[1]; // Radiant Girl
    return pool[0]; // Compelling Lady (default female)
  } else {
    if (descLower.match(/deep|cinematic|dramatic|narrator|epic/)) return pool[3]; // Deep_Voice_Man
    if (descLower.match(/casual|friend|chill|relax|fun/)) return pool[2]; // Casual_Guy
    if (descLower.match(/trust|warm|reliable|professional|business/)) return pool[1]; // Trustworthy
    return pool[0]; // Magnetic Man (default male)
  }
}

// Generate and save a voice for a character — exported for use in Reels.tsx
export async function generateVoiceForCharacter(
  characterDescription: string,
  gender: 'male' | 'female',
  userId: string,
  customLabel?: string
): Promise<{ voiceId: string; audioUrl: string | null } | null> {
  const voiceInfo = pickVoiceForCharacter(characterDescription, gender);
  
  const sampleText = characterDescription.length > 20
    ? `Hello! I'm your narrator. ${characterDescription.substring(0, 100)}. Let me tell you something amazing.`
    : "Hello! This is a preview of how your voiceover will sound in the final video. I'm ready to narrate your story.";

  try {
    const { data, error } = await supabase.functions.invoke('text-to-speech', {
      body: { text: sampleText.slice(0, 250), voice: voiceInfo.value }
    });
    if (error) throw error;

    const audioUrl = data?.audioUrl || data?.url || null;
    const label = customLabel || `${voiceInfo.label} — ${characterDescription.substring(0, 30)}`;

    // Save to database (upsert-style: ignore duplicate)
    const { error: insertError } = await supabase.from('saved_voices').insert({
      user_id: userId,
      voice_id: voiceInfo.value,
      voice_label: label,
      voice_description: voiceInfo.desc,
      gender,
      sample_audio_url: audioUrl,
    } as any);

    // If duplicate, that's fine — voice already saved
    if (insertError && !insertError.message?.includes('duplicate')) {
      console.error('Failed to save voice:', insertError);
    }

    return { voiceId: voiceInfo.value, audioUrl };
  } catch (err) {
    console.error('Voice generation failed:', err);
    return null;
  }
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onVoiceSelect,
  disabled = false,
  compact = false,
  characterDescription: charDescProp,
  characterGender: charGenderProp,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [savedVoices, setSavedVoices] = useState<SavedVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [copiedVoiceId, setCopiedVoiceId] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generateDescription, setGenerateDescription] = useState(charDescProp || '');
  const [generateGender, setGenerateGender] = useState<'male' | 'female'>(charGenderProp || 'male');

  // Auto-fill when character context changes or dialog opens
  useEffect(() => {
    if (charDescProp && !showGenerateDialog) {
      setGenerateDescription(charDescProp);
    }
    if (charGenderProp) {
      setGenerateGender(charGenderProp);
    }
  }, [charDescProp, charGenderProp]);
  const [generateLabel, setGenerateLabel] = useState('');
  const [isGeneratingNew, setIsGeneratingNew] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const handleGenerateVoice = async () => {
    if (!user) return;
    setIsGeneratingNew(true);
    
    try {
      const result = await generateVoiceForCharacter(
        generateDescription,
        generateGender,
        user.id,
        generateLabel.trim() || undefined
      );

      if (!result) throw new Error('Voice generation failed');

      toast({ title: "Voice Generated! ✨", description: "Your new voice has been saved and selected." });
      await loadSavedVoices();
      onVoiceSelect(result.voiceId);

      // Play preview
      if (result.audioUrl) {
        stopCurrentAudio();
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); audioRef.current = null; };
        await audio.play();
        setPlayingVoice(result.voiceId);
      }

      setShowGenerateDialog(false);
      setGenerateDescription('');
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
          Character Voice
          <Badge variant="outline" className="ml-auto text-xs bg-primary/10 text-primary border-primary/30">
            <Sparkles className="w-3 h-3 mr-1" />
            My Voices
          </Badge>
        </CardTitle>
        {!compact && (
          <CardDescription>
            {savedVoices.length > 0 
              ? <>Select from your generated voices. Click <Volume2 className="inline h-3 w-3" /> to preview.</>
              : 'Generate a voice matched to your character.'}
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
            <p className="text-xs text-muted-foreground">Generate a voice matched to your character's personality</p>
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
          Generate Voice for Character
        </Button>

        {/* Selected voice ID */}
        {selectedVoice && (
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
              Generate Voice for Character
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm">Describe your character</Label>
              <Textarea
                value={generateDescription}
                onChange={(e) => setGenerateDescription(e.target.value)}
                placeholder="E.g., A confident 30-year-old female business coach with a warm, inspiring tone..."
                className="min-h-[80px] resize-none"
              />
              <p className="text-[10px] text-muted-foreground">We'll match the best voice to your character's personality and tone</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Gender</Label>
                <Select value={generateGender} onValueChange={(v) => setGenerateGender(v as 'male' | 'female')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">♀ Female</SelectItem>
                    <SelectItem value="male">♂ Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Label (optional)</Label>
                <Input
                  value={generateLabel}
                  onChange={(e) => setGenerateLabel(e.target.value)}
                  placeholder="My Brand Voice"
                />
              </div>
            </div>

            {/* Preview of matched voice */}
            {generateDescription.length > 5 && (
              <div className="p-2.5 bg-muted/50 rounded-lg border border-border/50">
                <p className="text-[10px] text-muted-foreground mb-1">AI will match:</p>
                <p className="text-sm font-medium text-foreground">
                  {pickVoiceForCharacter(generateDescription, generateGender).label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pickVoiceForCharacter(generateDescription, generateGender).desc}
                </p>
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleGenerateVoice}
              disabled={isGeneratingNew || generateDescription.length < 3}
            >
              {isGeneratingNew ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Voice...</>
              ) : (
                <><Mic className="w-4 h-4 mr-2" />Generate & Preview Voice</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
