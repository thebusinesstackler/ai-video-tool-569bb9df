import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ImagePlus,
  Video,
  Bot,
  User,
  Loader2,
  Play,
  Download,
  ArrowUp,
  History,
  ArrowLeft,
  Calendar,
  X,
  Link,
  Sparkles,
  RefreshCw,
  Star,
  Pencil,
  RotateCcw,
  Check,
  Film,
  Wand2,
  Eye,
  Zap,
  Mic,
  Scissors,
  Package,
  Trash2,
  Share2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { createWaveSpeedVideo, getWaveSpeedVideoJob } from '@/lib/wavespeed';
import { stitchVideosWithAudio } from '@/lib/videoStitch';
import { trimVideoToTimestamp } from '@/lib/canvasStitch';
import ReactMarkdown from 'react-markdown';
import { ContentCalendarTab } from '@/components/ContentCalendarTab';
import { VideoRepoTimeline } from '@/components/VideoRepoTimeline';
import { FrameExtractorDialog } from '@/components/FrameExtractorDialog';
import { ProductPickerDialog, type SelectedProductContext } from '@/components/ProductPickerDialog';
import { MarcoVoiceChat } from '@/components/MarcoVoiceChat';
import { StylePicker, AlternativeAngles, STYLE_OPTIONS } from '@/components/StyleAnglePicker';
import { VideoRepoEngineSelector, type VideoEngine } from '@/components/VideoRepoEngineSelector';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { type: 'image' | 'video'; url: string; name?: string }[];
  videoResult?: { url: string; status: string };
  videoResults?: { url: string; label: string }[];
  retryable?: boolean;
}

interface VideoRepoProject {
  id: string;
  user_id: string;
  prompt: string | null;
  reference_video_url: string | null;
  product_image_url: string | null;
  analysis_text: string | null;
  generated_video_url: string | null;
  video_prompt: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  is_favorite?: boolean;
  custom_name?: string | null;
  segment_urls?: string[] | null;
  thumbnail_url?: string | null;
  tagged_product?: string | null;
  source?: 'video_repo' | 'podcast' | 'chatcut' | 'reels';
}

const statusColors: Record<string, string> = {
  analyzing: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  generating: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  stitching: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  completed: 'bg-green-500/15 text-green-600 border-green-500/30',
  failed: 'bg-red-500/15 text-red-600 border-red-500/30',
};

