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
import agentAvatar from '@/assets/chatcut-agent.png';
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
  Save,
  FilePlus,
  FolderOpen,
  Image as ImageIcon,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { ExportToDriveButton } from '@/components/ExportToDriveButton';
import { PiPOverlay } from '@/components/PiPOverlay';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';

const AGENT_NAME = 'Marco';

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
  audioUrl?: string;
}

interface OverlayItem {
  id: string;
  type: string;
  text: string;
  start: number;
  duration: number;
  imageUrl?: string;
  imageStatus?: 'generating' | 'ready' | 'failed';
}

interface BRollClip {
  id: string;
  name: string;
  prompt: string;
  start: number;
  duration: number;
  imageUrl?: string;
  imageStatus?: 'generating' | 'ready' | 'failed';
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
  const [bRollClips, setBRollClips] = useState<BRollClip[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const [trackMuted, setTrackMuted] = useState({ v1: false, v2: false, a1: false });
  // PiP state
  const [bgVideoUrl, setBgVideoUrl] = useState<string | null>(null);
  const [pipEnabled, setPipEnabled] = useState(false);
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  // Draft state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('Untitled Project');
  const [isSaving, setIsSaving] = useState(false);
  const [showDraftPicker, setShowDraftPicker] = useState(false);
  const [savedDrafts, setSavedDrafts] = useState<any[]>([]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync music audio with video playback
  useEffect(() => {
    musicTracks.forEach(track => {
      if (!track.audioUrl) return;
      let audioEl = musicAudioRefs.current.get(track.id);
      if (!audioEl) {
        audioEl = new Audio(track.audioUrl);
        audioEl.loop = true;
        musicAudioRefs.current.set(track.id, audioEl);
      }
      audioEl.volume = trackMuted.a1 ? 0 : track.volume;

      const inRange = currentTime >= track.startAt && currentTime < track.startAt + track.duration;
      if (isPlaying && inRange) {
        const expectedTime = currentTime - track.startAt;
        if (Math.abs(audioEl.currentTime - expectedTime) > 0.5) {
          audioEl.currentTime = expectedTime;
        }
        if (audioEl.paused) audioEl.play().catch(() => {});
      } else {
        if (!audioEl.paused) audioEl.pause();
      }
    });
  }, [isPlaying, currentTime, musicTracks, trackMuted.a1]);

  // Cleanup music audio on unmount
  useEffect(() => {
    return () => {
      musicAudioRefs.current.forEach(el => { el.pause(); el.src = ''; });
      musicAudioRefs.current.clear();
    };
  }, []);

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

  // Sync background video with main video playback
  useEffect(() => {
    const bg = bgVideoRef.current;
    const main = videoRef.current;
    if (!bg || !main || !pipEnabled || !bgVideoUrl) return;
    const sync = () => {
      if (Math.abs(bg.currentTime - main.currentTime) > 0.3) bg.currentTime = main.currentTime;
      if (main.paused && !bg.paused) bg.pause();
      if (!main.paused && bg.paused) bg.play().catch(() => {});
    };
    const interval = setInterval(sync, 200);
    main.addEventListener('play', () => bg.play().catch(() => {}));
    main.addEventListener('pause', () => bg.pause());
    main.addEventListener('seeked', sync);
    return () => {
      clearInterval(interval);
    };
  }, [pipEnabled, bgVideoUrl]);

  // Upload background video
  const uploadBgVideo = useCallback(async (file: File) => {
    if (!user) return;
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/bg-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('raw-footage').upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('raw-footage').getPublicUrl(path);
      setBgVideoUrl(urlData.publicUrl);
      setPipEnabled(true);
      toast({ title: 'Background video added', description: 'Your main video is now a PiP overlay. Drag to reposition, click size to resize.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  }, [user, toast]);

  // Load drafts on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from('chatcut_drafts')
      .select('id, name, updated_at, video_url')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setSavedDrafts(data);
          setShowDraftPicker(true);
        }
      });
  }, [user]);

  const resetProject = useCallback(() => {
    setMessages([]);
    setVideoUrl(null);
    setVideoFile(null);
    setTranscript(null);
    setCuts([]);
    setTimelineClips([]);
    setMusicTracks([]);
    setOverlays([]);
    setBRollClips([]);
    setCaptionSettings({ ...defaultCaptionSettings, enabled: false });
    setDraftId(null);
    setDraftName('Untitled Project');
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowDraftPicker(false);
    musicAudioRefs.current.forEach(el => { el.pause(); el.src = ''; });
    musicAudioRefs.current.clear();
  }, []);

  const getTimelineState = useCallback(() => ({
    clips: timelineClips.map(c => ({ name: c.name, startAt: c.startAt, duration: c.duration })),
    cuts: cuts.filter(c => c.accepted),
    musicTracks: musicTracks.map(t => ({ name: t.name, genre: t.genre, mood: t.mood, volume: t.volume, startAt: t.startAt, duration: t.duration, hasAudio: !!t.audioUrl })),
    overlays: overlays.map(o => ({ type: o.type, text: o.text, start: o.start, duration: o.duration, hasImage: !!o.imageUrl })),
    bRollClips: bRollClips.map(b => ({ name: b.name, start: b.start, duration: b.duration, hasImage: !!b.imageUrl })),
    captionsEnabled: captionSettings.enabled,
    captionStyle: captionSettings.style,
  }), [timelineClips, cuts, musicTracks, overlays, bRollClips, captionSettings]);

  const saveDraft = useCallback(async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const timelineState = {
        clips: timelineClips,
        cuts,
        musicTracks: musicTracks.map(({ ...t }) => ({ ...t })),
        overlays,
        bRollClips,
        captionSettings,
      };
      const payload: Record<string, unknown> = {
        user_id: user.id,
        name: draftName,
        video_url: videoUrl,
        transcript: transcript as unknown,
        timeline_state: timelineState as unknown,
        chat_history: messages as unknown,
      };
      if (draftId) {
        await supabase.from('chatcut_drafts').update(payload as any).eq('id', draftId);
      } else {
        const { data } = await supabase.from('chatcut_drafts').insert(payload as any).select('id').single();
        if (data) setDraftId(data.id);
      }
      toast({ title: 'Draft saved', description: `"${draftName}" saved successfully` });
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }, [user, draftId, draftName, videoUrl, transcript, timelineClips, cuts, musicTracks, overlays, bRollClips, captionSettings, messages, toast]);

