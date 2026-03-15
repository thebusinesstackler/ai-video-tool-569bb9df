import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, Mic, MicOff, Clock, Clapperboard, Play, Volume2, CheckCircle2, Sparkles, Plus } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { CommercialSegment } from '@/types/testimonialCommercial';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import loopAiAvatar from '@/assets/loop-ai-avatar.jpg';

interface Message {
  role: 'user' | 'assistant' | 'system-action';
  content: string;
}

interface CommercialStrategy {
  title: string;
  summary: string;
  segments: any[];
  totalDuration: number;
}

interface EditAction {
  type: 'edit';
  edits: Array<{
    action: 'update' | 'add' | 'delete' | 'setDuration' | 'generateVoice';
    sceneIndex?: number;
    changes?: Record<string, any>;
    segment?: any;
    duration?: number;
  }>;
}

interface LoopAIDirectorProps {
  onApplyStrategy: (segments: CommercialSegment[], name: string) => void;
  onUpdateSegment: (id: string, updates: Partial<CommercialSegment>) => void;
  onAddSegment: (type: 'speaking' | 'broll', prefill?: Partial<CommercialSegment>) => void;
  onDeleteSegment: (id: string) => void;
  onGenerateCharacter: (segmentId: string, description: string) => Promise<void>;
  onGenerateBrollPreview: (segmentId: string, prompt: string) => Promise<void>;
  onSaveToDb: () => Promise<void>;
  segments: CommercialSegment[];
  targetDuration: string;
  onTargetDurationChange: (dur: string) => void;
}

function calculateDurationFromScript(script: string): number {
  if (!script) return 5;
  const words = script.trim().split(/\s+/).length;
  const est = Math.ceil(words / 2.5);
  if (est <= 6) return 5;
  if (est <= 10) return 8;
  return 10;
}

const CHAT_STORAGE_KEY = 'loop-ai-director-chat';

function detectGenderFromDescription(desc: string): 'female' | 'male' {
  const lower = desc.toLowerCase();
  const femaleIndicators = ['woman', 'female', 'lady', 'girl', 'she', 'her ', 'mother', 'mom', 'sister', 'actress', 'heroine'];
  if (femaleIndicators.some(w => lower.includes(w))) return 'female';
  return 'male';
}

function pickVoiceForCharacter(desc: string): { voiceId: string; gender: string } {
  const gender = detectGenderFromDescription(desc);
  if (gender === 'female') {
    const voices = ['English_compelling_lady1', 'English_radiant_girl', 'Calm_Woman', 'Inspirational_girl'];
    return { voiceId: voices[Math.floor(Math.random() * voices.length)], gender: 'female' };
  }
  const voices = ['English_magnetic_voiced_man', 'English_Trustworth_Man', 'Casual_Guy', 'Deep_Voice_Man'];
  return { voiceId: voices[Math.floor(Math.random() * voices.length)], gender: 'male' };
}

