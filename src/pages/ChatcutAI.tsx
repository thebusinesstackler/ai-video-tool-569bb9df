import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import { KaraokeCaption, CaptionSettings, defaultCaptionSettings } from '@/components/KaraokeCaption';
import { CaptionStyleSelector } from '@/components/CaptionStyleSelector';
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

// CaptionState replaced by CaptionSettings from KaraokeCaption

interface MusicTrack {
  id: string;
  genre: string;
  mood: string;
  volume: number;
  fadeIn: boolean;
  fadeOut: boolean;
  name: string;
  duration: number;
  startAt: number;
}

interface OverlayItem {
  id: string;
  type: string;
  text: string;
  start: number;
  duration: number;
}

type TimelineAction = {
  action: string;
  [key: string]: any;
};

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
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>({ ...defaultCaptionSettings, enabled: false });
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
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

  const parseActions = (content: string): TimelineAction[] => {
    const actionsMatch = content.match(/```actions\n([\s\S]*?)\n```/);
    const cutsMatch = content.match(/```cuts\n([\s\S]*?)\n```/);
    if (actionsMatch) {
      try { return JSON.parse(actionsMatch[1]); } catch { return []; }
    }
    if (cutsMatch) {
      try {
        return JSON.parse(cutsMatch[1]).map((c: any) => ({ ...c, action: 'cut' }));
      } catch { return []; }
    }
    return [];
  };

  const executeActions = (actions: TimelineAction[]) => {
    for (const act of actions) {
      switch (act.action) {
        case 'cut':
          setCuts(prev => [...prev, {
            start: act.start, end: act.end,
            reason: act.reason || 'AI cut', type: act.type || 'other', accepted: true,
          }]);
          toast({ title: 'Cut added', description: act.reason || `${act.start}s — ${act.end}s` });
          break;
        case 'add_captions': {
          const presetMap: Record<string, Partial<CaptionSettings>> = {
            tiktok: { style: 'wordPop', background: 'solid', fontFamily: 'Montserrat', fontSize: 'large', fontColor: '#ffffff' },
            minimal: { style: 'karaoke', background: 'glass', fontFamily: 'Inter', fontSize: 'medium', fontColor: '#ffffff' },
            cinematic: { style: 'spotlight', background: 'gradient', fontFamily: 'Oswald', fontSize: 'xl', fontColor: '#ffffff' },
            youtube: { style: 'typewriter', background: 'solid', fontFamily: 'Poppins', fontSize: 'medium', fontColor: '#facc15' },
          };
          const presetSettings = presetMap[act.preset || 'tiktok'] || presetMap.tiktok;
          setCaptionSettings(prev => ({ ...prev, ...presetSettings, enabled: true }));
          toast({ title: 'Captions enabled', description: `${(act.preset || 'tiktok').toUpperCase()} style applied` });
          break;
        }
          break;
        case 'add_music': {
          const musicName = `${act.mood || act.genre || 'Background'} ${act.genre || 'Music'}`;
          setMusicTracks(prev => [...prev, {
            id: crypto.randomUUID(), genre: act.genre || 'ambient', mood: act.mood || 'calm',
            volume: act.volume ?? 0.3, fadeIn: act.fadeIn ?? true, fadeOut: act.fadeOut ?? true,
            name: musicName.charAt(0).toUpperCase() + musicName.slice(1),
            duration: duration || 60, startAt: 0,
          }]);
          toast({ title: 'Music added', description: `${musicName} added to A1 track` });
          break;
        }
        case 'add_overlay':
          setOverlays(prev => [...prev, {
            id: crypto.randomUUID(), type: act.type || 'lower_third',
            text: act.text || '', start: act.start || 0, duration: act.duration || 5,
          }]);
          toast({ title: 'Overlay added', description: `"${act.text}" on V2 track` });
          break;
        case 'split':
          toast({ title: 'Split', description: `Clip split at ${act.time}s on ${act.track || 'V1'}` });
          break;
      }
    }
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
      const actions = parseActions(assistantSoFar);
      if (actions.length > 0) executeActions(actions);
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
    if (videoRef.current) videoRef.current.currentTime = time;
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

  const timelineTicks: number[] = [];
  if (duration > 0) {
    const interval = duration > 120 ? 30 : duration > 30 ? 10 : 5;
    for (let t = 0; t <= duration; t += interval) {
      timelineTicks.push(t);
    }
  }

  const [zoomLevel, setZoomLevel] = useState(100);
  const [trackVisibility, setTrackVisibility] = useState({ v1: true, v2: true, v3: true, a1: true });
  const [trackMuted, setTrackMuted] = useState({ v1: false, v2: false, a1: false });

  const toggleTrackVisibility = (track: 'v1' | 'v2' | 'v3' | 'a1') => {
    setTrackVisibility(prev => ({ ...prev, [track]: !prev[track] }));
  };

  const toggleTrackMute = (track: 'v1' | 'v2' | 'a1') => {
    setTrackMuted(prev => ({ ...prev, [track]: !prev[track] }));
  };

  const cleanMessageContent = (content: string) => {
    return content
      .replace(/```actions\n[\s\S]*?\n```/g, '')
      .replace(/```cuts\n[\s\S]*?\n```/g, '')
      .trim();
  };

  const getActionBadges = (content: string) => {
    const badges: { label: string; color: string }[] = [];
    if (content.includes('"add_captions"')) badges.push({ label: '✓ Captions enabled', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' });
    if (content.includes('"add_music"')) badges.push({ label: '✓ Music added', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' });
    if (content.includes('"add_overlay"')) badges.push({ label: '✓ Overlay added', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' });
    if (content.includes('"cut"')) badges.push({ label: '✓ Cuts applied', color: 'bg-destructive/20 text-destructive border-destructive/30' });
    return badges;
  };

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
            <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white border-0 font-semibold px-4">
              Export
            </Button>
          </div>
        </div>

        {/* Main content: resizable 3-panel layout */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            {/* Left Panel: AI Chat + Transcript */}
            <ResizablePanel defaultSize={28} minSize={20} maxSize={40}>
              <div className="h-full flex flex-col bg-card">
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
                                <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_th]:py-1 [&_td]:py-1">
                                  <ReactMarkdown>{cleanMessageContent(msg.content)}</ReactMarkdown>
                                </div>
                                {getActionBadges(msg.content).length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {getActionBadges(msg.content).map((b, bi) => (
                                      <Badge key={bi} variant="outline" className={cn('text-[10px] px-1.5 py-0', b.color)}>
                                        {b.label}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
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
                  </TabsContent>

                  <TabsContent value="transcript" className="flex-1 overflow-hidden m-0 p-0">
                    <ScrollArea className="h-full px-3 py-2">
                      {transcript ? (
                        <div className="space-y-1 text-sm">
                          {(transcript.segments || transcript.words || []).map((seg: any, i: number, arr: any[]) => {
                            const segEnd = seg.end ?? (arr[i + 1]?.start ?? duration);
                            const isActive = currentTime >= seg.start && currentTime < segEnd;
                            return (
                              <p
                                key={i}
                                className={cn(
                                  "cursor-pointer transition-colors rounded px-1.5 py-0.5 -mx-1.5",
                                  isActive
                                    ? "bg-primary/15 text-primary font-medium"
                                    : "text-foreground/60 hover:text-foreground hover:bg-muted/50"
                                )}
                                onClick={() => seekTo(seg.start)}
                              >
                                <span className={cn(
                                  "text-xs font-mono mr-2",
                                  isActive ? "text-primary" : "text-muted-foreground"
                                )}>
                                  {formatTimeShort(seg.start)}
                                </span>
                                {seg.text || seg.word}
                              </p>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {isTranscribing ? 'Transcribing...' : 'Upload a video to see the transcript'}
                        </p>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>

                {/* Chat input — always visible at bottom regardless of tab */}
                <div className="p-3 border-t border-border mt-auto flex-shrink-0">
                  <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="space-y-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Tell AI what changes to make..."
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
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Center Panel: Video + Transport + Timeline */}
            <ResizablePanel defaultSize={52} minSize={35}>
              <div className="h-full flex flex-col bg-black/95">
                {/* Video preview */}
                {videoUrl ? (
                  <div className="flex-1 flex items-center justify-center min-h-0 relative">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      className="max-h-full max-w-full"
                      onClick={togglePlay}
                    />
                    {/* Live caption overlay */}
                    {captionSettings.enabled && transcript && (
                      <div className="absolute bottom-8 left-4 right-4 pointer-events-none z-10">
                        <KaraokeCaption
                          text={(() => {
                            const segs = transcript.segments || transcript.words || [];
                            const activeSeg = segs.find((s: any, i: number) => {
                              const segEnd = s.end ?? (segs[i + 1]?.start ?? duration);
                              return currentTime >= s.start && currentTime < segEnd;
                            });
                            return activeSeg?.text || activeSeg?.word || '';
                          })()}
                          currentTime={(() => {
                            const segs = transcript.segments || transcript.words || [];
                            const activeSeg = segs.find((s: any, i: number) => {
                              const segEnd = s.end ?? (segs[i + 1]?.start ?? duration);
                              return currentTime >= s.start && currentTime < segEnd;
                            });
                            return activeSeg ? currentTime - activeSeg.start : 0;
                          })()}
                          duration={(() => {
                            const segs = transcript.segments || transcript.words || [];
                            const activeIdx = segs.findIndex((s: any, i: number) => {
                              const segEnd = s.end ?? (segs[i + 1]?.start ?? duration);
                              return currentTime >= s.start && currentTime < segEnd;
                            });
                            if (activeIdx < 0) return 1;
                            const s = segs[activeIdx];
                            return (s.end ?? (segs[activeIdx + 1]?.start ?? duration)) - s.start;
                          })()}
                          style={captionSettings.style}
                          background={captionSettings.background}
                          fontFamily={captionSettings.fontFamily}
                          fontSize={captionSettings.fontSize}
                          fontColor={captionSettings.fontColor}
                        />
                      </div>
                    )}
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
                <div className="flex items-center gap-1 px-3 py-1.5 bg-card border-t border-border flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Split at playhead">
                    <Scissors className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Snap">
                    <Link2 className="w-3.5 h-3.5" />
                  </Button>
                  <div className="w-px h-5 bg-border mx-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => seekTo(Math.max(0, currentTime - 5))}>
                    <SkipBack className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={togglePlay}>
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => seekTo(Math.min(duration, currentTime + 5))}>
                    <SkipForward className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs font-mono text-amber-500 ml-2 tabular-nums">{formatTime(currentTime)}</span>
                  <span className="text-xs text-muted-foreground mx-1">/</span>
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">{formatTime(duration)}</span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomLevel(z => Math.max(50, z - 25))}>
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground font-mono w-8 text-center">{zoomLevel}%</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoomLevel(z => Math.min(200, z + 25))}>
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                  <div className="w-px h-5 bg-border mx-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Captions">
                    <Captions className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Fullscreen">
                    <Maximize className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Multi-Track Timeline */}
                <div className="border-t border-border bg-card flex-shrink-0 relative">
                  {/* Timeline ruler */}
                  <div className="relative h-6 border-b border-border overflow-hidden bg-muted/30">
                    <div className="absolute inset-0 px-[72px]">
                      {timelineTicks.map((t) => (
                        <div
                          key={t}
                          className="absolute flex flex-col items-center"
                          style={{ left: `${(t / Math.max(duration, 1)) * 100}%` }}
                        >
                          <span className="text-[9px] text-muted-foreground font-mono mt-1">{formatTimeShort(t)}</span>
                          <div className="w-px h-2 bg-border" />
                        </div>
                      ))}
                    </div>
                    {duration > 0 && (
                      <div
                        className="absolute top-0 bottom-0 z-20"
                        style={{ left: `calc(72px + ${(currentTime / duration) * (100 - 10)}%)` }}
                      >
                        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-amber-500 -ml-[5px]" />
                        <div className="w-0.5 h-full bg-amber-500 -ml-[1px]" />
                      </div>
                    )}
                  </div>

                  {timelineClips.length > 0 ? (
                    <div className="flex flex-col relative">
                      {/* V3 Track - Motion Graphics */}
                      <div className="flex items-center h-9 border-b border-border/50 group hover:bg-muted/20">
                        <div className="w-[72px] flex-shrink-0 flex items-center gap-1 px-2">
                          <span className="text-[10px] font-semibold text-purple-400 w-5">V3</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => toggleTrackVisibility('v3')}>
                            {trackVisibility.v3 ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                          </Button>
                        </div>
                        <div className="flex-1 relative h-6 mx-1">
                          {overlays.filter(o => o.type === 'motion_graphic' || o.type === 'animated_text').length > 0 ? (
                            overlays.filter(o => o.type === 'motion_graphic' || o.type === 'animated_text').map((ov) => (
                              <div
                                key={ov.id}
                                className="absolute inset-y-0 rounded bg-purple-500/20 border border-purple-500/40 flex items-center px-2 cursor-pointer hover:bg-purple-500/30 transition-colors"
                                style={{
                                  left: `${(ov.start / Math.max(duration, 1)) * 100}%`,
                                  width: `${(ov.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                              >
                                <Layers className="w-2.5 h-2.5 text-purple-400 mr-1 flex-shrink-0" />
                                <span className="text-[9px] text-purple-300 truncate">{ov.text}</span>
                              </div>
                            ))
                          ) : (
                            <div className="absolute inset-0 border border-dashed border-border/30 rounded" />
                          )}
                        </div>
                        <div className="w-10 flex-shrink-0" />
                      </div>

                      {/* V2 Track - Overlays / Captions */}
                      <div className="flex items-center h-9 border-b border-border/50 group hover:bg-muted/20">
                        <div className="w-[72px] flex-shrink-0 flex items-center gap-1 px-2">
                          <span className="text-[10px] font-semibold text-pink-400 w-5">V2</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => toggleTrackVisibility('v2')}>
                            {trackVisibility.v2 ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                          </Button>
                          {captionSettings.enabled && (
                            <Badge className="text-[8px] px-1 py-0 h-3.5 bg-pink-500/20 text-pink-400 border-pink-500/30">CC</Badge>
                          )}
                        </div>
                        <div className="flex-1 relative h-6 mx-1">
                          {overlays.filter(o => o.type !== 'motion_graphic' && o.type !== 'animated_text').length > 0 ? (
                            overlays.filter(o => o.type !== 'motion_graphic' && o.type !== 'animated_text').map((ov) => (
                              <div
                                key={ov.id}
                                className="absolute inset-y-0 rounded bg-pink-500/20 border border-pink-500/40 flex items-center px-2 cursor-pointer hover:bg-pink-500/30 transition-colors"
                                style={{
                                  left: `${(ov.start / Math.max(duration, 1)) * 100}%`,
                                  width: `${(ov.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                              >
                                <Sparkles className="w-2.5 h-2.5 text-pink-400 mr-1 flex-shrink-0" />
                                <span className="text-[9px] text-pink-300 truncate">{ov.text}</span>
                              </div>
                            ))
                          ) : captionSettings.enabled ? (
                            <div className="absolute inset-y-0 left-0 right-0 rounded bg-pink-500/15 border border-pink-500/30 flex items-center px-2">
                              <Captions className="w-3 h-3 text-pink-400 mr-1.5" />
                              <span className="text-[9px] text-pink-300">Captions — {captionSettings.style.toUpperCase()}</span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 border border-dashed border-border/30 rounded" />
                          )}
                        </div>
                        <div className="w-10 flex-shrink-0" />
                      </div>

                      {/* V1 Track - Video */}
                      <div className="flex items-center h-11 border-b border-border/50 group hover:bg-muted/20">
                        <div className="w-[72px] flex-shrink-0 flex items-center gap-1 px-2">
                          <span className="text-[10px] font-semibold text-primary w-5">V1</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => toggleTrackVisibility('v1')}>
                            {trackVisibility.v1 ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => toggleTrackMute('v1')}>
                            {trackMuted.v1 ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                          </Button>
                        </div>
                        <div className="flex-1 relative h-8 mx-1">
                          {timelineClips.map((clip) => (
                            <div
                              key={clip.id}
                              className="absolute inset-y-0 rounded bg-primary/25 border border-primary/40 overflow-hidden flex items-center cursor-pointer hover:bg-primary/35 transition-colors"
                              style={{
                                left: `${(clip.startAt / Math.max(duration, 1)) * 100}%`,
                                width: `${(clip.duration / Math.max(duration, 1)) * 100}%`,
                              }}
                              onClick={() => seekTo(clip.startAt)}
                            >
                              <div className="absolute inset-0 flex">
                                {Array.from({ length: 8 }).map((_, fi) => (
                                  <div key={fi} className="flex-1 border-r border-primary/10 bg-gradient-to-b from-primary/10 to-primary/5" />
                                ))}
                              </div>
                              <span className="relative text-[10px] text-foreground font-medium px-2 truncate z-10">
                                {clip.name}
                              </span>
                            </div>
                          ))}
                          {cuts.filter(c => c.accepted).map((cut, i) => (
                            <div
                              key={`cut-${i}`}
                              className="absolute inset-y-0 bg-destructive/25 border-l border-r border-destructive/50 cursor-pointer hover:bg-destructive/35"
                              style={{
                                left: `${(cut.start / Math.max(duration, 1)) * 100}%`,
                                width: `${((cut.end - cut.start) / Math.max(duration, 1)) * 100}%`,
                              }}
                              title={cut.reason}
                            />
                          ))}
                        </div>
                        <div className="w-10 flex-shrink-0 flex items-center justify-center">
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-60 hover:opacity-100">
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      </div>

                      {/* A1 Track - Audio */}
                      <div className="flex items-center h-9 group hover:bg-muted/20">
                        <div className="w-[72px] flex-shrink-0 flex items-center gap-1 px-2">
                          <span className="text-[10px] font-semibold text-cyan-400 w-5">A1</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-60 hover:opacity-100" onClick={() => toggleTrackMute('a1')}>
                            {trackMuted.a1 ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                          </Button>
                        </div>
                        <div className="flex-1 relative h-6 mx-1">
                          {musicTracks.length > 0 ? (
                            musicTracks.map((track) => (
                              <div
                                key={track.id}
                                className="absolute inset-y-0 rounded bg-cyan-500/20 border border-cyan-500/40 overflow-hidden flex items-center cursor-pointer hover:bg-cyan-500/30 transition-colors"
                                style={{
                                  left: `${(track.startAt / Math.max(duration, 1)) * 100}%`,
                                  width: `${(track.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                              >
                                <div className="absolute inset-0 flex items-center gap-px px-1 opacity-50">
                                  {Array.from({ length: 50 }).map((_, wi) => (
                                    <div
                                      key={wi}
                                      className="flex-1 bg-cyan-400/50 rounded-full"
                                      style={{ height: `${15 + Math.random() * 65}%` }}
                                    />
                                  ))}
                                </div>
                                <span className="relative text-[9px] text-cyan-300 font-medium px-2 truncate z-10">
                                  {track.name}
                                </span>
                              </div>
                            ))
                          ) : (
                            timelineClips.map((clip) => (
                              <div
                                key={`a-${clip.id}`}
                                className="absolute inset-y-0 rounded bg-cyan-500/15 border border-cyan-500/30 overflow-hidden"
                                style={{
                                  left: `${(clip.startAt / Math.max(duration, 1)) * 100}%`,
                                  width: `${(clip.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                              >
                                <div className="absolute inset-0 flex items-center gap-px px-1">
                                  {Array.from({ length: 40 }).map((_, wi) => (
                                    <div
                                      key={wi}
                                      className="flex-1 bg-cyan-400/40 rounded-full"
                                      style={{ height: `${20 + Math.random() * 60}%` }}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="w-10 flex-shrink-0 flex items-center justify-center">
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-60 hover:opacity-100">
                            <Trash2 className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Playhead line spanning all tracks */}
                      {duration > 0 && (
                        <div
                          className="absolute bottom-0 top-0 z-20 pointer-events-none"
                          style={{ left: `calc(72px + ${(currentTime / duration) * (100 - 10)}%)` }}
                        >
                          <div className="w-0.5 h-full bg-amber-500" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      className="h-28 flex items-center justify-center text-sm text-muted-foreground cursor-pointer"
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Drop media here or add from Media panel
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            {/* Right Panel: Media */}
            <ResizablePanel defaultSize={20} minSize={10} maxSize={30}>
              <div className="h-full flex flex-col bg-card border-l border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                  <span className="text-xs font-semibold text-foreground">Media</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fileInputRef.current?.click()}>
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-4">
                    {/* Videos */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Video className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Videos</span>
                        {timelineClips.length > 0 && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4 justify-center">{timelineClips.length}</Badge>
                        )}
                      </div>
                      {timelineClips.length > 0 ? (
                        <div className="space-y-2">
                          {timelineClips.map((clip) => (
                            <div key={clip.id} className="relative rounded-lg overflow-hidden cursor-pointer group border border-border hover:border-primary/50 transition-colors">
                              <video src={clip.url} className="w-full aspect-video object-cover" />
                              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                                {formatTimeShort(clip.duration)}
                              </div>
                              <p className="text-xs text-foreground/80 p-1.5 truncate">{clip.name}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No videos</p>
                      )}
                    </div>

                    {/* Audios */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Music className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Audios</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4 justify-center">{musicTracks.length}</Badge>
                      </div>
                      {musicTracks.length > 0 ? (
                        <div className="space-y-1.5">
                          {musicTracks.map((track) => (
                            <div key={track.id} className="flex items-center gap-2 p-1.5 rounded border border-border hover:border-cyan-500/50 cursor-pointer transition-colors">
                              <div className="w-8 h-8 rounded bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                <Music className="w-4 h-4 text-cyan-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-foreground truncate">{track.name}</p>
                                <p className="text-[9px] text-muted-foreground">{track.genre} · {Math.round(track.volume * 100)}%</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No audio files</p>
                      )}
                    </div>

                    {/* Motion Graphics */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Motion Graphics</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4 justify-center">{overlays.length}</Badge>
                      </div>
                      {overlays.length > 0 ? (
                        <div className="space-y-1.5">
                          {overlays.map((ov) => (
                            <div key={ov.id} className="flex items-center gap-2 p-1.5 rounded border border-border hover:border-pink-500/50 cursor-pointer transition-colors">
                              <div className="w-8 h-8 rounded bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                                <Layers className="w-4 h-4 text-pink-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-foreground truncate">{ov.text || ov.type}</p>
                                <p className="text-[9px] text-muted-foreground">{ov.duration}s</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No motion graphics</p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </Layout>
  );
};

export default ChatcutAI;