  const loadDraft = useCallback(async (id: string) => {
    if (!user) return;
    const { data, error } = await supabase.from('chatcut_drafts').select('*').eq('id', id).single();
    if (error || !data) {
      toast({ title: 'Load failed', description: 'Could not load draft', variant: 'destructive' });
      return;
    }
    resetProject();
    setDraftId(data.id);
    setDraftName(data.name);
    setVideoUrl(data.video_url);
    setTranscript(data.transcript);
    const ts = data.timeline_state as any;
    if (ts) {
      setTimelineClips(ts.clips || []);
      setCuts(ts.cuts || []);
      setMusicTracks(ts.musicTracks || []);
      setOverlays(ts.overlays || []);
      setBRollClips(ts.bRollClips || []);
      if (ts.captionSettings) setCaptionSettings(ts.captionSettings);
    }
    const ch = data.chat_history as any;
    if (Array.isArray(ch)) setMessages(ch);
    setShowDraftPicker(false);
    toast({ title: 'Draft loaded', description: `Resumed "${data.name}"` });
  }, [user, toast, resetProject]);

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
        { role: 'assistant', content: `Hey! 👋 I'm ${AGENT_NAME}, your video editor.\n\nJust finished uploading and transcribing your footage — looking good!\n\nI can auto-clean, add captions, music, B-roll, motion graphics, or review the whole timeline. What should we start with? 🎬` },
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

