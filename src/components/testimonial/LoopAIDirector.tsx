import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Send, Mic, MicOff, Clock, Clapperboard, Play, Volume2, VolumeX, CheckCircle2, Sparkles, Plus } from 'lucide-react';
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
  characters?: { characterId: string; name: string; description: string }[];
  segments: any[];
  totalDuration: number;
}

type ReplaceScope = 'script' | 'voiceover' | 'brollPrompts' | 'all';

interface EditAction {
  type: 'edit';
  edits: Array<{
    action: 'update' | 'add' | 'delete' | 'setDuration' | 'generateVoice' | 'regenerateCharacter' | 'regenerateBroll' | 'updateCharacterDescription' | 'replaceText' | 'generateMusic' | 'regenerateAll' | 'productSwap' | 'setCameraAngle' | 'generateVideo' | 'extendClip' | 'productSwapFromLibrary' | 'generateBrollVoiceover' | 'duplicateScene' | 'reorderScene' | 'videoDiagnostic';
    sceneIndex?: number | 'all';
    sceneIndices?: number[];
    changes?: Record<string, any>;
    segment?: any;
    duration?: number;
    description?: string;
    prompt?: string;
    find?: string;
    replaceWith?: string;
    scope?: ReplaceScope;
    mood?: string;
    sourceSceneIndex?: number;
    targetSceneIndices?: number[];
    fromIndex?: number;
    toIndex?: number;
    productName?: string;
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
  onGenerateMusic?: (mood: string) => Promise<void>;
  onGenerateVideo?: (segmentId: string) => Promise<void>;
  onExtendClip?: (segmentId: string, prompt: string) => Promise<void>;
  onDuplicateSegment?: (id: string) => void;
  onReorderSegments?: (fromIndex: number, toIndex: number) => void;
  segments: CommercialSegment[];
  targetDuration: string;
  onTargetDurationChange: (dur: string) => void;
  focusedSegmentId?: string | null;
  onClearFocusedSegment?: () => void;
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
  onGenerateMusic,
  onGenerateVideo,
  onExtendClip,
  onDuplicateSegment,
  onReorderSegments,
  segments,
  targetDuration,
  onTargetDurationChange,
  focusedSegmentId,
  onClearFocusedSegment,
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
  const prevSegmentsLenRef = useRef(segments.length);

  // Auto-greet on new project (segments cleared + no chat history)
  useEffect(() => {
    if (prevSegmentsLenRef.current > 0 && segments.length === 0) {
      // Full reset: clear chat history for new project
      localStorage.removeItem(CHAT_STORAGE_KEY);
      stopSpeaking();
      const greeting: Message = {
        role: 'assistant',
        content: "🎬 Fresh canvas — let's build something incredible.\n\nWhat's the **product**, **audience**, and **vibe**? I'll handle the rest—"
      };
      setMessages([greeting]);
    }
    prevSegmentsLenRef.current = segments.length;
  }, [segments.length]);
  const [isPreviewingAudio, setIsPreviewingAudio] = useState(false);
  const [previewingSegId, setPreviewingSegId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    try { return localStorage.getItem('loop-ai-voice') !== 'off'; } catch { return true; }
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // When a segment is focused from the timeline, prefill input with context
  useEffect(() => {
    if (!focusedSegmentId) return;
    const seg = segments.find(s => s.id === focusedSegmentId);
    if (!seg) return;
    const idx = segments.indexOf(seg);
    const typeCount = segments.slice(0, idx + 1).filter(s => s.type === seg.type).length;
    const label = seg.type === 'speaking' ? `Scene #${typeCount}` : `B-Roll #${typeCount}`;
    const thumb = seg.character?.referenceImages?.[0] || seg.brollImages?.[0] || null;
    const scriptPreview = (seg.script || seg.voiceoverText || seg.brollPrompts?.[0] || '').slice(0, 80);

    // Add a system-action message showing what segment is selected with thumbnail
    const refContent = thumb
      ? `📍 **Selected: ${label}** (${seg.duration}s)\n"${scriptPreview}…"\n![${label}](${thumb})`
      : `📍 **Selected: ${label}** (${seg.duration}s)\n"${scriptPreview}…"`;

    setMessages(prev => [...prev, { role: 'system-action' as const, content: refContent }]);
    setInput(`For ${label}: `);
    onClearFocusedSegment?.();

    // Focus the input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [focusedSegmentId, segments, onClearFocusedSegment]);

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

  const toggleVoice = useCallback(() => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    localStorage.setItem('loop-ai-voice', next ? 'on' : 'off');
    if (!next) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    }
    toast.success(next ? '🔊 Loop AI voice enabled' : '🔇 Loop AI voice muted');
  }, [voiceEnabled]);

  const speakResponse = useCallback(async (text: string) => {
    if (!voiceEnabled) return;

    const cleanText = text
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/```action[\s\S]*?```/g, '')
      .replace(/[#*_`>]/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText || cleanText.length < 10) return;

    // Keep spoken delivery sharp: first 2 sentences only
    const conciseChunks = cleanText
      .split(/(?:\.\.\.|—|[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 3);

    const speakText = conciseChunks.join(' — ').slice(0, 300);
    if (!speakText) return;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(true);

    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text: speakText, voice: 'Deep_Voice_Man', gender: 'male' }
      });

      if (error || !data?.audioUrl) {
        console.warn('Loop AI TTS failed, falling back to browser speech');
        // Fallback to browser speechSynthesis
        if (window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(speakText);
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Alex')) || voices.find(v => v.lang.startsWith('en'));
          if (preferredVoice) utterance.voice = preferredVoice;
          utterance.rate = 1.0;
          utterance.pitch = 1.0;
          utterance.onend = () => setIsSpeaking(false);
          utterance.onerror = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        } else {
          setIsSpeaking(false);
        }
        return;
      }

      const audio = new Audio(data.audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); audioRef.current = null; };
      audio.onerror = () => { setIsSpeaking(false); audioRef.current = null; };
      audio.play().catch(() => setIsSpeaking(false));
    } catch {
      setIsSpeaking(false);
    }
  }, [voiceEnabled]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    stopSpeaking();
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

  const resolveSceneIndexes = (edit: EditAction['edits'][number]): number[] => {
    if (Array.isArray(edit.sceneIndices) && edit.sceneIndices.length > 0) {
      return Array.from(new Set(edit.sceneIndices.filter((idx) => Number.isInteger(idx) && idx >= 0 && idx < segments.length)));
    }

    if (edit.sceneIndex === 'all') {
      return segments.map((_, idx) => idx);
    }

    if (typeof edit.sceneIndex === 'number' && edit.sceneIndex >= 0 && edit.sceneIndex < segments.length) {
      return [edit.sceneIndex];
    }

    return [];
  };

  const replaceExactText = (value: string, find: string, replaceWith: string): string => {
    if (!find.trim()) return value;
    return value.split(find).join(replaceWith);
  };

  const replaceProductPlaceholderTokens = (value: string, replaceWith: string): string => {
    return value.replace(/[\[{]\s*product\s*name\s*[\]}]/gi, replaceWith);
  };

  const applyEditActions = async (editAction: EditAction) => {
    const editSummary: string[] = [];

    for (const edit of editAction.edits) {
      const targetIndexes = resolveSceneIndexes(edit);

      switch (edit.action) {
        case 'update': {
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            const changes: Partial<CommercialSegment> = {};
            if (typeof edit.changes?.duration === 'number') changes.duration = edit.changes.duration;
            if (typeof edit.changes?.script === 'string') changes.script = edit.changes.script;
            if (Array.isArray(edit.changes?.brollPrompts)) changes.brollPrompts = edit.changes.brollPrompts;
            if (typeof edit.changes?.transition === 'string' && ['fade-in', 'cut', 'crossfade'].includes(edit.changes.transition)) {
              changes.transition = edit.changes.transition as CommercialSegment['transition'];
            }
            if (typeof edit.changes?.voiceoverText === 'string') changes.voiceoverText = edit.changes.voiceoverText;
            if (typeof edit.changes?.characterDescription === 'string') {
              changes.character = {
                ...(seg.character || { name: '', description: '', referenceImages: [] }),
                description: edit.changes.characterDescription,
                name: edit.changes.characterDescription.slice(0, 60),
              };
            }

            if (Object.keys(changes).length > 0) {
              onUpdateSegment(seg.id, changes);
              editSummary.push(`Updated scene ${sceneIndex + 1}`);
            }
          }
          break;
        }

        case 'replaceText': {
          const replaceWith = typeof edit.replaceWith === 'string' ? edit.replaceWith : '';
          if (!replaceWith) break;

          const scope: ReplaceScope = edit.scope || 'all';
          const find = typeof edit.find === 'string' ? edit.find : '';
          const shouldReplacePlaceholder = !find || /product\s*name/i.test(find);
          const indexes = targetIndexes.length > 0 ? targetIndexes : segments.map((_, idx) => idx);

          let touchedScenes = 0;
          for (const sceneIndex of indexes) {
            const seg = segments[sceneIndex];
            const updates: Partial<CommercialSegment> = {};
            let changed = false;

            if ((scope === 'script' || scope === 'all') && typeof seg.script === 'string') {
              let nextScript = seg.script;
              if (find) nextScript = replaceExactText(nextScript, find, replaceWith);
              if (shouldReplacePlaceholder) nextScript = replaceProductPlaceholderTokens(nextScript, replaceWith);
              if (nextScript !== seg.script) {
                updates.script = nextScript;
                changed = true;
              }
            }

            if ((scope === 'voiceover' || scope === 'all') && typeof seg.voiceoverText === 'string') {
              let nextVoiceover = seg.voiceoverText;
              if (find) nextVoiceover = replaceExactText(nextVoiceover, find, replaceWith);
              if (shouldReplacePlaceholder) nextVoiceover = replaceProductPlaceholderTokens(nextVoiceover, replaceWith);
              if (nextVoiceover !== seg.voiceoverText) {
                updates.voiceoverText = nextVoiceover;
                changed = true;
              }
            }

            if ((scope === 'brollPrompts' || scope === 'all') && Array.isArray(seg.brollPrompts)) {
              const nextPrompts = seg.brollPrompts.map((prompt) => {
                let nextPrompt = prompt;
                if (find) nextPrompt = replaceExactText(nextPrompt, find, replaceWith);
                if (shouldReplacePlaceholder) nextPrompt = replaceProductPlaceholderTokens(nextPrompt, replaceWith);
                return nextPrompt;
              });
              if (JSON.stringify(nextPrompts) !== JSON.stringify(seg.brollPrompts)) {
                updates.brollPrompts = nextPrompts;
                changed = true;
              }
            }

            if (changed) {
              onUpdateSegment(seg.id, updates);
              touchedScenes += 1;
            }
          }

          if (touchedScenes > 0) {
            const matchLabel = find || '[Product name]';
            editSummary.push(`Replaced "${matchLabel}" with "${replaceWith}" in ${touchedScenes} scene${touchedScenes === 1 ? '' : 's'}`);
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
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            onDeleteSegment(seg.id);
            editSummary.push(`Removed scene ${sceneIndex + 1}`);
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
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            if (seg.script) {
              previewAudio(seg.script, seg.id, seg.character?.description);
              editSummary.push(`Generating new voice for scene ${sceneIndex + 1}`);
            }
          }
          break;
        }

        case 'regenerateCharacter': {
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            const desc = edit.description || seg.character?.description || '';
            if (desc) {
              onUpdateSegment(seg.id, {
                character: {
                  ...(seg.character || { name: '', description: '', referenceImages: [] }),
                  description: desc,
                  name: desc.slice(0, 60),
                  referenceImages: [],
                },
                status: 'generating-character',
              });
              onGenerateCharacter(seg.id, desc);
              editSummary.push(`🎭 Regenerating character for scene ${sceneIndex + 1}`);
            }
          }
          break;
        }

        case 'regenerateBroll': {
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            const prompt = edit.prompt || seg.brollPrompts?.[0] || '';
            if (prompt) {
              if (edit.prompt) {
                onUpdateSegment(seg.id, { brollPrompts: [prompt], status: 'generating-character' });
              }
              onGenerateBrollPreview(seg.id, prompt);
              editSummary.push(`🎞️ Regenerating B-roll for scene ${sceneIndex + 1}`);
            }
          }
          break;
        }

        case 'productSwap': {
          const sourceIdx = edit.sourceSceneIndex;
          const targetIdxs = edit.targetSceneIndices || [];
          if (typeof sourceIdx === 'number' && sourceIdx >= 0 && sourceIdx < segments.length) {
            const sourceSeg = segments[sourceIdx];
            const productUrl = sourceSeg.productImageUrl || sourceSeg.character?.referenceImages?.[0];
            if (productUrl && targetIdxs.length > 0) {
              for (const tIdx of targetIdxs) {
                if (tIdx >= 0 && tIdx < segments.length) {
                  const tSeg = segments[tIdx];
                  onUpdateSegment(tSeg.id, { productImageUrl: productUrl, status: 'generating-character' });
                  const prompt = tSeg.brollPrompts?.[0] || 'Product showcase';
                  onGenerateBrollPreview(tSeg.id, prompt);
                }
              }
              editSummary.push(`📦 Product swap: copied product from scene ${sourceIdx + 1} to ${targetIdxs.length} B-roll scenes`);
            } else {
              editSummary.push(`⚠️ No product image found in scene ${sourceIdx + 1}`);
            }
          }
          break;
        }

        case 'updateCharacterDescription': {
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            const desc = edit.description || '';
            if (desc) {
              onUpdateSegment(seg.id, {
                character: {
                  ...(seg.character || { name: '', description: '', referenceImages: [] }),
                  description: desc,
                  name: desc.slice(0, 60),
                },
              });
              editSummary.push(`Updated character description for scene ${sceneIndex + 1}`);
            }
          }
          break;
        }

