import React, { useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { createWaveSpeedVideo, getWaveSpeedVideoJob } from '@/lib/wavespeed';
import { ImageDropZone } from '@/components/ImageDropZone';
import { useImageGallery } from '@/hooks/useImageGallery';
import {
  Wand2, Upload, Sparkles, Play, RotateCcw, Download, Music, ChevronRight, ChevronLeft, Image as ImageIcon, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

const STEPS = ['Select Image', 'Animate', 'Generate', 'Export'];

const AnimateStatics = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { images: galleryImages, isLoading: galleryLoading, saveImage } = useImageGallery();

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

  const handleImageSelect = (url: string) => {
    setSelectedImage(url);
    setAnalysis(null);
    setSelectedSuggestions(new Set());
    setCustomPrompt('');
    setVideoUrl(null);
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
    
    // Save to gallery so it appears in the user's image library
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
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      // When suggestions are selected, use their prompts; otherwise fall back to director prompt
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
    // customPrompt already contains the active prompt (either director or selected suggestions)
    // Prepend detected objects as preservation anchors for the video model
    const preservationPrefix = analysis?.objects?.length
      ? `[PRESERVE EXACTLY: ${analysis.objects.join('; ')}] `
      : '';
    const prompt = customPrompt.trim() || analysis?.directorPrompt || 'Subtle cinematic motion with slow zoom and gentle parallax';
    return preservationPrefix + prompt;
  };

  const startGeneration = async () => {
    if (!user || !selectedImage) return;
    setStep(2);
    setGenerating(true);
    setProgress(0);

    try {
      // Save project
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

      // Poll with retry tolerance
      let done = false;
      let consecutiveFailures = 0;
      const maxFailures = 3;
      const pollStart = Date.now();
      const maxPollDuration = 5 * 60 * 1000; // 5 minutes

      while (!done) {
        await new Promise(r => setTimeout(r, 5000));

        if (Date.now() - pollStart > maxPollDuration) {
          throw new Error('Generation timed out after 5 minutes. The video may still be processing — check back later.');
        }

        try {
          const job = await getWaveSpeedVideoJob(taskId);
          consecutiveFailures = 0; // reset on success
          if (job.progress) setProgress(job.progress);
          if (job.status === 'completed' && job.videoUrl) {
            setVideoUrl(job.videoUrl);
            await supabase.from('animated_statics').update({ animation_url: job.videoUrl, status: 'completed' }).eq('id', project.id);
            done = true;
          } else if (job.status === 'failed') {
            throw new Error(job.error || 'Video generation failed');
          }
        } catch (pollErr: any) {
          // If it's a real failure (not network), rethrow
          if (pollErr.message?.includes('Video generation failed')) throw pollErr;
          consecutiveFailures++;
          console.warn(`Polling attempt failed (${consecutiveFailures}/${maxFailures}):`, pollErr.message);
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

  const handleRefine = () => {
    setVideoUrl(null);
    setStep(1);
  };

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `animated-static-${Date.now()}.mp4`;
    a.target = '_blank';
    a.click();
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Animate Statics</h1>
          <p className="text-muted-foreground mt-1">Turn static images into animated video creatives with AI</p>
        </div>

        {/* Step indicator */}
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

        {/* Step 0: Image Selection */}
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

        {/* Step 1: Analysis & Prompt */}
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
                    <>
                      <p className="text-sm text-muted-foreground">Detected: {analysis.objects.join(', ')}</p>
                    </>
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

        {/* Step 2: Generating */}
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

        {/* Step 3: Export */}
        {step === 3 && videoUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Your Animated Creative</CardTitle>
              <CardDescription>Preview, refine, or export your animation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <video src={videoUrl} controls autoPlay loop className="w-full rounded-lg border border-border max-h-[500px] mx-auto" />

              <div className="flex flex-wrap gap-3 justify-center">
                <Button variant="outline" onClick={handleRefine} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Refine
                </Button>
                <Button variant="outline" onClick={handleDownload} className="gap-2">
                  <Download className="w-4 h-4" /> Download MP4
                </Button>
                <Button variant="outline" disabled className="gap-2">
                  <Music className="w-4 h-4" /> Add Music (coming soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default AnimateStatics;
