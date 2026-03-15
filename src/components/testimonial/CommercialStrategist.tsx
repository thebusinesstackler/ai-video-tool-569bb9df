import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, Wand2, ChevronDown, ChevronUp, Clock, Layers } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { CommercialSegment } from '@/types/testimonialCommercial';

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

interface CommercialStrategistProps {
  onApplyStrategy: (segments: CommercialSegment[], name: string) => void;
}

function calculateDurationFromScript(script: string): number {
  if (!script) return 5;
  const words = script.trim().split(/\s+/).length;
  const est = Math.ceil(words / 2.5);
  if (est <= 6) return 5;
  if (est <= 10) return 8;
  return 10;
}

export function CommercialStrategist({ onApplyStrategy }: CommercialStrategistProps) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [targetDuration, setTargetDuration] = useState('30');
  const [extractedStrategy, setExtractedStrategy] = useState<CommercialStrategy | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const extractStrategyFromMessage = (content: string): CommercialStrategy | null => {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
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
      }
    }
    return null;
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

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
            availableTwins: [], // No twins needed - AI generates characters
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

      const strategy = extractStrategyFromMessage(assistantContent);
      if (strategy) {
        setExtractedStrategy(strategy);
        applyStrategy(strategy);
      }
    } catch (error) {
      console.error('Strategy error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  const applyStrategy = (strategy: CommercialStrategy) => {
    // Convert strategy to segments - speaking segments get character descriptions
    const segments: CommercialSegment[] = strategy.segments.map((seg, index) => {
      const duration = seg.script ? calculateDurationFromScript(seg.script) : (seg.duration || 8);

      if (seg.type === 'speaking' || seg.type === 'twin-speaking') {
        return {
          id: crypto.randomUUID(),
          type: 'speaking' as const,
          script: seg.script || '',
          duration,
          transition: seg.transition || 'fade-in',
          status: 'pending' as const,
          // Store character description from strategy for easy generation
          character: seg.characterDescription ? {
            name: seg.characterDescription.slice(0, 60),
            description: seg.characterDescription,
            referenceImages: [],
          } : undefined,
        };
      }

      // B-roll
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

    onApplyStrategy(segments, strategy.title);
    toast.success('Strategy applied! Generate characters for each speaking scene.');
    setExtractedStrategy(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg py-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                AI Commercial Strategist
                <Badge variant="secondary" className="text-[10px]">VEO3</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Describe your idea — AI builds the full commercial plan with auto-generated actors
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <Select value={targetDuration} onValueChange={setTargetDuration}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chat */}
          <div className="border rounded-lg bg-background">
            <ScrollArea className="h-[220px] p-3" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Sparkles className="h-6 w-6 mb-2 opacity-40" />
                  <p className="text-sm font-medium">Describe your commercial idea</p>
                  <p className="text-xs mt-1">AI will create a plan with speaking scenes and B-roll</p>
                  <div className="flex flex-wrap gap-2 mt-3 justify-center">
                    {[
                      "30s testimonial ad for a fitness app",
                      "15s product launch for eco-friendly water bottle",
                      "10s social proof ad for a SaaS tool",
                    ].map((example, i) => (
                      <Button key={i} variant="outline" size="sm" className="text-[10px] h-7" onClick={() => setInput(example)}>
                        {example}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                        <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.content === '' && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="border-t p-2">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your commercial..."
                  className="min-h-[50px] resize-none text-sm"
                  disabled={isLoading}
                />
                <Button onClick={handleSend} disabled={!input.trim() || isLoading} className="h-auto px-3">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>

          {extractedStrategy && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{extractedStrategy.title}</span>
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Layers className="h-2 w-2" />
                      {extractedStrategy.segments.length} scenes
                    </Badge>
                  </div>
                  <Button size="sm" onClick={() => applyStrategy(extractedStrategy)} className="gap-1 h-7 text-xs">
                    <Wand2 className="h-3 w-3" />
                    Apply
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      )}
    </Card>
  );
}
