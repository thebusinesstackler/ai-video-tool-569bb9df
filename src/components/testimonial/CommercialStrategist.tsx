import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Sparkles, Wand2, ChevronDown, ChevronUp, Music, Clock, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CommercialSegment } from '@/types/testimonialCommercial';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CommercialStrategy {
  title: string;
  summary: string;
  musicStyle: string;
  segments: any[];
  totalDuration: number;
}

interface Twin {
  id: string;
  name: string;
  description: string | null;
  voice_cloning_key: string | null;
}

interface CommercialStrategistProps {
  onApplyStrategy: (segments: CommercialSegment[], name: string) => void;
  onGenerateBrollImages?: (segments: CommercialSegment[]) => Promise<void>;
}

// Calculate duration based on word count (~2.5 words per second for natural speech)
// Round to allowed API values: 5 or 8 seconds
function calculateDurationFromScript(script: string): number {
  if (!script) return 5;
  const words = script.trim().split(/\s+/).length;
  const estimatedSeconds = Math.ceil(words / 2.5);
  
  // Clamp to multiples of 5 or 8, minimum 5, round to nearest allowed value
  if (estimatedSeconds <= 6) return 5;
  if (estimatedSeconds <= 10) return 8;
  // For longer scripts, we need multiple segments but for now just use max
  return 8;
}

// Generate a voiceover script based on B-roll prompts
async function generateVoiceoverFromPrompts(brollPrompts: string[], commercialTitle: string): Promise<string> {
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
          messages: [{
            role: 'user',
            content: `Generate a SHORT, punchy voiceover script (15-20 words max) for a B-roll montage segment in a commercial called "${commercialTitle}". The visuals will show: ${brollPrompts.join(', ')}. 
            
Just return the voiceover text directly, no JSON, no quotes, just the script itself. Make it compelling and action-oriented with a clear call-to-action.`
          }],
          targetDuration: 8,
          availableTwins: [],
        }),
      }
    );

    if (!response.ok || !response.body) {
      throw new Error('Failed to generate voiceover');
    }

    // Read the streamed response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let voiceover = '';
    let textBuffer = '';

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
          if (content) voiceover += content;
        } catch {
          textBuffer = line + '\n' + textBuffer;
          break;
        }
      }
    }

    // Clean up the voiceover - remove any JSON formatting or quotes
    voiceover = voiceover.replace(/```json\s*|\s*```/g, '').replace(/^["']|["']$/g, '').trim();
    return voiceover || 'Discover something amazing today. Take action now.';
  } catch (error) {
    console.error('Failed to generate voiceover:', error);
    // Fallback voiceover
    return 'Experience the difference. Start your journey today.';
  }
}

