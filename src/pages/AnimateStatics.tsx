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
  Wand2, Upload, Sparkles, Play, RotateCcw, Download, Music, ChevronRight, ChevronLeft, Image as ImageIcon, Loader2, History, Trash2, Plus
} from 'lucide-react';
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

const STEPS = ['Select Image', 'Animate', 'Generate', 'Export'];

const MUSIC_PRESETS = [
  { label: 'Cinematic', prompt: 'Cinematic orchestral build, emotional and uplifting' },
  { label: 'Upbeat', prompt: 'Upbeat modern pop instrumental, energetic and bright' },
  { label: 'Lo-fi', prompt: 'Chill lo-fi hip hop beat, mellow and atmospheric' },
  { label: 'Corporate', prompt: 'Clean corporate background music, optimistic and professional' },
  { label: 'Ambient', prompt: 'Soft ambient pad, dreamy and minimal' },
  { label: 'Dramatic', prompt: 'Dramatic cinematic tension, deep cinematic drums' },
];

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

  useEffect(() => {
    if (view === 'history') loadHistory();
  }, [view, loadHistory]);

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
              <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" /> Your Animated Statics</CardTitle>
              <CardDescription>Resume, download, or delete past projects</CardDescription>
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

            {step === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ImageIcon className="w-5 h-5" /> Select an Image</CardTitle>
                  <CardDescription>Upload a new image or pick one from your gallery</CardDescription>
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
                    <TabsContent value="gallery" className="mt-4">
                      {galleryLoading ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                      ) : galleryImages.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No images in your gallery yet. Upload one above.</p>
                      ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-72 overflow-y-auto">
                          {galleryImages.map((img) => (
                            <button
                              key={img.id}
                              onClick={() => handleImageSelect(img.image_url)}
                              className={cn(
                                "rounded-lg overflow-hidden border-2 transition-all aspect-square",
                                selectedImage === img.image_url ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-border"
                              )}
                            >
                              <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {selectedImage && (
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
