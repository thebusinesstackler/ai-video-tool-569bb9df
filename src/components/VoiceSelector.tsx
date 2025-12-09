import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mic, Play, Square, Loader2, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  disabled?: boolean;
}

const VOICE_OPTIONS = {
  female: [
    { value: 'nova', label: 'Nova', desc: 'Warm & Friendly', sample: 'Hello! I\'m Nova, a warm and friendly voice perfect for engaging content.' },
    { value: 'shimmer', label: 'Shimmer', desc: 'Expressive & Clear', sample: 'Hi there! I\'m Shimmer, expressive and clear for dynamic storytelling.' },
    { value: 'fable', label: 'Fable', desc: 'British Accent', sample: 'Good day! I\'m Fable, bringing a lovely British accent to your narration.' },
  ],
  male: [
    { value: 'onyx', label: 'Onyx', desc: 'Deep & Authoritative', sample: 'Greetings. I\'m Onyx, a deep and authoritative voice for impactful content.' },
    { value: 'echo', label: 'Echo', desc: 'Clear & Neutral', sample: 'Hello! I\'m Echo, offering a clear and neutral tone for versatile use.' },
    { value: 'alloy', label: 'Alloy', desc: 'Balanced & Versatile', sample: 'Hey there! I\'m Alloy, balanced and versatile for any project.' },
  ],
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

  const renderVoiceButton = (voice: { value: string; label: string; desc: string; sample: string }) => {
    const isSelected = selectedVoice === voice.value;
    const isPreviewing = previewingVoice === voice.value;
    const isPlaying = playingVoice === voice.value;

    return (
      <div
        key={voice.value}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
          isSelected 
            ? 'border-primary bg-primary/10' 
            : 'border-border hover:border-primary/50'
        }`}
      >
        <button
          onClick={() => onVoiceSelect(voice.value)}
          disabled={disabled}
          className={`flex-1 text-left ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <div className={`font-medium text-sm ${isSelected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {voice.label}
          </div>
          <div className="text-xs opacity-70">{voice.desc}</div>
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
        </CardTitle>
        <CardDescription>
          Choose a voice that matches your character. Click <Volume2 className="inline h-3 w-3" /> to preview.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-2 gap-3">
          {/* Female Voices */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Female Voices</Label>
            <div className="space-y-1">
              {VOICE_OPTIONS.female.map(renderVoiceButton)}
            </div>
          </div>
          
          {/* Male Voices */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Male Voices</Label>
            <div className="space-y-1">
              {VOICE_OPTIONS.male.map(renderVoiceButton)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
