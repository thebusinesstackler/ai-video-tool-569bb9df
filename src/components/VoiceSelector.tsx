import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, Volume2, Square, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  disabled?: boolean;
}

// Google Cloud TTS Neural2/Journey/Studio voices
const VOICE_OPTIONS = {
  female: [
    { 
      value: 'en-US-Journey-F', 
      label: 'Journey F', 
      desc: 'Warm & Conversational', 
      tier: 'Journey',
      sample: 'Hello! I\'m Journey, a warm and conversational voice designed to sound natural and engaging.' 
    },
    { 
      value: 'en-US-Neural2-F', 
      label: 'Neural2 F', 
      desc: 'Expressive & Clear', 
      tier: 'Neural2',
      sample: 'Hi there! I\'m Neural2, an expressive and clear voice perfect for professional content.' 
    },
    { 
      value: 'en-US-Studio-O', 
      label: 'Studio O', 
      desc: 'Professional Broadcast', 
      tier: 'Studio',
      sample: 'Good day! I\'m Studio O, a professional broadcast-quality voice for premium productions.' 
    },
    { 
      value: 'en-GB-Neural2-F', 
      label: 'British F', 
      desc: 'British Accent', 
      tier: 'Neural2',
      sample: 'Hello! I\'m a British Neural2 voice, bringing an elegant accent to your narration.' 
    },
  ],
  male: [
    { 
      value: 'en-US-Journey-D', 
      label: 'Journey D', 
      desc: 'Natural & Friendly', 
      tier: 'Journey',
      sample: 'Hey there! I\'m Journey D, designed to sound natural and friendly in every conversation.' 
    },
    { 
      value: 'en-US-Neural2-D', 
      label: 'Neural2 D', 
      desc: 'Authoritative & Clear', 
      tier: 'Neural2',
      sample: 'Greetings. I\'m Neural2 D, an authoritative and clear voice for impactful content.' 
    },
    { 
      value: 'en-US-Studio-Q', 
      label: 'Studio Q', 
      desc: 'Deep & Professional', 
      tier: 'Studio',
      sample: 'Hello! I\'m Studio Q, offering a deep and professional tone for your projects.' 
    },
    { 
      value: 'en-GB-Neural2-D', 
      label: 'British D', 
      desc: 'British Accent', 
      tier: 'Neural2',
      sample: 'Good day! I\'m a British Neural2 voice, perfect for distinguished narration.' 
    },
  ],
};

const tierColors: Record<string, string> = {
  'Journey': 'bg-primary/20 text-primary border-primary/30',
  'Neural2': 'bg-secondary text-secondary-foreground border-secondary',
  'Studio': 'bg-accent text-accent-foreground border-accent',
};

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onVoiceSelect,
  disabled = false,
}) => {
  const { toast } = useToast();
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPlayingVoice(null);
  };

  const previewVoice = async (voiceValue: string, sampleText: string) => {
    // If already playing this voice, stop it
    if (playingVoice === voiceValue) {
      stopCurrentAudio();
      return;
    }

    // Stop any currently playing audio
    stopCurrentAudio();

    setPreviewingVoice(voiceValue);

    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: sampleText, voice: voiceValue }
      });

      if (error) throw error;

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
            <span className={`font-medium text-sm ${isSelected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {voice.label}
            </span>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tierColors[voice.tier]}`}>
              {voice.tier}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">{voice.desc}</div>
        </button>
        
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
            Google Cloud TTS
          </Badge>
        </CardTitle>
        <CardDescription>
          Choose a natural-sounding voice. Click <Volume2 className="inline h-3 w-3" /> to preview.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
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
      </CardContent>
    </Card>
  );
};
