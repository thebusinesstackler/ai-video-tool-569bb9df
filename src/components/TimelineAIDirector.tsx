import React, { useState, useRef, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Wand2, Scissors, Trash2, RefreshCw, Film } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

export interface DirectorAction {
  type: 'split_clip' | 'trim_clip' | 'delete_clip' | 'reorder_clips' | 'regenerate_clip' | 'add_caption' | 'set_transition' | 'detect_scenes';
  clipIndex?: number;
  timestamp?: number;
  trimStart?: number;
  trimEnd?: number;
  fromIndex?: number;
  toIndex?: number;
  prompt?: string;
  text?: string;
  transition?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: DirectorAction[];
}

interface TimelineClip {
  sceneNumber?: number;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
  caption?: string;
  text?: string;
  videoUrl?: string;
  transition?: string;
}

interface TimelineAIDirectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clips: TimelineClip[];
  totalDuration: number;
  onAction: (action: DirectorAction) => void;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  split_clip: <Scissors className="w-3 h-3" />,
  trim_clip: <Film className="w-3 h-3" />,
  delete_clip: <Trash2 className="w-3 h-3" />,
  regenerate_clip: <RefreshCw className="w-3 h-3" />,
  detect_scenes: <Wand2 className="w-3 h-3" />,
};

const ACTION_LABELS: Record<string, string> = {
  split_clip: 'Split',
  trim_clip: 'Trim',
  delete_clip: 'Delete',
  reorder_clips: 'Reorder',
  regenerate_clip: 'Regenerate',
  add_caption: 'Caption',
  set_transition: 'Transition',
  detect_scenes: 'Detect',
};

export const TimelineAIDirector: React.FC<TimelineAIDirectorProps> = ({
  open,
  onOpenChange,
  clips,
  totalDuration,
  onAction,
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('timeline-director', {
        body: {
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          timelineState: {
            clips: clips.map((c, i) => ({
              sceneNumber: c.sceneNumber || i + 1,
              duration: c.duration,
              trimStart: c.trimStart || 0,
              trimEnd: c.trimEnd || 0,
              caption: c.caption || c.text || '',
              hasVideo: !!c.videoUrl,
              transition: c.transition || 'crossfade',
            })),
            totalDuration,
          },
        },
      });

      if (error) throw error;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data?.message || 'I couldn\'t process that request.',
        actions: data?.actions || [],
      };
      setMessages(prev => [...prev, assistantMsg]);

      // Auto-apply actions
      if (assistantMsg.actions && assistantMsg.actions.length > 0) {
        for (const action of assistantMsg.actions) {
          onAction(action);
        }
        toast({
          title: `${assistantMsg.actions.length} edit${assistantMsg.actions.length > 1 ? 's' : ''} applied`,
          description: assistantMsg.actions.map(a => ACTION_LABELS[a.type] || a.type).join(', '),
        });
      }
    } catch (e: any) {
      console.error('Director chat error:', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${e.message}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: 'Detect scenes', message: 'Detect scene boundaries in this video and suggest where to split.' },
    { label: 'Trim silence', message: 'Find and trim any silent parts at the start or end of each clip.' },
    { label: 'Optimize pacing', message: 'Review the pacing of all clips and suggest trims for better flow.' },
    { label: 'Fix transitions', message: 'Review all transitions and suggest the best type for each cut.' },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 pb-2 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Wand2 className="w-5 h-5 text-primary" />
            AI Director
            <Badge variant="secondary" className="text-[10px]">
              {clips.length} clips • {totalDuration.toFixed(1)}s
            </Badge>
          </SheetTitle>
        </SheetHeader>

        {/* Quick Actions */}
        {messages.length === 0 && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Quick actions:</p>
            <div className="flex flex-wrap gap-1.5">
              {quickActions.map((qa, i) => (
                <Button
                  key={i}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => { setInput(qa.message); }}
                >
                  {qa.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 py-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}

                  {/* Show action badges */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
                      {msg.actions.map((action, aIdx) => (
                        <Badge
                          key={aIdx}
                          variant="outline"
                          className="text-[10px] gap-1 cursor-pointer hover:bg-accent"
                          onClick={() => onAction(action)}
                        >
                          {ACTION_ICONS[action.type] || <Wand2 className="w-3 h-3" />}
                          {ACTION_LABELS[action.type] || action.type}
                          {action.clipIndex !== undefined && ` #${(action.clipIndex || 0) + 1}`}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 pt-2 border-t border-border">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell the AI Director what to edit…"
              className="flex-1 text-sm"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};
