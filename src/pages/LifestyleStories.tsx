import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { getFriendlyError } from '@/lib/errorClassifier';
import {
  Globe, Sparkles, Play, Clock, Film, Music, Mic, Loader2, CheckCircle2,
  ArrowRight, RefreshCw, ChevronRight, Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandAnalysis {
  brand_name: string;
  brand_tone: string;
  product_type: string;
  target_audience: string;
  visual_style: string;
  key_benefits: string[];
  content_angles: string[];
  recommended_video_types: {
    type: string;
    title: string;
    description: string;
    hook_idea: string;
  }[];
}

interface VideoScene {
  scene_number: number;
  duration_seconds: number;
  visual_prompt: string;
  narration: string;
  scene_type: 'hook' | 'story' | 'product' | 'benefit' | 'cta';
}

interface VideoConcept {
  title: string;
  type: string;
  description: string;
  hook: string;
  cta: string;
  voiceover_script: string;
  music_mood: string;
  scenes: VideoScene[];
}

type Step = 'url' | 'analysis' | 'concepts' | 'production';

const DURATIONS = [
  { value: 15, label: '15s', desc: 'Quick hook' },
  { value: 30, label: '30s', desc: 'Story ad' },
  { value: 60, label: '60s', desc: 'Full story' },
];

const LifestyleStories = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('url');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [brandAnalysis, setBrandAnalysis] = useState<BrandAnalysis | null>(null);
  const [selectedVideoTypes, setSelectedVideoTypes] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [conceptCount, setConceptCount] = useState(3);
  const [concepts, setConcepts] = useState<VideoConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [productionStatus, setProductionStatus] = useState<Record<string, string>>({ scenes: 'queued', voiceover: 'queued', music: 'queued' });
  const [completedScenes, setCompletedScenes] = useState<any[]>([]);
  const [completedVoiceover, setCompletedVoiceover] = useState<string | null>(null);
  const [completedMusic, setCompletedMusic] = useState<string | null>(null);

  const analyzeBrand = async () => {
    if (!url.trim()) {
      toast({ title: 'Enter a URL', description: 'Please enter your website URL to analyze.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-brand-website', {
        body: { url: url.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setBrandAnalysis(data.analysis);
      setStep('analysis');
      toast({ title: 'Brand Analyzed!', description: `Found insights for ${data.analysis.brand_name}` });
    } catch (err: any) {
      const friendly = getFriendlyError(err);
      toast({ title: friendly.title, description: friendly.description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const generateConcepts = async () => {
    if (!brandAnalysis) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-lifestyle-concepts', {
        body: {
          brandAnalysis,
          duration,
          videoTypes: selectedVideoTypes,
          count: conceptCount,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConcepts(data.concepts || []);
      setStep('concepts');
      toast({ title: 'Concepts Ready!', description: `Generated ${(data.concepts || []).length} video concepts` });
    } catch (err: any) {
      const friendly = getFriendlyError(err);
      toast({ title: friendly.title, description: friendly.description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectConceptAndGenerate = async (index: number) => {
    setSelectedConcept(index);
    const concept = concepts[index];
    if (!concept || !user) return;

    setGeneratingVideo(true);
    setStep('production');
    setProductionStatus({ scenes: 'in_progress', voiceover: 'queued', music: 'queued' });

    try {
      // Save to database
      const { data: storyRecord, error: dbError } = await (supabase.from('lifestyle_stories' as any) as any).insert({
        user_id: user.id,
        brand_url: url,
        brand_analysis: brandAnalysis,
        concepts: concepts,
        selected_concept_index: index,
        duration,
        scenes: concept.scenes,
        title: concept.title,
        status: 'generating',
      }).select('id').single();
      if (dbError) console.error('Save error:', dbError);

      const storyId = (storyRecord as any)?.id;

      // Generate scene images
      const sceneResults = [];
      for (let i = 0; i < concept.scenes.length; i++) {
        const scene = concept.scenes[i];
        try {
          const { data: imgData, error: imgError } = await supabase.functions.invoke('generate-scene-image', {
            body: {
              prompt: scene.visual_prompt,
              style: brandAnalysis?.visual_style || 'cinematic',
            },
          });
          if (imgError) throw imgError;
          sceneResults.push({ ...scene, image_url: imgData?.imageUrl || null });
        } catch (err) {
          console.error(`Scene ${i + 1} image failed:`, err);
          sceneResults.push({ ...scene, image_url: null });
        }
      }

      setProductionStatus(prev => ({ ...prev, scenes: 'done', voiceover: 'in_progress' }));

      // Generate voiceover
      let voiceoverUrl: string | null = null;
      try {
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
          body: {
            text: concept.voiceover_script,
            voice: 'alloy',
          },
        });
        if (ttsError) throw ttsError;
        voiceoverUrl = ttsData?.audioUrl || null;
      } catch (err) {
        console.error('Voiceover generation failed:', err);
      }

      setProductionStatus(prev => ({ ...prev, voiceover: 'done', music: 'in_progress' }));

      // Generate background music
      let musicUrl: string | null = null;
      try {
        const { data: musicData, error: musicError } = await supabase.functions.invoke('generate-music', {
          body: {
            prompt: `${concept.music_mood} background music for a ${concept.type} video, ${duration} seconds`,
            duration,
          },
        });
        if (musicError) throw musicError;
        musicUrl = musicData?.audioUrl || null;
      } catch (err) {
        console.error('Music generation failed:', err);
      }

      setProductionStatus(prev => ({ ...prev, music: 'done' }));

      // Update DB record
      if (storyId) {
        await supabase.from('lifestyle_stories' as any).update({
          scenes: sceneResults,
          voiceover_url: voiceoverUrl,
          music_url: musicUrl,
          status: 'completed',
        }).eq('id', storyId);
      }

      setCompletedScenes(sceneResults);
      setCompletedVoiceover(voiceoverUrl);
      setCompletedMusic(musicUrl);

      toast({
        title: 'Production Complete!',
        description: `${sceneResults.filter(s => s.image_url).length} scenes generated with voiceover and music.`,
      });
    } catch (err: any) {
      const friendly = getFriendlyError(err);
      toast({ title: friendly.title, description: friendly.description, variant: 'destructive' });
    } finally {
      setGeneratingVideo(false);
    }
  };

  const toggleVideoType = (type: string) => {
    setSelectedVideoTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const sceneTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      hook: 'bg-red-500/10 text-red-500 border-red-500/20',
      story: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      product: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      benefit: 'bg-green-500/10 text-green-500 border-green-500/20',
      cta: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    };
    return colors[type] || 'bg-muted text-muted-foreground';
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Film className="w-8 h-8 text-primary" />
            Lifestyle Stories
          </h1>
          <p className="text-muted-foreground">
            Generate story-driven lifestyle videos that promote your products naturally
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2">
          {(['url', 'analysis', 'concepts', 'production'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              <button
                onClick={() => {
                  if (s === 'url') setStep('url');
                  if (s === 'analysis' && brandAnalysis) setStep('analysis');
                  if (s === 'concepts' && concepts.length) setStep('concepts');
                }}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  step === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {i + 1}. {s === 'url' ? 'Website' : s === 'analysis' ? 'Analysis' : s === 'concepts' ? 'Concepts' : 'Production'}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Step 1: URL Input */}
        {step === 'url' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Enter Your Website
              </CardTitle>
              <CardDescription>
                Our AI will analyze your brand, products, and messaging to create the perfect lifestyle videos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="https://yourbrand.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && analyzeBrand()}
                />
                <Button onClick={analyzeBrand} disabled={loading} className="min-w-[140px]">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {loading ? 'Analyzing...' : 'Analyze Brand'}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                {[
                  { icon: Wand2, title: 'AI Brand Analysis', desc: 'Tone, audience, and visual style detection' },
                  { icon: Film, title: 'Story Concepts', desc: '3-5 unique video ideas tailored to your brand' },
                  { icon: Music, title: 'Full Production', desc: 'Voiceover, music, and connected scenes' },
                ].map(f => (
                  <div key={f.title} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <f.icon className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Brand Analysis Results */}
        {step === 'analysis' && brandAnalysis && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Brand Analysis: {brandAnalysis.brand_name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { label: 'Brand Tone', value: brandAnalysis.brand_tone },
                    { label: 'Product Type', value: brandAnalysis.product_type },
                    { label: 'Target Audience', value: brandAnalysis.target_audience },
                    { label: 'Visual Style', value: brandAnalysis.visual_style },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{item.label}</p>
                      <p className="text-sm font-medium capitalize">{item.value}</p>
                    </div>
                  ))}
                  <div className="p-3 rounded-lg bg-muted/50 md:col-span-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Key Benefits</p>
                    <div className="flex flex-wrap gap-1.5">
                      {brandAnalysis.key_benefits.map((b, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{b}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommended Video Types */}
            <Card>
              <CardHeader>
                <CardTitle>Recommended Video Types</CardTitle>
                <CardDescription>Select the types you want to generate concepts for</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {brandAnalysis.recommended_video_types.map((vt) => (
                    <button
                      key={vt.type}
                      onClick={() => toggleVideoType(vt.type)}
                      className={cn(
                        "p-4 rounded-lg border text-left transition-all",
                        selectedVideoTypes.includes(vt.type)
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{vt.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{vt.description}</p>
                          <p className="text-xs text-primary mt-2 italic">Hook: "{vt.hook_idea}"</p>
                        </div>
                        {selectedVideoTypes.includes(vt.type) && (
                          <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Duration & Count */}
                <div className="flex flex-wrap gap-6 pt-4 border-t">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Video Duration</p>
                    <div className="flex gap-2">
                      {DURATIONS.map(d => (
                        <button
                          key={d.value}
                          onClick={() => setDuration(d.value)}
                          className={cn(
                            "px-4 py-2 rounded-lg border text-sm transition-all",
                            duration === d.value
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {d.label}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{d.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Number of Concepts</p>
                    <div className="flex gap-2">
                      {[3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setConceptCount(n)}
                          className={cn(
                            "px-4 py-2 rounded-lg border text-sm transition-all",
                            conceptCount === n
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border hover:border-primary/30"
                          )}
                        >
                          {n} videos
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button onClick={generateConcepts} disabled={loading} className="w-full mt-4" size="lg">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {loading ? 'Generating Concepts...' : `Generate ${conceptCount} Video Concepts`}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Video Concepts */}
        {step === 'concepts' && concepts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Video Concepts</h2>
              <Button variant="outline" size="sm" onClick={() => setStep('analysis')}>
                <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
              </Button>
            </div>

            <Tabs defaultValue="0">
              <TabsList className="w-full flex">
                {concepts.map((c, i) => (
                  <TabsTrigger key={i} value={String(i)} className="flex-1 text-xs">
                    {c.title.length > 20 ? c.title.slice(0, 20) + '...' : c.title}
                  </TabsTrigger>
                ))}
              </TabsList>

              {concepts.map((concept, i) => (
                <TabsContent key={i} value={String(i)}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{concept.title}</CardTitle>
                          <CardDescription className="mt-1">{concept.description}</CardDescription>
                        </div>
                        <Badge variant="secondary">{concept.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Hook & CTA */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground mb-1">🎣 Hook</p>
                          <p className="text-sm">{concept.hook}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-xs font-medium text-muted-foreground mb-1">📣 Call to Action</p>
                          <p className="text-sm">{concept.cta}</p>
                        </div>
                      </div>

                      {/* Voiceover Script */}
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Mic className="w-3 h-3" /> Voiceover Script
                        </p>
                        <p className="text-sm">{concept.voiceover_script}</p>
                      </div>

                      {/* Music Mood */}
                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Music mood:</span>
                        <Badge variant="outline">{concept.music_mood}</Badge>
                      </div>

                      {/* Scene Timeline */}
                      <div>
                        <p className="text-sm font-medium mb-3">Scene Breakdown</p>
                        <div className="space-y-2">
                          {concept.scenes.map((scene) => (
                            <div key={scene.scene_number} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-xs font-mono text-muted-foreground">#{scene.scene_number}</span>
                                <Badge variant="outline" className={cn("text-[10px]", sceneTypeColor(scene.scene_type))}>
                                  {scene.scene_type}
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">{scene.duration_seconds}s</span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-1">{scene.visual_prompt}</p>
                                <p className="text-xs italic text-foreground/70">"{scene.narration}"</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Generate Button */}
                      <Button
                        onClick={() => selectConceptAndGenerate(i)}
                        disabled={generatingVideo}
                        className="w-full"
                        size="lg"
                      >
                        {generatingVideo && selectedConcept === i ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        {generatingVideo && selectedConcept === i ? 'Starting Production...' : 'Generate This Video'}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {/* Step 4: Production */}
        {step === 'production' && selectedConcept !== null && concepts[selectedConcept] && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Film className="w-5 h-5 text-primary" />
                Production: {concepts[selectedConcept].title}
              </CardTitle>
              <CardDescription>
                Your lifestyle story video is being produced. Scene generation, voiceover, and music will be assembled automatically.
              </CardDescription>
            </CardHeader>
             <CardContent className="space-y-4">
              {generatingVideo ? (
                <div className="flex items-center gap-3 p-6 rounded-lg bg-muted/50 justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Video production pipeline is running. Each scene will be generated and stitched together with voiceover and music.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-6 rounded-lg bg-primary/10 justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <p className="text-sm font-medium">Production complete!</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { icon: Film, label: 'Scene Generation', status: productionStatus.scenes },
                  { icon: Mic, label: 'Voiceover', status: productionStatus.voiceover },
                  { icon: Music, label: 'Background Music', status: productionStatus.music },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 p-3 rounded-lg border border-border">
                    {item.status === 'in_progress' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : item.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : (
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground capitalize">{item.status === 'in_progress' ? 'In progress' : item.status}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Show completed scenes */}
              {completedScenes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Generated Scenes</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {completedScenes.map((scene, i) => (
                      <div key={i} className="rounded-lg overflow-hidden border border-border">
                        {scene.image_url ? (
                          <img src={scene.image_url} alt={`Scene ${i + 1}`} className="w-full aspect-video object-cover" />
                        ) : (
                          <div className="w-full aspect-video bg-muted flex items-center justify-center">
                            <Film className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-xs p-2 text-muted-foreground truncate">{scene.narration}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {completedVoiceover && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Voiceover</p>
                  <audio src={completedVoiceover} controls className="w-full" />
                </div>
              )}

              {completedMusic && (
                <div className="space-y-1">
                  <p className="text-sm font-medium">Background Music</p>
                  <audio src={completedMusic} controls className="w-full" />
                </div>
              )}

              {!generatingVideo && (
                <Button onClick={() => setStep('concepts')} variant="outline" className="w-full">
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Back to Concepts
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default LifestyleStories;