  // Generate B-roll image via generate-scene-image
  const generateBRollImage = useCallback(async (clipId: string, prompt: string) => {
    setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, imageStatus: 'generating' } : b));
    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt },
      });
      if (error || !data?.imageUrl) throw new Error(error?.message || 'No image generated');
      setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, imageUrl: data.imageUrl, imageStatus: 'ready' } : b));
      toast({ title: 'B-Roll ready', description: 'Image generated and added to timeline' });
    } catch (err: any) {
      console.error('B-roll gen error:', err);
      setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, imageStatus: 'failed' } : b));
    }
  }, [toast]);

  // Generate motion graphic image via Lovable AI Gateway
  const generateMotionGraphic = useCallback(async (overlayId: string, text: string, type: string, styleHint?: string) => {
    setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, imageStatus: 'generating' } : o));
    try {
      const style = styleHint || 'glass';
      const styleDesc: Record<string, string> = {
        glass: 'modern translucent glass background with subtle blur',
        bold: 'high-contrast bold background with strong colors',
        minimal: 'clean minimal design with thin elegant lines',
        neon: 'glowing neon edges with vibrant color highlights',
        broadcast: 'professional news broadcast style with accent bar',
      };
      const styleText = styleDesc[style] || styleDesc.glass;
      const stylePrompts: Record<string, string> = {
        motion_graphic: `Professional broadcast-quality motion graphic overlay with the text "${text}" in bold modern sans-serif font, ${styleText}, clean design, suitable for video overlay, transparent edges, on a clean dark background`,
        animated_text: `Cinematic animated text graphic showing "${text}" in elegant typography, ${styleText}, film-quality title card, subtle glow effects, on a clean dark background`,
        lower_third: `Professional lower-third graphic overlay with name "${text}", ${styleText}, sleek bar design, clean typography, on a clean dark background`,
        title_card: `Professional title card graphic showing "${text}" in bold cinematic typography, ${styleText}, centered composition, film-quality design, on a clean dark background`,
      };
      const imagePrompt = stylePrompts[type] || stylePrompts.motion_graphic;

      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.1-flash-image-preview',
          messages: [{ role: 'user', content: imagePrompt }],
          modalities: ['image', 'text'],
        }),
      });

      if (!resp.ok) throw new Error('Image generation failed');
      const data = await resp.json();
      const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imgUrl) throw new Error('No image in response');

      setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, imageUrl: imgUrl, imageStatus: 'ready' } : o));
      toast({ title: 'Motion graphic ready', description: `"${text}" generated successfully` });
    } catch (err: any) {
      console.error('Motion graphic gen error:', err);
      setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, imageStatus: 'failed' } : o));
    }
  }, [toast]);

  const executeActions = useCallback((actions: TimelineAction[]) => {
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
        case 'add_music': {
          const musicName = `${act.mood || act.genre || 'Background'} ${act.genre || 'Music'}`;
          const trackId = crypto.randomUUID();
          const newTrack: MusicTrack = {
            id: trackId, genre: act.genre || 'ambient', mood: act.mood || 'calm',
            volume: act.volume ?? 0.3, fadeIn: act.fadeIn ?? true, fadeOut: act.fadeOut ?? true,
            name: musicName.charAt(0).toUpperCase() + musicName.slice(1),
            duration: duration || 60, startAt: 0,
          };
          setMusicTracks(prev => [...prev, newTrack]);
          toast({ title: '🎵 Generating music...', description: `${musicName} — this takes ~15s` });
          setIsGeneratingMusic(true);
          supabase.functions.invoke('generate-music', {
            body: { mood: `${act.mood || 'calm'} ${act.genre || 'ambient'} background music for a video`, duration: Math.min(duration || 30, 60) },
          }).then(({ data, error }) => {
            setIsGeneratingMusic(false);
            if (error || !data?.audioUrl) {
              toast({ title: 'Music generation failed', description: 'Track added to timeline without audio', variant: 'destructive' });
              return;
            }
            setMusicTracks(prev => prev.map(t => t.id === trackId ? { ...t, audioUrl: data.audioUrl } : t));
            toast({ title: '🎵 Music ready!', description: `${musicName} is now playing with your video` });
          });
          break;
        }
        case 'add_overlay': {
          const overlayId = crypto.randomUUID();
          const newOverlay: OverlayItem = {
            id: overlayId, type: act.type || 'lower_third',
            text: act.text || '', start: act.start || 0, duration: act.duration || 5,
          };
          setOverlays(prev => [...prev, newOverlay]);
          toast({ title: 'Overlay added', description: `"${act.text}" — generating graphic...` });
          // Generate motion graphic image for motion_graphic and animated_text types
          if (['motion_graphic', 'animated_text', 'lower_third', 'title_card'].includes(act.type || '')) {
            generateMotionGraphic(overlayId, act.text || '', act.type || 'motion_graphic', act.style);
          }
          break;
        }
        case 'split':
          if (timelineClips.length > 0) {
            const splitTime = act.time ?? currentTime;
            const clipIdx = timelineClips.findIndex(c => splitTime >= c.startAt && splitTime < c.startAt + c.duration);
            if (clipIdx >= 0) {
              const clip = timelineClips[clipIdx];
              const relTime = splitTime - clip.startAt;
              if (relTime > 0.1 && relTime < clip.duration - 0.1) {
                const left: TimelineClip = { ...clip, id: crypto.randomUUID(), duration: relTime };
                const right: TimelineClip = { ...clip, id: crypto.randomUUID(), startAt: splitTime, duration: clip.duration - relTime };
                setTimelineClips(prev => [...prev.slice(0, clipIdx), left, right, ...prev.slice(clipIdx + 1)]);
              }
            }
          }
          toast({ title: 'Split', description: `Clip split at ${(act.time ?? currentTime).toFixed(1)}s` });
          break;
        case 'add_broll': {
          const brollId = crypto.randomUUID();
          const broll: BRollClip = {
            id: brollId,
            name: act.description || act.prompt || 'B-Roll',
            prompt: act.prompt || act.description || '',
            start: act.start ?? currentTime,
            duration: act.duration ?? 5,
          };
          setBRollClips(prev => [...prev, broll]);
          toast({ title: 'B-Roll added', description: `"${broll.name}" — generating image...` });
          // Generate real B-roll image
          if (broll.prompt) {
            generateBRollImage(brollId, broll.prompt);
          }
          break;
        }
        case 'review':
          // Review is handled conversationally by the AI
          break;
      }
    }
  }, [toast, duration, currentTime, timelineClips, generateBRollImage, generateMotionGraphic]);

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
        body: JSON.stringify({
          messages: allMessages,
          transcript,
          timelineState: getTimelineState(),
        }),
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
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [mediaPanelVisible, setMediaPanelVisible] = useState(true);

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
    if (content.includes('"add_broll"')) badges.push({ label: '✓ B-Roll added', color: 'bg-green-500/20 text-green-400 border-green-500/30' });
    return badges;
  };

  // Find active B-roll clip at current time
  const activeBRoll = bRollClips.find(br => currentTime >= br.start && currentTime < br.start + br.duration && br.imageUrl && br.imageStatus === 'ready');

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Draft picker overlay */}
        {showDraftPicker && savedDrafts.length > 0 && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <img src={agentAvatar} alt={AGENT_NAME} className="w-10 h-10 rounded-full ring-2 ring-primary/30" />
                  <div>
                    <h3 className="font-semibold text-foreground">Welcome back! 👋</h3>
                    <p className="text-sm text-muted-foreground">Resume a draft or start fresh?</p>
                  </div>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedDrafts.map(d => (
                    <Button key={d.id} variant="outline" className="w-full justify-start gap-2 text-left" onClick={() => loadDraft(d.id)}>
                      <FolderOpen className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{d.name}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(d.updated_at).toLocaleDateString()}</p>
                      </div>
                    </Button>
                  ))}
                </div>
                <Button className="w-full gap-2" onClick={() => { resetProject(); }}>
                  <FilePlus className="w-4 h-4" /> Start New Project
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-gradient-accent">
              <Scissors className="w-4 h-4 text-primary" />
            </div>
            <h1 className="text-sm font-semibold text-foreground">Chatcut AI</h1>
            <div className="w-px h-5 bg-border" />
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              className="h-7 text-xs w-40 bg-muted/30 border-0 focus-visible:ring-1"
              placeholder="Project name..."
            />
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
            <Button
              size="sm"
              variant="ghost"
              className="text-xs gap-1 h-7"
              onClick={() => {
                if (videoUrl || messages.length > 0) {
                  if (confirm('Start a new project? Unsaved changes will be lost.')) resetProject();
                } else {
                  resetProject();
                }
              }}
            >
              <FilePlus className="w-3.5 h-3.5" /> New
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1 h-7"
              disabled={isSaving || (!videoUrl && messages.length === 0)}
              onClick={saveDraft}
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
            <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white border-0 font-semibold px-4">
              Export
            </Button>
            {videoUrl && (
              <ExportToDriveButton videoUrl={videoUrl} fileName={draftName || 'Chatcut-Export'} />
            )}
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
                          <div className="text-center py-6">
                            <img src={agentAvatar} alt={AGENT_NAME} className="w-16 h-16 rounded-full mx-auto mb-3 ring-2 ring-primary/30" loading="lazy" width={64} height={64} />
                            <p className="text-sm font-semibold text-foreground mb-1">Hey! I'm {AGENT_NAME} 👋</p>
                            <p className="text-xs text-muted-foreground">
                              Your AI video editor. Upload some footage and let's make it shine!
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
                              <div className="flex gap-2 text-sm text-foreground">
                                <img src={agentAvatar} alt={AGENT_NAME} className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5 ring-1 ring-primary/20" loading="lazy" width={28} height={28} />
                                <div className="min-w-0 flex-1">
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
                              </div>
                            )}
                          </div>
                        ))}
                        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <img src={agentAvatar} alt={AGENT_NAME} className="w-6 h-6 rounded-full flex-shrink-0 animate-pulse" loading="lazy" width={24} height={24} />
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {AGENT_NAME} is working on it...
                          </div>
                        )}
                        {isGeneratingMusic && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                            <Music className="w-3 h-3 animate-bounce" />
                            Generating custom music track...
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
                  <div className="flex-1 flex items-center justify-center min-h-0 overflow-hidden bg-black">
                    {/* Video wrapper – sized to match the actual video so overlays stay within bounds */}
                    <div ref={videoWrapperRef} className="relative inline-block max-h-full max-w-full overflow-visible" style={{ lineHeight: 0 }}>
                      {/* Background video (when PiP mode is active) */}
                      {pipEnabled && bgVideoUrl && (
                        <video
                          ref={bgVideoRef}
                          src={bgVideoUrl}
                          className="max-h-[100%] max-w-[100%] block"
                          style={{ maxHeight: 'calc(100vh - 300px)' }}
                          muted
                          loop
                          playsInline
                          onClick={togglePlay}
                        />
                      )}
                      {/* B-Roll image overlay when active */}
                      {activeBRoll && (
                        <img
                          src={activeBRoll.imageUrl}
                          alt={activeBRoll.name}
                          className="max-h-[100%] max-w-[100%] block absolute inset-0 w-full h-full object-cover z-[5]"
                          style={{ maxHeight: 'calc(100vh - 300px)' }}
                        />
                      )}
                      {/* Main video - when PiP is enabled, this becomes the PiP overlay */}
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className={cn(
                          "max-h-[100%] max-w-[100%] block",
                          activeBRoll && "opacity-0",
                          pipEnabled && bgVideoUrl && "hidden" // Hide original; PiP component shows it
                        )}
                        style={{ maxHeight: 'calc(100vh - 300px)' }}
                        onClick={togglePlay}
                      />

                      {/* PiP overlay for main video */}
                      {pipEnabled && bgVideoUrl && (
                        <PiPOverlay
                          videoRef={videoRef}
                          containerRef={videoWrapperRef}
                          enabled={pipEnabled}
                        />
                      )}

                      {/* Motion graphics / overlay visuals on video */}
                      {trackVisibility.v3 && overlays
                        .filter(o => (o.type === 'motion_graphic' || o.type === 'animated_text') && currentTime >= o.start && currentTime < o.start + o.duration)
                        .map(ov => (
                          <div key={ov.id} className="absolute top-4 left-0 right-0 pointer-events-none z-10 flex justify-center">
                            {ov.imageUrl && ov.imageStatus === 'ready' ? (
                              <img src={ov.imageUrl} alt={ov.text} className="max-w-[80%] max-h-[30%] object-contain rounded-lg" />
                            ) : ov.imageStatus === 'generating' ? (
                              <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/40 flex items-center gap-2">
                                <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                                <span className="text-purple-200 text-sm">Generating graphic...</span>
                              </div>
                            ) : (
                              <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/40">
                                <span className="text-purple-200 text-sm font-semibold">{ov.text}</span>
                              </div>
                            )}
                          </div>
                        ))
                      }

                      {/* V2 text overlays on video */}
                      {trackVisibility.v2 && overlays
                        .filter(o => o.type !== 'motion_graphic' && o.type !== 'animated_text' && currentTime >= o.start && currentTime < o.start + o.duration)
                        .map(ov => (
                          <div key={ov.id} className="absolute bottom-20 left-0 right-0 pointer-events-none z-10 flex justify-center">
                            {ov.imageUrl && ov.imageStatus === 'ready' ? (
                              <img src={ov.imageUrl} alt={ov.text} className="max-w-[80%] max-h-[20%] object-contain" />
                            ) : (
                              <div className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-md border border-pink-500/30">
                                <span className="text-pink-100 text-xs">{ov.text}</span>
                              </div>
                            )}
                          </div>
                        ))
                      }

                      {/* B-Roll generating indicator */}
                      {bRollClips.some(br => currentTime >= br.start && currentTime < br.start + br.duration && br.imageStatus === 'generating') && (
                        <div className="absolute top-2 right-2 pointer-events-none z-10">
                          <div className="bg-green-500/80 px-2 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1">
                            <Loader2 className="w-2.5 h-2.5 animate-spin" /> GENERATING B-ROLL
                          </div>
                        </div>
                      )}

                      {/* B-Roll badge for clips without image */}
                      {!activeBRoll && bRollClips.some(br => currentTime >= br.start && currentTime < br.start + br.duration && br.imageStatus !== 'generating') && (
                        <div className="absolute top-2 right-2 pointer-events-none z-10">
                          <div className="bg-green-500/80 px-2 py-0.5 rounded text-[10px] font-bold text-white">B-ROLL</div>
                        </div>
                      )}

                      {/* Live caption overlay – constrained to video bounds */}
                      {captionSettings.enabled && transcript && (() => {
                        const segs = transcript.segments || transcript.words || [];
                        const activeSeg = segs.find((s: any, i: number) => {
                          const segEnd = s.end ?? (segs[i + 1]?.start ?? duration);
                          return currentTime >= s.start && currentTime < segEnd;
                        });
                        const activeText = activeSeg?.text || activeSeg?.word || '';
                        if (!activeText) return null;
                        const activeIdx = segs.indexOf(activeSeg);
                        const segDuration = (activeSeg.end ?? (segs[activeIdx + 1]?.start ?? duration)) - activeSeg.start;
                        return (
                          <div className="absolute bottom-6 left-2 right-2 pointer-events-none z-10">
                            <KaraokeCaption
                              text={activeText}
                              currentTime={currentTime - activeSeg.start}
                              duration={segDuration}
                              style={captionSettings.style}
                              background={captionSettings.background}
                              fontFamily={captionSettings.fontFamily}
                              fontSize={captionSettings.fontSize}
                              fontColor={captionSettings.fontColor}
                            />
                          </div>
                        );
                      })()}
                    </div>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Split at playhead"
                    onClick={() => {
                      if (timelineClips.length === 0 || duration === 0) return;
                      const clipIdx = timelineClips.findIndex(c => currentTime >= c.startAt && currentTime < c.startAt + c.duration);
                      if (clipIdx >= 0) {
                        const clip = timelineClips[clipIdx];
                        const relTime = currentTime - clip.startAt;
                        if (relTime > 0.1 && relTime < clip.duration - 0.1) {
                          const left: TimelineClip = { ...clip, id: crypto.randomUUID(), duration: relTime };
                          const right: TimelineClip = { ...clip, id: crypto.randomUUID(), startAt: currentTime, duration: clip.duration - relTime };
                          setTimelineClips(prev => [...prev.slice(0, clipIdx), left, right, ...prev.slice(clipIdx + 1)]);
                          toast({ title: 'Split', description: `Clip split at ${formatTime(currentTime)}` });
                        }
                      }
                    }}>
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
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Captions"
                    onClick={() => setCaptionSettings(prev => ({ ...prev, enabled: !prev.enabled }))}>
                    <Captions className={cn("w-3.5 h-3.5", captionSettings.enabled && "text-pink-400")} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Picture-in-Picture"
                    onClick={() => {
                      if (pipEnabled) {
                        setPipEnabled(false);
                        setBgVideoUrl(null);
                      } else {
                        bgFileInputRef.current?.click();
                      }
                    }}>
                    <Layers className={cn("w-3.5 h-3.5", pipEnabled && "text-green-400")} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Fullscreen"
                    onClick={() => {
                      const vid = pipEnabled ? bgVideoRef.current : videoRef.current;
                      if (!vid) return;
                      if (document.fullscreenElement) {
                        document.exitFullscreen();
                        setIsFullscreen(false);
                      } else {
                        vid.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
                      }
                    }}>
                    <Maximize className={cn("w-3.5 h-3.5", isFullscreen && "text-primary")} />
                  </Button>
                  {/* Hidden file input for background video */}
                  <input
                    ref={bgFileInputRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadBgVideo(f);
                    }}
                  />
                </div>

                {/* Multi-Track Timeline */}
                <div className={cn("border-t border-border bg-card flex-shrink-0 relative", timelineCollapsed && "h-8 overflow-hidden")}>
                  {/* Timeline ruler with inline collapse toggle */}
                  <div className="relative h-6 border-b border-border overflow-hidden bg-muted/30 cursor-pointer flex items-center"
                    onClick={(e) => {
                      if (duration <= 0) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const offsetX = e.clientX - rect.left - 72;
                      const trackWidth = rect.width - 72;
                      if (offsetX < 0 || trackWidth <= 0) return;
                      const ratio = Math.max(0, Math.min(1, offsetX / trackWidth));
                      seekTo(ratio * duration);
                    }}>
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
                    {/* Inline collapse toggle */}
                    <button
                      className="absolute right-1 top-0 bottom-0 z-30 flex items-center gap-0.5 text-[9px] text-muted-foreground hover:text-foreground transition-colors px-1.5 bg-muted/60 hover:bg-muted rounded"
                      onClick={(e) => { e.stopPropagation(); setTimelineCollapsed(prev => !prev); }}
                      title={timelineCollapsed ? 'Expand timeline' : 'Collapse timeline'}
                    >
                      {timelineCollapsed ? <ZoomIn className="w-3 h-3" /> : <ZoomOut className="w-3 h-3" />}
                      <span className="hidden sm:inline">{timelineCollapsed ? 'Show' : 'Hide'}</span>
                    </button>
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
                                className={cn(
                                  "absolute inset-y-0 rounded border flex items-center px-2 cursor-pointer transition-colors",
                                  ov.imageStatus === 'generating'
                                    ? "bg-purple-500/10 border-purple-500/30 animate-pulse"
                                    : ov.imageStatus === 'ready'
                                    ? "bg-purple-500/25 border-purple-500/50 hover:bg-purple-500/35"
                                    : "bg-purple-500/20 border-purple-500/40 hover:bg-purple-500/30"
                                )}
                                style={{
                                  left: `${(ov.start / Math.max(duration, 1)) * 100}%`,
                                  width: `${(ov.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                              >
                                {ov.imageStatus === 'generating' ? (
                                  <Loader2 className="w-2.5 h-2.5 text-purple-400 mr-1 flex-shrink-0 animate-spin" />
                                ) : ov.imageUrl ? (
                                  <ImageIcon className="w-2.5 h-2.5 text-purple-400 mr-1 flex-shrink-0" />
                                ) : (
                                  <Layers className="w-2.5 h-2.5 text-purple-400 mr-1 flex-shrink-0" />
                                )}
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

                      {/* B-Roll Track */}
                      <div className="flex items-center h-9 border-b border-border/50 group hover:bg-muted/20">
                        <div className="w-[72px] flex-shrink-0 flex items-center gap-1 px-2">
                          <span className="text-[10px] font-semibold text-green-400 w-5">BR</span>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-60 hover:opacity-100">
                            <Eye className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                        <div className="flex-1 relative h-6 mx-1">
                          {bRollClips.length > 0 ? (
                            bRollClips.map((br) => (
                              <div
                                key={br.id}
                                className={cn(
                                  "absolute inset-y-0 rounded border flex items-center px-2 cursor-pointer transition-colors",
                                  br.imageStatus === 'generating'
                                    ? "bg-green-500/10 border-green-500/30 animate-pulse"
                                    : br.imageStatus === 'ready'
                                    ? "bg-green-500/25 border-green-500/50 hover:bg-green-500/35"
                                    : "bg-green-500/20 border-green-500/40 hover:bg-green-500/30"
                                )}
                                style={{
                                  left: `${(br.start / Math.max(duration, 1)) * 100}%`,
                                  width: `${(br.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                                onClick={() => seekTo(br.start)}
                              >
                                {br.imageStatus === 'generating' ? (
                                  <Loader2 className="w-2.5 h-2.5 text-green-400 mr-1 flex-shrink-0 animate-spin" />
                                ) : br.imageUrl ? (
                                  <ImageIcon className="w-2.5 h-2.5 text-green-400 mr-1 flex-shrink-0" />
                                ) : (
                                  <Film className="w-2.5 h-2.5 text-green-400 mr-1 flex-shrink-0" />
                                )}
                                <span className="text-[9px] text-green-300 truncate">{br.name}</span>
                              </div>
                            ))
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

                    {/* B-Roll */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Film className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">B-Roll</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4 justify-center">{bRollClips.length}</Badge>
                      </div>
                      {bRollClips.length > 0 ? (
                        <div className="space-y-1.5">
                          {bRollClips.map((br) => (
                            <div key={br.id} className="flex items-center gap-2 p-1.5 rounded border border-border hover:border-green-500/50 cursor-pointer transition-colors" onClick={() => seekTo(br.start)}>
                              {br.imageUrl && br.imageStatus === 'ready' ? (
                                <img src={br.imageUrl} alt={br.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                  {br.imageStatus === 'generating' ? (
                                    <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                                  ) : (
                                    <Film className="w-4 h-4 text-green-400" />
                                  )}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-foreground truncate">{br.name}</p>
                                <p className="text-[9px] text-muted-foreground">{br.duration}s{br.imageStatus === 'generating' ? ' · generating...' : br.imageStatus === 'ready' ? ' · ✓' : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No b-roll</p>
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
                            <div key={ov.id} className="flex items-center gap-2 p-1.5 rounded border border-border hover:border-pink-500/50 cursor-pointer transition-colors" onClick={() => seekTo(ov.start)}>
                              {ov.imageUrl && ov.imageStatus === 'ready' ? (
                                <img src={ov.imageUrl} alt={ov.text} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded bg-pink-500/20 flex items-center justify-center flex-shrink-0">
                                  {ov.imageStatus === 'generating' ? (
                                    <Loader2 className="w-4 h-4 text-pink-400 animate-spin" />
                                  ) : (
                                    <Layers className="w-4 h-4 text-pink-400" />
                                  )}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-foreground truncate">{ov.text || ov.type}</p>
                                <p className="text-[9px] text-muted-foreground">{ov.duration}s{ov.imageStatus === 'generating' ? ' · generating...' : ov.imageStatus === 'ready' ? ' · ✓' : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No motion graphics</p>
                      )}
                    </div>

                    {/* Caption Style */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Captions className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Caption Style</span>
                      </div>
                      <CaptionStyleSelector
                        settings={captionSettings}
                        onChange={setCaptionSettings}
                      />
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
