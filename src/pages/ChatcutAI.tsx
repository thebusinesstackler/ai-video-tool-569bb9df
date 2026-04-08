import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import {
  Scissors,
  Upload,
  Send,
  Sparkles,
  Loader2,
  Film,
  Wand2,
  Play,
  Pause,
  Plus,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Trash2,
  Link2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize,
  RatioIcon,
  Captions,
  Music,
  Layers,
  Video,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

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

interface TimelineClip {
  id: string;
  name: string;
  url: string;
  duration: number;
  startAt: number;
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  const [activeTab, setActiveTab] = useState<'ai' | 'transcript'>('ai');
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentTime(video.currentTime);
    const onMeta = () => setDuration(video.duration);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoUrl]);

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

      // Add to timeline
      const tempVideo = document.createElement('video');
      tempVideo.src = urlData.publicUrl;
      tempVideo.addEventListener('loadedmetadata', () => {
        setTimelineClips([{
          id: crypto.randomUUID(),
          name: file.name.replace(/\.[^.]+$/, ''),
          url: urlData.publicUrl,
          duration: tempVideo.duration,
          startAt: 0,
        }]);
        setDuration(tempVideo.duration);
      });

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
        { role: 'assistant', content: '✅ Video uploaded and transcribed! I\'ve added it to the timeline.\n\nYou can now:\n- Type **"auto-clean"** to automatically detect filler words and pauses\n- Ask me anything about your footage\n- Tell me specific parts you want to cut' },
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

      const newCuts = parseCuts(assistantSoFar);
      if (newCuts.length > 0) setCuts(newCuts);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) videoRef.current.pause();
    else videoRef.current.play();
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 100);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const formatTimeShort = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Generate timeline tick marks
  const timelineTicks = [];
  if (duration > 0) {
    const interval = duration > 120 ? 30 : duration > 30 ? 10 : 5;
    for (let t = 0; t <= duration; t += interval) {
      timelineTicks.push(t);
    }
  }

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-accent">
              <Scissors className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-sm font-semibold text-foreground">Chatcut AI</h1>
          </div>
          <div className="flex items-center gap-2">
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
            <Button variant="default" size="sm" className="text-xs">
              Export
            </Button>
          </div>
        </div>

        {/* Main content: 3-column layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: AI Chat + Transcript */}
          <div className="w-[340px] flex-shrink-0 border-r border-border flex flex-col bg-card">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ai' | 'transcript')} className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="mx-3 mt-2 mb-0 bg-muted/50">
                <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
                <TabsTrigger value="transcript" className="text-xs">Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="ai" className="flex-1 flex flex-col overflow-hidden m-0 p-0">
                <ScrollArea className="flex-1 px-3 py-2">
                  <div className="space-y-3">
                    {messages.length === 0 && (
                      <div className="text-center py-8">
                        <Scissors className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Upload footage and tell AI what changes to make
                        </p>
                      </div>
                    )}
                    {messages.map((msg, i) => (
                      <div key={i}>
                        {msg.role === 'user' ? (
                          <div className="bg-muted/70 rounded-lg p-3 text-sm text-foreground">
                            {msg.content}
                            {videoFile && i === 0 && (
                              <span className="inline-flex items-center gap-1 ml-1 text-xs bg-background/50 rounded px-1.5 py-0.5">
                                <Film className="w-3 h-3" />
                                {videoFile.name.length > 16 ? videoFile.name.slice(0, 16) + '...' : videoFile.name}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-foreground">
                            <div className="prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing your media — your prompt will run when ready...
                      </div>
                    )}
                    <div ref={scrollRef} />
                  </div>
                </ScrollArea>

                {/* Chat input */}
                <div className="p-3 border-t border-border">
                  <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="space-y-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Tell AI what changes to make — @ to reference media"
                      disabled={isLoading}
                      className="text-sm bg-muted/30"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 h-7 text-muted-foreground">
                          <Sparkles className="w-3 h-3" /> Agent
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => fileInputRef.current?.click()}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                        <Button type="submit" disabled={isLoading || !input.trim()} size="icon" className="h-7 w-7 rounded-full bg-primary">
                          <Send className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </form>
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
                </div>
              </TabsContent>

              <TabsContent value="transcript" className="flex-1 overflow-hidden m-0 p-0">
                <ScrollArea className="h-full px-3 py-2">
                  {transcript ? (
                    <div className="space-y-1 text-sm">
                      {(transcript.segments || transcript.words || []).map((seg: any, i: number) => (
                        <p
                          key={i}
                          className="text-foreground/80 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => seekTo(seg.start)}
                        >
                          <span className="text-xs text-muted-foreground font-mono mr-2">
                            {formatTimeShort(seg.start)}
                          </span>
                          {seg.text || seg.word}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {isTranscribing ? 'Transcribing...' : 'Upload a video to see the transcript'}
                    </p>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {/* Center: Video Player */}
          <div className="flex-1 flex flex-col bg-black/95">
            {videoUrl ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="max-h-full max-w-full rounded"
                  onClick={togglePlay}
                />
              </div>
            ) : (
              <div
                className="flex-1 flex items-center justify-center cursor-pointer"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-12 text-center">
                  {isUploading ? (
                    <Loader2 className="w-10 h-10 text-muted-foreground animate-spin mx-auto mb-3" />
                  ) : (
                    <Upload className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                  )}
                  <p className="text-muted-foreground text-sm">
                    {isUploading ? 'Uploading...' : 'Drop files or'}{' '}
                    {!isUploading && <span className="underline text-foreground">browse</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Transport controls */}
            <div className="flex items-center gap-3 px-4 py-2 bg-card border-t border-border">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={togglePlay}>
                <Scissors className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Link2 className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={togglePlay}>
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </Button>
              <span className="text-xs font-mono text-muted-foreground">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
              <div className="flex-1" />
              <Slider
                value={[50]}
                max={100}
                step={1}
                className="w-20"
              />
            </div>
          </div>

          {/* Right: Media panel */}
          <div className="w-[220px] flex-shrink-0 border-l border-border flex flex-col bg-card">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold text-foreground">Media</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fileInputRef.current?.click()}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-3">
              {videoFile ? (
                <div className="space-y-2">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Videos {timelineClips.length}</p>
                  <div className="space-y-2">
                    {timelineClips.map((clip) => (
                      <div key={clip.id} className="relative rounded-lg overflow-hidden cursor-pointer group border border-border">
                        <video src={clip.url} className="w-full aspect-video object-cover" />
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                          {formatTimeShort(clip.duration)}
                        </div>
                        <p className="text-xs text-foreground/80 p-1.5 truncate">{clip.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">No media uploaded</p>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Bottom: Timeline */}
        <div className="border-t border-border bg-card">
          {timelineClips.length > 0 ? (
            <div className="flex flex-col">
              {/* Timeline ruler */}
              <div className="relative h-5 border-b border-border overflow-hidden">
                <div className="absolute inset-0 flex items-end px-12">
                  {timelineTicks.map((t) => (
                    <div
                      key={t}
                      className="absolute text-[9px] text-muted-foreground font-mono"
                      style={{ left: `${(t / duration) * 100}%` }}
                    >
                      {formatTimeShort(t)}
                    </div>
                  ))}
                </div>
                {/* Playhead */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                    style={{ left: `calc(48px + ${(currentTime / duration) * (100)}%)` }}
                  >
                    <div className="w-2 h-3 bg-primary -ml-[3px] rounded-b" />
                  </div>
                )}
              </div>

              {/* Track V1 */}
              <div className="flex items-center h-14 px-2">
                <div className="w-10 flex-shrink-0 flex items-center gap-1 text-xs text-muted-foreground font-medium">
                  V1
                </div>
                <div className="flex-1 relative h-10">
                  {timelineClips.map((clip) => (
                    <div
                      key={clip.id}
                      className="absolute inset-y-0 rounded bg-primary/30 border border-primary/50 overflow-hidden flex items-center cursor-pointer"
                      style={{
                        left: `${(clip.startAt / duration) * 100}%`,
                        width: `${(clip.duration / duration) * 100}%`,
                      }}
                      onClick={() => seekTo(clip.startAt)}
                    >
                      <span className="text-[10px] text-primary-foreground font-medium px-2 truncate">
                        {clip.name}
                      </span>
                    </div>
                  ))}

                  {/* Cut markers */}
                  {cuts.filter(c => c.accepted).map((cut, i) => (
                    <div
                      key={`cut-${i}`}
                      className="absolute inset-y-0 bg-destructive/20 border-l border-r border-destructive/50 cursor-pointer"
                      style={{
                        left: `${(cut.start / duration) * 100}%`,
                        width: `${((cut.end - cut.start) / duration) * 100}%`,
                      }}
                      title={cut.reason}
                    />
                  ))}
                </div>
                <div className="w-16 flex-shrink-0 flex items-center justify-end gap-0.5">
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Eye className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Volume2 className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Drop zone for more media */}
              <div className="h-8 flex items-center justify-center text-[10px] text-muted-foreground border-t border-border">
                Drop media here or add from Media
              </div>
            </div>
          ) : (
            <div
              className="h-24 flex items-center justify-center text-sm text-muted-foreground cursor-pointer"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              Drop media here or add from Media
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ChatcutAI;