const VideoRepoPro = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<'create' | 'history' | 'library' | 'calendar'>('create');
  const [libraryFavoritesOnly, setLibraryFavoritesOnly] = useState(false);
  const [libraryPlayingId, setLibraryPlayingId] = useState<string | null>(null);
  const [libraryThumbs, setLibraryThumbs] = useState<Record<string, string>>({});
  const thumbInFlightRef = useRef<Set<string>>(new Set());
  const [reviewProject, setReviewProject] = useState<VideoRepoProject | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAiFeedback, setReviewAiFeedback] = useState<string | null>(null);
  const [isReviewLoadingAi, setIsReviewLoadingAi] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStitching, setIsStitching] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [referenceVideoUrl, setReferenceVideoUrl] = useState<string | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [referenceVideoName, setReferenceVideoName] = useState('');
  
  const [productImageName, setProductImageName] = useState('');
  const [referenceVideoFile, setReferenceVideoFile] = useState<File | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isDownloadingUrl, setIsDownloadingUrl] = useState(false);

  const [historyProjects, setHistoryProjects] = useState<VideoRepoProject[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedProject, setSelectedProject] = useState<VideoRepoProject | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [frameExtractor, setFrameExtractor] = useState<{ url: string; projectId: string; label: string } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 9;
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [singleDuration, setSingleDuration] = useState<10 | 15 | 20>(20);
  // Which video model to use for the NEXT generation. Default Sora-2; "Recreate with VEO3" sets this to 'veo3'.
  const [nextGenerationModel, setNextGenerationModel] = useState<'sora-2' | 'veo3'>('sora-2');
  // Google Flow (multi-shot Veo 3): chains 2-6 sequential 8s clips into one stitched video.
  const [flowMode, setFlowMode] = useState(false);
  const [flowShots, setFlowShots] = useState<number>(3);
  // UI engine picker (mirrors nextGenerationModel + future wan-2.5 routing).
  const selectedEngine: VideoEngine = nextGenerationModel === 'veo3' ? 'veo3' : nextGenerationModel as VideoEngine;
  const handleEngineChange = (e: VideoEngine) => {
    if (e === 'veo3') setNextGenerationModel('veo3');
    else if (e === 'sora-2') {
      setNextGenerationModel('sora-2');
      setFlowMode(false);
    } else {
      // wan-2.5 falls back to sora-2 routing for now; flag retained for future expansion
      setNextGenerationModel('sora-2');
      setFlowMode(false);
      toast({ title: 'Wan 2.5 coming soon', description: 'Defaulting to Sora-2 for now.' });
    }
  };

  // AI Script Director chat state
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [latestAnalysisText, setLatestAnalysisText] = useState('');
  const [persistentVideoUrl, setPersistentVideoUrl] = useState<string | null>(null);
  const [persistentImageUrl, setPersistentImageUrl] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);
  const [pendingAutoAnalysis, setPendingAutoAnalysis] = useState(false);
  const pendingAutoPromptRef = useRef<string>('');
  
  // AI Director detail view analysis
  const [directorAnalysisRef, setDirectorAnalysisRef] = useState<string | null>(null);
  const [directorAnalysisGen, setDirectorAnalysisGen] = useState<string | null>(null);
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false);
  const [isAnalyzingGen, setIsAnalyzingGen] = useState(false);
  const [isCreatingImproved, setIsCreatingImproved] = useState(false);
  const [isReviewingGenerated, setIsReviewingGenerated] = useState(false);
  const [expandedScript, setExpandedScript] = useState(false);
  const [detailChatInput, setDetailChatInput] = useState('');
  const [detailChatMessages, setDetailChatMessages] = useState<{role: 'user' | 'assistant'; content: string}[]>([]);
  const [isEditingScript, setIsEditingScript] = useState(false);
  const [scriptDraft, setScriptDraft] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [voiceChatOpen, setVoiceChatOpen] = useState(false);
  const [isDetailChatting, setIsDetailChatting] = useState(false);
  const [showSegments, setShowSegments] = useState(false);
  
  // Find the latest generated video URL from chat messages
  const latestGeneratedVideoUrl = [...messages].reverse().find(m => m.videoResult?.url)?.videoResult?.url || null;
  
  const hasComposerInput = Boolean(prompt.trim() || referenceVideoUrl || productImageUrl);
  const showConversation = messages.length > 0 || isAnalyzing || isGenerating || isStitching || isExtractingFrames || isChatting;
  const statusLabel = isExtractingFrames
    ? 'Extracting key frames from your reference video...'
    : isAnalyzing
      ? `Researching the reference video and writing your single-take ${singleDuration}s script...`
      : isStitching
        ? 'Finalizing your video...'
        : isGenerating
          ? generationProgress || `Generating your ${singleDuration}s clip with Sora 2...`
          : null;

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  };

  useEffect(() => {
    if (!showConversation) return;
    scrollToBottom(messages.length > 0 ? 'smooth' : 'auto');
  }, [messages, showConversation, isAnalyzing, isGenerating, isStitching, isExtractingFrames]);

  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const [repoRes, podcastRes, chatcutRes] = await Promise.all([
        supabase
          .from('video_repo_projects')
          .select('*')
          .eq('user_id', user.id)
          .order('is_favorite', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('podcast_projects')
          .select('id,user_id,topic,hook,video_url,scene_image_url,status,created_at,updated_at,twin_name,featured_product')
          .eq('user_id', user.id)
          .not('video_url', 'is', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('chatcut_drafts')
          .select('id,user_id,name,video_url,created_at,updated_at')
          .eq('user_id', user.id)
          .not('video_url', 'is', null)
          .order('created_at', { ascending: false }),
      ]);
      if (repoRes.error) throw repoRes.error;

      const repoRows = (repoRes.data as VideoRepoProject[] || []).map(r => ({ ...r, source: 'video_repo' as const }));

      const podcastRows: VideoRepoProject[] = (podcastRes.data || []).map((p: any) => ({
        id: `podcast:${p.id}`,
        user_id: p.user_id,
        prompt: p.hook || p.topic || null,
        reference_video_url: null,
        product_image_url: p.scene_image_url || null,
        analysis_text: null,
        generated_video_url: p.video_url,
        video_prompt: null,
        status: p.status || 'completed',
        created_at: p.created_at,
        updated_at: p.updated_at,
        is_favorite: false,
        custom_name: p.topic ? `🎙️ ${p.topic}` : (p.twin_name ? `🎙️ ${p.twin_name}` : '🎙️ Podcast'),
        thumbnail_url: p.scene_image_url || null,
        tagged_product: p.featured_product || null,
        source: 'podcast' as const,
      }));

      const chatcutRows: VideoRepoProject[] = (chatcutRes.data || []).map((c: any) => ({
        id: `chatcut:${c.id}`,
        user_id: c.user_id,
        prompt: c.name || null,
        reference_video_url: null,
        product_image_url: null,
        analysis_text: null,
        generated_video_url: c.video_url,
        video_prompt: null,
        status: 'completed',
        created_at: c.created_at,
        updated_at: c.updated_at,
        is_favorite: false,
        custom_name: c.name ? `✂️ ${c.name}` : '✂️ Chatcut Edit',
        thumbnail_url: null,
        source: 'chatcut' as const,
      }));

      const merged = [...repoRows, ...podcastRows, ...chatcutRows].sort((a, b) => {
        if ((b.is_favorite ? 1 : 0) !== (a.is_favorite ? 1 : 0)) return (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setHistoryProjects(merged);
    } catch (err: any) {
      console.error('Error fetching history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const isImported = (project: VideoRepoProject) => project.source && project.source !== 'video_repo';

  const toggleFavorite = async (project: VideoRepoProject, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isImported(project)) {
      toast({ title: 'Read-only', description: 'Favorites are only available for videos created in Video Repo.' });
      return;
    }
    const newVal = !project.is_favorite;
    setHistoryProjects(prev => prev.map(p => p.id === project.id ? { ...p, is_favorite: newVal } : p));
    const { error } = await supabase.from('video_repo_projects').update({ is_favorite: newVal } as any).eq('id', project.id);
    if (error) {
      setHistoryProjects(prev => prev.map(p => p.id === project.id ? { ...p, is_favorite: !newVal } : p));
      toast({ title: 'Error', description: 'Could not update favorite', variant: 'destructive' });
    } else {
      fetchHistory();
    }
  };

  /**
   * Capture a real preview frame for a CDN-hosted video.
   * Tries crossOrigin="anonymous" first, then falls back to fetch -> blob URL
   * to bypass CORS-tainted-canvas errors. Uploads result to Supabase Storage
   * and persists the URL on the project row so it loads instantly next time.
   */
  const captureThumbnail = useCallback(async (project: VideoRepoProject) => {
    const url = project.generated_video_url;
    if (!url || !user) return;
    if (libraryThumbs[project.id] || project.thumbnail_url) return;
    if (thumbInFlightRef.current.has(project.id)) return;
    thumbInFlightRef.current.add(project.id);

    const drawFromVideo = (videoSrc: string, useCors: boolean): Promise<string | null> =>
      new Promise((resolve) => {
        const v = document.createElement('video');
        if (useCors) v.crossOrigin = 'anonymous';
        v.muted = true;
        v.playsInline = true;
        v.preload = 'auto';
        v.src = videoSrc;
        let settled = false;
        const cleanup = () => {
          v.removeAttribute('src');
          try { v.load(); } catch {}
        };
        const fail = () => { if (!settled) { settled = true; cleanup(); resolve(null); } };
        const timeout = setTimeout(fail, 8000);
        const drawNow = () => {
          if (settled) return;
          try {
            const w = v.videoWidth || 540;
            const h = v.videoHeight || 960;
            const scale = Math.min(1, 540 / Math.max(w, h));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(w * scale));
            canvas.height = Math.max(1, Math.round(h * scale));
            const ctx = canvas.getContext('2d');
            if (!ctx) return fail();
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
            settled = true;
            clearTimeout(timeout);
            cleanup();
            resolve(dataUrl);
          } catch {
            fail();
          }
        };
        v.addEventListener('loadeddata', () => {
          try { v.currentTime = Math.min(0.5, (v.duration || 1) * 0.1); } catch { drawNow(); }
        });
        v.addEventListener('seeked', drawNow);
        v.addEventListener('error', fail);
      });

    try {
      // Attempt 1: direct video with CORS header
      let dataUrl = await drawFromVideo(url, true);

      // Attempt 2: fetch as blob -> object URL (same-origin canvas)
      if (!dataUrl) {
        try {
          const resp = await fetch(url);
          if (resp.ok) {
            const blob = await resp.blob();
            const objUrl = URL.createObjectURL(blob);
            dataUrl = await drawFromVideo(objUrl, false);
            URL.revokeObjectURL(objUrl);
          }
        } catch { /* CORS-blocked CDN; give up gracefully */ }
      }

      if (!dataUrl) return;

      // Cache locally for instant render
      setLibraryThumbs(prev => ({ ...prev, [project.id]: dataUrl! }));

      // Persist to storage so subsequent visits skip the decode entirely
      // Skip persistence for imported rows (podcast/chatcut) — they aren't in video_repo_projects.
      if (isImported(project)) return;

      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const path = `thumbnails/${project.id}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('project-files')
          .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
        if (!upErr) {
          const { data: pub } = supabase.storage.from('project-files').getPublicUrl(path);
          if (pub?.publicUrl) {
            await supabase.from('video_repo_projects')
              .update({ thumbnail_url: pub.publicUrl } as any)
              .eq('id', project.id);
            setHistoryProjects(prev => prev.map(p => p.id === project.id ? { ...p, thumbnail_url: pub.publicUrl } : p));
          }
        }
      } catch (e) {
        console.warn('[captureThumbnail] persist failed', e);
      }
    } finally {
      thumbInFlightRef.current.delete(project.id);
    }
  }, [libraryThumbs, user]);

  const startRename = (project: VideoRepoProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNameId(project.id);
    setEditNameValue(project.custom_name || project.prompt?.replace(/^\[PRO\]\s*/, '') || '');
  };

  const saveRename = async (projectId: string) => {
    const trimmed = editNameValue.trim();
    if (!trimmed) { setEditingNameId(null); return; }
    setHistoryProjects(prev => prev.map(p => p.id === projectId ? { ...p, custom_name: trimmed } : p));
    setEditingNameId(null);
    const { error } = await supabase.from('video_repo_projects').update({ custom_name: trimmed } as any).eq('id', projectId);
    if (error) {
      toast({ title: 'Error', description: 'Could not rename', variant: 'destructive' });
      fetchHistory();
    }
  };

  const openReviewDialog = (project: VideoRepoProject) => {
    setReviewProject(project);
    setReviewNotes((project as any).review_notes || '');
    setReviewAiFeedback(null);
  };

  const runAiReviewInDialog = async () => {
    if (!reviewProject?.generated_video_url) return;
    setIsReviewLoadingAi(true);
    setReviewAiFeedback(null);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-frame-vision', {
        body: {
          videoUrl: reviewProject.generated_video_url,
          prompt: `You are an AI Director reviewing a generated marketing video. Provide a critical post-production review covering:
1. Hook strength (first 2 seconds)
2. Visual quality, lighting, composition
3. Pacing and energy
4. On-brand consistency
5. Specific issues (artifacts, weird hands, audio mismatch, etc.)
6. 3 concrete recommendations to improve the next version

Original prompt: ${reviewProject.prompt || 'N/A'}
${reviewProject.video_prompt ? `Video script: ${reviewProject.video_prompt}` : ''}

Be honest, specific, and actionable. Use markdown.`,
        },
      });
      if (error) throw error;
      setReviewAiFeedback(data?.analysis || data?.text || 'No feedback returned.');
    } catch (err: any) {
      toast({ title: 'AI review failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsReviewLoadingAi(false);
    }
  };

  const saveReviewNotes = async () => {
    if (!reviewProject) return;
    setIsSavingReview(true);
    const { error } = await supabase
      .from('video_repo_projects')
      .update({ review_notes: reviewNotes } as any)
      .eq('id', reviewProject.id);
    setIsSavingReview(false);
    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      setHistoryProjects(prev => prev.map(p => p.id === reviewProject.id ? { ...p, review_notes: reviewNotes } as any : p));
      toast({ title: 'Notes saved' });
    }
  };

  const deleteProject = async (project: VideoRepoProject, e: React.MouseEvent) => {
    e.stopPropagation();
    const label = project.custom_name || project.prompt?.slice(0, 60) || 'this video';
    if (!confirm(`Delete "${label}"? This cannot be undone.`)) return;
    const prev = historyProjects;
    setHistoryProjects(prev.filter(p => p.id !== project.id));
    if (selectedProject?.id === project.id) setSelectedProject(null);

    let error: any = null;
    if (project.source === 'podcast') {
      const realId = project.id.replace(/^podcast:/, '');
      ({ error } = await supabase.from('podcast_projects').delete().eq('id', realId));
    } else if (project.source === 'chatcut') {
      const realId = project.id.replace(/^chatcut:/, '');
      ({ error } = await supabase.from('chatcut_drafts').delete().eq('id', realId));
    } else if (project.source === 'reels') {
      const realId = project.id.replace(/^reels:/, '');
      ({ error } = await supabase.from('reels').delete().eq('id', realId));
    } else {
      ({ error } = await supabase.from('video_repo_projects').delete().eq('id', project.id));
    }
    if (error) {
      setHistoryProjects(prev);
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Video removed from library.' });
    }
  };

  const loadProjectAssets = (project: VideoRepoProject) => {
    if (project.reference_video_url) {
      setReferenceVideoUrl(project.reference_video_url);
      setReferenceVideoName('Previous reference');
      setPersistentVideoUrl(project.reference_video_url);
    }
    if (project.product_image_url) {
      setProductImageUrl(project.product_image_url);
      setProductImageName('Previous product');
      setPersistentImageUrl(project.product_image_url);
    }
    // Reset chat state for fresh session
    setMessages([]);
    setHasAnalysis(false);
    setLatestAnalysisText('');
    setCurrentProjectId(null);
  };

  const remakeWithEdits = (project: VideoRepoProject, e: React.MouseEvent) => {
    e.stopPropagation();
    loadProjectAssets(project);
    setPrompt(project.prompt?.replace(/^\[PRO\]\s*/, '') || '');
    setSelectedProject(null);
    setMainTab('create');
    toast({ title: 'Project loaded', description: 'Edit your prompt and hit send to remake.' });
  };

  const newVersionFromProject = (project: VideoRepoProject, e: React.MouseEvent) => {
    e.stopPropagation();
    loadProjectAssets(project);
    const originalPrompt = project.prompt?.replace(/^\[PRO\]\s*/, '') || 'Analyze this reference and generate a full 30-second UGC ad video.';
    setPrompt(originalPrompt);
    setSelectedProject(null);
    setMainTab('create');
    pendingAutoPromptRef.current = originalPrompt;
    setPendingAutoAnalysis(true);
    toast({ title: 'Starting new version', description: 'Auto-analyzing reference video...' });
  };

  const sendToSpokesperson = (project: VideoRepoProject, e: React.MouseEvent) => {
    e.stopPropagation();
    const script = project.analysis_text || project.prompt || '';
    const wordCount = script.split(/\s+/).filter(Boolean).length;
    const estimatedSeconds = Math.ceil(wordCount / 2.5);
    const durationOptions = [10, 15, 30, 45, 60, 90, 120, 180];
    const bestDuration = durationOptions.reduce((prev, curr) =>
      Math.abs(curr - estimatedSeconds) < Math.abs(prev - estimatedSeconds) ? curr : prev
    );
    sessionStorage.setItem('video-repo-to-spokesperson', JSON.stringify({
      script,
      duration: String(bestDuration),
      title: project.custom_name || project.prompt?.slice(0, 60) || 'Untitled',
    }));
    navigate('/ai-spokesperson');
    toast({ title: 'Sent to AI Spokesperson', description: `Script loaded — pick your AI Twin to produce a ${bestDuration}s talking-head video.` });
  };

  const reAnalyzeFromDetail = (project: VideoRepoProject) => {
    loadProjectAssets(project);
    const originalPrompt = project.prompt?.replace(/^\[PRO\]\s*/, '') || 'Analyze this reference and generate a full 30-second UGC ad video.';
    setPrompt(originalPrompt);
    setSelectedProject(null);
    setMainTab('create');
    pendingAutoPromptRef.current = originalPrompt;
    setPendingAutoAnalysis(true);
    toast({ title: 'Re-analyzing', description: 'Starting fresh AI analysis...' });
  };

  // AI Director: Analyze a video from its URL (extract frames + AI review)
  const extractFramesFromUrl = async (videoUrl: string, count = 6): Promise<string[]> => {
    const resp = await fetch(videoUrl);
    const blob = await resp.blob();
    const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
    return extractVideoFrames(file, count);
  };

  const analyzeVideoWithDirector = async (videoUrl: string, videoType: 'reference' | 'generated', project: VideoRepoProject) => {
    const setAnalysis = videoType === 'reference' ? setDirectorAnalysisRef : setDirectorAnalysisGen;
    const setLoading = videoType === 'reference' ? setIsAnalyzingRef : setIsAnalyzingGen;
    
    setLoading(true);
    setAnalysis(null);
    
    try {
      toast({ title: `Analyzing ${videoType} video...`, description: 'Extracting frames, transcribing audio, and running AI Director review.' });
      
      // Run frame extraction and audio transcription in parallel
      const [frames, transcriptResult] = await Promise.all([
        extractFramesFromUrl(videoUrl, 6),
        supabase.functions.invoke('transcribe-video', { body: { videoUrl } })
          .then(res => res.data)
          .catch(err => { console.warn('Transcription failed, continuing without:', err); return null; }),
      ]);

      const transcript = transcriptResult?.text || '';
      const timestampedTranscript = transcriptResult?.timestampedTranscript || '';
      const hasTranscript = transcript.length > 10;
      
      const transcriptBlock = hasTranscript
        ? `\n\n📝 AUDIO TRANSCRIPT (from Whisper speech-to-text):\n${timestampedTranscript}\n\nFull text: "${transcript}"\nDetected language: ${transcriptResult?.language || 'unknown'}\nAudio duration: ${transcriptResult?.duration ? transcriptResult.duration.toFixed(1) + 's' : 'unknown'}`
        : '\n\n⚠️ No speech detected in the audio track. The video may be silent or music-only.';

      const contentParts: any[] = [
        { type: 'text', text: `I've extracted 6 key frames from the ${videoType} video and transcribed the audio.${transcriptBlock}\n\nAnalyze every detail:` },
        ...frames.map(f => ({ type: 'image_url', image_url: { url: f } })),
      ];

      const systemPrompt = `You are an expert AI Video Director reviewing a ${videoType === 'reference' ? 'reference/inspiration' : 'generated'} UGC ad video. You have both visual frames AND the full audio transcript. Use the transcript to provide exact quotes and analysis of what's being said.`;

      const analysisPrompt = videoType === 'reference'
        ? `Analyze this REFERENCE video in detail:

1. **What's Being Said** — Use the provided transcript to give the EXACT words spoken. Highlight the most powerful phrases and note delivery style/tone.
2. **Hook Strategy** — How do the first 3 seconds grab attention? What exact words are used in the hook? Rate it 1-10.
3. **Visual Style** — Camera angles, lighting, color grading, environment.
4. **Talent Performance** — Energy, expressions, gestures, authenticity. How does their delivery match the script?
5. **Product Integration** — How/when the product appears, how naturally it's featured. What's said about the product?
6. **Pacing & Transitions** — Shot duration, cuts, movement. How does the script pacing match visual pacing?
7. **Script Analysis** — Break down the script structure: hook → problem → solution → CTA. What copywriting techniques are used?
8. **What Makes This Work** — The 3 strongest elements to replicate (both visual AND verbal).
9. **What Could Be Better** — 2-3 specific improvements for a new version.
10. **Director's Blueprint** — A concise formula to recreate this ad style but better, including the script template.`
        : `Analyze this GENERATED video vs the original script:

Original script used:
${project.video_prompt || 'Not available'}

Actual audio transcript:
${transcript || 'No speech detected'}

1. **What Actually Happened** — Describe exactly what's shown in each frame, what the character does.
2. **Actual Dialogue** — Compare the transcript to the intended script. Quote exact words spoken.
3. **Script Accuracy** — How closely does the spoken audio match the intended script? What's missing or different?
4. **Visual Quality** — Rate lighting, composition, realism, character consistency (1-10 each).
5. **Hook Effectiveness** — Did the first 3 seconds deliver the intended hook? Rate 1-10. Quote what was actually said.
6. **Product Visibility** — Is the product visible and naturally integrated?
7. **What Worked** — The 3 best elements of this generation.
8. **What Failed** — Issues, artifacts, mismatches, or weak moments.
9. **Director's Notes for V2** — Specific prompt improvements to fix issues in the next version.`;

      contentParts.push({ type: 'text', text: analysisPrompt });

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentParts },
          ],
        },
      });

      if (error) throw new Error('AI analysis failed');
      if (!data?.response) throw new Error('No response from AI');
      
      setAnalysis(data.response);
      toast({ title: 'Analysis complete', description: `AI Director has reviewed the ${videoType} video.` });
    } catch (err: any) {
      console.error(`[AI Director] ${videoType} analysis error:`, err);
      toast({ title: 'Analysis failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // AI Director: Review generated video inline in chat
  const reviewGeneratedVideo = async () => {
    if (!latestGeneratedVideoUrl) return;
    setIsReviewingGenerated(true);
    
    try {
      toast({ title: 'AI Director Review', description: 'Extracting frames and analyzing your generated video...' });
      const frames = await extractFramesFromUrl(latestGeneratedVideoUrl, 6);
      
      // Find the script that was used
      const scriptMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.content.includes('Segment'));
      const scriptUsed = scriptMsg?.content || latestAnalysisText || 'Not available';

      const contentParts: any[] = [
        { type: 'text', text: 'I\'ve extracted 6 key frames from the generated video. Provide a thorough post-production review.' },
        ...frames.map(f => ({ type: 'image_url', image_url: { url: f } })),
        { type: 'text', text: `You are an expert AI Video Director doing a post-production review of a just-generated UGC ad. Your goal is to help the creator iterate and improve.

## Script that was used:
${scriptUsed}

## Your Review Should Cover:

### 🎬 Overall Score (1-10)
Rate the overall quality of this video.

### ✅ What Worked Well
- List 3-5 specific things that came out great (hook, transitions, expressions, lighting, pacing, etc.)

### ⚠️ Issues & Improvements Needed
- List specific problems you see (static moments, awkward transitions, poor framing, lip-sync issues, unnatural movement, etc.)
- For EACH issue, provide a concrete suggestion on how to fix it in the next version

### 🎯 Script Adjustments for V2
- Suggest specific script/prompt changes that would address the issues above
- Include timing adjustments, camera angle changes, or action modifications

### 💡 Director's Priority Fix
- What is the SINGLE most impactful change to make for the next version?

Be specific, constructive, and actionable. Reference exact moments/frames when possible.` },
      ];

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            { role: 'system', content: 'You are an expert AI Video Director reviewing a just-generated UGC ad video. Provide constructive, specific, and actionable feedback to help the creator improve the next version.' },
            { role: 'user', content: contentParts },
          ],
        },
      });

      if (error) throw new Error('AI review failed');
      if (!data?.response) throw new Error('No response from AI');

      const reviewMsg: ChatMessage = {
        id: `review-${Date.now()}`,
        role: 'assistant',
        content: `🎬 **AI Director — Post-Production Review**\n\n${data.response}\n\n---\n*Type feedback above to refine the script based on these notes, then hit "Generate Video from Script" to create V2.*`,
      };
      setMessages(prev => [...prev, reviewMsg]);
      scrollToBottom();
      toast({ title: 'Review complete', description: 'AI Director has reviewed your video with improvement suggestions.' });
    } catch (err: any) {
      console.error('[AI Director] review error:', err);
      toast({ title: 'Review failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsReviewingGenerated(false);
    }
  };

  // Create improved version using AI Director analysis
  const createImprovedVersion = async (project: VideoRepoProject) => {
    setIsCreatingImproved(true);
    
    try {
      const improvementContext = [
        directorAnalysisRef ? `## Reference Video Analysis:\n${directorAnalysisRef}` : '',
        directorAnalysisGen ? `## Generated Video Analysis:\n${directorAnalysisGen}` : '',
        project.video_prompt ? `## Previous Script:\n${project.video_prompt}` : '',
        project.analysis_text ? `## Previous AI Script Director Notes:\n${project.analysis_text}` : '',
      ].filter(Boolean).join('\n\n');

      toast({ title: 'Creating improved version', description: 'AI Director is crafting an optimized script...' });

      // Load project assets
      loadProjectAssets(project);
      
      // Set a detailed improvement prompt
      const improvedPrompt = `Based on the AI Director's analysis of both the reference and generated videos, create an IMPROVED version of this ad. Fix all identified issues, amplify what worked, and apply the Director's improvement notes.\n\n${improvementContext}`;
      
      setPrompt(improvedPrompt);
      setSelectedProject(null);
      setMainTab('create');
      pendingAutoPromptRef.current = improvedPrompt;
      setPendingAutoAnalysis(true);
      
      // Reset director analyses
      setDirectorAnalysisRef(null);
      setDirectorAnalysisGen(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsCreatingImproved(false);
    }
  };
  // AI Director chat in detail view
  const sendDetailChat = async (project: VideoRepoProject) => {
    if (!detailChatInput.trim() || isDetailChatting) return;
    const userMsg = detailChatInput.trim();
    setDetailChatInput('');
    setDetailChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsDetailChatting(true);

    try {
      const context = [
        project.video_prompt ? `Video Script:\n${project.video_prompt}` : '',
        project.analysis_text ? `AI Script Director Notes:\n${project.analysis_text}` : '',
        directorAnalysisRef ? `Reference Video Analysis:\n${directorAnalysisRef}` : '',
        directorAnalysisGen ? `Generated Video Analysis:\n${directorAnalysisGen}` : '',
        project.segment_urls?.length ? `This video has ${project.segment_urls.length} individual segments.` : '',
      ].filter(Boolean).join('\n\n');

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            { role: 'system', content: `You are an expert AI Video Director. You have full context of this project. Answer questions, suggest improvements, and provide actionable feedback. Be concise and direct.\n\nProject Context:\n${context}` },
            ...detailChatMessages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMsg },
          ],
        },
      });

      if (error) throw error;
      setDetailChatMessages(prev => [...prev, { role: 'assistant', content: data?.response || 'No response' }]);
    } catch (err: any) {
      setDetailChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsDetailChatting(false);
    }
  };

  // Recreate (single-take mode — re-analyzes from the original prompt to make a fresh ${singleDuration}s clip)
  const recreateWithSameEnding = async (project: VideoRepoProject) => {
    loadProjectAssets(project);
    const originalPrompt = project.prompt?.replace(/^\[PRO\]\s*/, '') || `Analyze reference and generate ${singleDuration}s ad`;
    setPrompt(originalPrompt);
    setSelectedProject(null);
    setMainTab('create');
    pendingAutoPromptRef.current = originalPrompt;
    setPendingAutoAnalysis(true);
    toast({ title: 'Recreating', description: `Re-analyzing and generating a fresh ${singleDuration}-second take.` });
  };

  // Recreate the EXACT same video with Google VEO3 (8s native, supports image-to-video).
  // Re-runs the AI Director on the original reference + prompt, then generates the new clip with VEO3 instead of Sora-2.
  const recreateWithVeo3 = (project: VideoRepoProject, e?: React.MouseEvent) => {
    e?.stopPropagation();
    loadProjectAssets(project);
    const originalPrompt = project.prompt?.replace(/^\[PRO\]\s*/, '') || `Analyze reference and generate ad`;
    setPrompt(originalPrompt);
    setNextGenerationModel('veo3');
    setSelectedProject(null);
    setMainTab('create');
    pendingAutoPromptRef.current = originalPrompt;
    setPendingAutoAnalysis(true);
    toast({
      title: '🎬 Recreating with Google VEO3',
      description: 'Re-analyzing the reference and generating a fresh take with VEO3 (native 8s, longer & higher detail).',
    });
  };

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  // Auto-trigger analysis for "New Version" flow
  useEffect(() => {
    if (pendingAutoAnalysis && mainTab === 'create' && !isAnalyzing && !isGenerating && !isStitching) {
      setPendingAutoAnalysis(false);
      // Small delay to ensure state is settled
      const timer = setTimeout(() => {
        analyzeReference();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pendingAutoAnalysis, mainTab, isAnalyzing, isGenerating, isStitching]);

  // Pick up data from Video Repurposer handoff
  useEffect(() => {
    const raw = sessionStorage.getItem('repurpose-to-video-repo');
    if (!raw) return;
    sessionStorage.removeItem('repurpose-to-video-repo');
    try {
      const data = JSON.parse(raw) as { videoUrl: string; script: string; title: string };
      if (data.videoUrl) {
        setReferenceVideoUrl(data.videoUrl);
        setReferenceVideoName(data.title || 'Repurposed reference');
      }
      if (data.script) {
        setPrompt(data.script);
        pendingAutoPromptRef.current = data.script;
      }
      setMainTab('create');
      setPendingAutoAnalysis(true);
    } catch (e) {
      console.error('Failed to parse repurpose handoff data', e);
    }
  }, []);

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  };

  const uploadFileToStorage = async (file: File, subfolder: string): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${user.id}/video-repo-pro/${subfolder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('reels').upload(fileName, file, { contentType: file.type });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);
    return publicUrl;
  };

  const uploadBlobToStorage = async (blob: Blob, subfolder: string, ext = 'mp4'): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const fileName = `${user.id}/video-repo-pro/${subfolder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('reels').upload(fileName, blob, { contentType: `video/${ext}` });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(fileName);
    return publicUrl;
  };

  const extractVideoFrames = async (file: File, count = 6): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      const url = URL.createObjectURL(file);
      video.src = url;

      video.onloadedmetadata = () => {
        const duration = video.duration;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const frames: string[] = [];
        const timestamps = Array.from({ length: count }, (_, i) =>
          Math.min(duration * (i / (count - 1)), duration - 0.1)
        );
        let idx = 0;

        const captureFrame = () => {
          canvas.width = Math.min(video.videoWidth, 640);
          canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.7));
          idx++;
          if (idx < timestamps.length) {
            video.currentTime = timestamps[idx];
          } else {
            URL.revokeObjectURL(url);
            resolve(frames);
          }
        };

        video.onseeked = captureFrame;
        video.currentTime = timestamps[0];
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      };
    });
  };

  const clearReferenceVideo = () => {
    if (referenceVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(referenceVideoUrl);
    setReferenceVideoUrl(null);
    setReferenceVideoName('');
    setReferenceVideoFile(null);
    setVideoFrames([]);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const clearProductImage = () => {
    setProductImageUrl(null);
    setProductImageName('');
    setProductImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadAsMp4 = async (url: string, filename: string) => {
    try {
      toast({ title: 'Preparing download...', description: 'Fetching video file.' });
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename.endsWith('.mp4') ? filename : `${filename}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e: any) {
      console.error('[downloadAsMp4]', e);
      toast({
        title: 'Download failed',
        description: 'Opening video in a new tab — right-click and choose "Save Video As" to save as .mp4.',
        variant: 'destructive',
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleUrlImport = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || isDownloadingUrl) return;
    try { new URL(trimmed); } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid TikTok, YouTube, or video URL.', variant: 'destructive' });
      return;
    }
    setIsDownloadingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('download-video-url', { body: { url: trimmed } });
      if (error) throw new Error(typeof error === 'object' && 'message' in error ? error.message : 'Download failed');
      if (data?.error) throw new Error(data.error);

      let finalVideoUrl = data?.videoUrl;

      // Handle client-side download fallback
      if (data?.clientDownload && data?.downloadUrl && data?.signedUploadUrl) {
        toast({ title: 'Downloading video...', description: 'Browser is fetching the video directly.' });
        
        // Use a hidden video element to load (bypasses CORS for playback)
        // Then capture via MediaRecorder
        const videoBlob = await new Promise<Blob>((resolve, reject) => {
          // First try direct fetch
          fetch(data.downloadUrl)
            .then(resp => {
              if (!resp.ok) throw new Error('fetch failed');
              return resp.blob();
            })
            .then(resolve)
            .catch(() => {
              // Fallback: use video element + canvas capture
              const video = document.createElement('video');
              video.muted = true;
              video.playsInline = true;
              video.preload = 'auto';
              video.crossOrigin = 'anonymous';
              video.src = data.downloadUrl;
              
              video.onerror = () => {
                // Last resort: try without crossOrigin  
                video.removeAttribute('crossorigin');
                video.src = '';
                video.src = data.downloadUrl;
                video.onerror = () => reject(new Error('Could not load this video. Please download it manually and upload the file instead.'));
                video.onloadeddata = () => {
                  try {
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
                    if (!stream) throw new Error('captureStream not supported');
                    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                    const chunks: Blob[] = [];
                    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                    recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
                    recorder.start();
                    video.play();
                    video.onended = () => recorder.stop();
                    // Safety timeout
                    setTimeout(() => { try { recorder.stop(); } catch {} }, 120000);
                  } catch (e) {
                    reject(new Error('Could not capture video. Please download it manually and upload the file instead.'));
                  }
                };
              };

              video.onloadeddata = () => {
                try {
                  const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
                  if (!stream) throw new Error('captureStream not supported');
                  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                  const chunks: Blob[] = [];
                  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                  recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
                  recorder.start();
                  video.play();
                  video.onended = () => recorder.stop();
                  setTimeout(() => { try { recorder.stop(); } catch {} }, 120000);
                } catch (e) {
                  reject(new Error('Could not capture video. Please download it manually and upload the file instead.'));
                }
              };

              video.load();
            });
        });

        if (videoBlob.size > 100 * 1024 * 1024) throw new Error('Video is too large (max 100MB)');

        // Upload to storage using signed URL
        const uploadResp = await fetch(data.signedUploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': videoBlob.type || 'video/mp4' },
          body: videoBlob,
        });
        if (!uploadResp.ok) throw new Error('Failed to upload video');
        finalVideoUrl = data.publicUrl;
      }

      if (!finalVideoUrl) throw new Error('No video returned');

      if (referenceVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(referenceVideoUrl);
      setReferenceVideoUrl(finalVideoUrl);
      try {
        const hostname = new URL(trimmed).hostname.replace('www.', '');
        setReferenceVideoName(`${hostname} import`);
      } catch { setReferenceVideoName('URL import'); }
      setReferenceVideoFile(null);
      setUrlInput('');
      setVideoFrames([]);

      setIsExtractingFrames(true);
      try {
        const videoResp = await fetch(finalVideoUrl);
        const blob = await videoResp.blob();
        const file = new File([blob], 'imported.mp4', { type: 'video/mp4' });
        const frames = await extractVideoFrames(file, 6);
        setVideoFrames(frames);
      } catch (frameErr) {
        console.warn('Could not extract frames from imported video:', frameErr);
        toast({ title: 'Video imported', description: 'Frames could not be extracted but you can still generate.' });
      } finally {
        setIsExtractingFrames(false);
      }
      toast({ title: 'Video imported!', description: 'Reference video ready for analysis.' });
    } catch (err: any) {
      console.error('[URL import error]', err);

      let description = err?.message || 'Could not download video from URL';
      const response = err && typeof err === 'object' && 'context' in err ? (err as { context?: Response }).context : undefined;

      if (response instanceof Response) {
        try {
          const body = await response.clone().json();
          if (body?.error && typeof body.error === 'string') {
            description = body.error;
          }
        } catch {
          try {
            const text = await response.clone().text();
            if (text) description = text;
          } catch {
          }
        }
      }

      toast({ title: 'Import failed', description, variant: 'destructive' });
    } finally {
      setIsDownloadingUrl(false);
    }
  };

  const handleReferenceVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (referenceVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(referenceVideoUrl);
    const objectUrl = URL.createObjectURL(file);
    setReferenceVideoName(file.name);
    setReferenceVideoUrl(objectUrl);
    setReferenceVideoFile(file);
    setVideoFrames([]);
    setIsExtractingFrames(true);
    try {
      const frames = await extractVideoFrames(file, 6);
      setVideoFrames(frames);
    } catch {
      URL.revokeObjectURL(objectUrl);
      setReferenceVideoUrl(null);
      setReferenceVideoName('');
      setReferenceVideoFile(null);
      setVideoFrames([]);
      toast({ title: 'Could not extract frames from video', variant: 'destructive' });
    } finally {
      setIsExtractingFrames(false);
      e.target.value = '';
    }
  };

  const handleProductImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProductImageName(file.name);
    setProductImageFile(file);
    const url = await fileToDataUrl(file);
    if (url) setProductImageUrl(url);
    e.target.value = '';
  };

  // Check if text contains video prompt blocks
  const hasVideoPrompts = (text: string) => {
    return /```video-prompt\b/.test(text);
  };

  const analyzeReference = async () => {
    if (isExtractingFrames) {
      toast({ title: 'Reference video still processing', description: 'Please wait for frame extraction to finish.' });
      return;
    }
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt && !referenceVideoUrl && !productImageUrl) return;

    let pVideoUrl: string | null = null;
    let pImageUrl: string | null = null;

    try {
      if (referenceVideoFile) {
        pVideoUrl = await uploadFileToStorage(referenceVideoFile, 'videos');
      } else if (referenceVideoUrl && !referenceVideoUrl.startsWith('blob:')) {
        pVideoUrl = referenceVideoUrl;
      }
      if (productImageFile) {
        pImageUrl = await uploadFileToStorage(productImageFile, 'images');
      } else if (productImageUrl && !productImageUrl.startsWith('data:') && !productImageUrl.startsWith('blob:')) {
        pImageUrl = productImageUrl;
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'File upload failed', description: err.message, variant: 'destructive' });
    }

    // Preserve existing persistent URLs if new ones aren't available
    setPersistentVideoUrl(pVideoUrl || persistentVideoUrl);
    setPersistentImageUrl(pImageUrl || persistentImageUrl);

    let projectId: string | null = null;
    if (user) {
      try {
        const { data: insertedRow, error: insertErr } = await supabase
          .from('video_repo_projects')
          .insert({
            user_id: user.id,
            prompt: `[PRO] ${trimmedPrompt || 'Analyze reference and generate 30s ad'}`,
            reference_video_url: pVideoUrl,
            product_image_url: pImageUrl,
            status: 'analyzing',
          })
          .select('id')
          .single();
        if (insertErr) console.error('Insert error:', insertErr);
        else projectId = insertedRow.id;
      } catch (err) {
        console.error('DB insert error:', err);
      }
    }
    setCurrentProjectId(projectId);

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedPrompt || 'Analyze this reference and generate a full 30-second UGC ad video.',
      attachments: [
        ...(referenceVideoUrl ? [{ type: 'video' as const, url: referenceVideoUrl, name: referenceVideoName }] : []),
        ...(productImageUrl ? [{ type: 'image' as const, url: productImageUrl, name: productImageName }] : []),
      ],
    };

    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setIsAnalyzing(true);
    scrollToBottom('auto');

    try {
      const contentParts: any[] = [];

      if (videoFrames.length > 0) {
        contentParts.push({
          type: 'text',
          text: `I've extracted ${videoFrames.length} key frames from the reference video "${referenceVideoName}". Analyze these frames to understand the visual style, hook strategy, pacing, transitions, camera angles, and talent actions:`,
        });
        for (const frame of videoFrames) {
          contentParts.push({ type: 'image_url', image_url: { url: frame } });
        }
      }

      if (productImageUrl && !productImageUrl.startsWith('blob:')) {
        contentParts.push({ type: 'text', text: 'Here is the product image to feature in the ad:' });
        contentParts.push({ type: 'image_url', image_url: { url: productImageUrl } });
      }

      const formatLabel = aspectRatio === '9:16' ? 'vertical reel (9:16)' : 'horizontal landscape (16:9)';
      const wordTarget = Math.round(singleDuration * 2.5);
      const systemPrompt = `You are an AI Script Director for UGC ad videos. You help filmmakers craft and refine scripts for a SINGLE-TAKE ${singleDuration}-SECOND video in ${formatLabel} format. The video is generated as ONE continuous Sora-2 clip — NO stitching, NO segmenting.

Your personality: Warm, experienced, collaborative. You speak like a veteran ad creative director. You welcome feedback and iterate on scripts.

CRITICAL RULES:
- The total ad is exactly ${singleDuration} seconds — ONE continuous clip, no cuts to a second segment, no stitching
- Format: ${formatLabel} — frame all shots accordingly
- Spoken script must be paced at ~2.5 words/second → target ~${wordTarget} words of voiceover (max ${wordTarget + 5})
- The ad MUST end with a complete closing beat (resolved CTA / payoff frame) — NEVER mid-sentence, NEVER a fade before ${singleDuration}s, NEVER trail off on a preposition or article
- The single video-prompt block must be 120-200 words with full cinematic detail covering the entire ${singleDuration}-second arc (hook → body → payoff/CTA)
- ALWAYS include the video-prompt and narration code blocks in your response so the user can generate when ready`;

      const analysisInstruction = `User request: "${userMsg.content}"

${videoFrames.length > 0 ? `Reference video: "${referenceVideoName}" — I've provided ${videoFrames.length} key frames above. Study them carefully.` : ''}
${productImageUrl ? 'Product image provided above — incorporate this product naturally.' : ''}

