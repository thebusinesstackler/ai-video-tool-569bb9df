import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { createWaveSpeedVideo, getWaveSpeedVideoJob } from '@/lib/wavespeed';
import { ImageDropZone } from '@/components/ImageDropZone';
import { useImageGallery } from '@/hooks/useImageGallery';
import {
  Wand2, Upload, Sparkles, Play, RotateCcw, Download, Music, ChevronRight, ChevronLeft, Image as ImageIcon, Loader2, History, Trash2, Plus, CheckCircle2, XCircle, Layers, Zap, Library, Pause, RefreshCw, Share2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface AnimationSuggestion {
  label: string;
  description?: string;
  prompt: string;
}

interface Analysis {
  objects: string[];
  suggestions: AnimationSuggestion[];
  directorPrompt: string;
}

interface HistoryItem {
  id: string;
  source_image_url: string | null;
  animation_url: string | null;
  music_url: string | null;
  prompt: string | null;
  status: string;
  created_at: string;
}

interface SavedMusic {
  id: string;
  label: string;
  mood: string | null;
  prompt: string | null;
  audio_url: string;
  duration: number | null;
  created_at: string;
}

const STEPS = ['Select Image', 'Animate', 'Generate', 'Export'];

const MUSIC_PRESETS = [
  { label: 'Cinematic', prompt: 'Cinematic orchestral build, emotional and uplifting' },
  { label: 'Upbeat', prompt: 'Upbeat modern pop instrumental, energetic and bright' },
  { label: 'Lo-fi', prompt: 'Chill lo-fi hip hop beat, mellow and atmospheric' },
  { label: 'Corporate', prompt: 'Clean corporate background music, optimistic and professional' },
  { label: 'Ambient', prompt: 'Soft ambient pad, dreamy and minimal' },
  { label: 'Dramatic', prompt: 'Dramatic cinematic tension, deep cinematic drums' },
];

// 10-pack preset moods used when user clicks "Generate 10 Tracks"
const MUSIC_LIBRARY_PACK = [
  { label: 'Cinematic Uplift', prompt: 'Cinematic orchestral build, emotional and uplifting, soaring strings' },
  { label: 'Upbeat Pop', prompt: 'Upbeat modern pop instrumental, energetic and bright, catchy synths' },
  { label: 'Lo-fi Chill', prompt: 'Chill lo-fi hip hop beat, mellow and atmospheric, vinyl warmth' },
  { label: 'Corporate Clean', prompt: 'Clean corporate background music, optimistic and professional, light piano' },
  { label: 'Ambient Dream', prompt: 'Soft ambient pad, dreamy and minimal, ethereal texture' },
  { label: 'Dramatic Tension', prompt: 'Dramatic cinematic tension, deep cinematic drums, suspenseful' },
  { label: 'Hype Trap', prompt: 'Hype trap beat, hard-hitting 808s, modern and aggressive' },
  { label: 'Acoustic Warm', prompt: 'Warm acoustic guitar, intimate folk, gentle and heartfelt' },
  { label: 'Tech House', prompt: 'Driving tech house groove, modern electronic, club-ready' },
  { label: 'Epic Trailer', prompt: 'Epic movie trailer score, heroic brass and percussion, blockbuster energy' },
];

const isCreditError = (msg?: string) => !!msg && /insufficient|credit|balance|quota|payment/i.test(msg);

const AnimateStatics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { images: galleryImages, isLoading: galleryLoading, saveImage } = useImageGallery();

  const [view, setView] = useState<'create' | 'history'>('create');
  const [step, setStep] = useState(0);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [customPrompt, setCustomPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  // Music state
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicPrompt, setMusicPrompt] = useState('');
  const [generatingMusic, setGeneratingMusic] = useState(false);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Bulk state
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMusicPreset, setBulkMusicPreset] = useState<string>('Cinematic');
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkJobs, setBulkJobs] = useState<Array<{
    imageUrl: string;
    status: 'pending' | 'analyzing' | 'generating' | 'music' | 'done' | 'failed';
    progress: number;
    videoUrl?: string;
    musicUrl?: string;
    error?: string;
    creditError?: boolean;
  }>>([]);

  // Music library state
  const [savedMusic, setSavedMusic] = useState<SavedMusic[]>([]);
  const [musicLibLoading, setMusicLibLoading] = useState(false);
  const [generatingPack, setGeneratingPack] = useState(false);
  const [packProgress, setPackProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [selectedSavedMusicId, setSelectedSavedMusicId] = useState<string | null>(null);
  const [bulkSelectedMusicId, setBulkSelectedMusicId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const loadMusicLibrary = useCallback(async () => {
    if (!user) return;
    setMusicLibLoading(true);
    try {
      const { data, error } = await supabase
        .from('music_library')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSavedMusic(data || []);
    } catch (e: any) {
      console.error('Failed to load music library', e);
    } finally {
      setMusicLibLoading(false);
    }
  }, [user]);

  useEffect(() => { loadMusicLibrary(); }, [loadMusicLibrary]);

  const generateOneMusicTrack = async (label: string, prompt: string): Promise<SavedMusic | null> => {
    if (!user) return null;
    const { data, error } = await supabase.functions.invoke('generate-music', {
      body: { mood: prompt, duration: 30 },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    const audioUrl = data?.audioUrl;
    if (!audioUrl) throw new Error('No music URL returned');
    const { data: row, error: insErr } = await supabase
      .from('music_library')
      .insert({ user_id: user.id, label, mood: label, prompt, audio_url: audioUrl, duration: 30 })
      .select()
      .single();
    if (insErr) throw insErr;
    return row as SavedMusic;
  };

  const generateMusicPack = async () => {
    if (!user || generatingPack) return;
    setGeneratingPack(true);
    setPackProgress({ done: 0, total: MUSIC_LIBRARY_PACK.length, current: MUSIC_LIBRARY_PACK[0].label });
    let added = 0;
    let creditFail = false;
    for (let i = 0; i < MUSIC_LIBRARY_PACK.length; i++) {
      const { label, prompt } = MUSIC_LIBRARY_PACK[i];
      setPackProgress({ done: i, total: MUSIC_LIBRARY_PACK.length, current: label });
      try {
        const row = await generateOneMusicTrack(label, prompt);
        if (row) { setSavedMusic(prev => [row, ...prev]); added++; }
      } catch (e: any) {
        console.error(`Music pack [${label}] failed`, e);
        if (isCreditError(e.message)) { creditFail = true; break; }
      }
    }
    setPackProgress(null);
    setGeneratingPack(false);
    if (creditFail) {
      toast({ title: 'Music pack stopped — out of credits', description: `Saved ${added} tracks before WaveSpeed credits ran out. Top up and click Generate 10 again.`, variant: 'destructive' });
    } else {
      toast({ title: `🎵 ${added} tracks added to your library`, description: 'Reuse them across all future animations.' });
    }
  };

  const deleteSavedMusic = async (id: string) => {
    try {
      await supabase.from('music_library').delete().eq('id', id);
      setSavedMusic(prev => prev.filter(m => m.id !== id));
      if (selectedSavedMusicId === id) setSelectedSavedMusicId(null);
      if (bulkSelectedMusicId === id) setBulkSelectedMusicId(null);
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const togglePreview = (m: SavedMusic) => {
    if (previewAudioRef.current) { previewAudioRef.current.pause(); previewAudioRef.current = null; }
    if (previewingId === m.id) { setPreviewingId(null); return; }
    const audio = new Audio(m.audio_url);
    audio.play().catch(() => {});
    audio.onended = () => setPreviewingId(null);
    previewAudioRef.current = audio;
    setPreviewingId(m.id);
  };

  const attachSavedMusicToCurrent = async (m: SavedMusic) => {
    if (!projectId) {
      toast({ title: 'No active project', description: 'Generate an animation first.', variant: 'destructive' });
      return;
    }
    setMusicUrl(m.audio_url);
    setSelectedSavedMusicId(m.id);
    await supabase.from('animated_statics').update({ music_url: m.audio_url }).eq('id', projectId);
    toast({ title: 'Music attached', description: m.label });
  };

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('animated_statics')
        .select('id, source_image_url, animation_url, music_url, prompt, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistory(data || []);
    } catch (e: any) {
      toast({ title: 'Failed to load history', description: e.message, variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  }, [user, toast]);

  // Load history on mount so the gallery picker can flag previously-animated/failed images
  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Map source_image_url -> latest history entry (for status badges in the gallery picker)
  const historyByImage = React.useMemo(() => {
    const map = new Map<string, HistoryItem>();
    // history is already ordered desc by created_at, so first occurrence wins (latest)
    for (const h of history) {
      if (!h.source_image_url) continue;
      if (!map.has(h.source_image_url)) map.set(h.source_image_url, h);
    }
    return map;
  }, [history]);

  const getImageStatus = (url: string): 'animated' | 'failed' | 'pending' | null => {
    const h = historyByImage.get(url);
    if (!h) return null;
    if (h.animation_url && h.status !== 'failed') return 'animated';
    if (h.status === 'failed') return 'failed';
    if (h.status === 'processing' || h.status === 'pending' || h.status === 'draft') return 'pending';
    return h.animation_url ? 'animated' : 'failed';
  };

  const handleImageSelect = (url: string) => {
    setSelectedImage(url);
    setAnalysis(null);
    setSelectedSuggestions(new Set());
    setCustomPrompt('');
    setVideoUrl(null);
    setMusicUrl(null);
    setMusicPrompt('');
    setProjectId(null);
  };

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/animate-${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('reels').upload(path, file);
    if (error) {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('reels').getPublicUrl(data.path);
    await saveImage({ imageUrl: publicUrl, source: 'upload' });
    handleImageSelect(publicUrl);
  };

  const goToAnalysis = async () => {
    if (!selectedImage) return;
    setStep(1);
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-animate-image', {
        body: { imageUrl: selectedImage },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.userMessage || data.error);
      const analysisData = data as Analysis;
      setAnalysis(analysisData);
      setCustomPrompt(analysisData.directorPrompt || '');
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
      setStep(0);
    } finally {
      setAnalyzing(false);
    }
  };

  const selectSuggestion = (idx: number) => {
    if (!analysis) return;
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      if (next.size > 0) {
        const selectedPrompts: string[] = [];
        next.forEach(i => selectedPrompts.push(analysis.suggestions[i].prompt));
        setCustomPrompt(selectedPrompts.join(' '));
      } else {
        setCustomPrompt(analysis.directorPrompt || '');
      }
      return next;
    });
  };

  const buildFinalPrompt = () => {
    const preservationPrefix = analysis?.objects?.length
      ? `[PRESERVE EXACTLY: ${analysis.objects.join('; ')}] `
      : '';
    const textItems = analysis?.objects?.filter((o: string) => /^Text:/i.test(o)) || [];
    const textFreeze = textItems.length > 0
      ? `[TEXT FREEZE: All visible text and lettering must remain exactly as shown — treat as fixed texture, do not regenerate any characters. Detected text: ${textItems.join('; ')}] `
      : '[TEXT FREEZE: All visible text, lettering, and typography must be treated as fixed texture — do not regenerate, redraw, or alter any characters.] ';
    const prompt = customPrompt.trim() || analysis?.directorPrompt || 'Subtle cinematic motion with slow zoom and gentle parallax';
    return preservationPrefix + textFreeze + prompt;
  };

  const startGeneration = async () => {
    if (!user || !selectedImage) return;
    setStep(2);
    setGenerating(true);
    setProgress(0);

    try {
      const { data: project, error: projErr } = await supabase
        .from('animated_statics')
        .insert({
          user_id: user.id,
          source_image_url: selectedImage,
          analysis: analysis as any,
          prompt: buildFinalPrompt(),
          status: 'generating',
        })
        .select()
        .single();
      if (projErr) throw projErr;
      setProjectId(project.id);

      const taskId = await createWaveSpeedVideo({
        prompt: buildFinalPrompt(),
        imageUrls: [selectedImage],
        model: 'wan-2.5-i2v',
        aspectRatio: '9:16',
        userId: user.id,
        source: 'animate-statics',
        sourceId: project.id,
      });

      let done = false;
      let consecutiveFailures = 0;
      const maxFailures = 3;
      const pollStart = Date.now();
      const maxPollDuration = 5 * 60 * 1000;

      while (!done) {
        await new Promise(r => setTimeout(r, 5000));
        if (Date.now() - pollStart > maxPollDuration) {
          throw new Error('Generation timed out after 5 minutes. The video may still be processing — check back later.');
        }
        try {
          const job = await getWaveSpeedVideoJob(taskId);
          consecutiveFailures = 0;
          if (job.progress) setProgress(job.progress);
          if (job.status === 'completed' && job.videoUrl) {
            setVideoUrl(job.videoUrl);
            await supabase.from('animated_statics').update({ animation_url: job.videoUrl, status: 'completed' }).eq('id', project.id);
            done = true;
          } else if (job.status === 'failed') {
            throw new Error(job.error || 'Video generation failed');
          }
        } catch (pollErr: any) {
          if (pollErr.message?.includes('Video generation failed')) throw pollErr;
          consecutiveFailures++;
          if (consecutiveFailures >= maxFailures) {
            throw new Error('Lost connection to video service. The video may still be processing — try refreshing.');
          }
        }
      }
      setStep(3);
    } catch (e: any) {
      toast({ title: 'Generation failed', description: e.message, variant: 'destructive' });
      if (projectId) {
        await supabase.from('animated_statics').update({ status: 'failed' }).eq('id', projectId);
      }
      setStep(1);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateMusic = async (presetPrompt?: string) => {
    if (!projectId) return;
    const prompt = (presetPrompt || musicPrompt).trim();
    if (!prompt) {
      toast({ title: 'Pick a vibe', description: 'Choose a preset or describe the music you want.', variant: 'destructive' });
      return;
    }
    setGeneratingMusic(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-music', {
        body: { mood: prompt, duration: 30 },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      const audioUrl = data?.audioUrl;
      if (!audioUrl) throw new Error('No music URL returned');
      setMusicUrl(audioUrl);
      await supabase.from('animated_statics').update({ music_url: audioUrl }).eq('id', projectId);
      toast({ title: 'Music ready 🎵', description: 'Your soundtrack has been generated.' });
    } catch (e: any) {
      toast({ title: 'Music generation failed', description: e.message, variant: 'destructive' });
    } finally {
      setGeneratingMusic(false);
    }
  };

  const handleRefine = () => {
    setVideoUrl(null);
    setStep(1);
  };

  const handleDownload = (url?: string | null) => {
    const target = url || videoUrl;
    if (!target) return;
    const a = document.createElement('a');
    a.href = target;
    a.download = `animated-static-${Date.now()}.mp4`;
    a.target = '_blank';
    a.click();
  };

  const handleDeleteHistory = async (id: string) => {
    try {
      const { error } = await supabase.from('animated_statics').delete().eq('id', id);
      if (error) throw error;
      setHistory(prev => prev.filter(h => h.id !== id));
      toast({ title: 'Deleted' });
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleResumeFromHistory = (item: HistoryItem) => {
    setView('create');
    setSelectedImage(item.source_image_url);
    setVideoUrl(item.animation_url);
    setMusicUrl(item.music_url);
    setCustomPrompt(item.prompt || '');
    setProjectId(item.id);
    setStep(item.animation_url ? 3 : 0);
  };

  const handleNewProject = () => {
    setView('create');
    setStep(0);
    setSelectedImage(null);
    setAnalysis(null);
    setSelectedSuggestions(new Set());
    setCustomPrompt('');
    setVideoUrl(null);
    setMusicUrl(null);
    setMusicPrompt('');
    setProjectId(null);
    setBulkMode(false);
    setBulkSelected(new Set());
    setBulkJobs([]);
  };

  const toggleBulkSelect = (url: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const updateBulkJob = (imageUrl: string, patch: Partial<typeof bulkJobs[number]>) => {
    setBulkJobs(prev => prev.map(j => j.imageUrl === imageUrl ? { ...j, ...patch } : j));
  };

  const processOneBulkJob = async (imageUrl: string, musicMoodPrompt: string) => {
    if (!user) throw new Error('Not authenticated');

    // 1. Analyze
    updateBulkJob(imageUrl, { status: 'analyzing', progress: 5 });
    const { data: analysisData, error: analysisErr } = await supabase.functions.invoke('analyze-animate-image', {
      body: { imageUrl },
    });
    if (analysisErr) throw new Error(analysisErr.message);
    if (analysisData?.error) throw new Error(analysisData.userMessage || analysisData.error);
    const a = analysisData as Analysis;

    // 2. Build best-of-the-best prompt (use ALL suggestions + director's brief)
    const preservationPrefix = a.objects?.length ? `[PRESERVE EXACTLY: ${a.objects.join('; ')}] ` : '';
    const textItems = a.objects?.filter((o: string) => /^Text:/i.test(o)) || [];
    const textFreeze = textItems.length > 0
      ? `[TEXT FREEZE: All visible text and lettering must remain exactly as shown — treat as fixed texture, do not regenerate any characters. Detected text: ${textItems.join('; ')}] `
      : '[TEXT FREEZE: All visible text, lettering, and typography must be treated as fixed texture — do not regenerate, redraw, or alter any characters.] ';
    const finalPrompt = preservationPrefix + textFreeze + (a.directorPrompt || 'Subtle cinematic motion with slow zoom and gentle parallax');

    // 3. Insert project
    const { data: project, error: projErr } = await supabase
      .from('animated_statics')
      .insert({
        user_id: user.id,
        source_image_url: imageUrl,
        analysis: a as any,
        prompt: finalPrompt,
        status: 'generating',
      })
      .select()
      .single();
    if (projErr) throw projErr;

    // 4. Generate video
    updateBulkJob(imageUrl, { status: 'generating', progress: 15 });
    const taskId = await createWaveSpeedVideo({
      prompt: finalPrompt,
      imageUrls: [imageUrl],
      model: 'wan-2.5-i2v',
      aspectRatio: '9:16',
      userId: user.id,
      source: 'animate-statics',
      sourceId: project.id,
    });

    // 5. Poll
    const pollStart = Date.now();
    let videoOut: string | null = null;
    while (!videoOut) {
      await new Promise(r => setTimeout(r, 5000));
      if (Date.now() - pollStart > 5 * 60 * 1000) throw new Error('Video timed out');
      try {
        const job = await getWaveSpeedVideoJob(taskId);
        if (job.progress) updateBulkJob(imageUrl, { progress: Math.max(15, Math.min(80, job.progress)) });
        if (job.status === 'completed' && job.videoUrl) videoOut = job.videoUrl;
        else if (job.status === 'failed') throw new Error(job.error || 'Video generation failed');
      } catch (e: any) {
        if (e.message?.includes('Video generation failed') || e.message?.includes('timed out')) throw e;
      }
    }
    await supabase.from('animated_statics').update({ animation_url: videoOut, status: 'completed' }).eq('id', project.id);
    updateBulkJob(imageUrl, { videoUrl: videoOut, progress: 85, status: 'music' });

    // 6. Music — prefer saved library track, otherwise generate (and save) one
    let musicOut: string | undefined;
    const presetSaved = bulkSelectedMusicId ? savedMusic.find(m => m.id === bulkSelectedMusicId) : null;
    if (presetSaved) {
      musicOut = presetSaved.audio_url;
      await supabase.from('animated_statics').update({ music_url: musicOut }).eq('id', project.id);
    } else {
      try {
        const { data: musicData, error: musicErr } = await supabase.functions.invoke('generate-music', {
          body: { mood: musicMoodPrompt, duration: 30 },
        });
        if (musicErr) throw new Error(musicErr.message);
        if (musicData?.error) throw new Error(musicData.error);
        musicOut = musicData?.audioUrl;
        if (musicOut) {
          await supabase.from('animated_statics').update({ music_url: musicOut }).eq('id', project.id);
          // Auto-save to library for reuse
          const label = `Bulk · ${new Date().toLocaleDateString()}`;
          const { data: row } = await supabase.from('music_library').insert({
            user_id: user.id, label, mood: label, prompt: musicMoodPrompt, audio_url: musicOut, duration: 30,
          }).select().single();
          if (row) setSavedMusic(prev => [row as SavedMusic, ...prev]);
        }
      } catch (e: any) {
        console.warn('Music generation failed for bulk job:', e.message);
      }
    }

    updateBulkJob(imageUrl, { musicUrl: musicOut, status: 'done', progress: 100 });
  };

  const startBulkGeneration = async () => {
    if (!user || bulkSelected.size === 0) return;
    const moodPreset = MUSIC_PRESETS.find(p => p.label === bulkMusicPreset) || MUSIC_PRESETS[0];
    const urls = Array.from(bulkSelected);
    setBulkRunning(true);
    setBulkJobs(urls.map(u => ({ imageUrl: u, status: 'pending', progress: 0 })));

    for (const url of urls) {
      try {
        await processOneBulkJob(url, moodPreset.prompt);
      } catch (e: any) {
        updateBulkJob(url, { status: 'failed', error: e.message, creditError: isCreditError(e.message) });
      }
    }

    setBulkRunning(false);
    toast({
      title: 'Bulk generation complete 🎬',
      description: `Processed ${urls.length} images. Check History for all results.`,
    });
  };

  const retryBulkJob = async (imageUrl: string) => {
    if (!user || bulkRunning) return;
    const moodPreset = MUSIC_PRESETS.find(p => p.label === bulkMusicPreset) || MUSIC_PRESETS[0];
    setBulkRunning(true);
    updateBulkJob(imageUrl, { status: 'pending', progress: 0, error: undefined, creditError: false });
    try {
      await processOneBulkJob(imageUrl, moodPreset.prompt);
    } catch (e: any) {
      updateBulkJob(imageUrl, { status: 'failed', error: e.message, creditError: isCreditError(e.message) });
    } finally {
      setBulkRunning(false);
    }
  };

  const retryAllFailed = async () => {
    const failed = bulkJobs.filter(j => j.status === 'failed').map(j => j.imageUrl);
    if (!failed.length) return;
    const moodPreset = MUSIC_PRESETS.find(p => p.label === bulkMusicPreset) || MUSIC_PRESETS[0];
    setBulkRunning(true);
    for (const url of failed) {
      updateBulkJob(url, { status: 'pending', progress: 0, error: undefined, creditError: false });
      try { await processOneBulkJob(url, moodPreset.prompt); }
      catch (e: any) { updateBulkJob(url, { status: 'failed', error: e.message, creditError: isCreditError(e.message) }); }
    }
    setBulkRunning(false);
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Animate Statics</h1>
            <p className="text-muted-foreground mt-1">Turn static images into animated video creatives with AI</p>
          </div>
          <div className="flex gap-2">
            <Button variant={view === 'create' ? 'default' : 'outline'} size="sm" onClick={handleNewProject} className="gap-1.5">
              <Plus className="w-4 h-4" /> New
            </Button>
            <Button variant={view === 'history' ? 'default' : 'outline'} size="sm" onClick={() => setView('history')} className="gap-1.5">
              <History className="w-4 h-4" /> History
            </Button>
          </div>
        </div>

        {view === 'history' && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Your Animated Statics</CardTitle>
                  <CardDescription>Resume, download, or delete past projects</CardDescription>
                </div>
                {user?.id && history.some(h => h.animation_url) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={async () => {
                      const url = `${window.location.origin}/library/${user.id}?source=animated`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast({ title: 'Share link copied', description: 'Anyone with this link can view your animated statics — no login required.' });
                      } catch {
                        window.prompt('Copy this share link:', url);
                      }
                    }}
                  >
                    <Share2 className="w-4 h-4" />
                    Share Public Gallery
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : history.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No animations yet. Create your first one!</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {history.map(item => (
                    <div key={item.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted">
                      {item.animation_url ? (
                        <video src={`${item.animation_url}#t=0.5`} preload="metadata" className="w-full aspect-[9/16] object-cover" muted />
                      ) : item.source_image_url ? (
                        <img src={item.source_image_url} alt="" className="w-full aspect-[9/16] object-cover opacity-60" />
                      ) : (
                        <div className="w-full aspect-[9/16] bg-muted" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1.5">
                        <Badge variant={item.status === 'completed' ? 'default' : item.status === 'failed' ? 'destructive' : 'secondary'} className="self-start text-[10px]">
                          {item.status}
                        </Badge>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="secondary" className="h-7 px-2 text-xs flex-1" onClick={() => handleResumeFromHistory(item)}>
                            Open
                          </Button>
                          {item.animation_url && (
                            <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => handleDownload(item.animation_url)}>
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive" className="h-7 px-2"><Trash2 className="w-3 h-3" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this animation?</AlertDialogTitle>
                                <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteHistory(item.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {view === 'create' && (
          <>
            <div className="flex items-center gap-2">
              {STEPS.map((label, i) => (
                <React.Fragment key={label}>
                  {i > 0 && <div className={cn("h-px flex-1", i <= step ? "bg-primary" : "bg-border")} />}
                  <div className={cn(
                    "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors",
                    i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <span>{i + 1}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Music Library — reusable saved tracks */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base"><Library className="w-4 h-4" /> Music Library <Badge variant="secondary" className="text-[10px]">{savedMusic.length}</Badge></CardTitle>
                    <CardDescription className="text-xs">Save tracks once, reuse across all animations — skips music generation cost.</CardDescription>
                  </div>
                  <Button size="sm" onClick={generateMusicPack} disabled={generatingPack} className="gap-1.5">
                    {generatingPack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {generatingPack ? `Generating ${packProgress?.done ?? 0}/${packProgress?.total ?? 10}…` : 'Generate 10 Tracks'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {generatingPack && packProgress && (
                  <div className="mb-3 space-y-1">
                    <p className="text-xs text-muted-foreground">Now generating: <span className="font-medium text-foreground">{packProgress.current}</span></p>
                    <Progress value={(packProgress.done / packProgress.total) * 100} className="h-1.5" />
                  </div>
                )}
                {musicLibLoading ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                ) : savedMusic.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No saved tracks yet. Click "Generate 10 Tracks" to build your library.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {savedMusic.map(m => {
                      const isPlaying = previewingId === m.id;
                      const isAttached = selectedSavedMusicId === m.id || musicUrl === m.audio_url;
                      return (
                        <div key={m.id} className={cn(
                          "rounded-lg border p-2 flex flex-col gap-1.5 transition-colors",
                          isAttached ? "border-primary bg-primary/5" : "border-border bg-muted/30"
                        )}>
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Music className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="text-xs font-medium truncate">{m.label}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-6 px-2 flex-1" onClick={() => togglePreview(m)}>
                              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                            </Button>
                            {projectId && (
                              <Button size="sm" variant={isAttached ? 'default' : 'outline'} className="h-6 px-2 flex-1 text-[10px]" onClick={() => attachSavedMusicToCurrent(m)}>
                                {isAttached ? '✓' : 'Use'}
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-6 px-1.5" onClick={() => deleteSavedMusic(m.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {step === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Select an Image</CardTitle>
                  <CardDescription>Upload, pick one, or bulk-animate multiple gallery images at once</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs defaultValue="upload">
                    <TabsList>
                      <TabsTrigger value="upload"><Upload className="w-4 h-4 mr-1.5" />Upload</TabsTrigger>
                      <TabsTrigger value="gallery"><ImageIcon className="w-4 h-4 mr-1.5" />Gallery</TabsTrigger>
                    </TabsList>
                    <TabsContent value="upload" className="mt-4">
                      <ImageDropZone onFilesSelected={(files) => { if (files[0]) handleImageUpload(files[0]); }} />
                    </TabsContent>
                    <TabsContent value="gallery" className="mt-4 space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={bulkMode ? 'default' : 'outline'}
                            onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()); setSelectedImage(null); }}
                            className="gap-1.5"
                            disabled={bulkRunning}
                          >
                            <Layers className="w-3.5 h-3.5" /> {bulkMode ? 'Bulk Mode On' : 'Enable Bulk Mode'}
                          </Button>
                          {bulkMode && (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setBulkSelected(new Set(galleryImages.map(i => i.image_url)))} disabled={bulkRunning}>
                                Select All
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setBulkSelected(new Set())} disabled={bulkRunning}>
                                Clear
                              </Button>
                            </>
                          )}
                        </div>
                        {bulkMode && (
                          <Badge variant="secondary">{bulkSelected.size} selected</Badge>
                        )}
                      </div>

                      {galleryLoading ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                      ) : galleryImages.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No images in your gallery yet. Upload one above.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-72 overflow-y-auto">
                          {galleryImages.map((img) => {
                            const isBulkSelected = bulkSelected.has(img.image_url);
                            const isSingleSelected = selectedImage === img.image_url;
                            const status = getImageStatus(img.image_url);
                            const histItem = historyByImage.get(img.image_url);
                            return (
                              <button
                                key={img.id}
                                onClick={() => bulkMode ? toggleBulkSelect(img.image_url) : handleImageSelect(img.image_url)}
                                disabled={bulkRunning}
                                title={
                                  status === 'animated' ? 'Already animated — click to re-animate, or use the ▶ badge to view the video' :
                                  status === 'failed' ? 'Previous animation failed — select to retry' :
                                  status === 'pending' ? 'Animation in progress' : undefined
                                }
                                className={cn(
                                  "relative rounded-lg overflow-hidden border-2 transition-all aspect-square",
                                  bulkMode
                                    ? (isBulkSelected ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-border")
                                    : (isSingleSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"),
                                  status === 'animated' && !isBulkSelected && !isSingleSelected && "border-emerald-500/60",
                                  status === 'failed' && !isBulkSelected && !isSingleSelected && "border-destructive/70"
                                )}
                              >
                                <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                                {bulkMode && (
                                  <div className={cn(
                                    "absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors z-10",
                                    isBulkSelected ? "bg-primary border-primary" : "bg-background/70 border-background/90"
                                  )}>
                                    {isBulkSelected && <CheckCircle2 className="w-3.5 h-3.5 text-primary-foreground" />}
                                  </div>
                                )}

                                {/* Status overlay */}
                                {status === 'animated' && histItem?.animation_url && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => { e.stopPropagation(); window.open(histItem.animation_url!, '_blank'); }}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); window.open(histItem.animation_url!, '_blank'); } }}
                                    className="absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500 text-white px-1.5 py-0.5 text-[10px] font-semibold shadow hover:bg-emerald-600"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" /> View
                                  </span>
                                )}
                                {status === 'failed' && (
                                  <span className="absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-destructive text-destructive-foreground px-1.5 py-0.5 text-[10px] font-semibold shadow">
                                    <RotateCcw className="w-2.5 h-2.5" /> Retry
                                  </span>
                                )}
                                {status === 'pending' && (
                                  <span className="absolute top-1.5 right-1.5 z-10 inline-flex items-center gap-1 rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[10px] font-semibold shadow">
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                  </span>
                                )}
                                {status && (
                                  <div className="absolute inset-x-0 bottom-0 h-5 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Legend */}
                      {!galleryLoading && galleryImages.length > 0 && historyByImage.size > 0 && (
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Already animated</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive" /> Failed (retry)</span>
                          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> In progress</span>
                        </div>
                      )}

                      {bulkMode && bulkSelected.size > 0 && !bulkRunning && bulkJobs.length === 0 && (
                        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" />
                            <p className="text-sm font-medium">Bulk Animate ({bulkSelected.size} images)</p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Each image will be analyzed by AI Director, animated, and paired with music. Pick a saved track from your library to skip music generation entirely (faster + free).
                          </p>
                          <div className="flex items-end gap-2 flex-wrap">
                            <div className="flex-1 min-w-[200px]">
                              <label className="text-xs font-medium text-muted-foreground mb-1 block">Music source</label>
                              <Select
                                value={bulkSelectedMusicId || `__preset__${bulkMusicPreset}`}
                                onValueChange={(v) => {
                                  if (v.startsWith('__preset__')) {
                                    setBulkSelectedMusicId(null);
                                    setBulkMusicPreset(v.replace('__preset__', ''));
                                  } else {
                                    setBulkSelectedMusicId(v);
                                  }
                                }}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {savedMusic.length > 0 && (
                                    <>
                                      <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold">From your library</div>
                                      {savedMusic.map(m => (
                                        <SelectItem key={m.id} value={m.id}>🎵 {m.label}</SelectItem>
                                      ))}
                                    </>
                                  )}
                                  <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground font-semibold">Generate new (uses credits)</div>
                                  {MUSIC_PRESETS.map(p => (
                                    <SelectItem key={p.label} value={`__preset__${p.label}`}>✨ {p.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={startBulkGeneration} className="gap-2">
                              <Sparkles className="w-4 h-4" /> Start Bulk Generate
                            </Button>
                          </div>
                        </div>
                      )}

                      {bulkJobs.length > 0 && (
                        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <p className="text-sm font-medium flex items-center gap-2">
                              <Layers className="w-4 h-4 text-primary" />
                              Bulk Progress ({bulkJobs.filter(j => j.status === 'done').length}/{bulkJobs.length} done)
                            </p>
                            <div className="flex gap-1.5">
                              {!bulkRunning && bulkJobs.some(j => j.status === 'failed') && (
                                <Button size="sm" variant="default" onClick={retryAllFailed} className="gap-1.5 h-7">
                                  <RefreshCw className="w-3 h-3" /> Retry All Failed ({bulkJobs.filter(j => j.status === 'failed').length})
                                </Button>
                              )}
                              {!bulkRunning && (
                                <Button size="sm" variant="ghost" onClick={() => { setBulkJobs([]); setBulkSelected(new Set()); }}>Clear</Button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {bulkJobs.map((job, i) => (
                              <div key={i} className="flex items-center gap-3 p-2 rounded bg-background border border-border">
                                <img src={job.imageUrl} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs font-medium capitalize">{job.status}</span>
                                    {job.status === 'done' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                                    {job.status === 'failed' && <XCircle className="w-4 h-4 text-destructive" />}
                                    {(job.status === 'analyzing' || job.status === 'generating' || job.status === 'music') && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                                  </div>
                                  <Progress value={job.progress} className="h-1.5" />
                                  {job.error && (
                                    <p className="text-[10px] mt-1 truncate text-destructive">
                                      {job.creditError ? '💳 Insufficient WaveSpeed credits — top up then retry' : job.error}
                                    </p>
                                  )}
                                </div>
                                {job.status === 'failed' && !bulkRunning && (
                                  <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => retryBulkJob(job.imageUrl)}>
                                    <RefreshCw className="w-3 h-3" /> Retry
                                  </Button>
                                )}
                                {job.videoUrl && (
                                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => handleDownload(job.videoUrl)}>
                                    <Download className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                          {!bulkRunning && bulkJobs.some(j => j.status === 'done') && (
                            <Button size="sm" variant="outline" onClick={() => setView('history')} className="gap-1.5 w-full">
                              <History className="w-3.5 h-3.5" /> View All in History
                            </Button>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {!bulkMode && selectedImage && (
                    <div className="flex flex-col items-center gap-4 pt-4 border-t border-border">
                      <img src={selectedImage} alt="Selected" className="max-h-64 rounded-lg border border-border object-contain" />
                      <Button onClick={goToAnalysis} className="gap-2">
                        <Sparkles className="w-4 h-4" /> Analyze & Animate <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}


            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5" /> Animation Direction</CardTitle>
                  <CardDescription>Your AI director has analyzed the image and crafted a cinematic brief</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-4">
                    <img src={selectedImage!} alt="Source" className="w-32 h-32 object-cover rounded-lg border border-border flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      {analyzing ? (
                        <div className="flex flex-col items-start gap-2 py-6">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span className="font-medium">AI Director is analyzing your image…</span>
                          </div>
                          <p className="text-xs text-muted-foreground">Detecting objects, composition, and crafting your animation brief</p>
                        </div>
                      ) : analysis ? (
                        <p className="text-sm text-muted-foreground">Detected: {analysis.objects.join(', ')}</p>
                      ) : null}
                    </div>
                  </div>

                  {analysis && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">AI Suggests</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {analysis.suggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => selectSuggestion(i)}
                            className={cn(
                              "text-left p-3 rounded-lg border transition-all",
                              selectedSuggestions.has(i)
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border hover:border-primary/40 hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                "w-2 h-2 rounded-full flex-shrink-0",
                                selectedSuggestions.has(i) ? "bg-primary" : "bg-muted-foreground/30"
                              )} />
                              <span className="text-sm font-medium text-foreground">{s.label}</span>
                            </div>
                            {s.description && (
                              <p className="text-xs text-muted-foreground mt-1 ml-4">{s.description}</p>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <label className="text-sm font-medium text-foreground">Director's Brief</label>
                        <Badge variant="secondary" className="text-[10px]">AI Generated</Badge>
                      </div>
                      <Textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        rows={4}
                        className="text-sm"
                        placeholder="Your AI-generated animation direction will appear here…"
                      />
                      <p className="text-xs text-muted-foreground">Feel free to edit — this prompt drives the animation engine</p>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <Button variant="outline" onClick={() => setStep(0)} className="gap-2">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </Button>
                    <Button onClick={startGeneration} disabled={analyzing || !customPrompt.trim()} className="gap-2">
                      <Play className="w-4 h-4" /> Generate Animation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Generating Animation</CardTitle>
                  <CardDescription>This usually takes 1–3 minutes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Progress value={progress} className="h-3" />
                  <p className="text-sm text-muted-foreground text-center">{progress}% complete</p>
                  <div className="flex justify-center">
                    <img src={selectedImage!} alt="Source" className="w-48 rounded-lg border border-border opacity-60 animate-pulse" />
                  </div>
                </CardContent>
              </Card>
            )}

            {step === 3 && videoUrl && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Your Animated Creative</CardTitle>
                    <CardDescription>Preview, refine, or export your animation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="relative max-w-md mx-auto">
                      <video
                        key={`${videoUrl}-${musicUrl || 'nomusic'}`}
                        src={videoUrl}
                        controls
                        autoPlay
                        loop
                        className="w-full rounded-lg border border-border"
                      >
                        {musicUrl && <track kind="metadata" />}
                      </video>
                      {musicUrl && (
                        <audio src={musicUrl} autoPlay loop className="hidden" id="animate-music-track" />
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 justify-center">
                      <Button variant="outline" onClick={handleRefine} className="gap-2">
                        <RotateCcw className="w-4 h-4" /> Refine
                      </Button>
                      <Button variant="outline" onClick={() => handleDownload()} className="gap-2">
                        <Download className="w-4 h-4" /> Download MP4
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Music className="w-5 h-5" /> Add Background Music</CardTitle>
                    <CardDescription>Pick a vibe or describe the soundtrack you want</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {MUSIC_PRESETS.map(preset => (
                        <Button
                          key={preset.label}
                          size="sm"
                          variant="outline"
                          disabled={generatingMusic}
                          onClick={() => { setMusicPrompt(preset.prompt); handleGenerateMusic(preset.prompt); }}
                          className="gap-1.5"
                        >
                          <Music className="w-3.5 h-3.5" /> {preset.label}
                        </Button>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={musicPrompt}
                        onChange={(e) => setMusicPrompt(e.target.value)}
                        placeholder="Or describe a custom mood (e.g. 'epic cinematic strings')"
                        disabled={generatingMusic}
                      />
                      <Button onClick={() => handleGenerateMusic()} disabled={generatingMusic || !musicPrompt.trim()} className="gap-2">
                        {generatingMusic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Generate
                      </Button>
                    </div>

                    {generatingMusic && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> Composing your soundtrack… (~30–60s)
                      </p>
                    )}

                    {musicUrl && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <p className="text-sm font-medium text-foreground">Your Soundtrack</p>
                        <audio src={musicUrl} controls className="w-full" />
                        <Button variant="outline" size="sm" onClick={() => handleDownload(musicUrl)} className="gap-2">
                          <Download className="w-3.5 h-3.5" /> Download MP3
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default AnimateStatics;