export function LoopAIDirector({
  onApplyStrategy,
  onUpdateSegment,
  onAddSegment,
  onDeleteSegment,
  onGenerateCharacter,
  onGenerateBrollPreview,
  onSaveToDb,
  segments,
  targetDuration,
  onTargetDurationChange,
}: LoopAIDirectorProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) return JSON.parse(saved).messages || [];
    } catch {}
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);
  const [previewingSegId, setPreviewingSegId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Auto-save chat to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages, targetDuration }));
      } catch {}
    }
  }, [messages, targetDuration]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const toggleVoiceInput = useCallback(() => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error('Speech recognition not supported'); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
      setInput(transcript);
    };
    recognition.onerror = () => { setIsListening(false); toast.error('Voice recognition error'); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const previewAudio = async (script: string, segId: string, characterDescription?: string) => {
    if (isPreviewingAudio && previewingSegId === segId) {
      audioRef.current?.pause();
      setIsPreviewingAudio(false);
      setPreviewingSegId(null);
      return;
    }
    setIsPreviewingAudio(true);
    setPreviewingSegId(segId);
    try {
      const { voiceId, gender } = characterDescription
        ? pickVoiceForCharacter(characterDescription)
        : { voiceId: 'English_Trustworth_Man', gender: 'male' };

      toast.info(`🎙️ Generating ${gender} voice preview...`);

      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: script, voice: voiceId, gender }
      });
      if (error || !data?.audioUrl) throw new Error('TTS failed');

      // Show the voice ID used so the user can copy/reuse it
      const usedVoiceId = data.voiceUsed || voiceId;
      toast.success(`🎙️ Voice generated — ID: ${usedVoiceId}`, {
        action: {
          label: 'Copy ID',
          onClick: () => {
            navigator.clipboard.writeText(usedVoiceId);
            toast.info(`Voice ID "${usedVoiceId}" copied to clipboard`);
          },
        },
        duration: 8000,
      });

      // Save audio URL and voice ID to segment in DB
      onUpdateSegment(segId, { audioUrl: data.audioUrl, voiceoverId: usedVoiceId });

      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsPreviewingAudio(false); setPreviewingSegId(null); };
      audio.play();

      // Auto-save after generating audio
      onSaveToDb();
    } catch {
      toast.error('Failed to generate audio preview');
      setIsPreviewingAudio(false);
      setPreviewingSegId(null);
    }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    toast.success('Chat cleared');
  };

  const sanitizeJsonString = (raw: string): string => {
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
    return result;
  };

  const extractStrategyFromMessage = (content: string): CommercialStrategy | null => {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) return null;
    try {
      return JSON.parse(sanitizeJsonString(jsonMatch[1]));
    } catch (e) {
      console.error('Failed to parse strategy:', e);
      return null;
    }
  };

  const extractEditActions = (content: string): EditAction | null => {
    const actionMatch = content.match(/```action\s*([\s\S]*?)\s*```/);
    if (!actionMatch) return null;
    try {
      return JSON.parse(sanitizeJsonString(actionMatch[1]));
    } catch (e) {
      console.error('Failed to parse edit action:', e);
      return null;
    }
  };

  const applyEditActions = (editAction: EditAction) => {
    let editSummary: string[] = [];

    for (const edit of editAction.edits) {
      switch (edit.action) {
        case 'update': {
          if (edit.sceneIndex !== undefined && segments[edit.sceneIndex]) {
            const seg = segments[edit.sceneIndex];
            const changes: Partial<CommercialSegment> = {};
            if (edit.changes?.duration) changes.duration = edit.changes.duration;
            if (edit.changes?.script) changes.script = edit.changes.script;
            if (edit.changes?.brollPrompts) changes.brollPrompts = edit.changes.brollPrompts;
            if (edit.changes?.transition) changes.transition = edit.changes.transition;
            if (edit.changes?.voiceoverText) changes.voiceoverText = edit.changes.voiceoverText;
            if (edit.changes?.characterDescription) {
              changes.character = {
                ...(seg.character || { name: '', description: '', referenceImages: [] }),
                description: edit.changes.characterDescription,
                name: edit.changes.characterDescription.slice(0, 60),
              };
            }
            onUpdateSegment(seg.id, changes);
            editSummary.push(`Updated scene ${edit.sceneIndex + 1}`);
          }
          break;
        }
        case 'add': {
          if (edit.segment) {
            const type = edit.segment.type || 'speaking';
            const prefill: Partial<CommercialSegment> = {
              script: edit.segment.script || '',
              duration: edit.segment.duration || 8,
              transition: edit.segment.transition || 'cut',
              ...(edit.segment.characterDescription ? {
                character: {
                  name: edit.segment.characterDescription.slice(0, 60),
                  description: edit.segment.characterDescription,
                  referenceImages: [],
                }
              } : {}),
              ...(edit.segment.brollPrompts ? { brollPrompts: edit.segment.brollPrompts } : {}),
              ...(edit.segment.voiceover ? { voiceoverText: edit.segment.voiceover } : {}),
            };
            onAddSegment(type as 'speaking' | 'broll', prefill);
            editSummary.push(`Added new ${type} scene`);
          }
          break;
        }
        case 'delete': {
          if (edit.sceneIndex !== undefined && segments[edit.sceneIndex]) {
            onDeleteSegment(segments[edit.sceneIndex].id);
            editSummary.push(`Removed scene ${edit.sceneIndex + 1}`);
          }
          break;
        }
        case 'setDuration': {
          if (edit.duration) {
            onTargetDurationChange(String(edit.duration));
            editSummary.push(`Changed target duration to ${edit.duration}s`);
          }
          break;
        }
        case 'generateVoice': {
          if (edit.sceneIndex !== undefined && segments[edit.sceneIndex]) {
            const seg = segments[edit.sceneIndex];
            if (seg.script) {
              previewAudio(seg.script, seg.id, seg.character?.description);
              editSummary.push(`Generating new voice for scene ${edit.sceneIndex + 1}`);
            }
          }
          break;
        }
        case 'regenerateCharacter': {
          if (edit.sceneIndex !== undefined && segments[edit.sceneIndex]) {
            const seg = segments[edit.sceneIndex];
            const desc = (edit as any).description || seg.character?.description || '';
            if (desc) {
              // Update description first, then regenerate images
              onUpdateSegment(seg.id, {
                character: {
                  ...(seg.character || { name: '', description: '', referenceImages: [] }),
                  description: desc,
                  name: desc.slice(0, 60),
                  referenceImages: [], // Clear old images
                },
                status: 'generating-character',
              });
              onGenerateCharacter(seg.id, desc);
              editSummary.push(`🎭 Regenerating character for scene ${edit.sceneIndex + 1}`);
            }
          }
          break;
        }
        case 'regenerateBroll': {
          if (edit.sceneIndex !== undefined && segments[edit.sceneIndex]) {
            const seg = segments[edit.sceneIndex];
            const prompt = (edit as any).prompt || seg.brollPrompts?.[0] || '';
            if (prompt) {
              // Update prompt if provided, then regenerate
              if ((edit as any).prompt) {
                onUpdateSegment(seg.id, { brollPrompts: [prompt], status: 'generating-character' });
              }
              onGenerateBrollPreview(seg.id, prompt);
              editSummary.push(`🎞️ Regenerating B-roll for scene ${edit.sceneIndex + 1}`);
            }
          }
          break;
        }
        case 'updateCharacterDescription': {
          if (edit.sceneIndex !== undefined && segments[edit.sceneIndex]) {
            const seg = segments[edit.sceneIndex];
            const desc = (edit as any).description || '';
            if (desc) {
              onUpdateSegment(seg.id, {
                character: {
                  ...(seg.character || { name: '', description: '', referenceImages: [] }),
                  description: desc,
                  name: desc.slice(0, 60),
                },
              });
              editSummary.push(`Updated character description for scene ${edit.sceneIndex + 1}`);
            }
          }
          break;
        }
      }
    }

    if (editSummary.length > 0) {
      setMessages(prev => [...prev, {
        role: 'system-action' as const,
        content: `✏️ Applied changes: ${editSummary.join(', ')}`
      }]);
      onSaveToDb();
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }

    const userMessage: Message = { role: 'user', content: input };
    const chatMessages = messages.filter(m => m.role !== 'system-action');
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
            messages: [...chatMessages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: input }],
            targetDuration: parseInt(targetDuration),
            currentSegments: segments.length > 0 ? segments.map(s => ({
              type: s.type,
              duration: s.duration,
              transition: s.transition,
              script: s.script,
              brollPrompts: s.brollPrompts,
              character: s.character ? { description: s.character.description } : undefined,
              status: s.status,
            })) : undefined,
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
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'assistant') {
                  updated[lastIdx] = { role: 'assistant', content: assistantContent };
                }
                return updated;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Process AI response - check for new strategy OR edit actions
      const strategy = extractStrategyFromMessage(assistantContent);
      if (strategy) {
        applyStrategy(strategy);
      } else {
        const editAction = extractEditActions(assistantContent);
        if (editAction) {
          applyEditActions(editAction);
        }
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

    const speakingCount = newSegments.filter(s => s.type === 'speaking').length;
    const brollCount = newSegments.filter(s => s.type === 'broll').length;
    const totalDur = newSegments.reduce((sum, s) => sum + s.duration, 0);

    setMessages(prev => [...prev, {
      role: 'system-action' as const,
      content: `✅ Storyboard built — ${speakingCount} speaking scene${speakingCount !== 1 ? 's' : ''}, ${brollCount} B-roll clip${brollCount !== 1 ? 's' : ''}, ${totalDur}s total`
    }]);

    // Auto-save to DB
    setTimeout(() => onSaveToDb(), 500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const renderMessageContent = (content: string) => {
    return content.replace(/```json[\s\S]*?```/g, '').replace(/```action[\s\S]*?```/g, '').trim();
  };

  const LoopAvatar = ({ size = 'sm' }: { size?: 'sm' | 'lg' }) => (
    <Avatar className={`${size === 'lg' ? 'h-10 w-10' : 'h-7 w-7'} shrink-0 border-2 border-primary/30 shadow-sm`}>
      <AvatarImage src={loopAiAvatar} alt="Loop AI" className="object-cover" />
      <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
        <Clapperboard className="h-3 w-3" />
      </AvatarFallback>
    </Avatar>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative">
            <LoopAvatar size="lg" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-tight">Loop AI Director</h3>
            <p className="text-[10px] text-muted-foreground">Film Director • Commercial Strategist • Brand Expert</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={clearChat}>
              Clear
            </Button>
          )}
          <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <Select value={targetDuration} onValueChange={onTargetDurationChange}>
              <SelectTrigger className="w-[72px] h-6 text-[10px] border-0 bg-transparent p-0 shadow-none">
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
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="relative mb-5">
              <Avatar className="h-20 w-20 border-4 border-primary/20 shadow-lg">
                <AvatarImage src={loopAiAvatar} alt="Loop AI Director" className="object-cover" />
                <AvatarFallback className="bg-primary/10"><Clapperboard className="h-8 w-8 text-primary" /></AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-background flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full" />
              </div>
            </div>
            <h3 className="text-lg font-bold mb-1">Loop AI Director</h3>
            <p className="text-xs text-muted-foreground max-w-[280px] mb-6 leading-relaxed">
              I'm your creative director. Tell me about your product — I'll craft the actors, scripts, B-roll, and full storyboard. Ask me to tweak anything — duration, scripts, b-roll, actors. I'm here until it's perfect.
            </p>
            <div className="flex flex-col gap-2 w-full max-w-[320px]">
              {[
                "Create a 10s testimonial for my fitness app UFixness",
                "Who should my target audience be for a premium skincare brand?",
                "I need a 30s product launch ad with two actors",
              ].map((example, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-2.5 px-4 text-left justify-start whitespace-normal hover:bg-primary/5 hover:border-primary/30 transition-colors"
                  onClick={() => setInput(example)}
                >
                  <Sparkles className="h-3 w-3 mr-2 shrink-0 text-primary/60" />
                  {example}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => {
              if (msg.role === 'system-action') {
                return (
                  <div key={i} className="flex justify-center">
                    <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-lg px-4 py-2.5 text-xs font-medium flex items-center gap-2 max-w-[90%]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{msg.content}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="mt-1"><LoopAvatar /></div>
                  )}
                  <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted/80 rounded-bl-sm border border-border/30'
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
              );
            })}

            {isLoading && messages[messages.length - 1]?.content === '' && (
              <div className="flex gap-3">
                <div className="mt-0.5"><LoopAvatar /></div>
                <div className="bg-muted/80 rounded-xl rounded-bl-sm px-3.5 py-2.5 border border-border/30">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    <span className="text-[10px] text-muted-foreground italic">Loop AI is crafting your vision...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Scene Preview Cards */}
            {segments.length > 0 && (
              <div className="border-t border-border/30 pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline" className="text-[10px] gap-1 bg-primary/5 border-primary/20">
                    <Clapperboard className="h-2.5 w-2.5" />
                    Storyboard • {segments.length} scenes
                  </Badge>
                </div>
                <div className="space-y-2">
                  {segments.map((seg, idx) => (
                    <div key={seg.id} className="bg-background/60 border border-border/50 rounded-lg p-3 space-y-2 hover:border-primary/20 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono bg-muted rounded px-1.5 py-0.5">{idx + 1}</span>
                          <Badge variant={seg.type === 'speaking' ? 'default' : 'secondary'} className="text-[10px] h-5">
                            {seg.type === 'speaking' ? '🎬 Speaking' : '🎞️ B-Roll'}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{seg.duration}s • {seg.transition}</span>
                        </div>
                        {seg.type === 'speaking' && seg.script && (
                          <div className="flex items-center gap-1">
                            {seg.audioUrl && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] gap-1 hover:text-primary"
                                onClick={() => {
                                  const audio = new Audio(seg.audioUrl!);
                                  audio.play();
                                }}
                              >
                                <Play className="h-3 w-3" />
                                Play
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] gap-1 hover:text-primary"
                              onClick={() => previewAudio(seg.script!, seg.id, seg.character?.description)}
                            >
                              {isPreviewingAudio && previewingSegId === seg.id
                                ? <Volume2 className="h-3 w-3 text-primary animate-pulse" />
                                : <Sparkles className="h-3 w-3" />}
                              New Voice
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Character + B-roll images side by side */}
                      {seg.character && seg.character.referenceImages.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {seg.character.referenceImages.slice(0, 6).map((img, i) => (
                            <img key={i} src={img} alt={`Angle ${i+1}`} className="h-16 w-16 rounded-md object-cover border border-border/50 shrink-0 hover:scale-105 transition-transform" />
                          ))}
                        </div>
                      )}

                      {seg.brollImages && seg.brollImages.length > 0 && (
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {seg.brollImages.map((img, i) => (
                            <img key={i} src={img} alt={`B-roll ${i+1}`} className="h-16 w-24 rounded-md object-cover border border-border/50 shrink-0" />
                          ))}
                        </div>
                      )}

                      {seg.type === 'speaking' && seg.character && seg.character.referenceImages.length === 0 && (
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-primary/80 italic bg-primary/5 rounded px-2 py-1 flex-1">
                            🎭 "{seg.character.description?.slice(0, 80)}..."
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] gap-1 shrink-0"
                            onClick={() => onGenerateCharacter(seg.id, seg.character!.description)}
                          >
                            <Sparkles className="h-2.5 w-2.5" /> Generate
                          </Button>
                        </div>
                      )}

                      {seg.script && (
                        <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                          "{seg.script.slice(0, 120)}{seg.script.length > 120 ? '...' : ''}"
                        </p>
                      )}

                      {seg.brollPrompts?.[0] && !seg.brollImages?.length && (
                        <p className="text-[10px] text-muted-foreground">
                          📷 {seg.brollPrompts[0].slice(0, 100)}...
                        </p>
                      )}

                      {/* Audio indicator with voice ID */}
                      {seg.audioUrl && (
                        <div className="flex items-center gap-1.5">
                          <Volume2 className="h-2.5 w-2.5 text-emerald-500" />
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400">Voice generated</span>
                          {seg.voiceoverId && (
                            <button
                              className="text-[9px] font-mono text-muted-foreground hover:text-primary transition-colors ml-1 underline decoration-dotted"
                              onClick={() => {
                                navigator.clipboard.writeText(seg.voiceoverId!);
                                toast.success(`Voice ID "${seg.voiceoverId}" copied`);
                              }}
                            >
                              {seg.voiceoverId}
                            </button>
                          )}
                        </div>
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
      <div className="border-t border-border/50 p-3 bg-background/50">
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
            placeholder={isListening ? 'Listening...' : 'Describe your commercial or ask for changes...'}
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
