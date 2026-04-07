import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles, Send, Target, Video, Users, Lightbulb,
  Copy, ArrowRight, Loader2, MessageSquare
} from 'lucide-react';

type Message = { role: 'user' | 'assistant'; content: string };

const QUICK_PROMPTS = [
  { icon: Lightbulb, label: 'Content ideas', prompt: 'What should I talk about for a talking-head video? I want to grow my brand on social media. Give me 5 topic ideas with hooks.' },
  { icon: Target, label: 'Audience strategy', prompt: 'Help me define the target audience for my talking-head video. Ask me about my business and suggest the ideal viewer profile.' },
  { icon: Video, label: 'Creative direction', prompt: 'Suggest the best camera angle, lighting, and visual style for a professional yet authentic talking-head video.' },
  { icon: Users, label: 'Hook ideas', prompt: 'Give me 5 powerful opening hooks for a talking-head video that stops the scroll on social media.' },
];

interface PodcastAIDirectorProps {
  onUseScript: (script: string) => void;
  selectedCharacterName?: string;
}

export const PodcastAIDirector: React.FC<PodcastAIDirectorProps> = ({
  onUseScript,
  selectedCharacterName,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const extractScript = (text: string): string | null => {
    const match = text.match(/<SCRIPT_SUGGESTION>([\s\S]*?)<\/SCRIPT_SUGGESTION>/);
    return match ? match[1].trim() : null;
  };

  const stripScriptTags = (text: string): string => {
    return text.replace(/<\/?SCRIPT_SUGGESTION>/g, '');
  };

  const streamChat = async (allMessages: Message[]) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/podcast-director`;

    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages }),
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

  if (!isOpen) {
    return (
      <Card
        className="border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 cursor-pointer hover:border-primary/50 transition-all"
        onClick={() => setIsOpen(true)}
      >
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">AI Creative Director</p>
            <p className="text-xs text-muted-foreground">
              Get help with content ideas, creative direction, audience targeting & scripts
            </p>
          </div>
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-primary/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">AI Creative Director</p>
            <p className="text-[11px] text-muted-foreground">Strategy • Scripts • Direction</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-xs h-7">
          Minimize
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="h-[320px] p-3" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center py-2">
              👋 I'm your AI Creative Director. Tell me what you want to talk about and I'll help with strategy, scripts, and creative direction.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PROMPTS.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => send(qp.prompt)}
                  disabled={isStreaming}
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-border hover:border-primary/40 hover:bg-accent text-left transition-all text-xs"
                >
                  <qp.icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>{qp.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                )}>
                  {msg.role === 'assistant' ? (
                    <div className="space-y-2">
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:last-child]:mb-0">
                        <ReactMarkdown>{stripScriptTags(msg.content)}</ReactMarkdown>
                      </div>
                      {/* Script extraction button */}
                      {extractScript(msg.content) && (
                        <div className="flex gap-2 pt-2 border-t border-border">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => {
                              const script = extractScript(msg.content);
                              if (script) onUseScript(script);
                            }}
                          >
                            <ArrowRight className="w-3 h-3 mr-1" /> Use This Script
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
                        </div>
                      )}
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about content ideas, audience, creative direction..."
            className="min-h-[44px] max-h-[100px] resize-none text-sm"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            size="icon"
            onClick={() => send(input)}
            disabled={!input.trim() || isStreaming}
            className="shrink-0 self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        {messages.length > 0 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] cursor-pointer hover:bg-accent"
              onClick={() => send('Generate a ready-to-use script based on our discussion')}
            >
              Generate script
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] cursor-pointer hover:bg-accent"
              onClick={() => send('Suggest target audience for this content')}
            >
              Suggest audience
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] cursor-pointer hover:bg-accent"
              onClick={() => send('What camera angle and style should I use?')}
            >
              Camera & style
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
};
