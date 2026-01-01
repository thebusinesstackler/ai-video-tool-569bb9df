import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  MessageSquare, 
  Loader2, 
  Play, 
  Pause, 
  Download, 
  Sparkles,
  ChevronDown,
  Volume2,
  AlertCircle,
  Mic,
  MicOff
} from 'lucide-react';

interface TwinSpeakerProps {
  twinName: string;
  speechifyVoiceId: string | null;
}

export const TwinSpeaker: React.FC<TwinSpeakerProps> = ({ 
  twinName, 
  speechifyVoiceId
}) => {
  const hasClonedVoice = !!speechifyVoiceId;
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isOpen, setIsOpen] = useState(true);
  const [script, setScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scriptPrompt, setScriptPrompt] = useState('');
  
  // Voice-to-text state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Voice-to-text recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      toast({
        title: 'Recording started',
        description: 'Speak your idea, then click stop when done'
      });
    } catch (error: any) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Microphone access denied',
        description: 'Please allow microphone access to use voice input',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(audioBlob);
      const base64Audio = await base64Promise;

      // Call speech-to-text edge function
      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { audioBase64: base64Audio }
      });

      if (error) throw error;

      if (data?.text) {
        // Append to existing script or set as new
        setScript(prev => prev ? `${prev} ${data.text}` : data.text);
        toast({
          title: 'Transcribed!',
          description: 'Your speech has been added to the script'
        });
      } else {
        throw new Error('No transcription returned');
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast({
        title: 'Transcription failed',
        description: error.message || 'Failed to transcribe audio',
        variant: 'destructive'
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const generateScript = async () => {
    if (!scriptPrompt.trim()) {
      toast({
        title: 'Enter a prompt',
        description: 'Describe what you want your AI Twin to say',
        variant: 'destructive'
      });
      return;
    }

    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a script writer for ${twinName}. Generate a natural, conversational script based on the user's request. Keep it concise (2-4 sentences) unless asked otherwise. Write only the script text, no quotes or labels.`
            },
            {
              role: 'user',
              content: scriptPrompt
            }
          ]
        }
      });

      if (error) throw error;

      // Support both response formats
      const generatedScript = data?.choices?.[0]?.message?.content || data?.response || '';
      
      if (!generatedScript) {
        throw new Error('No script was generated');
      }
      
      setScript(generatedScript);
      setScriptPrompt('');
      
      toast({
        title: 'Script generated',
        description: 'Edit if needed, then click Speak to hear it'
      });
    } catch (error: any) {
      console.error('Error generating script:', error);
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate script',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const speakScript = async () => {
    if (!script.trim()) {
      toast({
        title: 'No script',
        description: 'Write or generate a script first',
        variant: 'destructive'
      });
      return;
    }

    if (!hasClonedVoice) {
      toast({
        title: 'No cloned voice',
        description: 'Clone a voice first in the Voice section above',
        variant: 'destructive'
      });
      return;
    }

    setIsGeneratingSpeech(true);
    setAudioUrl(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: script,
          speechifyVoiceId: speechifyVoiceId
        }
      });

      if (error) throw error;

      if (data?.audioContent) {
        // Check if audioContent is nested JSON (from some TTS providers)
        let actualAudioBase64 = data.audioContent;
        try {
          const decoded = atob(data.audioContent);
          if (decoded.startsWith('{') && decoded.includes('audio_data')) {
            const parsed = JSON.parse(decoded);
            actualAudioBase64 = parsed.audio_data;
          }
        } catch (e) {
          // Not nested JSON, use as-is
        }
        
        // Convert base64 to audio URL
        const audioBlob = base64ToBlob(actualAudioBase64, 'audio/mp3');
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        
        // Auto-play
        setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.play().catch(e => console.error('Auto-play failed:', e));
            setIsPlaying(true);
          }
        }, 100);

        toast({
          title: 'Speech generated!',
          description: `${twinName} is now speaking`
        });
      }
    } catch (error: any) {
      console.error('Error generating speech:', error);
      toast({
        title: 'Speech failed',
        description: error.message || 'Failed to generate speech',
        variant: 'destructive'
      });
    } finally {
      setIsGeneratingSpeech(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !audioUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${twinName.replace(/\s+/g, '_')}_speech.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Make Twin Speak
              </div>
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Warning if no cloned voice */}
            {!hasClonedVoice && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-muted-foreground">
                  Clone a voice first to make your AI Twin speak with their own voice.
                </p>
              </div>
            )}

            {/* AI Script Generation */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Generate with AI
              </label>
              <div className="flex gap-2">
                <Textarea
                  placeholder="Describe what you want the twin to say... E.g., 'Introduce yourself as a fitness coach' or 'Explain the benefits of meditation'"
                  value={scriptPrompt}
                  onChange={(e) => setScriptPrompt(e.target.value)}
                  className="h-16 resize-none flex-1"
                />
                <Button 
                  onClick={generateScript}
                  disabled={isGeneratingScript || !scriptPrompt.trim()}
                  className="h-auto"
                >
                  {isGeneratingScript ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Script Text Area with Voice Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Script</label>
                <Button
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isTranscribing}
                  className="gap-2"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Transcribing...
                    </>
                  ) : isRecording ? (
                    <>
                      <MicOff className="w-3 h-3" />
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <Mic className="w-3 h-3" />
                      Speak It
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                placeholder="Type, generate with AI, or click 'Speak It' to dictate your script..."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="min-h-[100px] resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {script.length} characters • ~{Math.ceil(script.split(' ').filter(Boolean).length / 150)} min speaking time
              </p>
            </div>

            {/* Speak Button */}
            <Button
              onClick={speakScript}
              disabled={isGeneratingSpeech || !script.trim() || !hasClonedVoice}
              className="w-full bg-gradient-primary hover:opacity-90"
            >
              {isGeneratingSpeech ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Speech...
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 mr-2" />
                  Speak
                </>
              )}
            </Button>

            {/* Audio Player */}
            {audioUrl && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={togglePlayPause}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                
                <div className="flex-1">
                  <p className="text-sm font-medium">{twinName}'s Speech</p>
                  <p className="text-xs text-muted-foreground">Click play to listen</p>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={downloadAudio}
                  title="Download audio"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            )}

            <audio
              ref={audioRef}
              src={audioUrl || undefined}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
