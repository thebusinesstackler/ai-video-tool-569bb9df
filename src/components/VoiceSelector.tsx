import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, Volume2, Square, Sparkles, Wand2, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

// WaveSpeed MiniMax Speech-02-HD voices - high quality
const VOICE_OPTIONS = {
  female: [
    { 
      value: 'English_compelling_lady1', 
      label: 'Compelling Lady', 
      desc: 'Professional & Confident', 
      tier: 'Pro',
      sample: 'Hello! I bring a compelling and confident energy to your content, perfect for professional voiceovers.' 
    },
    { 
      value: 'English_radiant_girl', 
      label: 'Radiant Girl', 
      desc: 'Bright & Energetic', 
      tier: 'Pro',
      sample: 'Hey there! I have a bright and energetic voice that brings your content to life with enthusiasm.' 
    },
    { 
      value: 'Calm_Woman', 
      label: 'Calm Woman', 
      desc: 'Soothing & Relaxed', 
      tier: 'HD',
      sample: 'Hi, I offer a calm and soothing voice perfect for storytelling, meditation, and relaxed content.' 
    },
    { 
      value: 'Inspirational_girl', 
      label: 'Inspirational', 
      desc: 'Motivational & Warm', 
      tier: 'HD',
      sample: 'Hello! My voice is warm and motivational, designed to inspire and uplift your audience.' 
    },
  ],
  male: [
    { 
      value: 'English_magnetic_voiced_man', 
      label: 'Magnetic Man', 
      desc: 'Deep & Authoritative', 
      tier: 'Pro',
      sample: 'Greetings. I bring a deep, magnetic quality to your narration with authority and presence.' 
    },
    { 
      value: 'English_Trustworth_Man', 
      label: 'Trustworthy', 
      desc: 'Warm & Reliable', 
      tier: 'Pro',
      sample: 'Hey there! I have a warm, trustworthy voice perfect for building connection with your audience.' 
    },
    { 
      value: 'Casual_Guy', 
      label: 'Casual Guy', 
      desc: 'Friendly & Natural', 
      tier: 'HD',
      sample: 'What\'s up! I have a casual, friendly tone that feels natural and conversational.' 
    },
    { 
      value: 'Deep_Voice_Man', 
      label: 'Deep Voice', 
      desc: 'Rich & Cinematic', 
      tier: 'HD',
      sample: 'Hello. My voice carries a rich, cinematic depth ideal for dramatic narration and premium content.' 
    },
  ],
};

// AI auto-select option
const AI_AUTO_VOICE = {
  value: 'ai-auto',
  label: 'AI Auto-Select',
  desc: 'AI picks the perfect voice for your content',
  tier: 'AI',
  sample: ''
};

export const VOICE_LIST = VOICE_OPTIONS;

const tierColors: Record<string, string> = {
  'Pro': 'bg-primary/20 text-primary border-primary/30',
  'HD': 'bg-secondary text-secondary-foreground border-secondary',
  'AI': 'bg-accent text-accent-foreground border-accent',
};

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onVoiceSelect,
  disabled = false,
  compact = false,
}) => {
  const { toast } = useToast();
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [lastUsedVoiceId, setLastUsedVoiceId] = useState<string | null>(null);
  const [copiedVoiceId, setCopiedVoiceId] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingVoice(null);
  };

  const copyVoiceId = () => {
    if (lastUsedVoiceId) {
      navigator.clipboard.writeText(lastUsedVoiceId);
      setCopiedVoiceId(true);
      toast({ title: "Voice ID Copied", description: `${lastUsedVoiceId} copied to clipboard` });
      setTimeout(() => setCopiedVoiceId(false), 2000);
    }
  };

  const previewVoice = async (voiceValue: string, sampleText: string) => {
    if (voiceValue === 'ai-auto') return;
    
    if (playingVoice === voiceValue) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    setPreviewingVoice(voiceValue);

    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: sampleText, voice: voiceValue }
      });

      if (error) throw error;

      // Capture the voice ID used by the API
      if (data?.voiceUsed) {
        setLastUsedVoiceId(data.voiceUsed);
      } else {
        setLastUsedVoiceId(voiceValue);
      }

      if (data?.audioContent) {
        const audioUrl = `data:audio/mp3;base64,${data.audioContent}`;
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setPlayingVoice(null);
          audioRef.current = null;
        };
        
        audio.onerror = () => {
          setPlayingVoice(null);
          audioRef.current = null;
          toast({
            title: "Playback Error",
            description: "Failed to play voice sample.",
            variant: "destructive"
          });
        };

        await audio.play();
        setPlayingVoice(voiceValue);
      }
    } catch (error: any) {
      console.error('Voice preview error:', error);
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to generate voice preview.",
        variant: "destructive"
      });
    } finally {
      setPreviewingVoice(null);
    }
  };

  const renderVoiceButton = (voice: { value: string; label: string; desc: string; tier: string; sample: string }) => {
    const isSelected = selectedVoice === voice.value;
    const isPreviewing = previewingVoice === voice.value;
    const isPlaying = playingVoice === voice.value;
    const isAiAuto = voice.value === 'ai-auto';

    return (
      <div
        key={voice.value}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
          isSelected 
            ? 'border-primary bg-primary/10 shadow-sm' 
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }`}
      >
        <button
          onClick={() => onVoiceSelect(voice.value)}
          disabled={disabled}
          className={`flex-1 text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className="flex items-center gap-2 mb-0.5">
            {isAiAuto && <Wand2 className="w-3.5 h-3.5 text-primary" />}
            <span className={`font-medium text-sm ${isSelected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {voice.label}
            </span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tierColors[voice.tier]}`}>
              {voice.tier}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{voice.desc}</div>
        </button>
        
        {!isAiAuto && (
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 shrink-0 ${isPlaying ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={(e) => {
              e.stopPropagation();
              previewVoice(voice.value, voice.sample);
            }}
            disabled={disabled || isPreviewing}
          >
            {isPreviewing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
        )}
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
            HD Voices
          </Badge>
        </CardTitle>
        {!compact && (
          <CardDescription>
            Choose a natural-sounding voice. Click <Volume2 className="inline h-3 w-3" /> to preview.
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* AI Auto option */}
        <div className="space-y-1.5">
          {renderVoiceButton(AI_AUTO_VOICE)}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Female Voices */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Female Voices</Label>
            <div className="space-y-1.5">
              {VOICE_OPTIONS.female.map(renderVoiceButton)}
            </div>
          </div>
          
          {/* Male Voices */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Male Voices</Label>
            <div className="space-y-1.5">
              {VOICE_OPTIONS.male.map(renderVoiceButton)}
            </div>
          </div>
        </div>

        {/* Voice ID Copy Section */}
        {lastUsedVoiceId && (
          <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg border border-border/50 mt-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">Voice ID (for reuse)</p>
              <p className="text-xs font-mono truncate">{lastUsedVoiceId}</p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 gap-1 text-[10px] shrink-0" onClick={copyVoiceId}>
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
    </Card>
  );
};
