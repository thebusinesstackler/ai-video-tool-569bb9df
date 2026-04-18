import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Volume2, VolumeX, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Marco's locked Speechify voice — warm male director voice
const MARCO_VOICE_ID = 'henry';

interface Props {
  /** Called when user finishes speaking — returns transcript so parent can route to Marco */
  onUserSpoke: (transcript: string) => Promise<string | void>;
  /** Marco's most recent reply (parent passes this in so we know what to speak aloud) */
  latestMarcoReply?: string;
  /** When true, auto-speak each new latestMarcoReply via Speechify */
  autoSpeak?: boolean;
  onClose?: () => void;
}

// Type-safe wrapper for browser Speech Recognition
type AnySpeechRecognition = any;

export const MarcoVoiceChat = ({ onUserSpoke, latestMarcoReply, autoSpeak = true, onClose }: Props) => {
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [partial, setPartial] = useState('');
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<AnySpeechRecognition>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenRef = useRef<string>('');

  // Init speech recognition
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec: AnySpeechRecognition = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += txt;
        else interim += txt;
      }
      setPartial(interim || final);
      if (final.trim()) {
        setIsListening(false);
        setPartial('');
        rec.stop();
        onUserSpoke(final.trim());
      }
    };
    rec.onerror = (e: any) => {
      console.warn('SpeechRecognition error:', e.error);
      setIsListening(false);
      setPartial('');
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        toast({ title: 'Microphone blocked', description: 'Allow microphone access to talk to Marco.', variant: 'destructive' });
      }
    };
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    return () => { try { rec.stop(); } catch {} };
  }, [onUserSpoke, toast]);

  // Speak Marco's reply via Speechify whenever it changes
  useEffect(() => {
    if (!latestMarcoReply || muted) return;
    if (latestMarcoReply === lastSpokenRef.current) return;
    if (!autoSpeak) return;
    lastSpokenRef.current = latestMarcoReply;
    speak(latestMarcoReply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestMarcoReply, muted, autoSpeak]);

  const speak = useCallback(async (text: string) => {
    // Strip markdown for cleaner TTS
    const clean = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*_#`>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1500);
    if (!clean) return;

    try {
      setIsSpeaking(true);
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: clean, speechifyVoiceId: MARCO_VOICE_ID, voice: 'henry', speed: 1 },
      });
      if (error) throw error;
      const audioB64 = data?.audioContent || data?.audio;
      if (!audioB64) throw new Error('No audio returned');

      const audioUrl = `data:audio/mp3;base64,${audioB64}`;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsSpeaking(false);
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch (err) {
      console.warn('Speechify TTS failed:', err);
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);
  };

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }
    // Stop any speaking before listening so Marco doesn't talk over the user
    stopSpeaking();
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.warn('Recognition start failed', e);
    }
  };

  return (
    <div className="rounded-2xl border-2 border-orange-500/40 bg-gradient-to-br from-orange-500/5 to-amber-500/5 p-3 flex items-center gap-2 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">🎙️ Voice chat with Marco</span>
          {isSpeaking && <span className="text-[10px] text-muted-foreground animate-pulse">speaking…</span>}
          {isListening && <span className="text-[10px] text-red-500 animate-pulse">listening…</span>}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {!supported
            ? 'Voice not supported in this browser — try Chrome/Edge.'
            : partial
              ? `"${partial}"`
              : isListening
                ? 'Speak your feedback…'
                : 'Tap the mic and tell Marco what to change.'}
        </p>
      </div>

      <Button
        size="icon"
        variant={muted ? 'outline' : 'ghost'}
        className="h-8 w-8 rounded-full flex-shrink-0"
        onClick={() => { setMuted((m) => !m); if (!muted) stopSpeaking(); }}
        title={muted ? 'Unmute Marco' : 'Mute Marco'}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </Button>

      <Button
        size="icon"
        className={`h-9 w-9 rounded-full flex-shrink-0 ${isListening ? 'bg-red-500 hover:bg-red-600' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'} text-white`}
        onClick={toggleListen}
        disabled={!supported}
        title={isListening ? 'Stop' : 'Hold-to-talk'}
      >
        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>

      {onClose && (
        <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full flex-shrink-0" onClick={onClose} title="Close voice chat">
          <X className="w-3.5 h-3.5" />
        </Button>
      )}

      {isSpeaking && !muted && (
        <Button size="icon" variant="outline" className="h-7 w-7 rounded-full flex-shrink-0" onClick={stopSpeaking} title="Stop Marco">
          {isSpeaking && <Loader2 className="w-3 h-3 animate-spin" />}
        </Button>
      )}
    </div>
  );
};