        case 'generateMusic': {
          const mood = edit.mood || 'uplifting corporate, warm and inspiring';
          if (onGenerateMusic) {
            onGenerateMusic(mood);
            editSummary.push(`🎵 Generating music: "${mood}"`);
          } else {
            editSummary.push(`🎵 Music requested: "${mood}" (not yet configured)`);
          }
          break;
        }

        case 'regenerateAll': {
          // Full production pass: regenerate all missing content
          let regeneratedCount = 0;
          for (let idx = 0; idx < segments.length; idx++) {
            const seg = segments[idx];
            if (seg.type === 'speaking') {
              // Regenerate character if no images
              if (seg.character?.description && (!seg.character.referenceImages || seg.character.referenceImages.length === 0)) {
                onUpdateSegment(seg.id, {
                  character: { ...seg.character, referenceImages: [] },
                  status: 'generating-character',
                });
                onGenerateCharacter(seg.id, seg.character.description);
                regeneratedCount++;
              }
              // Generate voice if no audio
              if (seg.script && !seg.audioUrl) {
                previewAudio(seg.script, seg.id, seg.character?.description);
                regeneratedCount++;
              }
            } else if (seg.type === 'broll') {
              // Regenerate B-roll preview if missing
              if (seg.brollPrompts?.[0] && (!seg.brollImages || seg.brollImages.length === 0)) {
                onGenerateBrollPreview(seg.id, seg.brollPrompts[0]);
                regeneratedCount++;
              }
            }
          }
          // Also generate music if handler available
          if (onGenerateMusic) {
            const allScripts = segments.filter(s => s.script).map(s => s.script).join(' ');
            const autoMood = allScripts.length > 50
              ? 'cinematic commercial background music, modern and inspiring, subtle build'
              : 'uplifting corporate, warm acoustic guitar, inspiring';
            onGenerateMusic(autoMood);
            regeneratedCount++;
          }
          editSummary.push(`🚀 Full production pass: regenerating ${regeneratedCount} assets`);
          break;
        }

