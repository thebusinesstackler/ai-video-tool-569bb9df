import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import {
  Scissors,
  Upload,
  Send,
  Sparkles,
  Trash2,
  Check,
  X,
  Loader2,
  Film,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CutSuggestion {
  start: number;
  end: number;
  reason: string;
  type: 'filler' | 'pause' | 'other';
  accepted?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatcut-director`;

const ChatcutAI = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [transcript, setTranscript] = useState<any>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [cuts, setCuts] = useState<CutSuggestion[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const uploadVideo = useCallback(async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('raw-footage').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('raw-footage').getPublicUrl(path);
      setVideoUrl(urlData.publicUrl);
      setVideoFile(file);
      toast({ title: 'Video uploaded', description: 'Your footage is ready for editing.' });

      // Auto-transcribe
      setIsTranscribing(true);
      const { data: txData, error: txError } = await supabase.functions.invoke('transcribe-video', {
        body: { videoUrl: urlData.publicUrl },
      });
      if (txError) throw txError;
      setTranscript(txData);
      setIsTranscribing(false);

      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: '✅ Video uploaded and transcribed! You can now:\n- Type **"auto-clean"** to automatically detect filler words and pauses\n- Ask me anything about your footage\n- Tell me specific parts you want to cut' },
      ]);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      setIsTranscribing(false);
    } finally {
      setIsUploading(false);
    }
  }, [user, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith('video/')) uploadVideo(file);
    else toast({ title: 'Invalid file', description: 'Please upload a video file.', variant: 'destructive' });
  }, [uploadVideo, toast]);

  const parseCuts = (content: string): CutSuggestion[] => {
    const match = content.match(/```cuts\n([\s\S]*?)\n```/);
    if (!match) return [];
    try {
      return JSON.parse(match[1]).map((c: any) => ({ ...c, accepted: true }));
    } catch { return []; }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    let assistantSoFar = '';
    const allMessages = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, transcript }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error('Rate limit exceeded. Please wait a moment.');
        if (resp.status === 402) throw new Error('Credits required. Please add funds.');
        throw new Error('Failed to get response');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
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
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Parse cuts from response
      const newCuts = parseCuts(assistantSoFar);
      if (newCuts.length > 0) setCuts(newCuts);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCut = (index: number) => {
    setCuts(prev => prev.map((c, i) => i === index ? { ...c, accepted: !c.accepted } : c));
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play();
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Layout>
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-accent">
            <Scissors className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Chatcut AI</h1>
            <p className="text-sm text-muted-foreground">Chat-powered video editing — remove filler words & dead air automatically</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Left: Video + Cuts */}
          <div className="lg:col-span-1 flex flex-col gap-4">
            {/* Video Player / Upload */}
            {videoUrl ? (
              <Card className="border-border">
                <CardContent className="p-3">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="w-full rounded-lg aspect-video bg-black"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      <Film className="w-3 h-3 mr-1" />
                      {videoFile?.name || 'Uploaded'}
                    </Badge>
                    {isTranscribing && (
                      <Badge variant="outline" className="text-xs">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Transcribing...
                      </Badge>
                    )}
                    {transcript && !isTranscribing && (
                      <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                        ✓ Transcribed
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card
                className="border-dashed border-2 border-border hover:border-primary/50 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="p-8 flex flex-col items-center justify-center text-center">
                  {isUploading ? (
                    <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
                  ) : (
                    <Upload className="w-10 h-10 text-muted-foreground mb-3" />
                  )}
                  <p className="font-medium text-foreground">
                    {isUploading ? 'Uploading...' : 'Drop raw footage here'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadVideo(f);
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Cut Suggestions */}
            {cuts.length > 0 && (
              <Card className="border-border flex-1 overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Suggested Cuts ({cuts.filter(c => c.accepted).length}/{cuts.length})</h3>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1.5">
                      {cuts.map((cut, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer transition-colors',
                            cut.accepted
                              ? 'bg-destructive/10 border border-destructive/20'
                              : 'bg-muted/50 border border-transparent opacity-50'
                          )}
                          onClick={() => seekTo(cut.start)}
                        >
                          <button onClick={(e) => { e.stopPropagation(); toggleCut(i); }} className="flex-shrink-0">
                            {cut.accepted ? (
                              <Check className="w-4 h-4 text-destructive" />
                            ) : (
                              <X className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                          <span className="font-mono text-xs text-muted-foreground">
                            {formatTime(cut.start)}–{formatTime(cut.end)}
                          </span>
                          <span className="flex-1 truncate text-foreground">{cut.reason}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {cut.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: Chat */}
          <div className="lg:col-span-2 flex flex-col">
            <Card className="border-border flex-1 flex flex-col overflow-hidden">
              <CardContent className="p-0 flex flex-col flex-1">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.length === 0 && (
                      <div className="text-center py-12">
                        <Scissors className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="font-semibold text-foreground mb-2">Welcome to Chatcut AI</h3>
                        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                          Upload your raw footage and I'll help you clean it up. I can automatically remove filler words, awkward pauses, and suggest scene cuts.
                        </p>
                        {videoUrl && transcript && (
                          <Button
                            variant="outline"
                            onClick={() => sendMessage('Auto-clean my video — remove all filler words and awkward pauses')}
                            className="gap-2"
                          >
                            <Wand2 className="w-4 h-4" />
                            Auto-Clean Video
                          </Button>
                        )}
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex',
                          msg.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[80%] rounded-xl px-4 py-3 text-sm',
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-foreground'
                          )}
                        >
                          {msg.role === 'assistant' ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            msg.content
                          )}
                        </div>
                      </div>
                    ))}
                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-xl px-4 py-3">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {/* Quick Actions */}
                {videoUrl && transcript && messages.length > 0 && (
                  <div className="px-4 py-2 border-t border-border flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => sendMessage('Auto-clean my video')}>
                      <Wand2 className="w-3 h-3" /> Auto-Clean
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => sendMessage('Show me all the filler words')}>
                      <Sparkles className="w-3 h-3" /> Find Fillers
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => sendMessage('Find all awkward pauses longer than 2 seconds')}>
                      <Scissors className="w-3 h-3" /> Find Pauses
                    </Button>
                  </div>
                )}

                {/* Input */}
                <div className="p-4 border-t border-border">
                  <form
                    onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                    className="flex gap-2"
                  >
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={videoUrl ? 'Ask me to clean your video...' : 'Upload a video to get started...'}
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChatcutAI;
