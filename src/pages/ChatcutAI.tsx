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
import { downloadSocialVideoToStorage } from '@/lib/socialVideoDownload';
import { extractBrollFrames, parseBrollClipMeta } from '@/lib/extractBrollFrames';

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

interface VizardClip {
  id: string;
  title: string;
  description: string;
  start: number;
  end: number;
  score: number;
  tags: string[];
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
  animation?: OverlayAnimation;
  style?: string;
  position?: { x: number; y: number };
  scale?: number; // 1 = default, up to 5 = full screen
}

interface BrandSettings {
  primaryColor: string;
  textColor: string;
  font: string;
  logoUrl: string | null;
  websiteUrl?: string;
}

interface BRollClip {
  id: string;
  name: string;
  prompt: string;
  start: number;
  duration: number;
  imageUrl?: string;
  imageStatus?: 'generating' | 'ready' | 'failed';
  videoUrl?: string;
  videoStatus?: 'generating' | 'ready' | 'failed';
  videoTaskId?: string;
  /** When this b-roll references a window inside a longer source video, sourceStart marks the in-point. */
  sourceStart?: number;
  sourceUrl?: string;
  /** When true, the b-roll's own audio plays and the main video is ducked. Default false (silent overlay). */
  audioEnabled?: boolean;
  /** Insertion order — higher wins when multiple b-rolls cover the same time (defensive tie-break). */
  z?: number;
}

interface OverlayAnimation {
  entrance: 'slide-up' | 'fade-in' | 'scale-pop' | 'slide-left' | 'none';
  exit: 'fade-out' | 'scale-out' | 'slide-down' | 'none';
}

