import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Mic, Loader2, Volume2, Square, Sparkles, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/AuthProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  disabled?: boolean;
  compact?: boolean;
  characterDescription?: string;
  characterGender?: 'male' | 'female';
}

interface AITwinVoice {
  id: string;
  name: string;
  voice_cloning_key: string;
  first_image?: string;
  gender?: string;
  voice_engine?: string;
  google_voice_id?: string | null;
}

// Keep export for backward compatibility — returns empty since we no longer use preset voices
export const VOICE_LIST = { female: [], male: [] };

// Legacy export — now a no-op that returns null (AI Twin voices are used instead)
export async function generateVoiceForCharacter(
  _characterDescription: string,
  _gender: 'male' | 'female',
  _userId: string,
  _customLabel?: string
): Promise<{ voiceId: string; audioUrl: string | null } | null> {
  return null;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  selectedVoice,
  onVoiceSelect,
  disabled = false,
  compact = false,
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [twins, setTwins] = useState<AITwinVoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;
    loadTwinsWithVoice();
  }, [user]);

  const loadTwinsWithVoice = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_twins_summary', { _user_id: user.id });
      if (error) throw error;
      const withVoice = (data || [])
        .filter((t: any) => t.voice_cloning_key || t.voice_engine === 'wavespeed')
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          voice_cloning_key: t.voice_cloning_key || '',
          first_image: t.first_image,
          gender: t.gender,
          voice_engine: t.voice_engine || 'speechify',
          google_voice_id: t.google_voice_id,
        }));
      setTwins(withVoice);
    } catch (err) {
      console.error('Failed to load AI Twin voices:', err);
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

  const previewVoice = async (speechifyVoiceId: string) => {
    if (playingVoice === speechifyVoiceId) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    setPreviewingVoice(speechifyVoiceId);

    try {
      const sampleText = "Hello! This is a preview of how your voiceover will sound in the final video.";
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: sampleText, speechifyVoiceId }
      });
      if (error) throw error;

      const audioUrl = data?.audioUrl || data?.url;
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); audioRef.current = null; };
        audio.onerror = () => { setPlayingVoice(null); audioRef.current = null; };
        await audio.play();
        setPlayingVoice(speechifyVoiceId);
      } else if (data?.audioContent) {
        const dataUrl = `data:audio/mp3;base64,${data.audioContent}`;
        const audio = new Audio(dataUrl);
        audioRef.current = audio;
        audio.onended = () => { setPlayingVoice(null); audioRef.current = null; };
        await audio.play();
        setPlayingVoice(speechifyVoiceId);
      }
    } catch (error: any) {
      toast({ title: "Preview Failed", description: error.message, variant: "destructive" });
    } finally {
      setPreviewingVoice(null);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="w-5 h-5 text-primary" />
          AI Twin Voice
          <Badge variant="outline" className="ml-auto text-xs bg-primary/10 text-primary border-primary/30">
            <Sparkles className="w-3 h-3 mr-1" />
            Cloned Voices
          </Badge>
        </CardTitle>
        {!compact && (
          <CardDescription>
            {twins.length > 0
              ? <>Select a cloned voice from your AI Twins. Click <Volume2 className="inline h-3 w-3" /> to preview.</>
              : 'Clone a voice from the AI Twins page to use it here.'}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : twins.length === 0 ? (
          <div className="text-center py-6 space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No cloned voices available</p>
            <p className="text-xs text-muted-foreground">Go to <strong>AI Twins</strong> and clone a voice to use it in your videos.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {twins.map((twin) => {
              const isSelected = selectedVoice === twin.voice_cloning_key;
              const isPreviewing = previewingVoice === twin.voice_cloning_key;
              const isPlaying = playingVoice === twin.voice_cloning_key;

              return (
                <div
                  key={twin.id}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <button
                    onClick={() => onVoiceSelect(twin.voice_cloning_key)}
                    disabled={disabled}
                    className={`flex-1 text-left flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Avatar className="h-7 w-7">
                      {twin.first_image ? (
                        <AvatarImage src={twin.first_image} alt={twin.name} />
                      ) : null}
                      <AvatarFallback><User className="h-3.5 w-3.5" /></AvatarFallback>
                    </Avatar>
                    <div>
                      <span className={`font-medium text-sm ${isSelected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        {twin.name}'s Voice
                      </span>
                      <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 bg-primary/20 text-primary border-primary/30">
                        {twin.voice_engine === 'wavespeed' ? '🌊 WaveSpeed' : '🎙️ Cloned'}
                      </Badge>
                    </div>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 ${isPlaying ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={(e) => { e.stopPropagation(); previewVoice(twin.voice_cloning_key); }}
                    disabled={disabled || isPreviewing}
                  >
                    {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : isPlaying ? <Square className="h-3.5 w-3.5 fill-current" />
                      : <Volume2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
