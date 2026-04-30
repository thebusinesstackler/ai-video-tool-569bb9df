import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import directorAvatar from '@/assets/ai-director-avatar.jpg';
import {
  Sparkles, Send, Target, Users, Lightbulb,
  Copy, ArrowRight, Loader2, Wand2, Layers, Check
} from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

export interface VideoPlan {
  topic: string;
  angle?: string;
  hook?: string;
  narration: string;
  audience?: string;
  duration?: number;
  twinName?: string;
}

export interface DirectorAvailableTwin {
  name: string;
  gender?: string;
  description?: string;
}

const QUICK_PROMPTS = [
  { icon: Layers, label: 'Plan 10 Videos', description: 'Bulk content batch', prompt: 'Plan 10 different talking-head videos for me. Each must cover a different topic angle and have a complete ready-to-shoot script. Use my brand context if you have it.' },
  { icon: Lightbulb, label: 'Content Ideas', description: 'Get 5 viral topic ideas', prompt: 'What should I talk about for a talking-head video? I want to grow my brand on social media. Give me 5 topic ideas with hooks.' },
  { icon: Target, label: 'Target Audience', description: 'Define your ideal viewer', prompt: 'Help me define the target audience for my talking-head video. Ask me about my business and suggest the ideal viewer profile.' },
  { icon: Users, label: 'Scroll-Stopping Hooks', description: 'Powerful opening lines', prompt: 'Give me 5 powerful opening hooks for a talking-head video that stops the scroll on social media.' },
];

export interface DirectorBrandContext {
  brandName?: string;
  brandDescription?: string;
  productLines?: string;
  audience?: string;
  websiteUrl?: string;
  websiteSummary?: string;
  userEmail?: string;
  userFirstName?: string;
}

interface PodcastAIDirectorProps {
  onUseScript: (script: string) => void;
  onUseBatchPlan?: (plans: VideoPlan[]) => void;
  selectedCharacterName?: string;
  brandContext?: DirectorBrandContext;
  availableTwins?: DirectorAvailableTwin[];
  isGenerating?: boolean;
  generationStatus?: string;
  generationProgress?: number;
  generationError?: string | null;
  finalVideoUrl?: string | null;
}

const STORAGE_KEY = 'podcast-marcus-chat-v1';
const STATUS_PREFIX = '__STATUS__::';
const VIDEO_PREFIX = '__VIDEO__::';

