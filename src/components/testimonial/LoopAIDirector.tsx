import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, Mic, MicOff, Clock, Clapperboard, Play, Volume2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { CommercialSegment } from '@/types/testimonialCommercial';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CommercialStrategy {
  title: string;
  summary: string;
  segments: any[];
  totalDuration: number;
}

interface LoopAIDirectorProps {
  onApplyStrategy: (segments: CommercialSegment[], name: string) => void;
  onGenerateCharacter: (segmentId: string, description: string) => Promise<void>;
  segments: CommercialSegment[];
}

function calculateDurationFromScript(script: string): number {
  if (!script) return 5;
  const words = script.trim().split(/\s+/).length;
  const est = Math.ceil(words / 2.5);
  if (est <= 6) return 5;
  if (est <= 10) return 8;
  return 10;
}

export function LoopAIDirector({ onApplyStrategy, onGenerateCharacter, segments }: LoopAIDirectorProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [targetDuration, setTargetDuration] = useState('30');
  const [isListening, setIsListening] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Voice input
  const toggleVoiceInput = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
      toast.error('Voice recognition error');
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // Audio preview for a script
  const previewAudio = async (script: string) => {
    if (isPreviewingAudio) {
      audioRef.current?.pause();
      setIsPreviewingAudio(false);
      return;
    }

    setIsPreviewingAudio(true);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: script }
      });
      if (error || !data?.audioUrl) throw new Error('TTS failed');

      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPreviewingAudio(false);
      audio.play();
      setPreviewAudioUrl(data.audioUrl);
    } catch (err) {
      console.error('Audio preview error:', err);
      toast.error('Failed to generate audio preview');
      setIsPreviewingAudio(false);
    }
  };

  const extractStrategyFromMessage = (content: string): CommercialStrategy | null => {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return null;
    try {
      let raw = jsonMatch[1];
      let result = '';
      let inString = false;
      let escaped = false;
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (escaped) { result += ch; escaped = false; continue; }
        if (ch === '\\') { result += ch; escaped = true; continue; }
        if (ch === '"') { inString = !inString; result += ch; continue; }
        if (inString && (ch === '\n' || ch === '\r' || ch === '\t')) {
          if (ch === '\n') result += '\\n';
          else if (ch === '\r') result += '\\r';
          else if (ch === '\t') result += '\\t';
          continue;
        }
        result += ch;
      }
      return JSON.parse(result);
    } catch (e) {
      console.error('Failed to parse strategy:', e);
      return null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let assistantContent = '';

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-commercial-strategy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            targetDuration: parseInt(targetDuration),
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get response');
      }
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Check for strategy JSON and auto-apply
      const strategy = extractStrategyFromMessage(assistantContent);
      if (strategy) {
        applyStrategy(strategy);
      }
    } catch (error) {
      console.error('Loop AI error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  const applyStrategy = (strategy: CommercialStrategy) => {
    const newSegments: CommercialSegment[] = strategy.segments.map((seg) => {
      const duration = seg.script ? calculateDurationFromScript(seg.script) : (seg.duration || 8);

      if (seg.type === 'speaking' || seg.type === 'twin-speaking') {
        return {
          id: crypto.randomUUID(),
          type: 'speaking' as const,
          script: seg.script || '',
          duration,
          transition: seg.transition || 'fade-in',
          status: 'pending' as const,
          character: seg.characterDescription ? {
            name: seg.characterDescription.slice(0, 60),
            description: seg.characterDescription,
            referenceImages: [],
          } : undefined,
        };
      }

      return {
        id: crypto.randomUUID(),
        type: 'broll' as const,
        brollPrompts: seg.brollPrompts || [seg.description || ''],
        voiceoverText: seg.voiceover || seg.voiceoverText || '',
        duration: seg.duration || 8,
        transition: seg.transition || 'cut',
        status: 'pending' as const,
      };
    });

    onApplyStrategy(newSegments, strategy.title);
    toast.success('🎬 Storyboard ready! Generate characters for each scene.');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Render message content - strip JSON blocks from display
  const renderMessageContent = (content: string) => {
    const withoutJson = content.replace(/```json[\s\S]*?```/g, '').trim();
    return withoutJson || content;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-9 w-9 bg-primary/10 border-2 border-primary/30">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                <Clapperboard className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Loop AI Director</h3>
            <p className="text-[10px] text-muted-foreground">Film Director • Commercial Expert</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <Select value={targetDuration} onValueChange={setTargetDuration}>
            <SelectTrigger className="w-[100px] h-7 text-[10px] border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10s</SelectItem>
              <SelectItem value="15">15s</SelectItem>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">60s</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <Clapperboard className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-1">Loop AI Director</h3>
            <p className="text-xs text-muted-foreground max-w-[280px] mb-5">
              I'm your creative director. Tell me about your product and I'll craft a cinematic commercial — actors, scripts, B-roll, everything.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[300px]">
              {[
                "Create a 10s testimonial for my fitness app UFixness",
                "I need a 30s product launch ad with two actors",
                "Make a social proof commercial for my SaaS tool",
              ].map((example, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-2 px-3 text-left justify-start whitespace-normal"
                  onClick={() => setInput(example)}
                >
                  {example}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <Avatar className="h-7 w-7 shrink-0 mt-1 bg-primary/10 border border-primary/20">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                      <Clapperboard className="h-3 w-3" />
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted/80 rounded-bl-sm'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs [&>p]:mb-2 [&>p]:leading-relaxed [&>ul]:mb-2 [&>ol]:mb-2 [&>h1]:text-sm [&>h2]:text-xs [&>h3]:text-xs [&>blockquote]:text-xs [&>blockquote]:border-primary/30">
                      <ReactMarkdown>{renderMessageContent(msg.content)}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-3">
                <Avatar className="h-7 w-7 shrink-0 bg-primary/10 border border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                    <Clapperboard className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted/80 rounded-xl rounded-bl-sm px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[10px] text-muted-foreground">Loop AI is crafting your vision...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Scene Preview Cards */}
            {segments.length > 0 && (
              <div className="border-t border-border/30 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Clapperboard className="h-2 w-2" />
                    Storyboard • {segments.length} scenes
                  </Badge>
                </div>
                <div className="space-y-2">
                  {segments.map((seg, idx) => (
                    <div key={seg.id} className="bg-background/60 border border-border/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">#{idx + 1}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {seg.type === 'speaking' ? '🎬 Speaking' : '🎞️ B-Roll'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{seg.duration}s • {seg.transition}</span>
                        </div>
                        {seg.type === 'speaking' && seg.script && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] gap-1"
                            onClick={() => previewAudio(seg.script!)}
                          >
                            {isPreviewingAudio ? <Volume2 className="h-3 w-3 text-primary animate-pulse" /> : <Play className="h-3 w-3" />}
                            Preview
                          </Button>
                        )}
                      </div>

                      {/* Character preview */}
                      {seg.character && seg.character.referenceImages.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto">
                          {seg.character.referenceImages.slice(0, 6).map((img, i) => (
                            <img key={i} src={img} alt={`Angle ${i+1}`} className="h-16 w-16 rounded-md object-cover border border-border/50 shrink-0" />
                          ))}
                        </div>
                      )}

                      {seg.type === 'speaking' && seg.character && seg.character.referenceImages.length === 0 && (
                        <p className="text-[10px] text-primary/80 italic">
                          🎭 "{seg.character.description}" — Generate character in the Scenes tab
                        </p>
                      )}

                      {seg.script && (
                        <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                          "{seg.script.slice(0, 120)}{seg.script.length > 120 ? '...' : ''}"
                        </p>
                      )}

                      {seg.brollPrompts?.[0] && (
                        <p className="text-[10px] text-muted-foreground">
                          📷 {seg.brollPrompts[0].slice(0, 100)}...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t border-border/50 p-3">
        <div className="flex gap-2 items-end">
          <Button
            variant={isListening ? 'default' : 'outline'}
            size="icon"
            className={`h-9 w-9 shrink-0 ${isListening ? 'bg-destructive hover:bg-destructive/90' : ''}`}
            onClick={toggleVoiceInput}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening...' : 'Describe your commercial idea...'}
            className="min-h-[44px] max-h-[120px] resize-none text-sm"
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-9 w-9 shrink-0"
            size="icon"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {isListening && (
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-[10px] text-destructive">Recording — speak your idea, then send</span>
          </div>
        )}
      </div>
    </div>
  );
}