type TimelineAction = {
  action: string;
  [key: string]: any;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatcut-director`;

const ProjectNameInput = ({ value, onSave }: { value: string; onSave: (v: string) => void }) => {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <Input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => onSave(local)}
      className="h-7 text-xs w-40 bg-muted/30 border-0 focus-visible:ring-1"
      placeholder="Project name..."
    />
  );
};

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
  const [hasInteracted, setHasInteracted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoAspect, setVideoAspect] = useState<number | null>(null); // width / height
  const [timelineClips, setTimelineClips] = useState<TimelineClip[]>([]);
  const [activeTab, setActiveTab] = useState<'ai' | 'transcript' | 'clips'>('ai');
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
  const [brandGuidelines, setBrandGuidelines] = useState<string | null>(null);
  const [vizardClips, setVizardClips] = useState<VizardClip[]>([]);
  const [brandSettings, setBrandSettings] = useState<BrandSettings>({
    primaryColor: '#6366f1',
    textColor: '#ffffff',
    font: 'Inter',
    logoUrl: null,
    websiteUrl: '',
  });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  // Opening thumbnail / TikTok cover (shows over the first N seconds + as fullscreen first frame)
  const [thumbnail, setThumbnail] = useState<{
    url: string;
    headline?: string;
    duration: number; // seconds the cover holds at the start of playback
  } | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  // Saved B-roll frames + product images for media panel
  const [savedBrollFrames, setSavedBrollFrames] = useState<{ id: string; image_url: string; prompt: string | null }[]>([]);
  const [savedBrollClips, setSavedBrollClips] = useState<{ id: string; image_url: string; prompt: string | null }[]>([]);
  const [isAutoExtracting, setIsAutoExtracting] = useState(false);
  const [productImages, setProductImages] = useState<{ id: string; image_url: string; label: string | null; product_name?: string; product_id?: string }[]>([]);
  const [productLibrary, setProductLibrary] = useState<{ id: string; name: string; description: string | null; benefits: string[] | null; brand_name?: string; primary_image?: string }[]>([]);

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const musicAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Fetch brand guidelines on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('brand_guidelines_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (data && (data as any).brand_guidelines_url) {
          const { data: fileData } = await supabase.storage
            .from('brand-guidelines')
            .download((data as any).brand_guidelines_url);
          if (fileData) {
            const text = await fileData.text();
            // Take first 8000 chars to keep context manageable
            setBrandGuidelines(text.slice(0, 8000));
          }
        }
      } catch (e) {
        console.warn('Could not load brand guidelines:', e);
      }
    })();
  }, [user]);

  // Load saved B-roll frames + product gallery for media panel
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: frames } = await supabase
          .from('generated_images')
          .select('id, image_url, prompt')
          .eq('user_id', user.id)
          .eq('source', 'broll-frame')
          .order('created_at', { ascending: false })
          .limit(60);
        if (frames) setSavedBrollFrames(frames as any);
      } catch (e) { console.warn('frames load failed', e); }
      try {
        const { data: clips } = await supabase
          .from('generated_images')
          .select('id, image_url, prompt')
          .eq('user_id', user.id)
          .eq('source', 'broll-clip')
          .order('created_at', { ascending: false })
          .limit(60);
        if (clips) setSavedBrollClips(clips as any);
      } catch (e) { console.warn('clips load failed', e); }
      try {
        const { data: pgal } = await supabase
          .from('product_gallery')
          .select('id, image_url, label, product_id, products(name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(60);
        if (pgal) setProductImages(pgal.map((p: any) => ({
          id: p.id,
          image_url: p.image_url,
          label: p.label,
          product_id: p.product_id,
          product_name: p.products?.name,
        })) as any);
      } catch (e) { console.warn('product gallery load failed', e); }
      // Load product library for Marco's awareness
      try {
        const { data: prods } = await supabase
          .from('products')
          .select('id, name, description, benefits, brands(name)')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(20);
        if (prods) {
          const enriched = await Promise.all(prods.map(async (p: any) => {
            const { data: img } = await supabase
              .from('product_gallery')
              .select('image_url')
              .eq('product_id', p.id)
              .eq('is_primary', true)
              .limit(1)
              .maybeSingle();
            return {
              id: p.id,
              name: p.name,
              description: p.description,
              benefits: p.benefits,
              brand_name: p.brands?.name,
              primary_image: img?.image_url,
            };
          }));
          setProductLibrary(enriched);
        }
      } catch (e) { console.warn('product library load failed', e); }
    })();
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  useEffect(() => {
    if (hasInteracted) return;
    const markInteracted = () => setHasInteracted(true);
    document.addEventListener('click', markInteracted, { once: true });
    document.addEventListener('keydown', markInteracted, { once: true });
    return () => {
      document.removeEventListener('click', markInteracted);
      document.removeEventListener('keydown', markInteracted);
    };
  }, [hasInteracted]);

  // Create/destroy audio elements when musicTracks change
  useEffect(() => {
    const currentIds = new Set(musicTracks.filter(t => t.audioUrl).map(t => t.id));
    // Remove stale audio elements
    musicAudioRefs.current.forEach((el, id) => {
      if (!currentIds.has(id)) {
        el.pause();
        el.src = '';
        musicAudioRefs.current.delete(id);
      }
    });
    // Create new audio elements
    musicTracks.forEach(track => {
      if (!track.audioUrl) return;
      if (!musicAudioRefs.current.has(track.id)) {
        const audioEl = new Audio(track.audioUrl);
        audioEl.preload = 'auto';
        musicAudioRefs.current.set(track.id, audioEl);
      }
    });
  }, [musicTracks]);

  // Sync music audio with video playback (only play/pause/seek/volume)
  useEffect(() => {
    musicTracks.forEach(track => {
      if (!track.audioUrl) return;
      const audioEl = musicAudioRefs.current.get(track.id);
      if (!audioEl) return;
      audioEl.volume = trackMuted.a1 ? 0 : track.volume;

      const inRange = currentTime >= track.startAt && currentTime < track.startAt + track.duration;
      if (isPlaying && inRange && hasInteracted) {
        const expectedTime = currentTime - track.startAt;
        if (Math.abs(audioEl.currentTime - expectedTime) > 0.5) {
          audioEl.currentTime = expectedTime;
        }
        if (audioEl.paused) {
          audioEl.play().catch(err => console.warn('Music play blocked:', err.message));
        }
      } else {
        if (!audioEl.paused) audioEl.pause();
      }
    });
  }, [isPlaying, currentTime, musicTracks, trackMuted.a1, hasInteracted]);

  // Cleanup music audio on unmount
  useEffect(() => {
    return () => {
      musicAudioRefs.current.forEach(el => { el.pause(); el.src = ''; });
      musicAudioRefs.current.clear();
    };
  }, []);

  const transcriptSegments = useMemo(() => {
    if (!transcript) return [];
    if (Array.isArray(transcript)) return transcript;
    if (Array.isArray(transcript.segments)) return transcript.segments;
    if (Array.isArray(transcript.words)) return transcript.words;
    if (typeof transcript.text === 'string' && transcript.text.trim()) {
      return [{ start: 0, end: duration || undefined, text: transcript.text }];
    }
    return [];
  }, [transcript, duration]);

  const sortedVizardClips = useMemo(
    () => [...vizardClips].sort((a, b) => b.score - a.score),
    [vizardClips]
  );

  const applyVizardClipToBuilder = useCallback((clip: VizardClip, options?: { sourceUrl?: string; totalDuration?: number; showToast?: boolean }) => {
    const sourceUrl = options?.sourceUrl || videoUrl;
    if (!sourceUrl) return;

    const detectedDuration = videoRef.current && Number.isFinite(videoRef.current.duration)
      ? videoRef.current.duration
      : 0;
    const totalDuration = options?.totalDuration
      ?? (Number.isFinite(duration) && duration > 0 ? duration : detectedDuration);
    const clipStart = Math.max(0, clip.start || 0);
    const rawClipEnd = clip.end > clipStart ? clip.end : clipStart + 1;
    const clipEnd = totalDuration > 0 ? Math.min(totalDuration, rawClipEnd) : rawClipEnd;

    const nextCuts: CutSuggestion[] = [];
    if (clipStart > 0.05) {
      nextCuts.push({
        start: 0,
        end: clipStart,
        reason: 'Trimmed before selected Vizard clip',
        type: 'other',
        accepted: true,
      });
    }
    if (totalDuration > 0 && clipEnd < totalDuration - 0.05) {
      nextCuts.push({
        start: clipEnd,
        end: totalDuration,
        reason: 'Trimmed after selected Vizard clip',
        type: 'other',
        accepted: true,
      });
    }

    setTimelineClips([{
      id: crypto.randomUUID(),
      name: clip.title || 'Vizard Clip',
      url: sourceUrl,
      duration: Math.max(clipEnd - clipStart, 0.1),
      startAt: clipStart,
    }]);
    setCuts(nextCuts);
    setDraftName(clip.title || 'Vizard Clip');

    if (videoRef.current) {
      videoRef.current.currentTime = clipStart;
    }
    setCurrentTime(clipStart);

    if (options?.showToast !== false) {
      toast({
        title: 'Clip loaded into builder',
        description: `${clip.title || 'Selected clip'} is ready on the timeline.`,
      });
    }
  }, [videoUrl, duration, toast]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => {
      const t = video.currentTime;
      // Skip over accepted cut regions during playback
      if (!video.paused) {
        const activeCut = cuts.find(c => c.accepted && t >= c.start && t < c.end);
        if (activeCut) {
          video.currentTime = activeCut.end;
          return;
        }
      }
      setCurrentTime(t);
    };
    const onMeta = () => {
      setDuration(video.duration);
      if (video.videoWidth && video.videoHeight) {
        setVideoAspect(video.videoWidth / video.videoHeight);
      }
    };
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
  }, [videoUrl, cuts]);

  // Listen for fullscreen exit
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement) setIsFullscreen(false);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

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
    const onPlay = () => bg.play().catch(() => {});
    const onPause = () => bg.pause();
    const interval = setInterval(sync, 200);
    main.addEventListener('play', onPlay);
    main.addEventListener('pause', onPause);
    main.addEventListener('seeked', sync);
    // Initial sync
    sync();
    return () => {
      clearInterval(interval);
      main.removeEventListener('play', onPlay);
      main.removeEventListener('pause', onPause);
      main.removeEventListener('seeked', sync);
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

  // Track whether we received a Vizard handoff to prevent draft picker from overriding
  const vizardHandoffRef = useRef(false);

  // Check for Vizard handoff on mount
  useEffect(() => {
    if (!user) return;
    const raw = sessionStorage.getItem('vizard-to-chatcut');
    if (raw) {
      sessionStorage.removeItem('vizard-to-chatcut');
      try {
        const payload = JSON.parse(raw);
        if (payload.videoUrl) {
          vizardHandoffRef.current = true;
          setShowDraftPicker(false);
          setDraftName(payload.clipTitle || payload.title || 'Vizard Clip');

          if (payload.transcript) {
            setTranscript(payload.transcript);
          }
          
          // Store all clips from Vizard
          if (payload.allClips && Array.isArray(payload.allClips) && payload.allClips.length > 0) {
            setVizardClips(payload.allClips);
            setActiveTab('clips'); // Auto-switch to clips tab
          }

          const isYT = /youtube\.com|youtu\.be/.test(payload.videoUrl);

          const loadVideo = async (url: string) => {
            setVideoUrl(url);

            // Wait for the actual video element to get metadata instead of a detached element
            const waitForMeta = setInterval(() => {
              const vid = videoRef.current;
              if (vid && vid.readyState >= 1 && vid.duration > 0) {
                clearInterval(waitForMeta);
                setDuration(vid.duration);

                const matchedClip = Array.isArray(payload.allClips)
                  ? payload.allClips.find((clip: VizardClip) =>
                      clip.id === payload.selectedClipId ||
                      (clip.start === payload.clipStart && clip.end === payload.clipEnd)
                    )
                  : null;

                if (matchedClip) {
                  applyVizardClipToBuilder(matchedClip, {
                    sourceUrl: url,
                    totalDuration: vid.duration,
                    showToast: true,
                  });
                } else {
                  setTimelineClips([{
                    id: crypto.randomUUID(),
                    name: payload.title || 'Imported clip',
                    url,
                    duration: vid.duration,
                    startAt: 0,
                  }]);
                  setCuts([]);
                }

                // Auto-extract B-roll if requested and source has none yet for this project
                if (payload.autoExtractBroll && payload.projectId && user) {
                  (async () => {
                    try {
                      const { data: existing } = await supabase
                        .from('generated_images')
                        .select('id')
                        .eq('user_id', user.id)
                        .in('source', ['broll-frame', 'broll-clip'])
                        .eq('project_id', payload.projectId)
                        .limit(1);
                      if (existing && existing.length > 0) return;
                      setIsAutoExtracting(true);
                      toast({ title: 'Extracting B-roll clips…', description: 'Marco is slicing 6 short playable clips from your source.' });
                      const saved = await extractBrollFrames({
                        videoUrl: url,
                        userId: user.id,
                        projectId: payload.projectId,
                        label: payload.sourceLabel || payload.title || 'Source',
                        count: 6,
                        clipDuration: 3,
                      });
                      if (saved.length > 0) {
                        const [framesRes, clipsRes] = await Promise.all([
                          supabase.from('generated_images').select('id, image_url, prompt').eq('user_id', user.id).eq('source', 'broll-frame').order('created_at', { ascending: false }).limit(60),
                          supabase.from('generated_images').select('id, image_url, prompt').eq('user_id', user.id).eq('source', 'broll-clip').order('created_at', { ascending: false }).limit(60),
                        ]);
                        if (framesRes.data) setSavedBrollFrames(framesRes.data as any);
                        if (clipsRes.data) setSavedBrollClips(clipsRes.data as any);
                        const clipCount = saved.filter(s => s.kind === 'clip').length;
                        const frameCount = saved.length - clipCount;
                        const desc = clipCount > 0
                          ? `${clipCount} short B-roll clip${clipCount !== 1 ? 's' : ''}${frameCount ? ` and ${frameCount} still${frameCount !== 1 ? 's' : ''}` : ''}`
                          : `${frameCount} B-roll frame${frameCount !== 1 ? 's' : ''}`;
                        setMessages((prev) => [
                          ...prev,
                          { role: 'assistant', content: `I extracted ${desc} from your source — open **Source Clips** on the right to preview them and drop them straight onto the timeline.` },
                        ]);
                        toast({ title: `Extracted ${saved.length} clip${saved.length !== 1 ? 's' : ''}`, description: 'Open Source Clips to preview and add them.' });
                      }
                    } catch (err: any) {
                      console.warn('[ChatcutAI] auto-extract failed', err);
                      toast({ title: 'Auto-extract failed', description: err?.message || 'Could not extract playable clips', variant: 'destructive' });
                    } finally {
                      setIsAutoExtracting(false);
                    }
                  })();
                }
              }
            }, 200);
            setTimeout(() => clearInterval(waitForMeta), 15000);
          };

          if (isYT) {
            downloadSocialVideoToStorage(payload.videoUrl, (title, description, variant) => {
              toast({ title, description, variant });
            })
              .then(loadVideo)
              .catch((err: Error) => {
                toast({ title: 'Video download failed', description: err.message, variant: 'destructive' });
              });
          } else {
            loadVideo(payload.videoUrl);
          }
          return; // Skip draft picker
        }
      } catch { /* ignore parse errors */ }
    }

    // Load drafts on mount (only if no Vizard handoff)
    if (videoUrl) return;
    supabase
      .from('chatcut_drafts')
      .select('id, name, updated_at, video_url')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .then(({ data }) => {
        // Don't show draft picker if Vizard handoff already loaded a video
        if (vizardHandoffRef.current) return;
        if (data && data.length > 0) {
          setSavedDrafts(data);
          setShowDraftPicker(true);
        }
      });
  }, [user, applyVizardClipToBuilder]);

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
    setVizardClips([]);
    setCaptionSettings({ ...defaultCaptionSettings, enabled: false });
    setThumbnail(null);
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
    sourceVideo: {
      hasVideo: !!videoUrl,
      duration: duration || 0,
      coverageNote: videoUrl
        ? `The source video is loaded on track V1 and plays CONTINUOUSLY from 0.0s to ${(duration || 0).toFixed(1)}s. There are NO gaps in the source video footage — every second between 0 and ${(duration || 0).toFixed(1)}s has visual content. NEVER tell the user "there's no visual at Xs" — the source video covers the entire timeline. Only B-Roll, overlays, music, and captions can be missing.`
        : 'No source video uploaded yet.',
    },
    clips: timelineClips.map(c => ({ name: c.name, startAt: c.startAt, duration: c.duration })),
    cuts: cuts.filter(c => c.accepted),
    musicTracks: musicTracks.map(t => ({ name: t.name, genre: t.genre, mood: t.mood, volume: t.volume, startAt: t.startAt, duration: t.duration, hasAudio: !!t.audioUrl })),
    overlays: overlays.map(o => ({ type: o.type, text: o.text, start: o.start, duration: o.duration, hasImage: !!o.imageUrl, scale: o.scale })),
    bRollClips: bRollClips.map(b => ({ name: b.name, start: b.start, duration: b.duration, hasImage: !!b.imageUrl })),
    captionsEnabled: captionSettings.enabled,
    captionStyle: captionSettings.style,
    brandSettings: {
      primaryColor: brandSettings.primaryColor,
      textColor: brandSettings.textColor,
      font: brandSettings.font,
      hasLogo: !!brandSettings.logoUrl,
    },
  }), [videoUrl, duration, timelineClips, cuts, musicTracks, overlays, bRollClips, captionSettings, brandSettings]);

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
        thumbnail,
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
      if (ts.thumbnail) setThumbnail(ts.thumbnail);
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

  // Poll WaveSpeed video task for B-roll animation
  const pollBRollVideo = useCallback(async (clipId: string, taskId: string) => {
    const maxAttempts = 60; // 5min max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const { data, error } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId },
        });
        if (error) continue;
        if (data?.status === 'completed' && data?.videoUrl) {
          setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, videoUrl: data.videoUrl, videoStatus: 'ready' } : b));
          const clip = bRollClips.find(b => b.id === clipId);
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `🎬 Your animated B-roll${clip ? ` **"${clip.name}"**` : ''} is ready at **${clip?.start?.toFixed(1) || '0'}s**! It's now playing on the timeline. How's it looking?`,
          }]);
          return;
        }
        if (data?.status === 'failed') {
          setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, videoStatus: 'failed' } : b));
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `⚠️ The B-roll animation didn't render — the still image is still on the timeline though. Want me to retry? 🔄`,
          }]);
          return;
        }
      } catch { /* retry */ }
    }
    setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, videoStatus: 'failed' } : b));
  }, [bRollClips]);

  // Generate B-roll image via generate-scene-image, then animate to video
  const generateBRollImage = useCallback(async (clipId: string, prompt: string) => {
    setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, imageStatus: 'generating' } : b));
    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt },
      });
      if (error || !data?.imageUrl) throw new Error(error?.message || 'No image generated');
      setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, imageUrl: data.imageUrl, imageStatus: 'ready', videoStatus: 'generating' } : b));
      toast({ title: 'B-Roll image ready', description: 'Now animating into video clip...' });

      // Chain: animate the still image into a 3s 720p video via Wan 2.5 i2v
      try {
        const { data: vidData, error: vidError } = await supabase.functions.invoke('wavespeed-video', {
          body: {
            action: 'create',
            model: 'wan-2.5-i2v',
            imageUrls: [data.imageUrl],
            prompt, // use the director's tone-matched prompt verbatim (no forced "cinematic slow motion")
            duration: 3,
            resolution: '720p',
            aspectRatio: '16:9',
          },
        });
        if (vidError || !vidData?.taskId) {
          setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, videoStatus: 'failed' } : b));
          return;
        }
        setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, videoTaskId: vidData.taskId } : b));
        // Start background polling
        pollBRollVideo(clipId, vidData.taskId);
      } catch {
        setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, videoStatus: 'failed' } : b));
      }
    } catch (err: any) {
      console.error('B-roll gen error:', err);
      setBRollClips(prev => prev.map(b => b.id === clipId ? { ...b, imageStatus: 'failed' } : b));
    }
  }, [toast, pollBRollVideo]);

  // Add B-roll from an EXISTING image (saved frame, product image, or upload) — skips image gen, animates directly
  const addBRollFromImage = useCallback((imageUrl: string, label: string, prompt?: string, startAt?: number) => {
    const brollId = crypto.randomUUID();
    const broll: BRollClip = {
      id: brollId,
      name: label,
      prompt: prompt || `Subtle natural motion that fits this scene: ${label}`,
      start: startAt ?? currentTime,
      duration: 3,
      imageUrl,
      imageStatus: 'ready',
      videoStatus: 'generating',
    };
    setBRollClips(prev => [...prev, broll]);
    toast({ title: 'B-Roll added', description: `"${label}" — animating into 3s clip...` });
    (async () => {
      try {
        const { data: vidData, error: vidError } = await supabase.functions.invoke('wavespeed-video', {
          body: {
            action: 'create',
            model: 'wan-2.5-i2v',
            imageUrls: [imageUrl],
            prompt: broll.prompt,
            duration: 3,
            resolution: '720p',
            aspectRatio: '16:9',
          },
        });
        if (vidError || !vidData?.taskId) {
          setBRollClips(prev => prev.map(b => b.id === brollId ? { ...b, videoStatus: 'failed' } : b));
          return;
        }
        setBRollClips(prev => prev.map(b => b.id === brollId ? { ...b, videoTaskId: vidData.taskId } : b));
        pollBRollVideo(brollId, vidData.taskId);
      } catch {
        setBRollClips(prev => prev.map(b => b.id === brollId ? { ...b, videoStatus: 'failed' } : b));
      }
    })();
  }, [currentTime, toast, pollBRollVideo]);

  // Add B-roll from an EXISTING video clip (e.g., extracted source clip) — uses it directly, no Wan animation.
  // Auto-snaps the start time forward to avoid overlapping any existing b-roll on the track.
  const addBRollFromVideoClip = useCallback((opts: { videoUrl: string; label: string; durationSec?: number; startAt?: number; sourceStart?: number; sourceUrl?: string }) => {
    const { videoUrl: vUrl, label, durationSec = 3, startAt, sourceStart, sourceUrl } = opts;
    const desiredStart = Math.max(0, startAt ?? currentTime);
    const dur = Math.max(0.3, durationSec);
    const brollId = crypto.randomUUID();
    setBRollClips(prev => {
      // Find first non-overlapping slot at or after desiredStart
      const sorted = [...prev].sort((a, b) => a.start - b.start);
      let cursor = desiredStart;
      for (const existing of sorted) {
        const eStart = existing.start;
        const eEnd = existing.start + existing.duration;
        if (cursor + dur <= eStart) break; // fits before this clip
        if (cursor < eEnd) cursor = eEnd; // bump past it
      }
      const broll: BRollClip = {
        id: brollId,
        name: label,
        prompt: label,
        start: +cursor.toFixed(2),
        duration: dur,
        videoUrl: sourceUrl || vUrl,
        sourceStart,
        sourceUrl: sourceUrl || vUrl,
        videoStatus: 'ready',
        imageStatus: 'ready',
        audioEnabled: false,
        z: Date.now(),
      };
      const wasBumped = Math.abs(cursor - desiredStart) > 0.01;
      if (wasBumped) {
        toast({ title: 'B-Roll auto-stacked', description: `"${label}" snapped to ${cursor.toFixed(1)}s to avoid overlapping the previous clip.` });
      } else {
        toast({ title: 'B-Roll clip added', description: `"${label}" — dropped at ${cursor.toFixed(1)}s` });
      }
      return [...prev, broll];
    });
  }, [currentTime, toast]);

  const generateMotionGraphic = useCallback(async (overlayId: string, text: string, type: string, styleHint?: string) => {
    setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, imageStatus: 'generating' } : o));
    try {
      const style = styleHint || 'glass';
      const styleDesc: Record<string, string> = {
        glass: 'modern translucent glass-look button shape with subtle blur and soft inner highlight',
        bold: 'high-contrast bold pill button shape with strong color fill and clean edges',
        minimal: 'clean minimal pill shape with thin border and elegant typography',
        neon: 'glowing neon-edged pill button with vibrant color highlights',
        broadcast: 'professional news-style chip with a vertical accent bar on the left',
      };
      const styleText = styleDesc[style] || styleDesc.glass;
      const stylePrompts: Record<string, string> = {
        motion_graphic: `A real pill-shaped BUTTON containing the text "${text}" in bold modern sans-serif typography. ${styleText}. The button must be a clearly visible filled rounded-rectangle shape (not bare floating text). Outside the button shape: 100% transparent.`,
        animated_text: `Standalone cinematic title text "${text}" in elegant typography with subtle glow. ${styleText}. Render only the text glyphs and a tight decorative shape behind/around them — outside that shape is fully transparent.`,
        lower_third: `A real lower-third bar SHAPE containing the name "${text}" — slim filled rounded bar in ${styleText}. The bar shape itself is filled with color and clearly visible. Outside the bar: 100% transparent.`,
        title_card: `A real filled title-chip SHAPE containing "${text}" in bold cinematic typography, ${styleText}. Tight rounded-rectangle shape with a colored fill. Outside the chip: 100% transparent.`,
      };
      const imagePrompt = stylePrompts[type] || stylePrompts.motion_graphic;

      const { data, error } = await supabase.functions.invoke('generate-motion-graphic', {
        body: {
          prompt: imagePrompt,
          brandPrimaryColor: brandSettings.primaryColor,
          brandTextColor: brandSettings.textColor,
          brandFont: brandSettings.font,
        },
      });

      if (error || !data?.imageUrl) throw new Error(error?.message || 'Image generation failed');
      const imgUrl = data.imageUrl;

      setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, imageUrl: imgUrl, imageStatus: 'ready' } : o));
      toast({ title: 'Motion graphic ready', description: `"${text}" generated successfully` });
      // Notify user in chat
      const overlay = overlays.find(o => o.id === overlayId) || { start: 0 };
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Your motion graphic **"${text}"** is ready! It's on the timeline at **${overlay.start.toFixed(1)}s**. Take a look and let me know if you'd like any changes! 🎨`,
      }]);
    } catch (err: any) {
      console.error('Motion graphic gen error:', err);
      setOverlays(prev => prev.map(o => o.id === overlayId ? { ...o, imageStatus: 'failed' } : o));
      toast({ title: 'Motion graphic failed', description: `Could not generate "${text}"`, variant: 'destructive' });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Heads up — the graphic for **"${text}"** didn't generate. Want me to retry with a different style? 🔄`,
      }]);
    }
  }, [toast, overlays, brandSettings]);

  // Generate or regenerate the opening TikTok-style cover via Nano Banana
  const generateThumbnail = useCallback(async (opts: {
    hookText?: string;
    style?: string;
    duration?: number;
    extraPrompt?: string;
    silent?: boolean;
  } = {}) => {
    setIsGeneratingThumbnail(true);
    try {
      // Pull a hook from the transcript if Marco didn't supply one
      const transcriptText = transcript
        ? (Array.isArray((transcript as any)?.segments)
            ? (transcript as any).segments.map((s: any) => s.text).join(' ')
            : typeof transcript === 'string' ? transcript : JSON.stringify(transcript))
        : '';
      const fallbackHook = transcriptText.split(/[.!?]/).find((s: string) => s.trim().length > 6) || 'WATCH THIS';
      const aspectHint = videoAspect && videoAspect < 1 ? 'vertical'
        : videoAspect && videoAspect > 1.4 ? 'horizontal' : 'square';

      const { data, error } = await supabase.functions.invoke('generate-thumbnail', {
        body: {
          transcript: transcriptText.slice(0, 1200),
          hookText: opts.hookText || fallbackHook,
          style: opts.style || 'tiktok-bold',
          aspectHint,
          extraPrompt: opts.extraPrompt || '',
          brandName: '',
          brandPrimaryColor: brandSettings.primaryColor,
          brandFont: brandSettings.font,
        },
      });
      if (error || !data?.imageUrl) throw new Error(error?.message || 'No image returned');

      const dur = Math.max(0.8, Math.min(4, opts.duration ?? 1.5));
      setThumbnail({ url: data.imageUrl, headline: data.headline, duration: dur });
      // If the user is at 0, snap the player to 0 so the cover shows immediately
      if (videoRef.current && currentTime < 0.1) {
        videoRef.current.currentTime = 0;
      }
      if (!opts.silent) {
        toast({ title: '🔥 Thumbnail ready', description: `"${data.headline}" — holds for ${dur}s` });
      }
      return data.imageUrl as string;
    } catch (err: any) {
      console.error('Thumbnail gen error:', err);
      toast({ title: 'Thumbnail failed', description: err.message || 'Could not generate cover', variant: 'destructive' });
      return null;
    } finally {
      setIsGeneratingThumbnail(false);
    }
  }, [transcript, videoAspect, brandSettings, currentTime, toast]);

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
            tiktok: { style: 'boldPop', background: 'glass', fontFamily: 'Montserrat', fontSize: 'large', fontColor: '#ffffff' },
            minimal: { style: 'minimal', background: 'glass', fontFamily: 'Inter', fontSize: 'medium', fontColor: '#ffffff' },
            cinematic: { style: 'cinematic', background: 'gradient', fontFamily: 'Oswald', fontSize: 'xl', fontColor: '#ffffff' },
            youtube: { style: 'subtitle', background: 'solid', fontFamily: 'Poppins', fontSize: 'medium', fontColor: '#facc15' },
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
          // Map style to animation preset
          const styleAnimationMap: Record<string, OverlayAnimation> = {
            glass: { entrance: 'fade-in', exit: 'fade-out' },
            bold: { entrance: 'scale-pop', exit: 'scale-out' },
            minimal: { entrance: 'fade-in', exit: 'fade-out' },
            neon: { entrance: 'scale-pop', exit: 'fade-out' },
            broadcast: { entrance: 'slide-left', exit: 'fade-out' },
          };
          const animation = act.animation
            ? { entrance: act.animation, exit: 'fade-out' as const }
            : styleAnimationMap[act.style || 'glass'] || { entrance: 'slide-up' as const, exit: 'fade-out' as const };
          const overlayType = act.type || 'lower_third';
          const isCTA = /shop now|buy|order|learn more|get yours|http|\.com|\.co|\.io/i.test(act.text || '');
          // Smart defaults for position + scale by type (safety net if Marco omits them)
          const defaultsByType: Record<string, { pos: { x: number; y: number }; scale: number }> = {
            lower_third: { pos: { x: 50, y: 85 }, scale: 2 },
            motion_graphic: { pos: { x: 50, y: 25 }, scale: 1 },
            animated_text: { pos: { x: 50, y: 80 }, scale: 2 },
            title_card: { pos: { x: 50, y: 50 }, scale: 5 },
          };
          const def = defaultsByType[overlayType] || { pos: { x: 50, y: 80 }, scale: 2 };
          // CTA buttons (Shop Now / contains URL) always get button-sized treatment
          const finalScale = isCTA ? 2 : (act.scale || def.scale);
          const finalPos = act.position || (isCTA ? { x: 50, y: 80 } : def.pos);
          const newOverlay: OverlayItem = {
            id: overlayId, type: overlayType,
            text: act.text || '', start: act.start || 0, duration: act.duration || 5,
            animation, style: act.style,
            scale: finalScale,
            position: finalPos,
          };
          setOverlays(prev => [...prev, newOverlay]);
          toast({ title: 'Overlay added', description: `"${act.text}" — generating graphic...` });
          // Generate motion graphic image for motion_graphic and animated_text types
          if (['motion_graphic', 'animated_text', 'lower_third', 'title_card'].includes(overlayType)) {
            generateMotionGraphic(overlayId, act.text || '', overlayType, act.style);
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
          // If Marco picked a saved Source Clip by id, drop it directly without regen.
          const savedRow = act.sourceClipId
            ? savedBrollClips.find((c) => c.id === act.sourceClipId)
            : null;
          if (savedRow) {
            const meta = parseBrollClipMeta(savedRow);
            addBRollFromVideoClip({
              videoUrl: meta.sourceUrl,
              label: act.description || meta.label,
              durationSec: act.duration ?? meta.duration,
              startAt: act.start ?? currentTime,
              sourceStart: meta.sourceStart,
              sourceUrl: meta.sourceUrl,
            });
            break;
          }
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
        case 'set_thumbnail': {
          toast({ title: '🎨 Generating thumbnail…', description: 'Marco is designing your TikTok cover with Nano Banana' });
          generateThumbnail({
            hookText: act.hookText || act.headline,
            style: act.style || 'tiktok-bold',
            duration: typeof act.duration === 'number' ? act.duration : 1.5,
            extraPrompt: act.extraPrompt || act.prompt,
            silent: true,
          });
          break;
        }
      }
    }
  }, [toast, duration, currentTime, timelineClips, generateBRollImage, generateMotionGraphic, savedBrollClips, addBRollFromVideoClip, generateThumbnail]);

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
          ...(brandGuidelines ? { brandGuidelines } : {}),
          brandSettings: {
            primaryColor: brandSettings.primaryColor,
            textColor: brandSettings.textColor,
            font: brandSettings.font,
            hasLogo: !!brandSettings.logoUrl,
            websiteUrl: brandSettings.websiteUrl || '',
          },
          productLibrary: productLibrary.map(p => ({
            name: p.name,
            description: p.description,
            benefits: p.benefits,
            brand: p.brand_name,
            hasImage: !!p.primary_image,
          })),
          savedFramesCount: savedBrollFrames.length,
          savedSourceClips: savedBrollClips.slice(0, 12).map((c) => {
            const meta = parseBrollClipMeta(c);
            return { id: c.id, label: meta.label, sourceStart: meta.sourceStart, duration: meta.duration };
          }),
          currentBRoll: bRollClips.map((b) => ({
            id: b.id,
            name: b.name,
            start: +b.start.toFixed(2),
            end: +(b.start + b.duration).toFixed(2),
            duration: +b.duration.toFixed(2),
            audioEnabled: !!b.audioEnabled,
            ready: (b.videoStatus === 'ready') || (b.imageStatus === 'ready'),
          })),
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
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
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
  const [draggingOverlayId, setDraggingOverlayId] = useState<string | null>(null);

  const handleOverlayMouseDown = useCallback((e: React.MouseEvent, overlayId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOverlayId(overlayId);
  }, []);

  useEffect(() => {
    if (!draggingOverlayId) return;
    const handleMouseMove = (e: MouseEvent) => {
      const wrapper = videoWrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setOverlays(prev => prev.map(o => o.id === draggingOverlayId ? { ...o, position: { x, y } } : o));
    };
    const handleMouseUp = () => setDraggingOverlayId(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingOverlayId]);
  const musicWaveHeights = useMemo(() => Array.from({ length: 50 }, () => 15 + Math.random() * 65), []);
  const audioWaveHeights = useMemo(() => Array.from({ length: 40 }, () => 20 + Math.random() * 60), []);
  const [mediaPanelVisible, setMediaPanelVisible] = useState(true);

  const toggleTrackVisibility = (track: 'v1' | 'v2' | 'v3' | 'a1') => {
    setTrackVisibility(prev => ({ ...prev, [track]: !prev[track] }));
  };

  const toggleTrackMute = (track: 'v1' | 'v2' | 'a1') => {
    setTrackMuted(prev => {
      const next = { ...prev, [track]: !prev[track] };
      // Actually mute/unmute the video element
      if (track === 'v1' && videoRef.current) {
        videoRef.current.muted = next.v1;
      }
      return next;
    });
  };

  const deleteClip = (clipId: string) => {
    setTimelineClips(prev => prev.filter(c => c.id !== clipId));
    toast({ title: 'Clip removed', description: 'Segment deleted from timeline' });
  };

  const deleteCut = (index: number) => {
    setCuts(prev => prev.filter((_, i) => i !== index));
    toast({ title: 'Cut removed', description: 'Cut region restored' });
  };

  const deleteOverlay = (id: string) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
    toast({ title: 'Overlay removed' });
  };

  const deleteBRoll = (id: string) => {
    setBRollClips(prev => prev.filter(b => b.id !== id));
    toast({ title: 'B-Roll removed' });
  };

  // Drag / resize a B-Roll clip on the timeline
  const handleBRollDrag = (
    e: React.MouseEvent<HTMLDivElement>,
    brId: string,
    mode: 'move' | 'resize-left' | 'resize-right'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const trackEl = (e.currentTarget.closest('[data-broll-track]') || e.currentTarget.parentElement) as HTMLElement | null;
    if (!trackEl) return;
    const trackRect = trackEl.getBoundingClientRect();
    const startX = e.clientX;
    const br = bRollClips.find(b => b.id === brId);
    if (!br) return;
    const startStart = br.start;
    const startDuration = br.duration;
    const total = Math.max(duration, 1);
    document.body.style.cursor = mode === 'move' ? 'grabbing' : 'ew-resize';

    const onMove = (ev: MouseEvent) => {
      const deltaPx = ev.clientX - startX;
      const deltaSec = (deltaPx / trackRect.width) * total;
      setBRollClips(prev => {
        const others = prev.filter(b => b.id !== brId).sort((a, b) => a.start - b.start);
        return prev.map(b => {
          if (b.id !== brId) return b;
          if (mode === 'move') {
            let newStart = Math.max(0, Math.min(total - startDuration, startStart + deltaSec));
            const newEnd = newStart + startDuration;
            // Prevent overlap: nudge to the closest free side of any neighbor we collide with.
            for (const o of others) {
              const oStart = o.start;
              const oEnd = o.start + o.duration;
              if (newStart < oEnd && newEnd > oStart) {
                // collision — pick whichever side requires less travel
                const moveLeft = oStart - startDuration;
                const moveRight = oEnd;
                newStart = Math.abs(newStart - moveLeft) < Math.abs(newStart - moveRight) ? Math.max(0, moveLeft) : moveRight;
              }
            }
            newStart = Math.max(0, Math.min(total - startDuration, newStart));
            return { ...b, start: newStart };
          }
          if (mode === 'resize-left') {
            const maxShift = startDuration - 0.3;
            let shift = Math.max(-startStart, Math.min(maxShift, deltaSec));
            const proposedStart = startStart + shift;
            // Block if it would overlap a neighbor on the left
            const leftNeighbor = [...others].reverse().find(o => o.start + o.duration <= startStart + 0.001);
            if (leftNeighbor) {
              const minStart = leftNeighbor.start + leftNeighbor.duration;
              if (proposedStart < minStart) shift = minStart - startStart;
            }
            return { ...b, start: startStart + shift, duration: startDuration - shift };
          }
          // resize-right
          let newDuration = Math.max(0.3, Math.min(total - startStart, startDuration + deltaSec));
          const rightNeighbor = others.find(o => o.start >= startStart + 0.001);
          if (rightNeighbor) {
            const maxDur = rightNeighbor.start - startStart;
            if (newDuration > maxDur) newDuration = Math.max(0.3, maxDur);
          }
          return { ...b, duration: newDuration };
        });
      });
    };
    const onUp = () => {
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const deleteMusicTrack = (id: string) => {
    const audioEl = musicAudioRefs.current.get(id);
    if (audioEl) { audioEl.pause(); audioEl.src = ''; musicAudioRefs.current.delete(id); }
    setMusicTracks(prev => prev.filter(t => t.id !== id));
    toast({ title: 'Music track removed' });
  };

  const handleExport = async () => {
    if (!videoUrl) {
      toast({ title: 'Nothing to export', description: 'Upload a video first', variant: 'destructive' });
      return;
    }
    toast({ title: 'Exporting...', description: 'Preparing your video with all timeline edits. This may take a moment.' });
    try {
      const exportData = {
        videoUrl,
        cuts: cuts.filter(c => c.accepted),
        captionSettings: captionSettings.enabled ? captionSettings : null,
        transcript: captionSettings.enabled ? transcript : null,
        overlays,
        bRollClips: bRollClips.filter(b => b.imageUrl && b.imageStatus === 'ready'),
        musicTracks: musicTracks.filter(t => t.audioUrl),
        duration,
      };
      const { data, error } = await supabase.functions.invoke('creatomate-stitch', {
        body: exportData,
      });
      if (error) throw error;
      if (data?.videoUrl) {
        toast({ title: 'Export complete! 🎬', description: 'Your video is ready for download.' });
        window.open(data.videoUrl, '_blank');
      } else {
        toast({ title: 'Export submitted', description: 'Your video is being rendered. Check back in a few minutes.' });
      }
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message || 'Please try again', variant: 'destructive' });
    }
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

  // Find active B-roll clip at current time. When multiple cover this moment (overlap), pick the most recently added (highest z).
  const activeBRoll = (() => {
    const candidates = bRollClips.filter(br =>
      currentTime >= br.start &&
      currentTime < br.start + br.duration &&
      ((br.videoUrl && br.videoStatus === 'ready') || (br.imageUrl && br.imageStatus === 'ready'))
    );
    if (candidates.length === 0) return undefined;
    return candidates.reduce((winner, c) => ((c.z ?? 0) > (winner.z ?? 0) ? c : winner));
  })();

  // Mute main video while a b-roll with its own audio is active
  useEffect(() => {
    if (!videoRef.current) return;
    const shouldMuteMain = !!(activeBRoll && activeBRoll.audioEnabled);
    if (shouldMuteMain) {
      videoRef.current.muted = true;
    } else {
      videoRef.current.muted = trackMuted.v1;
    }
  }, [activeBRoll, trackMuted.v1]);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Draft picker overlay */}
        {showDraftPicker && savedDrafts.length > 0 && (
          <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowDraftPicker(false)}>
            <Card className="w-full max-w-md relative" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-7 w-7 z-10"
                onClick={() => setShowDraftPicker(false)}
              >
                <span className="sr-only">Close</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </Button>
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
            <ProjectNameInput
              value={draftName}
              onSave={setDraftName}
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
            <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white border-0 font-semibold px-4" onClick={handleExport} disabled={!videoUrl}>
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
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ai' | 'transcript' | 'clips')} className="flex flex-col flex-1 overflow-hidden">
                  <TabsList className="mx-3 mt-2 mb-0 bg-muted/50">
                    <TabsTrigger value="ai" className="text-xs">AI</TabsTrigger>
                    <TabsTrigger value="transcript" className="text-xs">Transcript</TabsTrigger>
                    {vizardClips.length > 0 && (
                      <TabsTrigger value="clips" className="text-xs">
                        <Scissors className="w-3 h-3 mr-1" />
                        Clips ({vizardClips.length})
                      </TabsTrigger>
                    )}
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
                      {transcriptSegments.length > 0 ? (
                        <div className="space-y-1 text-sm">
                          {transcriptSegments.map((seg: any, i: number, arr: any[]) => {
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

                  {vizardClips.length > 0 && (
                    <TabsContent value="clips" className="flex-1 overflow-hidden m-0 p-0">
                      <ScrollArea className="h-full px-3 py-2">
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground mb-2">
                            Clips identified by Vizard AI. Click a clip to load that range into the builder.
                          </p>
                          {sortedVizardClips.map((clip) => (
                            <Card
                              key={clip.id}
                              className={cn(
                                "cursor-pointer hover:border-primary/50 transition-colors",
                                currentTime >= clip.start && currentTime < clip.end && "border-primary bg-primary/5"
                              )}
                              onClick={() => applyVizardClipToBuilder(clip)}
                            >
                              <CardContent className="p-3 space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="text-sm font-medium leading-tight">{clip.title}</h4>
                                  <Badge variant="secondary" className="text-[10px] shrink-0">
                                    ⭐ {clip.score}/10
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">{clip.description}</p>
                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                  <span className="font-mono">{formatTimeShort(clip.start)} – {formatTimeShort(clip.end)}</span>
                                  <span>({Math.round(clip.end - clip.start)}s)</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {clip.tags.map(tag => (
                                    <Badge key={tag} variant="outline" className="text-[9px] h-4 px-1">{tag}</Badge>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </TabsContent>
                  )}
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
                    {/* Video wrapper – sized to match the actual video aspect ratio so portrait/reel videos display correctly */}
                    <div
                      ref={videoWrapperRef}
                      className={cn(
                        "relative overflow-hidden bg-black",
                        isFullscreen && "w-full h-full flex items-center justify-center"
                      )}
                      style={{
                        lineHeight: 0,
                        aspectRatio: videoAspect ? `${videoAspect}` : '16 / 9',
                        // Constrain so the wrapper fits within available space regardless of orientation
                        maxHeight: '100%',
                        maxWidth: '100%',
                        height: videoAspect && videoAspect < 1 ? '100%' : 'auto',
                        width: videoAspect && videoAspect >= 1 ? '100%' : 'auto',
                      }}
                    >
                      {/* Background video (when PiP mode is active) */}
                      {pipEnabled && bgVideoUrl && (
                        <video
                          ref={bgVideoRef}
                          src={bgVideoUrl}
                          className="w-full h-full block object-contain"
                          muted
                          loop
                          playsInline
                          onClick={togglePlay}
                        />
                      )}
                      {/* B-Roll overlay when active — prefer video over still */}
                      {activeBRoll && (
                        activeBRoll.videoUrl && activeBRoll.videoStatus === 'ready' ? (
                          <video
                            key={activeBRoll.id}
                            src={activeBRoll.videoUrl}
                            autoPlay
                            muted={!activeBRoll.audioEnabled}
                            loop={typeof activeBRoll.sourceStart !== 'number'}
                            playsInline
                            className="block absolute inset-0 w-full h-full object-cover z-[5]"
                            onLoadedMetadata={(e) => {
                              if (typeof activeBRoll.sourceStart === 'number') {
                                (e.currentTarget as HTMLVideoElement).currentTime = activeBRoll.sourceStart;
                              }
                            }}
                            onTimeUpdate={(e) => {
                              if (typeof activeBRoll.sourceStart !== 'number') return;
                              const v = e.currentTarget as HTMLVideoElement;
                              const end = activeBRoll.sourceStart + activeBRoll.duration;
                              if (v.currentTime >= end - 0.05) {
                                v.currentTime = activeBRoll.sourceStart;
                              }
                            }}
                          />
                        ) : (
                          <img
                            src={activeBRoll.imageUrl}
                            alt={activeBRoll.name}
                            className="block absolute inset-0 w-full h-full object-cover z-[5]"
                          />
                        )
                      )}
                      {/* Active B-Roll badge — shows which clip is on screen and lets user toggle its audio */}
                      {activeBRoll && (
                        <div className="absolute top-2 left-2 z-[6] flex items-center gap-1.5 bg-background/85 backdrop-blur px-2 py-1 rounded-md border border-border shadow-sm pointer-events-auto">
                          <span className="text-[10px] font-medium text-foreground truncate max-w-[160px]">B-Roll: {activeBRoll.name}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBRollClips(prev => prev.map(b => b.id === activeBRoll.id ? { ...b, audioEnabled: !b.audioEnabled } : b));
                              if (videoRef.current) {
                                videoRef.current.muted = !activeBRoll.audioEnabled ? true : false;
                              }
                            }}
                            className={cn(
                              "h-5 w-5 rounded flex items-center justify-center transition-colors",
                              activeBRoll.audioEnabled
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            )}
                            title={activeBRoll.audioEnabled ? 'B-Roll audio ON (main video muted)' : 'B-Roll audio OFF (main video plays)'}
                          >
                            {activeBRoll.audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                      {/* Main video - when PiP is enabled, this becomes the PiP overlay */}
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        className={cn(
                          "w-full h-full block object-contain",
                          activeBRoll && "opacity-0",
                          pipEnabled && bgVideoUrl && "hidden" // Hide original; PiP component shows it
                        )}
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

                      {/* Motion graphics / overlay visuals on video — with entrance animations */}
                      {trackVisibility.v3 && overlays
                        .filter(o => (o.type === 'motion_graphic' || o.type === 'animated_text') && currentTime >= o.start && currentTime < o.start + o.duration)
                        .map(ov => {
                          const elapsed = currentTime - ov.start;
                          const remaining = ov.duration - elapsed;
                          const entrance = ov.animation?.entrance || 'fade-in';
                          const isEntering = elapsed < 0.5;
                          const isExiting = remaining < 0.5;
                          const animClass = isEntering
                            ? entrance === 'slide-up' ? 'animate-[slideUp_0.5s_ease-out]'
                            : entrance === 'scale-pop' ? 'animate-[scalePop_0.4s_ease-out]'
                            : entrance === 'slide-left' ? 'animate-[slideLeft_0.5s_ease-out]'
                            : 'animate-[fadeIn_0.4s_ease-out]'
                            : isExiting ? 'animate-[fadeOut_0.4s_ease-in_forwards]' : '';
                          const pos = ov.position || { x: 50, y: 30 };
                          const scale = ov.scale || 1;
                          const isFull = scale >= 4;
                          return (
                            <div
                              key={ov.id}
                              className={cn(
                                "absolute z-10 cursor-grab active:cursor-grabbing",
                                animClass,
                                draggingOverlayId === ov.id && "opacity-80",
                                isFull && "inset-0 flex items-center justify-center"
                              )}
                              style={isFull ? {} : { left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                              onMouseDown={(e) => !isFull && handleOverlayMouseDown(e, ov.id)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, scale: ((o.scale || 1) % 5) + 1 } : o));
                              }}
                            >
                              {ov.imageUrl && ov.imageStatus === 'ready' ? (
                                <img
                                  src={ov.imageUrl}
                                  alt={ov.text}
                                  className="object-contain rounded-lg pointer-events-none"
                                  style={isFull
                                    ? { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 0 }
                                    : { maxWidth: `${Math.min(scale * 20, 90)}vw`, maxHeight: `${Math.min(scale * 12, 80)}vh` }
                                  }
                                />
                              ) : ov.imageStatus === 'generating' ? (
                                <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/40 flex items-center gap-2 pointer-events-none">
                                  <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                                  <span className="text-purple-200 text-sm">Generating graphic...</span>
                                </div>
                              ) : (
                                <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-purple-500/40 pointer-events-none">
                                  <span className="text-purple-200 text-sm font-semibold">{ov.text}</span>
                                </div>
                              )}
                              {/* Resize hint */}
                              {!isFull && ov.imageUrl && ov.imageStatus === 'ready' && (
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 text-[9px] text-muted-foreground whitespace-nowrap pointer-events-none">
                                  Double-click to resize
                                </div>
                              )}
                            </div>
                          );
                        })
                      }

                      {/* V2 text overlays on video */}
                      {trackVisibility.v2 && overlays
                        .filter(o => o.type !== 'motion_graphic' && o.type !== 'animated_text' && currentTime >= o.start && currentTime < o.start + o.duration)
                        .map(ov => {
                          const pos = ov.position || { x: 50, y: 80 };
                          const scale = ov.scale || 1;
                          const isFull = scale >= 4;
                          return (
                            <div
                              key={ov.id}
                              className={cn(
                                "absolute z-10 cursor-grab active:cursor-grabbing",
                                draggingOverlayId === ov.id && "opacity-80",
                                isFull && "inset-0 flex items-center justify-center"
                              )}
                              style={isFull ? {} : { left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)' }}
                              onMouseDown={(e) => !isFull && handleOverlayMouseDown(e, ov.id)}
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, scale: ((o.scale || 1) % 5) + 1 } : o));
                              }}
                            >
                              {ov.imageUrl && ov.imageStatus === 'ready' ? (
                                <img
                                  src={ov.imageUrl}
                                  alt={ov.text}
                                  className="object-contain pointer-events-none"
                                  style={isFull
                                    ? { width: '100%', height: '100%', objectFit: 'cover' }
                                    : { maxWidth: `${Math.min(scale * 15, 80)}vw`, maxHeight: `${Math.min(scale * 8, 60)}vh` }
                                  }
                                />
                              ) : (
                                <div className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-md border border-pink-500/30 pointer-events-none">
                                  <span className="text-pink-100 text-xs">{ov.text}</span>
                                </div>
                              )}
                            </div>
                          );
                        })
                      }

                      {/* B-Roll status indicators */}
                      {bRollClips
                        .filter(br => currentTime >= br.start && currentTime < br.start + br.duration)
                        .filter(br => !activeBRoll || br.id !== activeBRoll.id)
                        .map(br => (
                          <div key={br.id} className="absolute inset-0 z-[4] flex items-center justify-center bg-black/60">
                            {(br.imageStatus === 'generating' || br.videoStatus === 'generating') ? (
                              <div className="flex flex-col items-center gap-2 text-white">
                                <Loader2 className="w-6 h-6 animate-spin text-green-400" />
                                <span className="text-xs font-medium">
                                  {br.videoStatus === 'generating' ? 'Animating B-Roll...' : 'Generating B-Roll...'}
                                </span>
                                <span className="text-[10px] text-muted-foreground">{br.name}</span>
                              </div>
                            ) : br.imageStatus === 'failed' ? (
                              <div className="flex flex-col items-center gap-2 text-white">
                                <span className="text-sm">⚠️ B-Roll failed</span>
                                <button
                                  className="text-xs text-green-400 hover:text-green-300 underline"
                                  onClick={() => generateBRollImage(br.id, br.prompt)}
                                >
                                  Retry generation
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-2 text-white/60">
                                <Film className="w-6 h-6" />
                                <span className="text-xs">B-Roll placeholder</span>
                              </div>
                            )}
                          </div>
                        ))
                      }

                      {/* Live caption overlay – constrained to video bounds, always on top */}
                      {captionSettings.enabled && transcriptSegments.length > 0 && (() => {
                        const segs = transcriptSegments;
                        const activeSeg = segs.find((s: any, i: number) => {
                          const segEnd = s.end ?? (segs[i + 1]?.start ?? duration);
                          return currentTime >= s.start && currentTime < segEnd;
                        });
                        const activeText = activeSeg?.text || activeSeg?.word || '';
                        if (!activeText) return null;
                        const activeIdx = segs.indexOf(activeSeg);
                        const segDuration = (activeSeg.end ?? (segs[activeIdx + 1]?.start ?? duration)) - activeSeg.start;
                        return (
                          <div
                            className={cn(
                              'absolute left-0 right-0 flex justify-center pointer-events-none z-30 px-4',
                              isFullscreen ? 'bottom-[8%]' : 'bottom-[6%]'
                            )}
                          >
                            <KaraokeCaption
                              text={activeText}
                              currentTime={currentTime - activeSeg.start}
                              duration={segDuration}
                              style={captionSettings.style}
                              background={captionSettings.background}
                              fontFamily={captionSettings.fontFamily}
                              fontSize={captionSettings.fontSize}
                              fontColor={captionSettings.fontColor}
                              videoAspect={videoAspect ?? undefined}
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
                      const wrapper = videoWrapperRef.current;
                      if (!wrapper) return;
                      if (document.fullscreenElement) {
                        document.exitFullscreen();
                        setIsFullscreen(false);
                      } else {
                        wrapper.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
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
                      const offsetX = e.clientX - rect.left - 80;
                      const trackWidth = rect.width - 80 - 10;
                      if (offsetX < 0 || trackWidth <= 0) return;
                      const ratio = Math.max(0, Math.min(1, offsetX / trackWidth));
                      seekTo(ratio * duration);
                    }}>
                    <div className="absolute inset-0 px-[80px] pr-[10px]">
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
                        className="absolute top-0 bottom-0 z-20 pointer-events-none"
                        style={{ left: `calc(80px + (100% - 90px) * ${currentTime / duration})` }}
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
                    <div className="flex flex-col relative overflow-x-auto" style={{ minWidth: `${zoomLevel}%` }}>
                      {/* Graphics Track */}
                      {trackVisibility.v3 && (
                      <div className="flex items-center h-9 border-b border-border/50 group hover:bg-muted/20">
                        <div className="w-[80px] flex-shrink-0 flex items-center gap-1 px-2" title="Motion graphics & animated text overlays">
                          <span className="text-[9px] font-semibold text-purple-400 truncate">Graphics</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 opacity-60 hover:opacity-100" onClick={() => toggleTrackVisibility('v3')}>
                            <EyeOff className="w-2.5 h-2.5" />
                          </Button>
                        </div>
                        <div className="flex-1 relative h-6 mx-1">
                          {overlays.filter(o => o.type === 'motion_graphic' || o.type === 'animated_text').length > 0 ? (
                            overlays.filter(o => o.type === 'motion_graphic' || o.type === 'animated_text').map((ov) => (
                              <div
                                key={ov.id}
                                className={cn(
                                  "absolute inset-y-0 rounded border flex items-center px-1 cursor-pointer transition-colors group/clip",
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
                                onClick={() => seekTo(ov.start)}
                              >
                                {ov.imageStatus === 'generating' ? (
                                  <Loader2 className="w-2.5 h-2.5 text-purple-400 mr-1 flex-shrink-0 animate-spin" />
                                ) : ov.imageUrl ? (
                                  <ImageIcon className="w-2.5 h-2.5 text-purple-400 mr-1 flex-shrink-0" />
                                ) : (
                                  <Layers className="w-2.5 h-2.5 text-purple-400 mr-1 flex-shrink-0" />
                                )}
                                <span className="text-[9px] text-purple-300 truncate flex-1">{ov.text}</span>
                                <button className="hidden group-hover/clip:flex w-3.5 h-3.5 items-center justify-center rounded bg-destructive/80 hover:bg-destructive flex-shrink-0 ml-0.5" onClick={(e) => { e.stopPropagation(); deleteOverlay(ov.id); }}>
                                  <Trash2 className="w-2 h-2 text-white" />
                                </button>
                              </div>
                            ))
                          ) : (
                            <div className="absolute inset-0 border border-dashed border-border/30 rounded" />
                          )}
                        </div>
                        <div className="w-10 flex-shrink-0" />
                      </div>
                      )}

                      {/* Overlays / Captions Track */}
                      {trackVisibility.v2 && (
                      <div className="flex items-center h-9 border-b border-border/50 group hover:bg-muted/20">
                        <div className="w-[80px] flex-shrink-0 flex items-center gap-1 px-2" title="Text overlays, lower thirds & captions">
                          <span className="text-[9px] font-semibold text-pink-400 truncate">Overlay</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 opacity-60 hover:opacity-100" onClick={() => toggleTrackVisibility('v2')}>
                            <EyeOff className="w-2.5 h-2.5" />
                          </Button>
                          {captionSettings.enabled && (
                            <Badge className="text-[7px] px-1 py-0 h-3 bg-pink-500/20 text-pink-400 border-pink-500/30">CC</Badge>
                          )}
                        </div>
                        <div className="flex-1 relative h-6 mx-1">
                          {overlays.filter(o => o.type !== 'motion_graphic' && o.type !== 'animated_text').length > 0 ? (
                            overlays.filter(o => o.type !== 'motion_graphic' && o.type !== 'animated_text').map((ov) => (
                              <div
                                key={ov.id}
                                className="absolute inset-y-0 rounded bg-pink-500/20 border border-pink-500/40 flex items-center px-1 cursor-pointer hover:bg-pink-500/30 transition-colors group/clip"
                                style={{
                                  left: `${(ov.start / Math.max(duration, 1)) * 100}%`,
                                  width: `${(ov.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                                onClick={() => seekTo(ov.start)}
                              >
                                <Sparkles className="w-2.5 h-2.5 text-pink-400 mr-1 flex-shrink-0" />
                                <span className="text-[9px] text-pink-300 truncate flex-1">{ov.text}</span>
                                <button className="hidden group-hover/clip:flex w-3.5 h-3.5 items-center justify-center rounded bg-destructive/80 hover:bg-destructive flex-shrink-0 ml-0.5" onClick={(e) => { e.stopPropagation(); deleteOverlay(ov.id); }}>
                                  <Trash2 className="w-2 h-2 text-white" />
                                </button>
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
                      )}

                      {/* B-Roll Track */}
                      <div className="flex items-center h-9 border-b border-border/50 group hover:bg-muted/20">
                        <div className="w-[80px] flex-shrink-0 flex items-center gap-1 px-2" title="B-Roll cutaway images">
                          <span className="text-[9px] font-semibold text-green-400 truncate">B-Roll</span>
                        </div>
                        <div
                          className="flex-1 relative h-6 mx-1"
                          data-broll-track
                          onDragOver={(e) => {
                            if (Array.from(e.dataTransfer.types).includes('application/x-source-clip')) {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = 'copy';
                            }
                          }}
                          onDrop={(e) => {
                            const raw = e.dataTransfer.getData('application/x-source-clip');
                            if (!raw) return;
                            e.preventDefault();
                            try {
                              const data = JSON.parse(raw);
                              const rect = e.currentTarget.getBoundingClientRect();
                              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                              const dropAt = +(ratio * Math.max(duration, 1)).toFixed(2);
                              addBRollFromVideoClip({ ...data, startAt: dropAt });
                            } catch (err) {
                              console.warn('B-Roll drop parse failed', err);
                            }
                          }}
                        >
                          {bRollClips.length > 0 ? (
                            bRollClips.map((br) => (
                              <div
                                key={br.id}
                                className={cn(
                                  "absolute inset-y-0 rounded border flex items-center cursor-grab active:cursor-grabbing transition-colors group/clip select-none",
                                  br.imageStatus === 'generating' || br.videoStatus === 'generating'
                                    ? "bg-green-500/10 border-green-500/30 animate-pulse"
                                    : br.videoStatus === 'ready'
                                    ? "bg-green-500/30 border-green-500/60 hover:bg-green-500/40"
                                    : br.imageStatus === 'ready'
                                    ? "bg-green-500/25 border-green-500/50 hover:bg-green-500/35"
                                    : "bg-green-500/20 border-green-500/40 hover:bg-green-500/30"
                                )}
                                style={{
                                  left: `${(br.start / Math.max(duration, 1)) * 100}%`,
                                  width: `${(br.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                                onClick={() => seekTo(br.start)}
                                onMouseDown={(e) => {
                                  // Only start drag with primary button on the body (not on handles/buttons)
                                  if (e.button !== 0) return;
                                  const target = e.target as HTMLElement;
                                  if (target.closest('[data-broll-handle]') || target.closest('button')) return;
                                  handleBRollDrag(e, br.id, 'move');
                                }}
                                title={`${br.name} — drag body to move, drag edges to trim (${br.duration.toFixed(1)}s)`}
                              >
                                {/* Left resize handle */}
                                <div
                                  data-broll-handle
                                  className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-green-400/0 hover:bg-green-400/70 rounded-l z-10"
                                  onMouseDown={(e) => handleBRollDrag(e, br.id, 'resize-left')}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <div className="flex items-center px-1.5 flex-1 min-w-0 pointer-events-none">
                                  {br.imageStatus === 'generating' ? (
                                    <Loader2 className="w-2.5 h-2.5 text-green-400 mr-1 flex-shrink-0 animate-spin" />
                                  ) : br.videoStatus === 'generating' ? (
                                    <Video className="w-2.5 h-2.5 text-green-400 mr-1 flex-shrink-0 animate-pulse" />
                                  ) : br.videoStatus === 'ready' ? (
                                    <Video className="w-2.5 h-2.5 text-green-400 mr-1 flex-shrink-0" />
                                  ) : br.imageUrl ? (
                                    <ImageIcon className="w-2.5 h-2.5 text-green-400 mr-1 flex-shrink-0" />
                                  ) : (
                                    <Film className="w-2.5 h-2.5 text-green-400 mr-1 flex-shrink-0" />
                                  )}
                                  <span className="text-[9px] text-green-300 truncate flex-1">{br.name}</span>
                                </div>
                                <button
                                  className="hidden group-hover/clip:flex w-3.5 h-3.5 items-center justify-center rounded bg-background/70 hover:bg-background flex-shrink-0 mr-1 z-10 relative"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setBRollClips(prev => prev.map(b => b.id === br.id ? { ...b, audioEnabled: !b.audioEnabled } : b));
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  title={br.audioEnabled ? 'B-Roll audio ON — click to mute' : 'B-Roll audio OFF — click to enable'}
                                >
                                  {br.audioEnabled
                                    ? <Volume2 className="w-2 h-2 text-green-300" />
                                    : <VolumeX className="w-2 h-2 text-muted-foreground" />}
                                </button>
                                <button
                                  className="hidden group-hover/clip:flex w-3.5 h-3.5 items-center justify-center rounded bg-destructive/80 hover:bg-destructive flex-shrink-0 mr-1.5 z-10 relative"
                                  onClick={(e) => { e.stopPropagation(); deleteBRoll(br.id); }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="w-2 h-2 text-white" />
                                </button>
                                {/* Right resize handle */}
                                <div
                                  data-broll-handle
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-green-400/0 hover:bg-green-400/70 rounded-r z-10"
                                  onMouseDown={(e) => handleBRollDrag(e, br.id, 'resize-right')}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="absolute inset-0 border border-dashed border-border/30 rounded" />
                          )}
                        </div>
                        <div className="w-10 flex-shrink-0" />
                      </div>

                      {/* Video Track */}
                      <div className="flex items-center h-11 border-b border-border/50 group hover:bg-muted/20">
                        <div className="w-[80px] flex-shrink-0 flex items-center gap-1 px-2" title="Main video track">
                          <span className="text-[9px] font-semibold text-primary truncate">Video</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 opacity-60 hover:opacity-100" onClick={() => toggleTrackMute('v1')}>
                            {trackMuted.v1 ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                          </Button>
                        </div>
                        <div className="flex-1 relative h-8 mx-1">
                          {timelineClips.map((clip) => (
                            <div
                              key={clip.id}
                              className="absolute inset-y-0 rounded bg-primary/25 border border-primary/40 overflow-hidden flex items-center cursor-pointer hover:bg-primary/35 transition-colors group/clip"
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
                              <span className="relative text-[10px] text-foreground font-medium px-2 truncate z-10 flex-1">
                                {clip.name}
                              </span>
                              {timelineClips.length > 1 && (
                                <button className="hidden group-hover/clip:flex relative z-10 w-3.5 h-3.5 items-center justify-center rounded bg-destructive/80 hover:bg-destructive flex-shrink-0 mr-1" onClick={(e) => { e.stopPropagation(); deleteClip(clip.id); }}>
                                  <Trash2 className="w-2 h-2 text-white" />
                                </button>
                              )}
                            </div>
                          ))}
                          {cuts.filter(c => c.accepted).map((cut, i) => (
                            <div
                              key={`cut-${i}`}
                              className="absolute inset-y-0 bg-destructive/25 border-l border-r border-destructive/50 cursor-pointer hover:bg-destructive/35 group/cut"
                              style={{
                                left: `${(cut.start / Math.max(duration, 1)) * 100}%`,
                                width: `${((cut.end - cut.start) / Math.max(duration, 1)) * 100}%`,
                              }}
                              title={`${cut.reason} — click ✕ to remove cut`}
                            >
                              <button className="absolute top-0.5 right-0.5 hidden group-hover/cut:flex w-3 h-3 items-center justify-center rounded-full bg-destructive text-white z-10" onClick={(e) => { e.stopPropagation(); deleteCut(i); }}>
                                <span className="text-[8px] leading-none">✕</span>
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="w-10 flex-shrink-0" />
                      </div>

                      {/* Music Track */}
                      <div className="flex items-center h-9 group hover:bg-muted/20">
                        <div className="w-[80px] flex-shrink-0 flex items-center gap-1 px-1" title="Music & audio tracks">
                          <span className="text-[9px] font-semibold text-cyan-400 truncate">Music</span>
                          <Button variant="ghost" size="icon" className="h-4 w-4 opacity-60 hover:opacity-100 flex-shrink-0" onClick={() => toggleTrackMute('a1')}>
                            {trackMuted.a1 ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                          </Button>
                          {musicTracks.length > 0 && (
                            <Slider
                              min={0}
                              max={100}
                              step={1}
                              value={[trackMuted.a1 ? 0 : Math.round((musicTracks[0]?.volume ?? 0.3) * 100)]}
                              onValueChange={([val]) => {
                                if (val === 0) {
                                  setTrackMuted(prev => ({ ...prev, a1: true }));
                                } else {
                                  setTrackMuted(prev => ({ ...prev, a1: false }));
                                  setMusicTracks(prev => prev.map(t => ({ ...t, volume: val / 100 })));
                                }
                              }}
                              className="w-12 flex-shrink-0"
                            />
                          )}
                        </div>
                        <div className="flex-1 relative h-6 mx-1">
                          {musicTracks.length > 0 ? (
                            musicTracks.map((track) => (
                              <div
                                key={track.id}
                                className="absolute inset-y-0 rounded bg-cyan-500/20 border border-cyan-500/40 overflow-hidden flex items-center cursor-pointer hover:bg-cyan-500/30 transition-colors group/clip"
                                style={{
                                  left: `${(track.startAt / Math.max(duration, 1)) * 100}%`,
                                  width: `${(track.duration / Math.max(duration, 1)) * 100}%`,
                                }}
                              >
                                <div className="absolute inset-0 flex items-center gap-px px-1 opacity-50">
                                  {musicWaveHeights.map((h, wi) => (
                                    <div
                                      key={wi}
                                      className="flex-1 bg-cyan-400/50 rounded-full"
                                      style={{ height: `${h}%` }}
                                    />
                                  ))}
                                </div>
                                <span className="relative text-[9px] text-cyan-300 font-medium px-2 truncate z-10 flex-1">
                                  {track.name}
                                </span>
                                <button className="hidden group-hover/clip:flex relative z-10 w-3.5 h-3.5 items-center justify-center rounded bg-destructive/80 hover:bg-destructive flex-shrink-0 mr-1" onClick={(e) => { e.stopPropagation(); deleteMusicTrack(track.id); }}>
                                  <Trash2 className="w-2 h-2 text-white" />
                                </button>
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
                                  {audioWaveHeights.map((h, wi) => (
                                    <div
                                      key={wi}
                                      className="flex-1 bg-cyan-400/40 rounded-full"
                                      style={{ height: `${h}%` }}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                        <div className="w-10 flex-shrink-0" />
                      </div>

                      {/* Hidden track toggles — show buttons to restore hidden tracks */}
                      {(!trackVisibility.v3 || !trackVisibility.v2) && (
                        <div className="flex items-center gap-1 px-2 py-1 border-t border-border/30">
                          <span className="text-[9px] text-muted-foreground mr-1">Hidden:</span>
                          {!trackVisibility.v3 && (
                            <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5 text-purple-400 hover:text-purple-300" onClick={() => toggleTrackVisibility('v3')}>
                              <Eye className="w-2.5 h-2.5 mr-0.5" /> Graphics
                            </Button>
                          )}
                          {!trackVisibility.v2 && (
                            <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1.5 text-pink-400 hover:text-pink-300" onClick={() => toggleTrackVisibility('v2')}>
                              <Eye className="w-2.5 h-2.5 mr-0.5" /> Overlay
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Playhead line spanning all tracks */}
                      {duration > 0 && (
                        <div
                          className="absolute bottom-0 top-0 z-20 pointer-events-none"
                          style={{ left: `calc(80px + (100% - 90px) * ${currentTime / duration})` }}
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

            {mediaPanelVisible && <ResizableHandle withHandle />}

            {/* Right Panel: Media */}
            {mediaPanelVisible ? (
            <ResizablePanel defaultSize={20} minSize={10} maxSize={30}>
              <div className="h-full flex flex-col bg-card border-l border-border">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
                  <span className="text-xs font-semibold text-foreground">Media</span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fileInputRef.current?.click()}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMediaPanelVisible(false)} title="Hide media panel">
                      <PanelRightClose className="w-3.5 h-3.5" />
                    </Button>
                  </div>
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
                            <div key={clip.id} className="relative rounded-lg overflow-hidden cursor-pointer group border border-border hover:border-primary/50 transition-colors bg-black">
                              <video src={clip.url} className="w-full aspect-video object-contain" />
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
                                <p className="text-[9px] text-muted-foreground">{br.duration}s{br.videoStatus === 'generating' ? ' · animating...' : br.videoStatus === 'ready' ? ' · 🎬 video' : br.imageStatus === 'generating' ? ' · generating...' : br.imageStatus === 'ready' ? ' · ✓ image' : ''}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No b-roll</p>
                      )}
                    </div>

                    {/* Source Clips Library — short video clips sliced from a source, ready to drop directly */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Scissors className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Source Clips</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4 justify-center">{savedBrollClips.length}</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 ml-auto text-[9px] gap-1"
                          disabled={!videoUrl || isAutoExtracting || !user}
                          onClick={async () => {
                            if (!videoUrl || !user) return;
                            try {
                              setIsAutoExtracting(true);
                              toast({ title: 'Slicing 6 short clips…', description: 'Saving playable B-Roll clips from your source video.' });
                              const saved = await extractBrollFrames({
                                videoUrl,
                                userId: user.id,
                                projectId: null,
                                label: draftName || 'Source',
                                count: 6,
                                clipDuration: 3,
                              });
                              if (saved.length) {
                                const [framesRes, clipsRes] = await Promise.all([
                                  supabase.from('generated_images').select('id, image_url, prompt').eq('user_id', user.id).eq('source', 'broll-frame').order('created_at', { ascending: false }).limit(60),
                                  supabase.from('generated_images').select('id, image_url, prompt').eq('user_id', user.id).eq('source', 'broll-clip').order('created_at', { ascending: false }).limit(60),
                                ]);
                                if (framesRes.data) setSavedBrollFrames(framesRes.data as any);
                                if (clipsRes.data) setSavedBrollClips(clipsRes.data as any);
                                toast({ title: `Saved ${saved.length} clip${saved.length !== 1 ? 's' : ''}`, description: 'They are ready in Source Clips.' });
                              }
                            } catch (e: any) {
                              toast({ title: 'Extract failed', description: e?.message, variant: 'destructive' });
                            } finally {
                              setIsAutoExtracting(false);
                            }
                          }}
                          title="Slice 6 short video clips from the current source"
                        >
                          {isAutoExtracting ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Scissors className="w-2.5 h-2.5" />}
                          Extract
                        </Button>
                      </div>
                      {savedBrollClips.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {savedBrollClips.slice(0, 24).map((c) => {
                            const meta = parseBrollClipMeta(c);
                            const previewUrl = `${meta.sourceUrl}#t=${meta.sourceStart},${(meta.sourceStart + meta.duration).toFixed(2)}`;
                            return (
                              <div
                                key={c.id}
                                role="button"
                                tabIndex={0}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('application/x-source-clip', JSON.stringify({
                                    videoUrl: meta.sourceUrl,
                                    label: meta.label,
                                    durationSec: meta.duration,
                                    sourceStart: meta.sourceStart,
                                    sourceUrl: meta.sourceUrl,
                                  }));
                                  e.dataTransfer.effectAllowed = 'copy';
                                }}
                                className="relative group rounded-md overflow-hidden border border-border hover:border-primary/70 hover:shadow-md transition-all bg-black cursor-grab active:cursor-grabbing"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  addBRollFromVideoClip({
                                    videoUrl: meta.sourceUrl,
                                    label: meta.label,
                                    durationSec: meta.duration,
                                    sourceStart: meta.sourceStart,
                                    sourceUrl: meta.sourceUrl,
                                  });
                                }}
                                onMouseEnter={(e) => {
                                  const v = e.currentTarget.querySelector('video') as HTMLVideoElement | null;
                                  if (v) { v.currentTime = meta.sourceStart; v.play().catch(() => {}); }
                                }}
                                onMouseLeave={(e) => {
                                  const v = e.currentTarget.querySelector('video') as HTMLVideoElement | null;
                                  if (v) { v.pause(); v.currentTime = meta.sourceStart + 0.05; }
                                }}
                                title={`Click or drag onto B-Roll track — ${meta.duration.toFixed(1)}s clip`}
                              >
                                <video
                                  src={previewUrl}
                                  preload="metadata"
                                  muted
                                  loop
                                  playsInline
                                  className="w-full aspect-video object-cover pointer-events-none bg-muted"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 pointer-events-none" />
                                <div className="absolute inset-0 group-hover:bg-primary/10 flex items-center justify-center transition-colors pointer-events-none">
                                  <div className="opacity-0 group-hover:opacity-100 bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg transition-opacity">
                                    <Plus className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 pointer-events-none">
                                  <p className="text-[10px] font-medium text-white truncate drop-shadow">{meta.label}</p>
                                </div>
                                <div className="absolute top-1 right-1 bg-primary/90 text-primary-foreground text-[9px] font-semibold px-1.5 py-0.5 rounded pointer-events-none shadow-sm">
                                  {meta.duration.toFixed(1)}s
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No source clips yet — hit Extract to slice short clips from the current video</p>
                      )}
                    </div>

                    {/* Saved Frames Library — still frames (fallback / legacy) */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saved Frames</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4 justify-center">{savedBrollFrames.length}</Badge>
                      </div>
                      {savedBrollFrames.length > 0 ? (
                        <div className="grid grid-cols-3 gap-1.5">
                          {savedBrollFrames.slice(0, 18).map((f) => {
                            // If the frame embeds source-clip metadata, treat as a virtual clip (no animation).
                            let meta: ReturnType<typeof parseBrollClipMeta> | null = null;
                            try {
                              if (f.prompt && f.prompt.trim().startsWith('{')) {
                                meta = parseBrollClipMeta(f as any);
                              }
                            } catch { /* not a clip */ }
                            const handleClick = () => {
                              if (meta && meta.sourceUrl) {
                                addBRollFromVideoClip({
                                  videoUrl: meta.sourceUrl,
                                  label: meta.label,
                                  durationSec: meta.duration,
                                  sourceStart: meta.sourceStart,
                                  sourceUrl: meta.sourceUrl,
                                });
                              } else {
                                // Legacy still frame — drop the actual JPEG onto the timeline as a static B-roll.
                                const brollId = crypto.randomUUID();
                                setBRollClips(prev => [...prev, {
                                  id: brollId,
                                  name: f.prompt || 'Saved frame',
                                  prompt: f.prompt || 'Saved frame',
                                  start: currentTime,
                                  duration: 3,
                                  imageUrl: f.image_url,
                                  imageStatus: 'ready',
                                } as BRollClip]);
                                toast({ title: 'Frame added', description: `Static image dropped at ${currentTime.toFixed(1)}s` });
                              }
                            };
                            return (
                            <button
                              key={f.id}
                              className="relative group rounded overflow-hidden border border-border hover:border-green-500/70 transition-colors"
                              onClick={handleClick}
                              title={meta ? `Add source clip @ ${currentTime.toFixed(1)}s` : `Add still frame @ ${currentTime.toFixed(1)}s`}
                            >
                              <img src={f.image_url} alt={f.prompt || 'frame'} className="w-full aspect-video object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                                <Plus className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                              </div>
                            </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No saved frames yet</p>
                      )}
                    </div>

                    {/* Product Gallery — pick a product image and animate as B-Roll */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Product Gallery</span>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 min-w-4 justify-center">{productImages.length}</Badge>
                      </div>
                      {productImages.length > 0 ? (
                        <div className="grid grid-cols-3 gap-1.5">
                          {productImages.slice(0, 18).map((p) => (
                            <button
                              key={p.id}
                              className="relative group rounded overflow-hidden border border-border hover:border-amber-500/70 transition-colors bg-muted/20"
                              onClick={() => addBRollFromImage(p.image_url, p.label || 'Product', `Subtle product showcase: gentle camera move on the product, natural lighting matching the source video's vibe`)}
                              title={`Add product as B-Roll @ ${currentTime.toFixed(1)}s`}
                            >
                              <img src={p.image_url} alt={p.label || 'product'} className="w-full aspect-square object-contain p-1" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                                <Plus className="w-4 h-4 text-white opacity-0 group-hover:opacity-100" />
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 text-center py-3">No products in gallery yet</p>
                      )}
                    </div>

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
                                <p className="text-[9px] text-muted-foreground">{ov.type.replace('_', ' ')} · {ov.duration}s · {ov.start.toFixed(1)}s{ov.imageStatus === 'generating' ? ' · generating...' : ov.imageStatus === 'ready' ? ' · ✓' : ''}</p>
                              </div>
                              {/* Scale control */}
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  className="w-5 h-5 rounded text-[9px] bg-muted hover:bg-muted/80 flex items-center justify-center"
                                  onClick={(e) => { e.stopPropagation(); setOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, scale: Math.max(1, (o.scale || 1) - 1) } : o)); }}
                                  title="Smaller"
                                >−</button>
                                <span className="text-[9px] text-muted-foreground w-4 text-center">{ov.scale || 1}x</span>
                                <button
                                  className="w-5 h-5 rounded text-[9px] bg-muted hover:bg-muted/80 flex items-center justify-center"
                                  onClick={(e) => { e.stopPropagation(); setOverlays(prev => prev.map(o => o.id === ov.id ? { ...o, scale: Math.min(5, (o.scale || 1) + 1) } : o)); }}
                                  title="Larger (5 = full screen)"
                                >+</button>
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

                    {/* Brand Settings */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <RatioIcon className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Brand</span>
                      </div>
                      <div className="space-y-2.5">
                        {/* Primary Color */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Primary Color</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={brandSettings.primaryColor}
                              onChange={(e) => setBrandSettings(prev => ({ ...prev, primaryColor: e.target.value }))}
                              className="w-6 h-6 rounded cursor-pointer border border-border"
                            />
                            <span className="text-[9px] font-mono text-muted-foreground">{brandSettings.primaryColor}</span>
                          </div>
                        </div>
                        {/* Text Color */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Text Color</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={brandSettings.textColor}
                              onChange={(e) => setBrandSettings(prev => ({ ...prev, textColor: e.target.value }))}
                              className="w-6 h-6 rounded cursor-pointer border border-border"
                            />
                            <span className="text-[9px] font-mono text-muted-foreground">{brandSettings.textColor}</span>
                          </div>
                        </div>
                        {/* Font */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Font</span>
                          <select
                            value={brandSettings.font}
                            onChange={(e) => setBrandSettings(prev => ({ ...prev, font: e.target.value }))}
                            className="text-[10px] bg-muted border border-border rounded px-1.5 py-1 text-foreground"
                          >
                            {['Inter', 'Montserrat', 'Poppins', 'Oswald', 'Roboto', 'Playfair Display', 'DM Sans', 'Space Grotesk', 'Bebas Neue', 'Raleway'].map(f => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>
                        {/* Logo */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Logo</span>
                          <div className="flex items-center gap-1.5">
                            {brandSettings.logoUrl ? (
                              <div className="flex items-center gap-1">
                                <img src={brandSettings.logoUrl} alt="Logo" className="w-6 h-6 object-contain rounded" />
                                <button
                                  className="text-[9px] text-destructive hover:underline"
                                  onClick={() => setBrandSettings(prev => ({ ...prev, logoUrl: null }))}
                                >✕</button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => logoInputRef.current?.click()}
                              >
                                Upload
                              </Button>
                            )}
                            <input
                              ref={logoInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !user) return;
                                try {
                                  const ext = file.name.split('.').pop();
                                  const path = `${user.id}/brand-logo-${Date.now()}.${ext}`;
                                  const { error } = await supabase.storage.from('raw-footage').upload(path, file);
                                  if (error) throw error;
                                  const { data: urlData } = supabase.storage.from('raw-footage').getPublicUrl(path);
                                  setBrandSettings(prev => ({ ...prev, logoUrl: urlData.publicUrl }));
                                  toast({ title: 'Logo uploaded', description: 'Your brand logo is set.' });
                                } catch (err: any) {
                                  toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
                                }
                              }}
                            />
                          </div>
                        </div>
                        {/* Website URL */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground shrink-0">Website</span>
                          <Input
                            value={brandSettings.websiteUrl || ''}
                            onChange={(e) => setBrandSettings(prev => ({ ...prev, websiteUrl: e.target.value }))}
                            placeholder="yourbrand.com"
                            className="h-6 text-[10px] px-2 flex-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </ResizablePanel>
            ) : (
              <div className="w-8 flex-shrink-0 bg-card border-l border-border flex flex-col items-center pt-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMediaPanelVisible(true)} title="Show media panel">
                  <PanelRightOpen className="w-4 h-4" />
                </Button>
              </div>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    </Layout>
  );
};

export default ChatcutAI;