export function CommercialStrategist({ onApplyStrategy, onGenerateBrollImages }: CommercialStrategistProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [targetDuration, setTargetDuration] = useState('60');
  const [twins, setTwins] = useState<Twin[]>([]);
  const [extractedStrategy, setExtractedStrategy] = useState<CommercialStrategy | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch user's AI twins
  useEffect(() => {
    async function fetchTwins() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('ai_twins')
        .select('id, name, description, voice_cloning_key')
        .eq('user_id', user.id);

      if (data) {
        setTwins(data);
      }
    }
    fetchTwins();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const extractStrategyFromMessage = (content: string): CommercialStrategy | null => {
    // Look for JSON code block
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('Failed to parse strategy JSON:', e);
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
            availableTwins: twins.filter(t => t.voice_cloning_key).map(t => ({
              name: t.name,
              description: t.description
            })),
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

      // Add empty assistant message to update progressively
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line by line
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
            // Incomplete JSON, put back and wait
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Check if response contains a strategy
      const strategy = extractStrategyFromMessage(assistantContent);
      if (strategy) {
        setExtractedStrategy(strategy);
      }

    } catch (error) {
      console.error('Strategy chat error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to get response');
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyStrategy = async () => {
    if (!extractedStrategy) return;

    setIsGeneratingImages(true);
    toast.info('Preparing strategy...');

    // First, generate voiceovers for any montage segments that are missing them
    const processedStrategySegments = await Promise.all(
      extractedStrategy.segments.map(async (seg) => {
        if (seg.type === 'broll-montage' && !seg.voiceover && seg.brollPrompts?.length > 0) {
          toast.info('Generating voiceover for montage...');
          const generatedVoiceover = await generateVoiceoverFromPrompts(
            seg.brollPrompts,
            extractedStrategy.title
          );
          return { ...seg, voiceover: generatedVoiceover };
        }
        return seg;
      })
    );

    // Convert strategy segments to CommercialSegment format
    const segments: CommercialSegment[] = processedStrategySegments.map((seg, index) => {
      // Calculate duration based on script length for speaking segments
      let duration = seg.duration || 8;
      if (seg.type === 'twin-speaking' && seg.script) {
        duration = calculateDurationFromScript(seg.script);
      } else if (seg.type === 'broll-montage' && seg.voiceover) {
        duration = calculateDurationFromScript(seg.voiceover);
      }

      const baseSegment = {
        id: crypto.randomUUID(),
        order: index,
        duration,
        transition: seg.transition || 'cut',
        status: 'pending' as const,
      };

      if (seg.type === 'twin-speaking') {
        // Find matching twin by name
        const matchedTwin = twins.find(t => 
          t.name.toLowerCase().includes(seg.twinName?.toLowerCase() || '') ||
          seg.twinName?.toLowerCase().includes(t.name.toLowerCase())
        );

        return {
          ...baseSegment,
          type: 'twin-speaking' as const,
          twinId: matchedTwin?.id,
          script: seg.script || '',
        };
      } else if (seg.type === 'broll-voice-continue') {
        return {
          ...baseSegment,
          type: 'broll-voice-continue' as const,
          brollPrompts: seg.brollPrompts || [],
          brollImages: [],
        };
      } else if (seg.type === 'broll-montage') {
        return {
          ...baseSegment,
          type: 'broll-montage' as const,
          voiceover: seg.voiceover || '',
          brollPrompts: seg.brollPrompts || [],
          brollImages: [],
        };
      }

      // Default to twin-speaking if type is unknown
      return {
        ...baseSegment,
        type: 'twin-speaking' as const,
        script: seg.script || '',
      };
    });

    onApplyStrategy(segments, extractedStrategy.title);
    toast.success('Strategy applied to timeline!');
    setExtractedStrategy(null);

    // Generate B-roll images for segments that have prompts
    const brollSegments = segments.filter(
      s => (s.type === 'broll-voice-continue' || s.type === 'broll-montage') && s.brollPrompts && s.brollPrompts.length > 0
    );

    if (brollSegments.length > 0 && onGenerateBrollImages) {
      toast.info('Generating B-roll images...');
      try {
        await onGenerateBrollImages(segments);
        toast.success('B-roll images generated!');
      } catch (error) {
        console.error('Failed to generate B-roll images:', error);
        toast.error('Failed to generate some B-roll images');
      }
    }

    setIsGeneratingImages(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const twinsWithVoice = twins.filter(t => t.voice_cloning_key);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                AI Commercial Strategist
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </CardTitle>
              <CardDescription>
                Brainstorm your commercial concept with AI - get a complete strategy with segments, scripts, and B-roll
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* Settings Row */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Select value={targetDuration} onValueChange={setTargetDuration}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="180">3 minutes</SelectItem>
                  <SelectItem value="240">4 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Layers className="h-4 w-4" />
              <span>{twinsWithVoice.length} AI Twin{twinsWithVoice.length !== 1 ? 's' : ''} available</span>
            </div>

            {twinsWithVoice.length === 0 && (
              <Badge variant="destructive" className="text-xs">
                No cloned voices - create AI Twins first
              </Badge>
            )}
          </div>

          {/* Chat Area */}
          <div className="border rounded-lg bg-background">
            <ScrollArea className="h-[280px] p-4" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                  <Sparkles className="h-8 w-8 mb-3 opacity-50" />
                  <p className="font-medium">Start brainstorming your commercial</p>
                  <p className="text-sm mt-1">
                    Describe your product/service, target audience, and goals
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4 justify-center">
                    {[
                      "I'm launching a fitness app for busy professionals",
                      "We sell eco-friendly cleaning products",
                      "I have a SaaS tool for small businesses",
                    ].map((example, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs"
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
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg px-4 py-2 ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.content === '' && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="border-t p-3">
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your commercial idea..."
                  className="min-h-[60px] resize-none"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="h-auto"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Strategy Preview & Apply */}
          {extractedStrategy && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-green-500" />
                      <span className="font-semibold">{extractedStrategy.title}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{extractedStrategy.summary}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="gap-1">
                        <Music className="h-3 w-3" />
                        {extractedStrategy.musicStyle}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {extractedStrategy.totalDuration}s total
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        <Layers className="h-3 w-3" />
                        {extractedStrategy.segments.length} segments
                      </Badge>
                    </div>
                  </div>
                  <Button onClick={handleApplyStrategy} className="gap-2">
                    <Wand2 className="h-4 w-4" />
                    Apply to Timeline
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