export const PodcastAIDirector: React.FC<PodcastAIDirectorProps> = ({
  onUseScript,
  onUseBatchPlan,
  selectedCharacterName,
  brandContext,
  availableTwins,
  isGenerating = false,
  generationStatus = '',
  generationProgress = 0,
  generationError = null,
  finalVideoUrl = null,
}) => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore invalid saved chat payloads.
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [planSelections, setPlanSelections] = useState<Record<string, Set<number>>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist chat across navigation.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore private browsing/storage write failures.
    }
  }, [messages]);

  const togglePlanIdx = (msgKey: string, idx: number, total: number) => {
    setPlanSelections(prev => {
      const current = prev[msgKey] ?? new Set<number>(Array.from({ length: total }, (_, i) => i));
      const next = new Set(current);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return { ...prev, [msgKey]: next };
    });
  };
  const getSelected = (msgKey: string, total: number) => {
    return planSelections[msgKey] ?? new Set<number>(Array.from({ length: total }, (_, i) => i));
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Marcus narrates the generation pipeline IN PLACE — one status bubble that
  // updates rather than spamming new messages, so the script + plan stay visible.
  const wasGeneratingRef = useRef<boolean>(false);
  useEffect(() => {
    if (isGenerating && generationStatus) {
      const pct = Math.round(generationProgress);
      const statusContent = `${STATUS_PREFIX}⚙️ **${generationStatus}** _(${pct}%)_`;
      setMessages(prev => {
        const lastIdx = prev.length - 1;
        const last = prev[lastIdx];
        if (last?.role === 'assistant' && last.content.startsWith(STATUS_PREFIX)) {
          if (last.content === statusContent) return prev;
          return prev.map((m, i) => i === lastIdx ? { ...m, content: statusContent } : m);
        }
        return [...prev, { role: 'assistant', content: statusContent }];
      });
    }
    if (isGenerating) wasGeneratingRef.current = true;
    if (!isGenerating && wasGeneratingRef.current) {
      wasGeneratingRef.current = false;
      const done = generationProgress >= 100 || !!finalVideoUrl;
      setMessages(prev => {
        const filtered = prev.filter(m => !m.content.startsWith(STATUS_PREFIX));
        return [
          ...filtered,
          {
            role: 'assistant',
            content: done
              ? `✅ **Your video is ready!** It's saved here so you can come back to it anytime.`
              : generationError
                ? `⚠️ Generation hit an issue: ${generationError}. Click **Generate Video** again on the script above to retry — your script is preserved.`
                : `${STATUS_PREFIX}⚙️ **Still rendering in the background...** _Marcus will keep checking and post the video here when it finishes._`,
          },
        ];
      });
    }
  }, [isGenerating, generationStatus, generationProgress, generationError, finalVideoUrl]);

  // When a finished video URL arrives, embed it as a special chat message
  // so the user sees the result inline AND it persists across navigation.
  const lastVideoRef = useRef<string | null>(null);
  useEffect(() => {
    if (finalVideoUrl && finalVideoUrl !== lastVideoRef.current) {
      lastVideoRef.current = finalVideoUrl;
      setMessages(prev => {
        if (prev.some(m => m.content === `${VIDEO_PREFIX}${finalVideoUrl}`)) return prev;
        return [
          ...prev.filter(m => !m.content.startsWith(STATUS_PREFIX)),
          { role: 'assistant', content: `${VIDEO_PREFIX}${finalVideoUrl}` },
        ];
      });
    }
  }, [finalVideoUrl]);

  const clearChat = () => {
    setMessages([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {
      // Ignore private browsing/storage write failures.
    }
  };

  const extractScript = (text: string): string | null => {
    const match = text.match(/<SCRIPT_SUGGESTION>([\s\S]*?)<\/SCRIPT_SUGGESTION>/);
    return match ? match[1].trim() : null;
  };

  const extractPlan = (text: string): VideoPlan[] | null => {
    const match = text.match(/<VIDEO_PLAN>([\s\S]*?)<\/VIDEO_PLAN>/);
    if (!match) return null;
    try {
      const json = JSON.parse(match[1].trim());
      const arr: VideoPlan[] = Array.isArray(json?.plans) ? json.plans : [];
      return arr.filter(p => p?.topic && p?.narration).slice(0, 10);
    } catch {
      return null;
    }
  };

  const stripScriptTags = (text: string): string => {
    return text
      .replace(/<\/?SCRIPT_SUGGESTION>/g, '')
      .replace(/<VIDEO_PLAN>[\s\S]*?<\/VIDEO_PLAN>/g, '');
  };

  const streamChat = async (allMessages: Message[]) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/podcast-director`;
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages, brandContext, selectedCharacterName, availableTwins }),
    });

    if (!resp.ok || !resp.body) {
      const err = await resp.json().catch(() => ({}));
      throw new Error((err as any)?.error || `Request failed (${resp.status})`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantSoFar = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantSoFar += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
              }
              return [...prev, { role: 'assistant', content: assistantSoFar }];
            });
          }
        } catch {
          buffer = line + '\n' + buffer;
          break;
        }
      }
    }
  };

  const send = async (text: string) => {
    if (!text.trim() || isStreaming) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const contextNote = selectedCharacterName
      ? `\n[Context: The user has selected AI Twin character "${selectedCharacterName}" for this video.]`
      : '';
    const enrichedMsg: Message = {
      role: 'user',
      content: text.trim() + contextNote,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    try {
      await streamChat([...messages, enrichedMsg]);
    } catch (e: any) {
      console.error('Podcast director error:', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I ran into an issue: ${e.message}. Please try again.`,
      }]);
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Avatar className="w-10 h-10 ring-2 ring-primary/30">
          <AvatarImage src={directorAvatar} alt="AI Creative Director" />
          <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <Wand2 className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-sm">Marcus — AI Creative Director</h3>
          <p className="text-[11px] text-muted-foreground">Content • Scripts • Strategy • Direction</p>
        </div>
        {isStreaming && (
          <Badge variant="secondary" className="ml-auto text-[10px] animate-pulse">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Thinking
          </Badge>
        )}
        {!isStreaming && messages.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={clearChat}
            className="ml-auto text-[10px] h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="p-4">
          {messages.length === 0 ? (
            <div className="space-y-5">
              {/* Welcome */}
              <div className="flex gap-3">
                <Avatar className="w-9 h-9 flex-shrink-0 ring-2 ring-primary/20">
                  <AvatarImage src={directorAvatar} alt="Director" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs">
                    <Wand2 className="w-3.5 h-3.5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed">
                  <p>Hey, I'm <strong>Marcus</strong> 👋 — your AI Creative Director. Tell me what you want to talk about and I'll help you craft the perfect talking-head video — from strategy and audience targeting to a ready-to-use script.</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="pl-11 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick start</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_PROMPTS.map((qp, i) => (
                    <button
                      key={i}
                      onClick={() => send(qp.prompt)}
                      disabled={isStreaming}
                      className="group flex items-start gap-3 p-3 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 text-left transition-all"
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                        <qp.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{qp.label}</p>
                        <p className="text-xs text-muted-foreground">{qp.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
                  {msg.role === 'assistant' && (
                    <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5 ring-2 ring-primary/20">
                      <AvatarImage src={directorAvatar} alt="Director" />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs">
                        <Wand2 className="w-3 h-3" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={cn(
                    'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted rounded-tl-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="space-y-2">
                        {msg.content.startsWith(VIDEO_PREFIX) ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-primary">🎬 Video ready</p>
                            <video
                              src={`${msg.content.slice(VIDEO_PREFIX.length)}#t=0.5`}
                              controls
                              preload="metadata"
                              className="w-full rounded-lg border border-border"
                            />
                            <a
                              href={msg.content.slice(VIDEO_PREFIX.length)}
                              download
                              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                            >
                              <ArrowRight className="w-3 h-3" /> Download
                            </a>
                          </div>
                        ) : msg.content.startsWith(STATUS_PREFIX) ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                            <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-0">
                              <ReactMarkdown>{msg.content.slice(STATUS_PREFIX.length)}</ReactMarkdown>
                            </div>
                          </div>
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:last-child]:mb-0 [&>ul]:my-1 [&>ol]:my-1 [&>p]:my-1">
                            <ReactMarkdown>{stripScriptTags(msg.content)}</ReactMarkdown>
                          </div>
                        )}
                        {extractScript(msg.content) && (
                          <div className="flex gap-2 pt-2 mt-2 border-t border-border/50">
                            <Button
                              size="sm"
                              disabled={isGenerating}
                              className="text-xs h-7 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 disabled:opacity-100"
                              onClick={() => {
                                const script = extractScript(msg.content);
                                if (!script) return;
                                onUseScript(script);
                              }}
                            >
                              {isGenerating ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating… {Math.round(generationProgress)}%</>
                              ) : (
                                <><ArrowRight className="w-3 h-3 mr-1" /> Generate Video</>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-xs h-7"
                              onClick={() => {
                                const script = extractScript(msg.content);
                                if (script) navigator.clipboard.writeText(script);
                              }}
                            >
                              <Copy className="w-3 h-3 mr-1" /> Copy
                            </Button>
                            {isGenerating && generationStatus && (
                              <span className="text-[10px] text-muted-foreground self-center ml-1">
                                {generationStatus}
                              </span>
                            )}
                          </div>
                        )}
                        {(() => {
                          const plan = extractPlan(msg.content);
                          if (!plan || plan.length === 0) return null;
                          const msgKey = `msg-${i}`;
                          const selected = getSelected(msgKey, plan.length);
                          const selectedCount = selected.size;
                          return (
                            <div className="space-y-2 pt-2 mt-2 border-t border-border/50">
                              <div className="flex items-center gap-2">
                                <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">
                                  <Layers className="w-3 h-3 mr-1" /> {selectedCount} of {plan.length} selected
                                </Badge>
                              </div>
                              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {plan.map((p, idx) => {
                                  const isOn = selected.has(idx);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => togglePlanIdx(msgKey, idx, plan.length)}
                                      className={cn(
                                        'w-full text-left text-[11px] p-2 rounded-md border transition flex items-start gap-2',
                                        isOn
                                          ? 'bg-primary/10 border-primary/40'
                                          : 'bg-background/60 border-border/50 opacity-60'
                                      )}
                                    >
                                      <span className={cn(
                                        'mt-0.5 w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center',
                                        isOn ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                                      )}>
                                        {isOn && <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="font-medium text-foreground line-clamp-1 flex-1">{idx + 1}. {p.topic}</p>
                                          {p.twinName && (
                                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/40 text-primary shrink-0">
                                              🎭 {p.twinName}
                                            </Badge>
                                          )}
                                        </div>
                                        {p.hook && <p className="text-muted-foreground line-clamp-1 mt-0.5">"{p.hook}"</p>}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                              {onUseBatchPlan && (
                                <Button
                                  size="sm"
                                  disabled={selectedCount === 0}
                                  className="w-full text-xs h-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                                  onClick={() => {
                                    const picked = plan.filter((_, idx) => selected.has(idx));
                                    onUseBatchPlan(picked);
                                  }}
                                >
                                  <ArrowRight className="w-3 h-3 mr-1" /> Send {selectedCount} to Bulk Queue & Start
                                </Button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0 ring-2 ring-primary/20">
                    <AvatarImage src={directorAvatar} alt="Director" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-xs">
                      <Wand2 className="w-3 h-3" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="bg-muted rounded-xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick follow-ups */}
      {messages.length > 0 && !isStreaming && (
        <div className="flex gap-1.5 px-4 py-2 border-t border-border/50 flex-wrap">
          <Badge
            variant="outline"
            className="text-[10px] cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
            onClick={() => send('Generate a ready-to-use talking-head script based on my first input. Include the estimated duration and camera movement suggestions, then wrap the exact spoken script in SCRIPT_SUGGESTION tags.')}
          >
            <Sparkles className="w-3 h-3 mr-1" /> Rewrite Script
          </Badge>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border bg-card/50">
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to talk about..."
            className="min-h-[44px] max-h-[100px] resize-none text-sm rounded-xl"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 rounded-xl h-[44px] w-[44px]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