        case 'generateVideo': {
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            if (onGenerateVideo) {
              onGenerateVideo(seg.id);
              editSummary.push(`🎬 Generating video for scene ${sceneIndex + 1}`);
            } else {
              editSummary.push(`⚠️ Video generation not available`);
            }
          }
          break;
        }

        case 'extendClip': {
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            if (seg.videoUrl && onExtendClip) {
              onExtendClip(seg.id, edit.prompt || 'Continue the scene naturally with smooth motion');
              editSummary.push(`⏭️ Extending video clip for scene ${sceneIndex + 1}`);
            } else if (!seg.videoUrl) {
              editSummary.push(`⚠️ Scene ${sceneIndex + 1} has no video to extend`);
            } else {
              editSummary.push(`⚠️ Clip extension not available`);
            }
          }
          break;
        }

        case 'productSwapFromLibrary': {
          try {
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) { editSummary.push('⚠️ Not authenticated'); break; }
            const { data: products } = await supabase
              .from('product_images')
              .select('*')
              .eq('user_id', currentUser.id)
              .order('created_at', { ascending: false })
              .limit(5);
            if (!products || products.length === 0) {
              editSummary.push('⚠️ No products in your library — upload a product image first');
              break;
            }
            // Find by name if specified, otherwise use first
            const productName = edit.productName?.toLowerCase();
            const product = productName
              ? products.find(p => p.name?.toLowerCase().includes(productName)) || products[0]
              : products[0];
            const indexes = targetIndexes.length > 0 ? targetIndexes : segments.map((_, idx) => idx).filter(idx => segments[idx].type === 'broll');
            for (const tIdx of indexes) {
              const tSeg = segments[tIdx];
              onUpdateSegment(tSeg.id, { productImageUrl: product.image_url, status: 'generating-character' });
              const prompt = tSeg.brollPrompts?.[0] || 'Product showcase';
              onGenerateBrollPreview(tSeg.id, prompt);
            }
            editSummary.push(`📦 Applied "${product.name || 'product'}" from library to ${indexes.length} scene(s)`);
          } catch (err) {
            editSummary.push('⚠️ Failed to fetch product library');
          }
          break;
        }

        case 'generateBrollVoiceover': {
          // Find main character voice for consistency
          const mainSpeaking = segments.find(s => s.type === 'speaking' && s.character?.description);
          const charDesc = mainSpeaking?.character?.description || '';
          const indexes = targetIndexes.length > 0 ? targetIndexes : segments.map((_, idx) => idx).filter(idx => segments[idx].type === 'broll' && segments[idx].voiceoverText);
          for (const idx of indexes) {
            const seg = segments[idx];
            if (seg.voiceoverText) {
              previewAudio(seg.voiceoverText, seg.id, charDesc);
              editSummary.push(`🎙️ Generating voiceover for B-Roll scene ${idx + 1}`);
            }
          }
          break;
        }

        case 'duplicateScene': {
          for (const sceneIndex of targetIndexes) {
            const seg = segments[sceneIndex];
            if (onDuplicateSegment) {
              onDuplicateSegment(seg.id);
              editSummary.push(`📋 Duplicated scene ${sceneIndex + 1}`);
            }
          }
          break;
        }

        case 'reorderScene': {
          if (typeof edit.fromIndex === 'number' && typeof edit.toIndex === 'number' && onReorderSegments) {
            onReorderSegments(edit.fromIndex, edit.toIndex);
            editSummary.push(`🔀 Moved scene from position ${edit.fromIndex + 1} to ${edit.toIndex + 1}`);
          }
          break;
        }

        case 'videoDiagnostic': {
          const diagnosticReport: string[] = [];
          segments.forEach((seg, idx) => {
            const issues: string[] = [];
            if (seg.type === 'speaking') {
              if (!seg.character?.referenceImages?.length) issues.push('❌ No character images');
              if (!seg.audioUrl) issues.push('❌ No audio');
              if (!seg.videoUrl) issues.push('❌ No video');
              else issues.push('✅ Video ready');
              if (seg.audioUrl && seg.character?.referenceImages?.length) {
                issues.push('✅ Lip-sync ready');
              } else if (!seg.audioUrl || !seg.character?.referenceImages?.length) {
                issues.push('⚠️ Not lip-sync ready (needs audio + images)');
              }
            } else {
              if (!seg.brollImages?.length) issues.push('❌ No preview image');
              if (!seg.videoUrl) issues.push('❌ No video');
              else issues.push('✅ Video ready');
              if (!seg.voiceoverText) issues.push('⚠️ No voiceover — will be silent');
              if (!seg.audioUrl && seg.voiceoverText) issues.push('⚠️ VO text exists but no audio generated');
            }
            const wc = (seg.script || seg.voiceoverText || '').split(/\s+/).filter(Boolean).length;
            if (wc > 0 && Math.abs(Math.ceil(wc / 2.5) - seg.duration) > 2) {
              issues.push(`⚠️ Duration mismatch: ${wc} words ≈ ${Math.ceil(wc / 2.5)}s but set to ${seg.duration}s`);
            }
            diagnosticReport.push(`**Scene ${idx + 1}** (${seg.type}): ${issues.join(' | ')}`);
          });
          const readyCount = segments.filter(s => s.videoUrl).length;
          const totalCount = segments.length;
          const fullReport = `🔍 **Video Diagnostic Report**\n\n${diagnosticReport.join('\n')}\n\n**Summary:** ${readyCount}/${totalCount} scenes have video. ${readyCount === totalCount ? '✅ All ready for final assembly!' : `⚠️ ${totalCount - readyCount} scene(s) still need video generation.`}`;
          setMessages(prev => [...prev, { role: 'system-action' as const, content: fullReport }]);
          return; // Don't add edit summary — diagnostic is its own message
        }
      }
    }

    if (editSummary.length > 0) {
      setMessages(prev => [...prev, {
        role: 'system-action' as const,
        content: `✏️ Applied changes: ${editSummary.join(', ')}`
      }]);
      onSaveToDb();
      return;
    }

    setMessages(prev => [...prev, {
      role: 'system-action' as const,
      content: '⚠️ I could not apply that edit automatically — ask me to target a scene number or use "replace [Product name] with ..."'
    }]);
  };

  const handleSendWithMessage = async (msg: string) => {
    if (!msg.trim() || isLoading) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }

    const userMessage: Message = { role: 'user', content: msg };
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
            messages: [...chatMessages.map(m => ({ role: m.role, content: m.content })), { role: 'user', content: msg }],
            targetDuration: parseInt(targetDuration),
            currentSegments: segments.length > 0 ? (() => {
              const speakingSegments = segments.filter(seg => seg.type === 'speaking');
              return segments.map((s, index) => {
                let typeNum = 0;
                for (let j = 0; j <= index; j++) {
                  if (segments[j].type === s.type) typeNum++;
                }
                let narrativeRole = '';
                if (s.type === 'speaking') {
                  const speakIdx = speakingSegments.indexOf(s);
                  if (speakIdx === 0) narrativeRole = 'HOOK';
                  else if (speakIdx === speakingSegments.length - 1) narrativeRole = 'CTA';
                  else if (speakIdx === 1) narrativeRole = 'PROBLEM/STORY';
                  else narrativeRole = 'PROOF/SOLUTION';
                }
                const scriptText = s.type === 'speaking' ? (s.script || '') : '';
                const voText = s.voiceoverText || '';
                const wordCount = (scriptText || voText).split(/\s+/).filter(Boolean).length;
                const expectedDuration = Math.ceil(wordCount / 2.5);
                const durationMismatch = wordCount > 0 && Math.abs(expectedDuration - s.duration) > 2;

                const missingAssets: string[] = [];
                if (s.type === 'speaking') {
                  if (!s.character?.description) missingAssets.push('no character description');
                  if (!s.character?.referenceImages?.length) missingAssets.push('no character images');
                  if (!s.audioUrl) missingAssets.push('no audio/voiceover');
                  if (!s.videoUrl) missingAssets.push('no video');
                  if (!scriptText) missingAssets.push('no script');
                } else {
                  if (!(s.brollImages?.length)) missingAssets.push('no B-roll preview images');
                  if (!s.brollPrompts?.length) missingAssets.push('no B-roll prompts');
                  if (!voText) missingAssets.push('no voiceover text');
                  if (!s.videoUrl) missingAssets.push('no video');
                }

                return {
                  index,
                  type: s.type,
                  typeNumber: typeNum,
                  narrativeRole,
                  duration: s.duration,
                  transition: s.transition,
                  script: scriptText,
                  voiceoverText: voText,
                  brollPrompts: s.brollPrompts,
                  brollImageUrls: s.brollImages || [],
                  wordCount,
                  expectedDuration,
                  durationMismatch,
                  missingAssets,
                  character: s.character ? {
                    name: s.character.name || '',
                    description: s.character.description,
                    gender: s.character.gender || '',
                    hasImages: (s.character.referenceImages?.length || 0) > 0,
                    imageCount: s.character.referenceImages?.length || 0,
                    referenceImageUrls: (s.character.referenceImages || []).slice(0, 2),
                  } : undefined,
                  hasBrollImages: (s.brollImages?.length || 0) > 0,
                  hasProductImage: !!s.productImageUrl,
                  hasAudio: !!s.audioUrl,
                  hasVideo: !!s.videoUrl,
                  audioUrl: s.audioUrl ? '✅ present' : undefined,
                  videoUrl: s.videoUrl ? '✅ present' : undefined,
                  voiceoverId: s.voiceoverId || '',
                  status: s.status,
                };
              });
            })() : undefined,
            timelineIssues: segments.length > 0 ? (() => {
              const issues: { sceneIndex: number; sceneLabel: string; problems: string[] }[] = [];
              let consecutiveSpeaking = 0;
              segments.forEach((s, i) => {
                const problems: string[] = [];
                const typeNum = segments.slice(0, i + 1).filter(seg => seg.type === s.type).length;
                const label = s.type === 'speaking' ? `Scene #${typeNum}` : `B-Roll #${typeNum}`;

                if (s.type === 'speaking') {
                  consecutiveSpeaking++;
                  if (!s.character?.description) problems.push('Missing character description');
                  if (!s.character?.referenceImages?.length) problems.push('No character reference images — cannot generate video');
                  if (!s.audioUrl) problems.push('No audio generated');
                  if (!s.videoUrl) problems.push('No video generated');
                  if (!s.script) problems.push('Empty script');
                  const wc = (s.script || '').split(/\s+/).filter(Boolean).length;
                  if (wc > s.duration * 3) problems.push(`Script too long: ${wc} words for ${s.duration}s (max ~${Math.floor(s.duration * 2.5)} words)`);
                  if (wc > 0 && wc < s.duration * 1.5) problems.push(`Script too short: ${wc} words for ${s.duration}s (aim for ~${Math.floor(s.duration * 2.5)} words)`);
                } else {
                  if (consecutiveSpeaking >= 3) problems.push(`Preceded by ${consecutiveSpeaking} consecutive speaking scenes — add B-roll for visual variety`);
                  consecutiveSpeaking = 0;
                  if (!(s.brollImages?.length)) problems.push('No B-roll preview image');
                  if (!s.brollPrompts?.length) problems.push('No B-roll prompt set');
                  if (!s.voiceoverText) problems.push('No voiceover text — scene will be silent');
                }
                if (problems.length > 0) issues.push({ sceneIndex: i, sceneLabel: label, problems });
              });
              if (consecutiveSpeaking >= 3) {
                issues.push({ sceneIndex: -1, sceneLabel: 'Overall', problems: [`Ends with ${consecutiveSpeaking} consecutive speaking scenes — consider adding B-roll`] });
              }
              // Check transition variety
              const transitions = segments.map(s => s.transition);
              const uniqueTransitions = new Set(transitions);
              if (segments.length > 3 && uniqueTransitions.size === 1) {
                issues.push({ sceneIndex: -1, sceneLabel: 'Overall', problems: [`All ${segments.length} segments use "${transitions[0]}" transition — vary transitions for better flow`] });
              }
              return issues.length > 0 ? issues : undefined;
            })() : undefined,
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

      const strategy = extractStrategyFromMessage(assistantContent);
      if (strategy) {
        applyStrategy(strategy);
      } else {
        const editAction = extractEditActions(assistantContent);
        if (editAction) {
          applyEditActions(editAction);
        }
      }

      speakResponse(assistantContent);
    } catch (error) {
      console.error('Loop AI error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    handleSendWithMessage(input);
  };

  const applyStrategy = (strategy: CommercialStrategy) => {
    // Build character lookup from strategy's characters array for consistency
    const characterLookup: Record<string, { name: string; description: string }> = {};
    if (Array.isArray(strategy.characters)) {
      for (const char of strategy.characters) {
        if (char.characterId) {
          characterLookup[char.characterId] = {
            name: char.name || char.description?.slice(0, 60) || '',
            description: char.description || '',
          };
        }
      }
    }

    const newSegments: CommercialSegment[] = strategy.segments.map((seg) => {
      const duration = seg.script ? calculateDurationFromScript(seg.script) : (seg.duration || 8);
      if (seg.type === 'speaking' || seg.type === 'twin-speaking') {
        // Resolve character from characterId lookup for consistency
        const charFromLookup = seg.characterId ? characterLookup[seg.characterId] : null;
        // Combine: base appearance from lookup + scene-specific action from segment
        const baseDescription = charFromLookup?.description || '';
        const sceneAction = seg.characterDescription || '';
        const fullDescription = baseDescription && sceneAction
          ? `${baseDescription}. In this scene: ${sceneAction}`
          : sceneAction || baseDescription;

        return {
          id: crypto.randomUUID(),
          type: 'speaking' as const,
          script: seg.script || '',
          duration,
          transition: seg.transition || 'fade-in',
          status: 'pending' as const,
          character: fullDescription ? {
            name: charFromLookup?.name || fullDescription.slice(0, 60),
            description: fullDescription,
            referenceImages: [],
            // Store characterId for grouping during generation
            ...(seg.characterId ? { twinId: seg.characterId } : {}),
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
    const uniqueChars = Object.keys(characterLookup).length;

    setMessages(prev => [...prev, {
      role: 'system-action' as const,
      content: `✅ Storyboard built — ${speakingCount} speaking scene${speakingCount !== 1 ? 's' : ''}, ${brollCount} B-roll clip${brollCount !== 1 ? 's' : ''}, ${totalDur}s total${uniqueChars > 0 ? ` (${uniqueChars} unique actor${uniqueChars !== 1 ? 's' : ''})` : ''}`
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

  // Generate contextual quick actions based on project state
  const getQuickActions = (): { label: string; message: string; icon: string }[] => {
    const actions: { label: string; message: string; icon: string }[] = [];
    
    if (segments.length === 0) {
      actions.push(
        { label: '🎬 Build a 15s ad', message: 'Create a 15 second commercial for my product', icon: '🎬' },
        { label: '⚡ Quick TikTok ad', message: 'Build a punchy 10 second TikTok-style ad', icon: '⚡' },
        { label: '🎯 30s testimonial', message: 'Create a 30 second testimonial commercial with actors', icon: '🎯' },
      );
      return actions;
    }

    // Detect product image in any segment for propagation suggestion
    const hasProductInAnyScene = segments.some(s => s.productImageUrl);
    const brollWithoutProduct = segments.filter(s => s.type === 'broll' && !s.productImageUrl);

    const missingCharacters = segments.filter(s => s.type === 'speaking' && (!s.character?.referenceImages || s.character.referenceImages.length === 0));
    const missingAudio = segments.filter(s => s.type === 'speaking' && !s.audioUrl);
    const missingBroll = segments.filter(s => s.type === 'broll' && (!s.brollImages || s.brollImages.length === 0));
    const hasAnyVideo = segments.some(s => s.videoUrl);

    // Product propagation — top priority
    if (hasProductInAnyScene && brollWithoutProduct.length > 0) {
      actions.push({ label: `📦 Swap product to ${brollWithoutProduct.length} B-roll`, message: 'Swap my product image into all B-roll scenes that are missing it', icon: '📦' });
    }

    if (missingCharacters.length > 0) {
      actions.push({ label: `🎭 Generate ${missingCharacters.length} character${missingCharacters.length > 1 ? 's' : ''}`, message: 'Generate all missing character images', icon: '🎭' });
    }
    if (missingAudio.length > 0) {
      actions.push({ label: `🎙️ Generate ${missingAudio.length} voiceover${missingAudio.length > 1 ? 's' : ''}`, message: 'Generate voiceovers for all scenes missing audio', icon: '🎙️' });
    }
    if (missingBroll.length > 0) {
      actions.push({ label: `🎞️ Generate ${missingBroll.length} B-roll`, message: 'Generate preview images for all B-roll scenes', icon: '🎞️' });
    }
    // Video generation — when characters + audio ready but no videos
    const readyForVideo = segments.filter(s => s.type === 'speaking' && s.character?.referenceImages?.length && s.audioUrl && !s.videoUrl);
    if (readyForVideo.length > 0) {
      actions.push({ label: `🎬 Generate ${readyForVideo.length} video${readyForVideo.length > 1 ? 's' : ''}`, message: 'Generate videos for all scenes that have characters and audio ready', icon: '🎬' });
    }
    if (segments.length > 0 && !hasAnyVideo) {
      actions.push({ label: '🚀 Full production pass', message: 'Do a full production pass — generate everything that\'s missing', icon: '🚀' });
    }
    // Diagnose videos — when some videos exist
    if (hasAnyVideo) {
      actions.push({ label: '🔍 Diagnose videos', message: 'Run a full video diagnostic — check all scenes for missing assets, lip-sync readiness, and duration issues', icon: '🔍' });
    }
    // Product from library
    actions.push({ label: '📦 Add product from library', message: 'Pull my product from the library and add it to all B-roll scenes', icon: '📦' });
    // Extend clip — when a scene has video
    const scenesWithVideo = segments.filter(s => s.videoUrl);
    if (scenesWithVideo.length > 0) {
      actions.push({ label: `⏭️ Extend clip`, message: 'Extend the shortest video clip to give it more screen time', icon: '⏭️' });
    }
    // B-roll voiceover
    const brollMissingAudio = segments.filter(s => s.type === 'broll' && s.voiceoverText && !s.audioUrl);
    if (brollMissingAudio.length > 0) {
      actions.push({ label: `🎙️ B-roll voiceovers (${brollMissingAudio.length})`, message: 'Generate voiceovers for all B-roll scenes that have narration text', icon: '🎙️' });
    }
    if (segments.length > 0) {
      actions.push({ label: '📝 Script breakdown', message: 'Show me the full script flow — how all the scenes connect together with timing, camera angles, and transitions', icon: '📝' });
      actions.push({ label: '🔍 Review & polish', message: 'Review my storyboard — check scripts, camera angles, transitions, durations, and fix any issues', icon: '🔍' });
      actions.push({ label: '➕ Add B-roll', message: 'Suggest and add a cinematic B-roll scene that fits the narrative with specific camera angles and product shots', icon: '➕' });
      actions.push({ label: '🎵 Add music', message: 'Add background music that matches the mood of this commercial', icon: '🎵' });
      actions.push({ label: '✏️ Punch up the hook', message: 'Make the hook scene more attention-grabbing with a stronger script and more dynamic camera angle', icon: '✏️' });
      actions.push({ label: '⏱️ Extend duration', message: 'The story needs more time — extend scenes where the emotional beats need to breathe and adjust the pacing', icon: '⏱️' });
      actions.push({ label: '📸 Change camera angles', message: 'Review all camera angles and suggest better cinematic angles for each scene with proper transitions between them', icon: '📸' });
    }

    return actions.slice(0, 6);
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
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold tracking-tight">Loop AI Director</h3>
              {isSpeaking && (
                <button onClick={stopSpeaking} className="flex items-center gap-1" title="Click to stop">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: `${6 + Math.random() * 8}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                  <span className="text-[9px] text-primary font-medium">Speaking</span>
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Film Director • Commercial Strategist • Brand Expert</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={voiceEnabled ? 'default' : 'outline'}
            size="sm"
            className="h-6 w-6 p-0"
            onClick={toggleVoice}
            title={voiceEnabled ? 'Mute Loop AI' : 'Unmute Loop AI'}
          >
            {voiceEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
          </Button>
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
              Hey, I'm your creative director — here to help you build amazing commercials. Tell me about your product and I'll set up the whole thing — actors, scripts, B-roll, transitions. Need changes? Just tell me — I've got you—
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

            {/* Quick action buttons — show after last message when not loading */}
            {!isLoading && messages.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border/30">
                {getQuickActions().map((action, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    className="text-[10px] h-auto py-1.5 px-2.5 hover:bg-primary/5 hover:border-primary/30 transition-colors"
                    onClick={() => { handleSendWithMessage(action.message); }}
                  >
                    <span className="mr-1">{action.icon}</span>
                    {action.label.replace(/^[^\s]+\s/, '')}
                  </Button>
                ))}
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