Provide:
1. **Reference Analysis**: What you observed in the reference frames — hook type, pacing, camera style, talent energy, visual effects
2. **Estimated Transcript**: Based on visual cues (lip movements, expressions, gestures, text overlays, captions), reconstruct what the person is most likely saying. Present as timestamped script (e.g., "0-3s: ...", "3-8s: ..."). If you see captions or text overlays, transcribe them exactly.
3. **Hook Strategy**: How the first 3 seconds will stop the scroll
4. **Full ${singleDuration}-Second Script**: Scene-by-scene breakdown covering 0-${singleDuration} seconds, with explicit timestamps that SUM to exactly ${singleDuration}s
5. **Product Integration**: How and when the product appears naturally
6. **CTA Strategy**: Closing technique for maximum conversion — must land cleanly inside the ${singleDuration}s window

Then provide ONE single video prompt block:

\`\`\`video-prompt
[ONE continuous ${singleDuration}-second video. 120-200 words covering environment, character, action choreography, camera movement, lighting, product placement, pacing, sound design, and the FINAL closing frame. The clip must end on a complete payoff/CTA frame — never mid-action, never a cut-off. Explicitly describe the closing 2 seconds so the model lands the ending.]
\`\`\`

And finally, provide the voiceover narration script:

\`\`\`narration
[The full voiceover script for the ${singleDuration}-second ad. ~${wordTarget} words (max ${wordTarget + 5}). Conversational, punchy, direct. The final sentence MUST be a complete, self-contained closing line — never trail off, never end on "and", "to", "the", or a comma.]
\`\`\`

After providing the script, let the user know they can give feedback to refine it, or hit "Generate Video" when they're happy with it.`;

      const styleSuffix = selectedStyle ? STYLE_OPTIONS.find(s => s.id === selectedStyle)?.promptSuffix : null;
      const fullInstruction = styleSuffix
        ? `${analysisInstruction}\n\n🎬 STYLE LOCK: ${styleSuffix}\nApply this style consistently across the entire ${singleDuration}-second clip.`
        : analysisInstruction;

      contentParts.push({ type: 'text', text: fullInstruction });

      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentParts.length > 1 ? contentParts : analysisInstruction },
          ],
        },
      });

      if (aiError) {
        const errorBody = typeof aiError === 'object' && 'context' in aiError
          ? JSON.stringify(aiError) : (aiError.message || 'AI analysis failed');
        throw new Error(errorBody);
      }

      if (!aiData?.response) {
        throw new Error('No response from AI. The model may be overloaded — please try again.');
      }

      const analysisText = aiData.response;

      if (projectId) {
        await supabase.from('video_repo_projects').update({ analysis_text: analysisText, status: 'analyzed' as any }).eq('id', projectId);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: analysisText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLatestAnalysisText(analysisText);
      if (hasVideoPrompts(analysisText)) {
        setHasAnalysis(true);
      }
      setIsAnalyzing(false);
    } catch (err: any) {
      console.error('[VideoRepoPro] Analysis error:', err);
      if (projectId) {
        await supabase.from('video_repo_projects').update({ status: 'failed' }).eq('id', projectId);
      }
      toast({ title: 'Analysis failed', description: err.message, variant: 'destructive' });
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ ${err.message}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsAnalyzing(false);
    }
  };

  // Follow-up chat with AI Script Director
  const handleFollowUp = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isChatting) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedPrompt,
    };
    setMessages((prev) => [...prev, userMsg]);
    setPrompt('');
    setIsChatting(true);
    scrollToBottom('auto');

    try {
      const formatLabel = aspectRatio === '9:16' ? 'vertical reel (9:16)' : 'horizontal landscape (16:9)';
      const wordTargetFollow = Math.round(singleDuration * 2.5);
      const systemPrompt = `You are an AI Script Director for UGC ad videos. You're in a collaborative session helping refine a SINGLE-TAKE ${singleDuration}-second ${formatLabel} ad script.

RULES:
- Listen to user feedback and revise the script accordingly
- ALWAYS include updated video-prompt and narration code blocks when you make script changes
- The ad is ONE continuous ${singleDuration}s clip — NO segmenting, NO stitching
- The closing line and final frame MUST land cleanly inside the ${singleDuration}s window — never mid-sentence, never trailing off
- Narration target: ~${wordTargetFollow} words (max ${wordTargetFollow + 5})
- Be collaborative, warm, and constructive
- If the user asks questions about the script, answer helpfully
- The single video-prompt block must be 120-200 words with full cinematic detail`;

      // Build conversation history for context
      const aiMessages: any[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: trimmedPrompt },
      ];

      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai', {
        body: { messages: aiMessages },
      });

      if (aiError) throw new Error(aiError.message || 'AI chat failed');
      if (!aiData?.response) throw new Error('No response from AI');

      const responseText = aiData.response;
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Update latest analysis if it contains video prompts
      if (hasVideoPrompts(responseText)) {
        setLatestAnalysisText(responseText);
        setHasAnalysis(true);
      }
    } catch (err: any) {
      console.error('[VideoRepoPro] Follow-up error:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ ${err.message}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsChatting(false);
    }
  };

  // Generate video from the latest approved script
  const generateFromScript = async () => {
    if (!latestAnalysisText || !hasAnalysis) return;

    const analysisText = latestAnalysisText;
    const projectId = currentProjectId;

    if (projectId) {
      await supabase.from('video_repo_projects').update({ analysis_text: analysisText, status: 'generating' }).eq('id', projectId);
    }

    // Extract ONE single video prompt (no segments)
    const promptMatch = analysisText.match(/```video-prompt\s*\n([\s\S]*?)```/);

    if (!promptMatch) {
      toast({ title: 'No video prompt found', description: 'Ask the AI to include a single ```video-prompt``` block.', variant: 'destructive' });
      return;
    }

    let videoPrompt = promptMatch[1].trim();

    // --- AI Script Pacing Agent (single-clip mode) ---
    try {
      setGenerationProgress('AI Agent reviewing script pacing & ending...');
      const narrationMatch = analysisText.match(/```narration\n([\s\S]*?)```/);
      const fullNarration = narrationMatch ? narrationMatch[1].trim() : '';
      const wordTarget = Math.round(singleDuration * 2.5);

      const { data: pacingData, error: pacingError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a script pacing & ending QA agent for SINGLE-TAKE Sora-2 videos.

RULES:
- Speaking rate is ~2.5 words/second
- Target duration: ${singleDuration} seconds → narration target ~${wordTarget} words (max ${wordTarget + 5})
- The video is ONE continuous clip — no segments, no stitching
- Video prompt should be 120-200 words with full cinematic detail covering the ENTIRE ${singleDuration}s arc (hook → body → payoff/CTA)
- The narration's FINAL sentence MUST be a complete, self-contained closing line — never end on "and", "to", "the", "for", "but", a comma, an ellipsis, or any preposition/article
- The video prompt MUST explicitly describe the closing 1-2 seconds and final frame so the model lands the ending cleanly inside ${singleDuration}s
- If the narration is too long for ${singleDuration}s at 2.5 wps, trim it. If the closing line is incomplete, rewrite it as a complete sentence.

RESPOND IN EXACTLY THIS FORMAT (no extra text):
\`\`\`video-prompt
[corrected single video prompt — 120-200 words — must include explicit closing-frame description]
\`\`\`

\`\`\`narration
[corrected narration — max ${wordTarget + 5} words — final sentence must be complete and self-contained]
\`\`\`

If everything is already fine, return them unchanged.`
            },
            {
              role: 'user',
              content: `Review this for pacing + a clean ending inside ${singleDuration}s:

VIDEO PROMPT:
${videoPrompt}

NARRATION:
${fullNarration}

Check word count vs ${singleDuration}s duration (~2.5 words/sec = ${wordTarget} words ideal). Verify the closing line is COMPLETE and the prompt explicitly describes the final frame. Fix any issues.`
            }
          ],
        },
      });

      if (!pacingError && pacingData?.response) {
        const reviewed = pacingData.response;
        const rp = reviewed.match(/```video-prompt\s*\n([\s\S]*?)```/);
        if (rp) {
          videoPrompt = rp[1].trim();
          console.log('[VideoRepoPro] AI Pacing Agent revised single-clip prompt');
        }
      }
    } catch (pacingErr) {
      console.warn('[VideoRepoPro] Pacing review failed, using original prompt:', pacingErr);
    }

    const segmentModel: 'sora-2' | 'veo3' = nextGenerationModel;
    const modelLabel = segmentModel === 'veo3' ? 'Google VEO3' : 'Sora-2';
    // VEO3 produces 8-second native clips; Sora-2 honors singleDuration (10/15/20s).
    const effectiveDuration = segmentModel === 'veo3' ? 8 : singleDuration;

    // ============================================================
    // GOOGLE FLOW MODE — multi-shot Veo 3 chained into one video
    // ============================================================
    if (segmentModel === 'veo3' && flowMode) {
      const shotCount = Math.max(2, Math.min(6, flowShots));
      const totalSec = shotCount * 8;
      const narrationMatch = analysisText.match(/```narration\n([\s\S]*?)```/);
      const fullNarration = narrationMatch ? narrationMatch[1].trim() : videoPrompt;

      setIsGenerating(true);
      const flowMsg: ChatMessage = {
        id: `assistant-flow-${Date.now()}`,
        role: 'assistant',
        content: `🎬 **Google Flow Mode** — generating ${shotCount} sequential Veo 3 shots (${totalSec}s total) with locked character + setting, then auto-stitching into one continuous video.`,
      };
      setMessages((prev) => [...prev, flowMsg]);

      try {
        // 1) Build the Flow plan (Bible + per-shot prompts)
        setGenerationProgress(`Planning ${shotCount}-shot Flow with shared Bible...`);
        const { data: planData, error: planError } = await supabase.functions.invoke('generate-flow-bible', {
          body: {
            script: fullNarration,
            shotCount,
            aspectRatio,
            referenceContext: videoPrompt.slice(0, 3500),
          },
        });
        if (planError) throw new Error(planError.message || 'Flow planning failed');
        if (!planData?.shots?.length) throw new Error('Flow plan returned no shots');

        const shots = planData.shots as { shotNumber: number; prompt: string; dialogue: string }[];
        console.log('[VideoRepoPro] Flow plan ready:', planData.bible, shots.length, 'shots');

        // 2) Kick off all shots in parallel via Veo 3
        setGenerationProgress(`Launching ${shots.length} Veo 3 shots in parallel...`);
        const taskIds = await Promise.all(
          shots.map((s) =>
            createWaveSpeedVideo({
              prompt: s.prompt,
              model: 'veo3',
              aspectRatio,
              duration: 8,
              userId: user?.id,
              source: 'video-repo-pro-flow',
              sceneNumber: s.shotNumber,
              ...(persistentImageUrl && s.shotNumber === 1 ? { imageUrls: [persistentImageUrl] } : {}),
            }).then((taskId) => ({ shotNumber: s.shotNumber, taskId }))
          )
        );

        // 3) Poll all shots until completion
        const completed: Record<number, string> = {};
        const maxAttempts = 150;
        let attempts = 0;
        while (Object.keys(completed).length < taskIds.length && attempts < maxAttempts) {
          await new Promise((r) => setTimeout(r, 5000));
          await Promise.all(
            taskIds.map(async (t) => {
              if (completed[t.shotNumber]) return;
              try {
                const job = await getWaveSpeedVideoJob(t.taskId);
                if (job?.status === 'completed' && job.videoUrl) {
                  completed[t.shotNumber] = job.videoUrl;
                } else if (job?.status === 'failed') {
                  throw new Error(`Shot ${t.shotNumber} failed: ${job.error || 'unknown'}`);
                }
              } catch (err) {
                console.error(`[Flow] Shot ${t.shotNumber} poll error`, err);
              }
            })
          );
          attempts++;
          const done = Object.keys(completed).length;
          setGenerationProgress(`Veo 3 Flow: ${done}/${taskIds.length} shots ready (${Math.round((attempts / maxAttempts) * 100)}%)...`);
        }

        const orderedClips = taskIds
          .map((t) => completed[t.shotNumber])
          .filter((u): u is string => !!u);

        if (orderedClips.length === 0) {
          throw new Error('No Flow shots completed in time.');
        }

        // 4) Auto-stitch via Creatomate
        setIsStitching(true);
        setGenerationProgress(`Stitching ${orderedClips.length} shots into one video...`);

        let finalUrl: string | null = null;
        try {
          const clips = orderedClips.map((url) => ({ url, duration: 8 }));
          const { data: stitchData, error: stitchError } = await supabase.functions.invoke('creatomate-stitch', {
            body: { clips, transition: 'crossfade' },
          });
          if (stitchError) throw stitchError;

          if (stitchData?.success && stitchData?.renderId) {
            const renderStart = Date.now();
            while (Date.now() - renderStart < 300_000) {
              const { data: status } = await supabase.functions.invoke('creatomate-status', {
                body: { renderId: stitchData.renderId },
              });
              if (status?.status === 'succeeded' && status?.url) {
                finalUrl = status.url;
                break;
              }
              if (status?.status === 'failed') break;
              await new Promise((r) => setTimeout(r, 3000));
            }
          }
        } catch (stitchErr) {
          console.warn('[Flow] Cloud stitch failed, falling back to first clip:', stitchErr);
        }

        if (!finalUrl) finalUrl = orderedClips[0];

        // 5) Save to history
        if (projectId) {
          await supabase.from('video_repo_projects').update({
            generated_video_url: finalUrl,
            status: 'completed',
            segment_urls: orderedClips,
            model: 'veo3',
            engine: 'veo3',
            flow_mode: true,
            flow_shot_count: orderedClips.length,
            video_prompt: shots.map((s) => `Shot ${s.shotNumber}: ${s.dialogue}`).join('\n'),
          } as any).eq('id', projectId);
        }

        if (user) {
          await supabase.from('generated_images').insert({
            user_id: user.id,
            image_url: finalUrl,
            prompt: `[PRO Flow ${orderedClips.length}×8s VEO3] ${(shots[0]?.dialogue || '').substring(0, 100)}...`,
            source: 'video-repo-pro-flow',
            reference_image_url: persistentImageUrl,
          });
        }

        setIsGenerating(false);
        setIsStitching(false);
        setGenerationProgress('');

        const flowResultMsg: ChatMessage = {
          id: `flow-result-${Date.now()}`,
          role: 'assistant',
          content: `✅ **Veo 3 · Flow · ${orderedClips.length} shots** ready! Stitched into one ${orderedClips.length * 8}s video.\n\n💾 Saved to your **History** tab. Each individual shot is also preserved so you can re-roll any single one.`,
          videoResults: [
            { url: finalUrl, label: `Final Flow video (${orderedClips.length}×8s)` },
            ...orderedClips.map((u, i) => ({ url: u, label: `Shot ${i + 1}` })),
          ],
        };
        setMessages((prev) => prev.filter((m) => m.id !== flowMsg.id).concat(flowResultMsg));
        await fetchHistory();
        // Reset to default after run
        setNextGenerationModel('sora-2');
        setFlowMode(false);
        toast({ title: '🎬 Flow video saved', description: `${orderedClips.length} Veo 3 shots stitched into one ${orderedClips.length * 8}s video.` });
        return;
      } catch (flowErr: any) {
        console.error('[VideoRepoPro] Flow Mode failed:', flowErr);
        if (projectId) {
          await supabase.from('video_repo_projects').update({ status: 'failed' }).eq('id', projectId);
        }
        const errMsg: ChatMessage = {
          id: `flow-error-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Flow Mode error: ${flowErr.message}\n\nYou can retry, or switch off Flow Mode to generate a single 8s Veo 3 clip instead.`,
          retryable: true,
        };
        setMessages((prev) => prev.filter((m) => m.id !== flowMsg.id).concat(errMsg));
        setIsGenerating(false);
        setIsStitching(false);
        setGenerationProgress('');
        return;
      }
    }
    // ============================================================
    // END FLOW MODE — falls through to single-shot pipeline below
    // ============================================================

    // --- VEO3 Prompt Rewriter ---
    // VEO3 supports native synchronized audio + dialogue. Rewrite the Sora-style cinematic prompt
    // into a VEO3-native prompt with explicit spoken dialogue, ambient audio, and 8-second structure.
    if (segmentModel === 'veo3') {
      try {
        setGenerationProgress('Optimizing prompt for Google VEO3 (native dialogue + audio)...');
        const narrationMatch = analysisText.match(/```narration\n([\s\S]*?)```/);
        const fullNarration = narrationMatch ? narrationMatch[1].trim() : '';
        // VEO3 = 8s @ ~2.5 wps → ~20 words spoken max
        const veo3WordTarget = 20;

        const { data: veo3Data, error: veo3Error } = await supabase.functions.invoke('ai', {
          body: {
            messages: [
              {
                role: 'system',
                content: `You are a prompt engineer for Google VEO3 (text+image-to-video, 8 seconds, native synchronized audio with lip-synced dialogue).

VEO3 STRENGTHS — USE THEM:
- Native spoken dialogue with accurate lip-sync (no separate TTS needed)
- Ambient sound design baked into the video (room tone, foley, light music)
- Photoreal humans with natural expression and micro-movement
- 8-second clean single take

VEO3 PROMPT FORMAT (strict):
1. SHOT (1 sentence): subject, setting, framing, lens, lighting (cinematic, natural daylight if UGC)
2. ACTION (1-2 sentences): what the subject DOES across the 8s — concrete physical actions, expressions, eye contact
3. DIALOGUE (this is the most important part — VEO3 will lip-sync it):
   Format EXACTLY as: The [subject] says: "[exact spoken line, max ${veo3WordTarget} words, must be a complete self-contained thought that fits naturally in 8 seconds at ~2.5 words/sec]"
   - Must be ONE clean spoken line, conversational, ends on a complete sentence
   - No stage directions inside the quotes
   - Match the brand/topic from the source narration
4. AUDIO (1 sentence): ambient sound + tone (e.g. "Audio: soft room tone, subtle warm background music, intimate ASMR-close mic on the voice.")
5. ENDING (1 short sentence): describe the final frame at second 8 — subject's final expression/pose so VEO3 lands the cut cleanly.

HARD RULES:
- Total prompt: 90-160 words
- DIALOGUE quoted line: max ${veo3WordTarget} words, MUST be a complete sentence, MUST make sense as a standalone spoken hook/insight/CTA
- No camera-jargon overload — VEO3 prefers plain cinematic English
- No "[TEXT FREEZE]", no segment markers, no scene numbers
- Do NOT include "Subtitles:" or "Caption:" instructions — VEO3 bakes them in if you ask, we don't want that

RESPOND IN EXACTLY THIS FORMAT (no extra text, no preamble):
\`\`\`veo3-prompt
[the rewritten 90-160 word VEO3 prompt following the 5-part format above, with the dialogue line clearly written as: The [subject] says: "..."]
\`\`\``
              },
              {
                role: 'user',
                content: `Rewrite this for Google VEO3 (8s, native dialogue + audio). Pull the single strongest spoken line from the narration — it must be a complete thought that fits in ~8 seconds (max ${veo3WordTarget} words).

ORIGINAL CINEMATIC PROMPT:
${videoPrompt}

ORIGINAL NARRATION (extract or distill the best single spoken line from this):
${fullNarration || '(no narration provided — invent a punchy on-brand spoken line that matches the visual prompt)'}

Output the VEO3-optimized prompt now.`
              }
            ],
          },
        });

        if (!veo3Error && veo3Data?.response) {
          const v3 = veo3Data.response.match(/```veo3-prompt\s*\n([\s\S]*?)```/);
          if (v3) {
            videoPrompt = v3[1].trim();
            console.log('[VideoRepoPro] VEO3 prompt rewriter applied:', videoPrompt.substring(0, 200));
          } else {
            // Model didn't wrap in fence — use raw response if it looks reasonable
            const raw = veo3Data.response.trim();
            if (raw.length > 50 && raw.length < 2000) {
              videoPrompt = raw;
              console.log('[VideoRepoPro] VEO3 rewriter returned unfenced prompt, using raw');
            }
          }
        } else if (veo3Error) {
          console.warn('[VideoRepoPro] VEO3 rewriter failed, using cinematic prompt as-is:', veo3Error);
        }
      } catch (veo3Err) {
        console.warn('[VideoRepoPro] VEO3 prompt rewrite error, using cinematic prompt:', veo3Err);
      }
    }

    if (projectId) {
      await supabase.from('video_repo_projects').update({
        video_prompt: videoPrompt,
      }).eq('id', projectId);
    }

    setIsGenerating(true);

    const generatingMsg: ChatMessage = {
      id: `assistant-gen-${Date.now()}`,
      role: 'assistant',
      content: `🎬 Generating ONE continuous ${effectiveDuration}-second video with ${modelLabel}... No stitching, no segments — a single clean take that ends on the closing frame.`,
    };
    setMessages((prev) => [...prev, generatingMsg]);

    let videoUrl: string | null = null;

    try {
      setGenerationProgress(`Starting ${effectiveDuration}s generation with ${modelLabel}...`);

      const taskId = await createWaveSpeedVideo({
        prompt: videoPrompt,
        model: segmentModel,
        aspectRatio,
        duration: effectiveDuration,
        userId: user?.id,
        source: 'video-repo-pro',
        ...(persistentImageUrl ? { imageUrls: [persistentImageUrl] } : {}),
      });

      let attempts = 0;
      const maxAttempts = 150;

      while (attempts < maxAttempts && !videoUrl) {
        await new Promise((r) => setTimeout(r, 5000));
        const job = await getWaveSpeedVideoJob(taskId);

        if (job?.status === 'completed' && job.videoUrl) {
          videoUrl = job.videoUrl;
          setGenerationProgress('Video ready!');
          break;
        }
        if (job?.status === 'failed') throw new Error(`Generation failed: ${job.error || 'Unknown error'}`);

        setGenerationProgress(`Generating ${effectiveDuration}s clip with ${modelLabel}... (${Math.round((attempts / maxAttempts) * 100)}%)`);
        attempts++;
      }

      if (!videoUrl) {
        throw new Error(`Video generation timed out after ${attempts * 5}s.`);
      }

      setIsGenerating(false);
      setGenerationProgress('');

      if (projectId) {
        await supabase.from('video_repo_projects').update({
          generated_video_url: videoUrl,
          status: 'completed',
          segment_urls: [videoUrl],
          model: segmentModel,
        } as any).eq('id', projectId);
      }

      if (user) {
        await supabase.from('generated_images').insert({
          user_id: user.id,
          image_url: videoUrl,
          prompt: `[PRO ${effectiveDuration}s ${modelLabel}] ${videoPrompt.substring(0, 100)}...`,
          source: 'video-repo-pro',
          reference_image_url: persistentImageUrl,
        });
      }

      const resultMsg: ChatMessage = {
        id: `result-${Date.now()}`,
        role: 'assistant',
        content: `✅ Your ${effectiveDuration}-second ${modelLabel} video is ready! One clean take — no stitching. Want changes? Just tell me in the chat.\n\n💾 This project has been saved to your **History** tab.`,
        videoResults: [{ url: videoUrl, label: `${effectiveDuration}s ${modelLabel} clip` }],
      };
      setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id).concat(resultMsg));
      await fetchHistory();
      // Reset to default model after a successful VEO3 run so the next chat-driven generation goes back to Sora-2.
      if (segmentModel === 'veo3') setNextGenerationModel('sora-2');
      toast({
        title: '✅ Saved to History',
        description: 'Your single-take video is saved. Click the History tab to view all your projects.',
      });
    } catch (genErr: any) {
      if (projectId) {
        await supabase.from('video_repo_projects').update({ status: 'failed' }).eq('id', projectId);
      }

      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ Generation issue: ${genErr.message}\n\nYou can retry from the chat, or copy the video prompt above and try again.`,
        retryable: true,
      };
      setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id).concat(errorMsg));
    }
    setIsGenerating(false);
    setIsStitching(false);
    setGenerationProgress('');
    fetchHistory();
  };

  const enhancePrompt = async () => {
    const current = prompt.trim();
    if (!current) {
      toast({ title: 'Nothing to enhance', description: 'Type or paste a prompt first.', variant: 'destructive' });
      return;
    }
    setIsEnhancing(true);
    try {
      const directorBrief = `You are the AI Reel Director for a high-performance UGC ad platform. Rewrite the user's prompt into a richly-detailed ${singleDuration}-second cinematic ad brief for ONE continuous Sora-2 take (no stitching, no segments). Apply these rules:

- Movement-First UGC aesthetic: bright natural daylight, unretouched, handheld energy, vibrant color.
- Structure: Hook (first 2-3s, psychological trigger) → Problem → Product reveal → 1-2 specific benefits → CTA — all inside ${singleDuration}s as ONE continuous take.
- Pacing: ~2.5 words/second. Total ~${Math.round(singleDuration * 2.5)} words of spoken script (max ${Math.round(singleDuration * 2.5) + 5}).
- Cinematography: specify shot type, camera motion, lens feel, lighting, location, wardrobe, and explicitly describe the FINAL closing frame so the model lands the ending cleanly inside ${singleDuration}s.
- Keep the user's product, brand voice, and core idea intact — do NOT invent a different product.
- Output ONLY the rewritten prompt as a single flowing brief (no headings, no bullet labels, no preamble like "Here is..."). Plain text, ready to paste back into the composer.`;

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          message: `${directorBrief}\n\n---\nUSER PROMPT TO ENHANCE:\n${current}\n\n${productImageName ? `Product attached: ${productImageName}` : ''}\n${referenceVideoName ? `Reference video attached: ${referenceVideoName}` : ''}`,
        },
      });
      if (error) throw error;
      const enhanced = (data?.response || '').trim();
      if (!enhanced) throw new Error('No enhanced prompt returned');
      setPrompt(enhanced);
      toast({ title: 'Prompt enhanced ✨', description: 'AI Director rewrote your brief — review and tweak before sending.' });
    } catch (err) {
      console.error('enhancePrompt error:', err);
      toast({ title: 'Enhance failed', description: err instanceof Error ? err.message : 'Try again.', variant: 'destructive' });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSubmit = () => {
    if (hasAnalysis && prompt.trim()) {
      handleFollowUp();
    } else {
      analyzeReference();
    }
  };

  // Voice handler — called when user finishes speaking via MarcoVoiceChat
  const handleVoiceTranscript = async (transcript: string) => {
    if (!transcript.trim()) return;
    setPrompt(transcript);
    // Wait one tick so prompt state updates before submit reads it
    await new Promise((r) => setTimeout(r, 50));
    if (hasAnalysis) {
      handleFollowUp();
    } else {
      analyzeReference();
    }
  };

  // Alternative-angle handler — pre-fills feedback and runs the follow-up
  const applyAlternativeAngle = async (instruction: string, label: string) => {
    if (isChatting || isAnalyzing) return;
    setPrompt(instruction);
    await new Promise((r) => setTimeout(r, 50));
    toast({ title: `Trying angle: ${label}`, description: 'Marco is rewriting the script…' });
    handleFollowUp();
  };

  // Latest Marco assistant text (for voice playback)
  const latestMarcoReply = [...messages].reverse().find((m) => m.role === 'assistant')?.content || '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Side-by-side detail view
  if (selectedProject) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-4 space-y-4">
          {/* Header bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedProject(null); setDirectorAnalysisRef(null); setDirectorAnalysisGen(null); setDetailChatMessages([]); setDetailChatInput(''); setShowSegments(false); }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground truncate">{selectedProject.custom_name || 'Project Details'}</h2>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedProject.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={(e) => toggleFavorite(selectedProject, e)}>
              <Star className={`w-5 h-5 ${selectedProject.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => remakeWithEdits(selectedProject, e)}>
              <RotateCcw className="w-3.5 h-3.5" /> Remake
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => newVersionFromProject(selectedProject, e)}>
              <RefreshCw className="w-3.5 h-3.5" /> New Version
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
              onClick={(e) => recreateWithVeo3(selectedProject, e)}
            >
              <Sparkles className="w-3.5 h-3.5" /> Recreate with VEO3
            </Button>
            {selectedProject.analysis_text && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => sendToSpokesperson(selectedProject, e)}>
                <Mic className="w-3.5 h-3.5" /> Recreate with AI Twin
              </Button>
            )}
            {selectedProject.generated_video_url && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowTimeline(!showTimeline)}>
                <Film className="w-3.5 h-3.5" /> {showTimeline ? 'Hide Timeline' : 'Timeline'}
              </Button>
            )}
            {selectedProject.generated_video_url && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setFrameExtractor({
                  url: selectedProject.generated_video_url!,
                  projectId: selectedProject.id,
                  label: selectedProject.custom_name || 'Video',
                })}
                title="Save playable B-Roll clips to use in Chatcut AI"
              >
                <Scissors className="w-3.5 h-3.5" /> Extract B-Roll Clips
              </Button>
            )}
            <Badge variant="outline" className={`${statusColors[selectedProject.status] || ''}`}>
              {selectedProject.status}
            </Badge>
          </div>

          {/* Main content: Videos left, Script/Analysis right */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left column: Videos stacked compact */}
            <div className="lg:col-span-1 space-y-2">
              {/* Generated Video — primary */}
              <Card>
                <CardContent className="p-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase truncate">
                      {selectedProject.segment_urls && selectedProject.segment_urls.length > 1
                        ? `Generated · ${selectedProject.segment_urls.length} segments`
                        : 'Generated Video'}
                    </p>
                    {selectedProject.product_image_url && (
                      <img
                        src={selectedProject.product_image_url}
                        alt="Product"
                        title="Product reference"
                        className="w-7 h-7 object-cover rounded-md border border-border shrink-0"
                      />
                    )}
                  </div>

                  {selectedProject.segment_urls && selectedProject.segment_urls.length > 0 ? (
                    <div className="space-y-2">
                      {selectedProject.segment_urls.map((segUrl, idx) => (
                        <div key={idx} className="space-y-1">
                          <video src={segUrl} controls className="w-full rounded-md max-h-[220px] object-contain bg-black" preload="metadata" playsInline />
                          <div className="grid grid-cols-2 gap-1">
                            <Button size="sm" variant="secondary" className="h-7 text-[11px] px-2"
                              onClick={() => downloadAsMp4(segUrl, `${selectedProject.custom_name || 'video'}-seg-${idx + 1}.mp4`)}>
                              <Download className="w-3 h-3 mr-1" /> Seg {idx + 1}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-[11px] px-2"
                              onClick={() => setFrameExtractor({ url: segUrl, projectId: selectedProject.id, label: `${selectedProject.custom_name || 'Video'} - Seg ${idx + 1}` })}>
                              <Scissors className="w-3 h-3 mr-1" /> B-Roll
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : selectedProject.generated_video_url ? (
                    <div className="space-y-1.5">
                      <video src={selectedProject.generated_video_url} controls className="w-full rounded-md max-h-[260px] object-contain bg-black" />
                      <div className="grid grid-cols-2 gap-1">
                        <Button size="sm" variant="secondary" className="h-7 text-[11px]"
                          onClick={() => downloadAsMp4(selectedProject.generated_video_url!, `${selectedProject.custom_name || 'video'}.mp4`)}>
                          <Download className="w-3 h-3 mr-1" /> Download
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]"
                          onClick={() => setFrameExtractor({ url: selectedProject.generated_video_url!, projectId: selectedProject.id, label: selectedProject.custom_name || 'Video' })}>
                          <Scissors className="w-3 h-3 mr-1" /> B-Roll
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="h-32 rounded-md bg-muted flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">
                        {selectedProject.status === 'generating' || selectedProject.status === 'stitching' ? 'Processing…' : selectedProject.status === 'failed' ? 'Failed' : 'Not generated'}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Reference Video — collapsed details */}
              {selectedProject.reference_video_url && (
                <details className="group rounded-lg border border-border bg-card">
                  <summary className="cursor-pointer list-none flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                    <span className="flex items-center gap-1.5">
                      <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                      Reference Video
                    </span>
                    <span className="text-[10px] normal-case text-muted-foreground/70 font-normal">tap to view</span>
                  </summary>
                  <div className="px-2.5 pb-2.5">
                    <video src={selectedProject.reference_video_url} controls className="w-full rounded-md max-h-[200px] object-contain bg-black" preload="metadata" />
                  </div>
                </details>
              )}

              {/* Action toolbar — inline, single card, everything visible */}
              {selectedProject.generated_video_url && (
                <Card>
                  <CardContent className="p-2 space-y-1.5">
                    <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase px-1">Actions</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[11px] gap-1 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
                        disabled={isAnalyzingGen || isAnalyzingRef}
                        onClick={() => {
                          analyzeVideoWithDirector(selectedProject.generated_video_url!, 'generated', selectedProject);
                          if (selectedProject.reference_video_url) {
                            analyzeVideoWithDirector(selectedProject.reference_video_url!, 'reference', selectedProject);
                          }
                        }}
                      >
                        {(isAnalyzingGen || isAnalyzingRef) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                        {(isAnalyzingGen || isAnalyzingRef) ? 'Analyzing…' : 'AI Director'}
                      </Button>

                      {selectedProject.segment_urls && selectedProject.segment_urls.length >= 2 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-[11px] gap-1 border-purple-500/40 text-purple-400 hover:bg-purple-500/10"
                          onClick={() => recreateWithSameEnding(selectedProject)}
                        >
                          <RotateCcw className="w-3 h-3" /> Same Ending
                        </Button>
                      ) : (
                        <div />
                      )}
                    </div>

                    {(directorAnalysisRef || directorAnalysisGen) && (
                      <Button
                        size="sm"
                        className="w-full h-8 text-[11px] gap-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold"
                        disabled={isCreatingImproved}
                        onClick={() => createImprovedVersion(selectedProject)}
                      >
                        {isCreatingImproved ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                        Regenerate Improved
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column: Script + Analysis + Director Reviews, scrollable */}
            <div className="lg:col-span-2 space-y-3">
              {/* AI Director Reference Analysis */}
              {(isAnalyzingRef || directorAnalysisRef) && (
                <Card className="border-amber-500/30"><CardContent className="p-4">
                  <p className="text-xs font-medium uppercase mb-2 flex items-center gap-1.5 text-amber-500">
                    <Eye className="w-3.5 h-3.5" /> AI Director — Reference Video Review
                  </p>
                  {isAnalyzingRef ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span className="text-sm text-muted-foreground">AI Director is reviewing the reference video...</span>
                    </div>
                  ) : directorAnalysisRef && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{directorAnalysisRef}</ReactMarkdown>
                    </div>
                  )}
                </CardContent></Card>
              )}

              {/* AI Director Generated Analysis */}
              {(isAnalyzingGen || directorAnalysisGen) && (
                <Card className="border-orange-500/30"><CardContent className="p-4">
                  <p className="text-xs font-medium uppercase mb-2 flex items-center gap-1.5 text-orange-500">
                    <Eye className="w-3.5 h-3.5" /> AI Director — Generated Video Review
                  </p>
                  {isAnalyzingGen ? (
                    <div className="flex items-center gap-2 py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                      <span className="text-sm text-muted-foreground">AI Director is reviewing the generated video...</span>
                    </div>
                  ) : directorAnalysisGen && (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{directorAnalysisGen}</ReactMarkdown>
                    </div>
                  )}
                </CardContent></Card>
              )}

              {/* Video Script / Narration */}
              {selectedProject.video_prompt && (
                <Card><CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" /> Video Script &amp; Narration
                    </p>
                  </div>
                  <div className={`prose prose-sm dark:prose-invert max-w-none overflow-hidden transition-all ${!expandedScript ? 'max-h-[120px]' : ''}`} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <ReactMarkdown>{selectedProject.video_prompt}</ReactMarkdown>
                  </div>
                  {selectedProject.video_prompt.length > 200 && (
                    <Button variant="ghost" size="sm" className="mt-1 text-xs text-primary h-7 px-2" onClick={() => setExpandedScript(!expandedScript)}>
                      {expandedScript ? 'Show Less' : 'Read More'}
                    </Button>
                  )}
                </CardContent></Card>
              )}

              {selectedProject.prompt && (
                <Card><CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Prompt</p>
                  <p className="text-sm text-foreground">{selectedProject.prompt}</p>
                </CardContent></Card>
              )}

              {selectedProject.analysis_text && (
                <Card><CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-primary" /> AI Script Director
                  </p>
                  <p className="text-[10px] text-muted-foreground mb-3">
                    {selectedProject.status === 'failed'
                      ? 'This is the script that was planned for production (generation failed).'
                      : 'This is the script that was generated for production.'}
                  </p>
                  <div className={`prose prose-sm dark:prose-invert max-w-none overflow-hidden transition-all ${!expandedScript ? 'max-h-[200px]' : ''}`} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                    <ReactMarkdown>{selectedProject.analysis_text}</ReactMarkdown>
                  </div>
                  {selectedProject.analysis_text.length > 300 && (
                    <Button variant="ghost" size="sm" className="mt-1 text-xs text-primary h-7 px-2" onClick={() => setExpandedScript(!expandedScript)}>
                      {expandedScript ? 'Show Less' : 'Read More'}
                    </Button>
                  )}
                </CardContent></Card>
              )}

              {/* Re-Analyze button for failed projects */}
              {selectedProject.status === 'failed' && selectedProject.reference_video_url && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => reAnalyzeFromDetail(selectedProject)}
                >
                  <RefreshCw className="w-4 h-4" /> Re-Analyze &amp; Try Again
                </Button>
              )}
            </div>
          </div>

          {/* AI Director Chat */}
          <Card className="border-orange-500/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium uppercase mb-3 flex items-center gap-1.5 text-orange-500">
                <Bot className="w-3.5 h-3.5" /> Chat with AI Director
              </p>
              {detailChatMessages.length > 0 && (
                <ScrollArea className="max-h-[300px] mb-3">
                  <div className="space-y-3">
                    {detailChatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                            <Bot className="w-3 h-3 text-orange-500" />
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <div className="prose prose-sm dark:prose-invert max-w-none" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    ))}
                    {isDetailChatting && (
                      <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-3 h-3 text-orange-500" />
                        </div>
                        <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="text-xs text-muted-foreground">Thinking...</span>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask the AI Director about this video..."
                  value={detailChatInput}
                  onChange={(e) => setDetailChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDetailChat(selectedProject); } }}
                  className="text-sm"
                  disabled={isDetailChatting}
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                  onClick={() => sendDetailChat(selectedProject)}
                  disabled={isDetailChatting || !detailChatInput.trim()}
                >
                  {isDetailChatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {showTimeline && selectedProject.generated_video_url && (
            <VideoRepoTimeline
              videoUrl={selectedProject.generated_video_url}
              onClose={() => setShowTimeline(false)}
            />
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`flex max-w-6xl mx-auto flex-col ${mainTab === 'create' ? 'h-[calc(100vh-4rem)] overflow-hidden' : ''}`}>
        <div className="text-center py-3 md:py-5 px-4">
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
              Video Repo Pro
            </h1>
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px] md:text-xs">PRO</Badge>
          </div>
          <p className="text-muted-foreground text-xs md:text-base max-w-2xl mx-auto">
            One clean Sora-2 take ({singleDuration}s) — no stitching, no segments, lands on the closing frame.
          </p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => { setMainTab(v as 'create' | 'history' | 'library' | 'calendar'); if (v === 'library' || v === 'history') fetchHistory(); }} className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-center px-4">
            <TabsList>
              <TabsTrigger value="create" className="gap-1.5">
                <Play className="w-3.5 h-3.5" /> Create
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <History className="w-3.5 h-3.5" /> History
                {historyProjects.length > 0 && (
                  <span className="ml-1 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">{historyProjects.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="library" className="gap-1.5">
                <Film className="w-3.5 h-3.5" /> Library
                {historyProjects.filter(p => p.generated_video_url).length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {historyProjects.filter(p => p.generated_video_url).length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Content Calendar
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="create" className="flex-1 flex flex-col items-center px-4 min-h-0 overflow-y-auto mt-2">
            <Card className="w-full max-w-3xl bg-card/95 border-2 border-orange-500/30 shadow-card rounded-2xl md:rounded-3xl overflow-hidden mb-3 backdrop-blur-sm">
              <div className="px-3 md:px-4 py-2 md:py-3 border-b border-border/50 bg-background/70">
                <Textarea
                  placeholder={hasAnalysis ? "Give feedback on the script, ask for changes, or hit Generate Video when ready..." : "Describe your 30-second ad idea..."}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  ref={(el) => {
                    if (el) {
                      el.style.height = 'auto';
                      el.style.height = `${el.scrollHeight}px`;
                    }
                  }}
                  className="min-h-[60px] md:min-h-[88px] max-h-[60vh] rounded-xl md:rounded-2xl border border-border bg-background px-3 md:px-4 py-2 md:py-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-hidden"
                />
              </div>

              <div className="px-3 md:px-4 py-2 md:py-3 space-y-2 bg-background/60">

                {(referenceVideoUrl || productImageUrl || statusLabel) && (
                  <div className="space-y-2">
                    {(referenceVideoUrl || productImageUrl) && (
                      <div className="flex gap-2 flex-wrap">
                        {productImageUrl && (
                          <Badge variant="outline" className="text-xs gap-1 bg-background">
                            <ImagePlus className="w-3 h-3" /> {productImageName || 'Product'}
                            <button type="button" onClick={clearProductImage} className="ml-1 hover:text-destructive">×</button>
                          </Badge>
                        )}
                        {referenceVideoUrl && (
                          <Badge variant="outline" className="text-xs gap-1 bg-background">
                            <Video className="w-3 h-3" /> {referenceVideoName || 'Reference'} {videoFrames.length > 0 ? `(${videoFrames.length} frames)` : ''}
                            <button type="button" onClick={clearReferenceVideo} className="ml-1 hover:text-destructive">×</button>
                          </Badge>
                        )}
                      </div>
                    )}
                    {referenceVideoUrl && videoFrames.length > 0 && !statusLabel && (
                      <p className="text-xs text-muted-foreground">
                        We'll analyze {videoFrames.length} key frames to learn the hook, pacing, and style — then generate one continuous {singleDuration}-second clip that lands on a complete closing frame.
                      </p>
                    )}
                    {statusLabel && (
                      <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{statusLabel}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Style picker — controls Marco's first-pass tone */}
                {!hasAnalysis && (
                  <StylePicker value={selectedStyle} onChange={setSelectedStyle} className="pt-1" />
                )}

                {/* Voice chat panel — full two-way conversation with Marco */}
                {voiceChatOpen && (
                  <MarcoVoiceChat
                    onUserSpoke={handleVoiceTranscript}
                    latestMarcoReply={latestMarcoReply}
                    autoSpeak
                    onClose={() => setVoiceChatOpen(false)}
                  />
                )}

                <div className="flex items-center gap-2 flex-wrap">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductImage} />
                    <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleReferenceVideo} />
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-full bg-background" onClick={() => fileInputRef.current?.click()}>
                      <ImagePlus className="w-3.5 h-3.5" /> Add Image
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-full bg-background" onClick={() => videoInputRef.current?.click()}>
                      <Video className="w-3.5 h-3.5" /> Reference Video
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <Link className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          type="url"
                          placeholder="Paste URL"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlImport(); } }}
                          className="h-8 text-xs rounded-full pl-8 pr-2 w-[160px] md:w-[200px] bg-background"
                          disabled={isDownloadingUrl}
                        />
                      </div>
                      {urlInput.trim() && (
                        <Button variant="outline" size="sm" className="text-xs rounded-full gap-1" onClick={handleUrlImport} disabled={isDownloadingUrl}>
                          {isDownloadingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          {isDownloadingUrl ? '...' : 'Import'}
                        </Button>
                      )}
                    </div>
                    <div className="w-full">
                      <VideoRepoEngineSelector
                        engine={selectedEngine}
                        onEngineChange={handleEngineChange}
                        flowMode={flowMode}
                        onFlowModeChange={setFlowMode}
                        flowShots={flowShots}
                        onFlowShotsChange={setFlowShots}
                      />
                    </div>
                    <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as '9:16' | '16:9')}>
                      <SelectTrigger className="h-8 w-[110px] text-xs rounded-full bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9:16">📱 9:16</SelectItem>
                        <SelectItem value="16:9">🖥️ 16:9</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={String(singleDuration)} onValueChange={(v) => setSingleDuration(Number(v) as 10 | 15 | 20)}>
                      <SelectTrigger className="h-8 w-[100px] text-xs rounded-full bg-background" title="Single-take duration (no stitching)">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">⏱ 10s</SelectItem>
                        <SelectItem value="15">⏱ 15s</SelectItem>
                        <SelectItem value="20">⏱ 20s</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant={voiceChatOpen ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 text-xs rounded-full gap-1 px-2.5 ml-auto ${voiceChatOpen ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'border-orange-500/40 text-orange-500 hover:bg-orange-500/10'}`}
                      onClick={() => setVoiceChatOpen((v) => !v)}
                      title="Talk to Marco with your voice (Speechify)"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      Voice
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-full gap-1 px-2.5 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                      onClick={enhancePrompt}
                      disabled={isEnhancing || !prompt.trim()}
                      title="Rewrite your prompt with AI Director cinematic detail"
                    >
                      {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      {isEnhancing ? 'Enhancing…' : 'Enhance'}
                    </Button>
                    <Button
                      size="icon"
                      aria-label="Send prompt"
                      className="h-8 w-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                      onClick={handleSubmit}
                      disabled={isAnalyzing || isExtractingFrames || isChatting || (!hasComposerInput && !prompt.trim())}
                    >
                      {(isAnalyzing || isChatting) ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                    </Button>
                  </div>
              </div>
            </Card>

            {showConversation ? (
              <>
                <ScrollArea className="w-full max-w-3xl mb-4 min-h-[280px] max-h-[60vh] rounded-2xl border border-border/60 bg-background/20 px-4">
                  <div className="space-y-4 py-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-orange-500" />
                          </div>
                        )}
                        <div className={`max-w-[85%] rounded-2xl px-4 py-3 overflow-hidden ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex gap-2 mb-2 flex-wrap">
                              {msg.attachments.map((att, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {att.type === 'video' ? <Video className="w-3 h-3 mr-1" /> : <ImagePlus className="w-3 h-3 mr-1" />}
                                  {att.name || att.type}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere [&_pre]:whitespace-pre-wrap [&_pre]:break-all [&_code]:break-all [&_p]:break-words [&_p]:overflow-hidden [&_p]:word-break-break-word" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          {msg.videoResult && (
                            <div className="mt-3 space-y-2">
                              <video src={msg.videoResult.url} controls className="w-full rounded-lg max-h-[400px]" />
                              <div className="flex gap-2">
                                <Button size="sm" variant="secondary" asChild>
                                  <a href={msg.videoResult.url} download target="_blank" rel="noopener noreferrer">
                                    <Download className="w-3 h-3 mr-1" /> Download
                                  </a>
                                </Button>
                              </div>
                            </div>
                          )}
                          {msg.videoResults && msg.videoResults.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {msg.videoResults.map((v, i) => (
                                <div key={i} className="space-y-2">
                                  <div className="text-xs font-semibold text-muted-foreground">{v.label}</div>
                                  <video src={v.url} controls className="w-full rounded-lg max-h-[360px] bg-black" />
                                  <Button size="sm" variant="secondary" asChild className="w-full">
                                    <a href={v.url} download target="_blank" rel="noopener noreferrer">
                                      <Download className="w-3 h-3 mr-1" /> Download {v.label}
                                    </a>
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          {msg.retryable && !isAnalyzing && !isGenerating && !isStitching && (
                            <div className="mt-2">
                              <Button size="sm" variant="outline" onClick={analyzeReference}>
                                <RefreshCw className="w-3 h-3 mr-1" /> Retry
                              </Button>
                            </div>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-secondary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}
                    {statusLabel && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">{statusLabel}</span>
                        </div>
                      </div>
                    )}
                    {isChatting && (
                      <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-orange-500" />
                        </div>
                        <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm text-muted-foreground">Thinking about your feedback...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                {/* Editable Script + Product Warning + Generate CTA */}
                {hasAnalysis && !isGenerating && !isStitching && (
                  <div className="w-full max-w-3xl mb-4 space-y-3">
                    {/* Product warning banner */}
                    {!productImageUrl && (
                      <div className="rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
                        <ImagePlus className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                            No product attached — the AI may invent a generic product
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Pick a product from your library so Marco uses your real product image, name, and benefits.
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full text-xs gap-1.5 border-amber-500/40 text-amber-600 hover:bg-amber-500/20 flex-shrink-0"
                          onClick={() => setShowProductPicker(true)}
                        >
                          <Package className="w-3.5 h-3.5" />
                          Pick Product
                        </Button>
                      </div>
                    )}

                    {/* Editable script card */}
                    <div className="rounded-xl border border-border/60 bg-background/80 overflow-hidden">
                      <div className="px-4 py-2.5 border-b border-border/60 flex items-center justify-between gap-2 bg-muted/40">
                        <div className="flex items-center gap-2 min-w-0">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="text-xs font-semibold truncate">
                            Editable script — change the hook, swap lines, rewrite anything
                          </span>
                        </div>
                        {isEditingScript ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => { setIsEditingScript(false); setScriptDraft(''); }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs gap-1 bg-primary"
                              onClick={() => {
                                if (scriptDraft.trim()) {
                                  setLatestAnalysisText(scriptDraft);
                                  toast({ title: 'Script updated ✓', description: 'Your edits will be used when you hit Generate.' });
                                }
                                setIsEditingScript(false);
                              }}
                            >
                              <Check className="w-3 h-3" /> Save edits
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1 rounded-full flex-shrink-0"
                            onClick={() => { setScriptDraft(latestAnalysisText); setIsEditingScript(true); }}
                          >
                            <Pencil className="w-3 h-3" /> Edit Script
                          </Button>
                        )}
                      </div>
                      {isEditingScript ? (
                        <Textarea
                          value={scriptDraft}
                          onChange={(e) => setScriptDraft(e.target.value)}
                          className="min-h-[280px] max-h-[420px] rounded-none border-0 text-sm font-mono resize-y focus-visible:ring-0"
                          placeholder="Edit your script here..."
                        />
                      ) : (
                        <div className="px-4 py-3 max-h-[200px] overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{latestAnalysisText.slice(0, 800) + (latestAnalysisText.length > 800 ? '\n\n_…click Edit Script to see and change the full script._' : '')}</ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {/* Alternative angles — let user pivot the script direction */}
                    <AlternativeAngles
                      onPick={applyAlternativeAngle}
                      disabled={isChatting || isAnalyzing || isGenerating || isStitching}
                    />

                    <Button
                      onClick={generateFromScript}
                      className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 shadow-lg"
                      disabled={isAnalyzing || isChatting || isEditingScript}
                    >
                      <Sparkles className="w-5 h-5" />
                      Generate Video from Script
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-1.5">
                      Edit the script above, or scroll up to chat with Marco for changes — then hit generate.
                    </p>
                    {latestGeneratedVideoUrl && (
                      <Button
                        onClick={reviewGeneratedVideo}
                        variant="outline"
                        className="w-full h-10 mt-2 text-sm font-medium rounded-xl border-orange-500/40 text-orange-400 hover:bg-orange-500/10 gap-2"
                        disabled={isReviewingGenerated || isAnalyzing || isChatting || isGenerating || isStitching}
                      >
                        {isReviewingGenerated ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            AI Director is reviewing...
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            AI Director: Review & Improve
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="history" className="flex-1 px-4 mt-4 pb-24">
            <div className="max-w-4xl mx-auto space-y-4">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!historyProjects.find((p) => p.generated_video_url)}
                  onClick={() => {
                    const latest = historyProjects.find((p) => p.generated_video_url);
                    if (latest) setFrameExtractor({
                      url: latest.generated_video_url!,
                      projectId: latest.id,
                      label: latest.custom_name || 'Latest video',
                    });
                  }}
                  title="Extract playable B-Roll clips from your most recent generated video"
                >
                  <Scissors className="w-3.5 h-3.5" /> Extract Clips (latest)
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setHistoryPage(1); fetchHistory(); }} disabled={isLoadingHistory}>
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} /> Sync from database
                </Button>
              </div>
              {isLoadingHistory ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : historyProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No projects yet</p>
                  <p className="text-sm mt-1">Create your first 30-second video to see it here</p>
                  <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => fetchHistory()}>
                    <RefreshCw className="w-3.5 h-3.5" /> Sync from database
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {historyProjects.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE).map((project) => (
                    <Card
                      key={project.id}
                      className={`overflow-hidden cursor-pointer hover:border-orange-500/40 transition-colors group ${project.is_favorite ? 'ring-1 ring-amber-400/50' : ''}`}
                      onClick={() => { setSelectedProject(project); setExpandedScript(false); }}
                    >
                      <div className="grid grid-cols-2 aspect-[4/3] relative">
                        {project.reference_video_url ? (
                          <video src={`${project.reference_video_url}#t=0.5`} className="w-full h-full object-cover" muted preload="metadata" playsInline />
                        ) : (
                          <div className="bg-muted flex items-center justify-center"><Video className="w-6 h-6 text-muted-foreground/40" /></div>
                        )}
                        {project.generated_video_url ? (
                          <video src={`${project.generated_video_url}#t=0.5`} className="w-full h-full object-cover" muted preload="metadata" playsInline />
                        ) : (
                          <div className="bg-muted flex items-center justify-center">
                            {project.status === 'generating' || project.status === 'stitching' ? (
                              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                            ) : project.status === 'failed' ? (
                              <X className="w-5 h-5 text-red-500" />
                            ) : (
                              <Play className="w-6 h-6 text-muted-foreground/40" />
                            )}
                          </div>
                        )}
                        <button
                          onClick={(e) => toggleFavorite(project, e)}
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                        >
                          <Star className={`w-4 h-4 ${project.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-white/70'}`} />
                        </button>
                      </div>
                      <CardContent className="p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className={`text-[10px] ${statusColors[project.status] || ''}`}>
                            {project.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(project.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        {editingNameId === project.id ? (
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editNameValue}
                              onChange={(e) => setEditNameValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveRename(project.id); if (e.key === 'Escape') setEditingNameId(null); }}
                              className="h-6 text-xs"
                              autoFocus
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => saveRename(project.id)}>
                              <Check className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-xs text-foreground line-clamp-2">{project.custom_name || project.prompt || 'No prompt'}</p>
                        )}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => startRename(project, e)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Rename</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => remakeWithEdits(project, e)}>
                                <RotateCcw className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remake with edits</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => newVersionFromProject(project, e)}>
                                <RefreshCw className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Generate new version</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                onClick={(e) => recreateWithVeo3(project, e)}
                              >
                                <Sparkles className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Recreate with Google VEO3</TooltipContent>
                          </Tooltip>
                          {project.generated_video_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFrameExtractor({
                                      url: project.generated_video_url!,
                                      projectId: project.id,
                                      label: project.custom_name || project.prompt?.slice(0, 40) || 'Video',
                                    });
                                  }}
                                >
                                  <Scissors className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Extract B-Roll Clips</TooltipContent>
                            </Tooltip>
                          )}
                          {project.generated_video_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6" asChild>
                                  <a href={project.generated_video_url} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                                    <Download className="w-3 h-3" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                                onClick={(e) => deleteProject(project, e)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {!isLoadingHistory && historyProjects.length > HISTORY_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <Button variant="outline" size="sm" disabled={historyPage === 1} onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}>
                    Prev
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {historyPage} of {Math.ceil(historyProjects.length / HISTORY_PAGE_SIZE)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={historyPage >= Math.ceil(historyProjects.length / HISTORY_PAGE_SIZE)}
                    onClick={() => setHistoryPage((p) => Math.min(Math.ceil(historyProjects.length / HISTORY_PAGE_SIZE), p + 1))}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>


          <TabsContent value="library" className="flex-1 px-4 mt-4 pb-24 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Video Library</h2>
                  <p className="text-sm text-muted-foreground">
                    {(() => {
                      const all = historyProjects.filter(p => p.generated_video_url);
                      const fav = all.filter(p => p.is_favorite).length;
                      return `${all.length} video${all.length === 1 ? '' : 's'} · ${fav} favorite${fav === 1 ? '' : 's'}`;
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={libraryFavoritesOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLibraryFavoritesOnly(v => !v)}
                    className="gap-1.5"
                  >
                    <Star className={`w-3.5 h-3.5 ${libraryFavoritesOnly ? 'fill-current' : ''}`} />
                    {libraryFavoritesOnly ? 'Showing Favorites' : 'Favorites Only'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!user) return;
                      const url = `${window.location.origin}/library/${user.id}`;
                      navigator.clipboard.writeText(url).then(
                        () => toast({ title: 'Share link copied', description: 'Anyone with this link can view your videos.' }),
                        () => toast({ title: 'Copy failed', description: url, variant: 'destructive' as any }),
                      );
                    }}
                    className="gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share Library
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => fetchHistory()} disabled={isLoadingHistory} className="gap-1.5">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
              </div>

              {(() => {
                const videos = historyProjects
                  .filter(p => p.generated_video_url)
                  .filter(p => !libraryFavoritesOnly || p.is_favorite);

                if (isLoadingHistory && videos.length === 0) {
                  return (
                    <div className="flex items-center justify-center py-20 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your videos...
                    </div>
                  );
                }

                if (videos.length === 0) {
                  return (
                    <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
                      <Film className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {libraryFavoritesOnly ? 'No favorites yet. Tap the star on a video to add it here.' : 'No generated videos yet. Create one in the Create tab.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {videos.map((project) => {
                      const url = project.generated_video_url!;
                      const label = project.custom_name || project.prompt?.replace(/^\[PRO\]\s*/, '').slice(0, 60) || 'Untitled';
                      const isPlaying = libraryPlayingId === project.id;
                      return (
                        <Card key={project.id} className="overflow-hidden group hover:border-primary/50 transition-colors">
                          <div className="relative aspect-[9/16] bg-muted">
                            {/* Always-visible placeholder behind the preview so the tile is never blank */}
                            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/40 pointer-events-none">
                              <Film className="w-10 h-10 text-muted-foreground/40" />
                            </div>
                            {(() => {
                              const thumb = libraryThumbs[project.id] || project.thumbnail_url || (project as any).product_image_url || null;
                              if (isPlaying) {
                                return (
                                  <video
                                    src={url}
                                    controls
                                    autoPlay
                                    playsInline
                                    className="relative w-full h-full object-cover bg-black"
                                  />
                                );
                              }
                              return (
                                <>
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={label}
                                      loading="lazy"
                                      className="relative w-full h-full object-cover"
                                    />
                                  ) : (
                                    // No thumbnail yet — kick off background capture and keep placeholder visible
                                    <img
                                      ref={(el) => {
                                        if (el && !libraryThumbs[project.id] && !project.thumbnail_url) {
                                          captureThumbnail(project);
                                        }
                                      }}
                                      alt=""
                                      className="hidden"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setLibraryPlayingId(project.id)}
                                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                                    aria-label="Play video"
                                  >
                                    <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
                                      <Play className="w-5 h-5 text-primary-foreground fill-primary-foreground ml-0.5" />
                                    </div>
                                  </button>
                                </>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={(e) => toggleFavorite(project, e)}
                              className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
                                project.is_favorite
                                  ? 'bg-yellow-500/90 text-white'
                                  : 'bg-black/50 text-white hover:bg-black/70'
                              }`}
                              aria-label={project.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <Star className={`w-4 h-4 ${project.is_favorite ? 'fill-current' : ''}`} />
                            </button>
                          </div>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {(() => {
                                const src = project.source || 'video_repo';
                                const meta: Record<string, { label: string; cls: string }> = {
                                  video_repo: { label: 'Video Repo', cls: 'bg-primary/10 text-primary border-primary/20' },
                                  podcast: { label: 'Podcast', cls: 'bg-purple-500/10 text-purple-600 border-purple-500/20' },
                                  chatcut: { label: 'Chatcut', cls: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
                                  reels: { label: 'Reel', cls: 'bg-pink-500/10 text-pink-600 border-pink-500/20' },
                                };
                                const m = meta[src] || meta.video_repo;
                                return (
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${m.cls}`}>
                                    {m.label}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-sm font-medium line-clamp-2 min-h-[2.5rem]" title={label}>
                              {label}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(project.created_at).toLocaleDateString()}
                            </p>
                            <div className="flex items-center gap-1.5 pt-1">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1 h-8 text-xs"
                                onClick={() => openReviewDialog(project)}
                              >
                                <Eye className="w-3 h-3 mr-1" /> Review
                              </Button>
                              {project.source === 'chatcut' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2"
                                  onClick={() => {
                                    const realId = project.id.replace(/^chatcut:/, '');
                                    navigate(`/chatcut-ai?draft=${realId}`);
                                  }}
                                  aria-label="Open in Chatcut"
                                  title="Open in Chatcut"
                                >
                                  <Scissors className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2"
                                onClick={() => downloadAsMp4(url, `${label}.mp4`)}
                                aria-label="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={(e) => deleteProject(project, e)}
                                aria-label="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="flex-1 min-h-0 overflow-y-auto mt-2">
            <ContentCalendarTab projects={historyProjects} />
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={!!reviewProject} onOpenChange={(o) => { if (!o) { setReviewProject(null); setReviewAiFeedback(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-orange-500" />
              Review: {reviewProject?.custom_name || reviewProject?.prompt?.replace(/^\[PRO\]\s*/, '').slice(0, 60) || 'Video'}
            </DialogTitle>
          </DialogHeader>

          {reviewProject && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {reviewProject.generated_video_url && (
                  <video
                    src={reviewProject.generated_video_url}
                    controls
                    playsInline
                    className="w-full rounded-lg bg-black aspect-[9/16] object-contain"
                  />
                )}
                {reviewProject.video_prompt && (
                  <details className="text-xs bg-muted/50 rounded-lg p-3">
                    <summary className="cursor-pointer font-medium">Original script</summary>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{reviewProject.video_prompt}</p>
                  </details>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-1.5 flex items-center justify-between">
                    <span>Your notes — what's wrong / what to fix</span>
                  </label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="e.g. Hook is too slow, lighting flat at 0:04, hands look weird at the end, audio doesn't match the visual..."
                    rows={8}
                    className="resize-none text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={saveReviewNotes}
                    disabled={isSavingReview}
                    className="w-full mt-2 gap-1.5"
                  >
                    {isSavingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Save Notes
                  </Button>
                </div>

                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" /> AI Director Feedback
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={runAiReviewInDialog}
                      disabled={isReviewLoadingAi}
                      className="h-7 text-xs gap-1.5"
                    >
                      {isReviewLoadingAi ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      {reviewAiFeedback ? 'Re-run' : 'Run AI Review'}
                    </Button>
                  </div>
                  {isReviewLoadingAi && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2 py-3">
                      <Loader2 className="w-3 h-3 animate-spin" /> Analyzing video frames...
                    </div>
                  )}
                  {reviewAiFeedback && (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-xs bg-muted/40 rounded-lg p-3 max-h-64 overflow-y-auto">
                      <ReactMarkdown>{reviewAiFeedback}</ReactMarkdown>
                    </div>
                  )}
                  {!reviewAiFeedback && !isReviewLoadingAi && (
                    <p className="text-xs text-muted-foreground italic">
                      Click "Run AI Review" to get a critical post-production breakdown of this video.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {reviewProject && (
              <Button
                variant="outline"
                onClick={() => {
                  const p = reviewProject;
                  setReviewProject(null);
                  setSelectedProject(p);
                  setMainTab('history');
                }}
                className="gap-1.5"
              >
                <ArrowUp className="w-3.5 h-3.5" /> Open in full editor
              </Button>
            )}
            <Button variant="ghost" onClick={() => setReviewProject(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FrameExtractorDialog
        open={!!frameExtractor}
        onOpenChange={(o) => !o && setFrameExtractor(null)}
        videoUrl={frameExtractor?.url || ''}
        projectId={frameExtractor?.projectId}
        projectLabel={frameExtractor?.label}
      />
      <ProductPickerDialog
        open={showProductPicker}
        onOpenChange={setShowProductPicker}
        onSelect={(ctx: SelectedProductContext) => {
          setProductImageUrl(ctx.imageUrl);
          setProductImageName(ctx.productName);
          setPersistentImageUrl(ctx.imageUrl);
          setProductImageFile(null);
          setShowProductPicker(false);
          toast({
            title: `${ctx.productName} attached ✓`,
            description: 'Marco will use this product image, name, and benefits in the script.',
          });
        }}
      />
    </Layout>
  );
};

export default VideoRepoPro;
