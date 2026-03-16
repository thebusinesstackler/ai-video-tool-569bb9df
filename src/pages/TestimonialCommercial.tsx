import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SegmentTimeline } from '@/components/testimonial/SegmentTimeline';
import { LoopAIDirector } from '@/components/testimonial/LoopAIDirector';
import { TimelinePreview } from '@/components/testimonial/TimelinePreview';
import { useTestimonialCommercial, VideoFormat, VideoStyle } from '@/hooks/useTestimonialCommercial';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Play, Download, ArrowLeft, Loader2, Video, Trash2, Film, CheckCircle2, Image, Clapperboard, PanelLeftClose, PanelLeftOpen, MessageSquare, Clock, Eye, Music, Smartphone, Monitor, Copy, ExternalLink, RotateCcw, Tv, Subtitles } from 'lucide-react';
import { TestimonialCommercial as TestimonialCommercialType, CommercialSegment } from '@/types/testimonialCommercial';
import { cn } from '@/lib/utils';
import { SavedCommercialsDrawer } from '@/components/testimonial/SavedCommercialsDrawer';
import { StoryboardPreview } from '@/components/testimonial/StoryboardPreview';
import { CaptionSettings, defaultCaptionSettings } from '@/components/KaraokeCaption';
import { CaptionStyleSelector } from '@/components/CaptionStyleSelector';
import { VideoPlayerWithOverlay } from '@/components/VideoPlayerWithOverlay';
import { Card, CardContent } from '@/components/ui/card';

export default function TestimonialCommercial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [name, setName] = useState('Untitled Commercial');
  const [savedCommercials, setSavedCommercials] = useState<TestimonialCommercialType[]>([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('scenes');
  const [targetDuration, setTargetDuration] = useState('30');
  const [chatOpen, setChatOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [focusedSegmentId, setFocusedSegmentId] = useState<string | null>(null);
  const [captionSettings, setCaptionSettings] = useState<CaptionSettings>(defaultCaptionSettings);
  const resultCardRef = useRef<HTMLDivElement>(null);

  const {
    segments,
    setSegments,
    addSegment,
    updateSegment,
    deleteSegment,
    duplicateSegment,
    reorderSegments,
    saveCommercial,
    loadCommercial,
    generateCommercial,
    generateCharacterForSegment,
    approveAllSegments,
    isGenerating,
    generationProgress,
    currentCommercial,
    setCurrentCommercial,
    videoFormat,
    setVideoFormat,
    videoStyle,
    setVideoStyle,
  } = useTestimonialCommercial();

  const handleTimelineSelectSegment = useCallback((segmentId: string) => {
    const seg = segments.find(s => s.id === segmentId);
    if (!seg) return;
    setActiveTab(seg.type === 'broll' ? 'broll' : 'scenes');
    if (!chatOpen) setChatOpen(true);
    setFocusedSegmentId(segmentId);
    setTimeout(() => {
      const el = document.getElementById(`segment-card-${segmentId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  }, [segments, chatOpen]);

  const handleApplyStrategy = (newSegments: CommercialSegment[], commercialName: string) => {
    setSegments(newSegments);
    if (commercialName) setName(commercialName);
    setCurrentCommercial(null);
    setFinalVideoUrl(null);
    setActiveTab('scenes');
  };

  const handleSaveToDb = async () => {
    await saveCommercial(name);
  };

  useEffect(() => {
    async function fetchSaved() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('testimonial_commercials')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (data) setSavedCommercials(data as unknown as TestimonialCommercialType[]);
    }
    fetchSaved();
  }, [currentCommercial]);

  useEffect(() => {
    if (editId) loadCommercial(editId);
  }, [editId, loadCommercial]);

  useEffect(() => {
    if (currentCommercial) {
      setName(currentCommercial.name);
      if (currentCommercial.video_url) setFinalVideoUrl(currentCommercial.video_url);
    }
  }, [currentCommercial]);

  const handleSave = async () => { await saveCommercial(name); };
  const handleGenerate = async () => {
    const videoUrl = await generateCommercial();
    if (videoUrl) {
      setFinalVideoUrl(videoUrl);
      setActiveTab('final-cut');
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('testimonial_commercials').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else { setSavedCommercials(prev => prev.filter(c => c.id !== id)); toast.success('Deleted'); }
  };

  const generateBrollPreview = useCallback(async (segmentId: string, prompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-scene-image', {
        body: { prompt, aspectRatio: '16:9' }
      });
      if (error) throw error;
      if (data?.imageUrl) {
        updateSegment(segmentId, { brollImages: [data.imageUrl], status: 'character-ready' });
      } else {
        updateSegment(segmentId, { status: 'pending' });
      }
    } catch (err) {
      console.error('B-roll preview generation failed:', err);
      updateSegment(segmentId, { status: 'pending' });
    }
  }, [updateSegment]);

  const [musicUrl, setMusicUrl] = useState<string | null>(null);

  const handleGenerateMusic = useCallback(async (mood: string) => {
    toast.info(`🎵 Generating background music: "${mood}"...`);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-music`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            mood,
            duration: segments.reduce((s, seg) => s + seg.duration, 0) || 30,
          }),
        }
      );
      const data = await response.json();
      if (data.needsKey) {
        toast.error('ElevenLabs API key needed for music generation. Add ELEVENLABS_API_KEY in settings.');
        return;
      }
      if (data.error) throw new Error(data.error);
      if (data.audioUrl) {
        setMusicUrl(data.audioUrl);
        toast.success('🎵 Background music generated!');
      } else if (data.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        setMusicUrl(audioUrl);
        toast.success('🎵 Background music generated!');
      }
    } catch (err) {
      console.error('Music generation failed:', err);
      toast.error('Music generation failed');
    }
  }, [segments]);

  // Video generation for individual segments via Loop AI
  const handleGenerateVideo = useCallback(async (segmentId: string) => {
    const seg = segments.find(s => s.id === segmentId);
    if (!seg) return;
    toast.info(`🎬 Generating video for ${seg.type === 'speaking' ? 'speaking scene' : 'B-roll'}...`);
    try {
      const { createWaveSpeedVideo, getWaveSpeedVideoJob } = await import('@/lib/wavespeed');
      let taskId: string;
      if (seg.type === 'speaking') {
        if (!seg.character?.referenceImages?.length || !seg.audioUrl) {
          toast.error('Scene needs character images and audio before video can be generated');
          return;
        }
        taskId = await createWaveSpeedVideo({
          prompt: seg.character?.description || 'Person speaking naturally to camera',
          imageUrls: [seg.character.referenceImages[0]],
          audioUrl: seg.audioUrl,
          model: 'infinitetalk',
          aspectRatio: videoFormat === '16:9' ? '16:9' : '9:16',
          duration: seg.duration,
        });
      } else {
        const prompt = seg.brollPrompts?.[0] || 'Cinematic B-roll';
        const imageUrl = seg.brollImages?.[0];
        taskId = await createWaveSpeedVideo({
          prompt,
          imageUrls: imageUrl ? [imageUrl] : undefined,
          model: 'alibaba/wan-2.5/text-to-video',
          aspectRatio: videoFormat === '16:9' ? '16:9' : '9:16',
          duration: seg.duration,
        });
      }
      const poll = async () => {
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const job = await getWaveSpeedVideoJob(taskId);
          if (job.status === 'completed' && job.videoUrl) {
            updateSegment(segmentId, { videoUrl: job.videoUrl, status: 'complete' });
            toast.success(`🎬 Video generated!`);
            return;
          }
          if (job.status === 'failed') {
            toast.error(`Video generation failed: ${job.error || 'Unknown error'}`);
            return;
          }
        }
        toast.error('Video generation timed out');
      };
      poll();
    } catch (err) {
      console.error('Video generation error:', err);
      toast.error('Failed to start video generation');
    }
  }, [segments, updateSegment, videoFormat]);

  const handleExtendClip = useCallback(async (segmentId: string, prompt: string) => {
    const seg = segments.find(s => s.id === segmentId);
    if (!seg?.videoUrl) { toast.error('No video to extend'); return; }
    toast.info('⏭️ Extending video clip...');
    try {
      const { createWaveSpeedVideo, getWaveSpeedVideoJob } = await import('@/lib/wavespeed');
      const taskId = await createWaveSpeedVideo({
        prompt,
        videoUrl: seg.videoUrl,
        model: 'alibaba/wan-2.5/text-to-video',
        aspectRatio: videoFormat === '16:9' ? '16:9' : '9:16',
      });
      const poll = async () => {
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 5000));
          const job = await getWaveSpeedVideoJob(taskId);
          if (job.status === 'completed' && job.videoUrl) {
            updateSegment(segmentId, { videoUrl: job.videoUrl });
            toast.success('⏭️ Video clip extended!');
            return;
          }
          if (job.status === 'failed') {
            toast.error(`Clip extension failed: ${job.error || 'Unknown error'}`);
            return;
          }
        }
        toast.error('Clip extension timed out');
      };
      poll();
    } catch (err) {
      console.error('Clip extension error:', err);
      toast.error('Failed to extend clip');
    }
  }, [segments, updateSegment, videoFormat]);

  // Generate more twin angles for a character
  const handleGenerateTwinAngles = useCallback(async (
    twinId: string, faceDescription: string, gender: string, name: string, referenceImageUrl?: string
  ): Promise<string[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('generate-twin-angles', {
        body: { twinId, faceDescription, gender, name, referenceImageUrl }
      });
      if (error) throw error;
      return data?.generatedUrls || [];
    } catch (err) {
      console.error('Generate twin angles error:', err);
      toast.error('Failed to generate additional angles');
      return [];
    }
  }, []);

  const [isSuggestingScene, setIsSuggestingScene] = useState(false);

  const handleSmartAddScene = useCallback(async (type: 'speaking' | 'broll') => {
    if (segments.length === 0) {
      addSegment(type);
      return;
    }

    setIsSuggestingScene(true);
    try {
      const segmentSummary = segments.map((s, i) => {
        if (s.type === 'speaking') return `Scene ${i+1}: SPEAKING — "${(s.script || '').slice(0, 100)}"`;
        return `Scene ${i+1}: B-ROLL — "${(s.brollPrompts?.[0] || '').slice(0, 100)}"`;
      }).join('\n');

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [{
            role: 'user',
            content: `You are a commercial director. Given this storyboard:\n${segmentSummary}\n\nSuggest ONE new ${type} segment that fits cohesively. Return ONLY valid JSON:\n${type === 'speaking'
              ? '{"script":"TTS-ready script using em dashes and ellipses, never periods","characterDescription":"Vivid actor description","duration":8}'
              : '{"brollPrompts":["Cinematic B-roll description"],"voiceoverText":"Optional narration","duration":5}'}`
          }],
          model: 'google/gemini-2.5-flash',
        }
      });

      if (error) throw error;

      const text = data?.choices?.[0]?.message?.content || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const suggestion = JSON.parse(jsonMatch[0]);
        if (type === 'speaking') {
          addSegment('speaking', {
            script: suggestion.script || '',
            duration: suggestion.duration || 8,
            character: suggestion.characterDescription ? {
              name: suggestion.characterDescription.slice(0, 60),
              description: suggestion.characterDescription,
              referenceImages: [],
            } : undefined,
          });
        } else {
          const brollPrompt = suggestion.brollPrompts?.[0] || '';
          const newSeg = addSegment('broll', {
            brollPrompts: suggestion.brollPrompts || [''],
            voiceoverText: suggestion.voiceoverText || '',
            duration: suggestion.duration || 5,
            status: brollPrompt ? 'generating-character' : 'pending',
          });
          // Auto-generate B-roll preview image
          if (brollPrompt && newSeg) {
            generateBrollPreview(newSeg.id, brollPrompt);
          }
        }
        toast.success(`AI suggested a new ${type === 'speaking' ? 'scene' : 'B-roll'} — edit it to your liking`);
      } else {
        addSegment(type);
      }
    } catch (err) {
      console.error('Smart add failed:', err);
      addSegment(type);
    } finally {
      setIsSuggestingScene(false);
    }
  }, [segments, addSegment]);

  const speakingSegments = segments.filter(s => s.type === 'speaking');
  const brollSegments = segments.filter(s => s.type === 'broll');
  const allApproved = speakingSegments.length > 0 && speakingSegments.every(s => s.status === 'approved' || s.status === 'complete');
  const hasCharacters = speakingSegments.some(s => s.character && s.character.referenceImages.length > 0);

  return (
    <Layout>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Compact Header */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/50 bg-background/95 backdrop-blur shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Clapperboard className="h-4 w-4 text-primary shrink-0" />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-sm font-semibold bg-transparent border-none outline-none flex-1 min-w-0 placeholder:text-muted-foreground/40"
              placeholder="Commercial name..."
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => setChatOpen(!chatOpen)}
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              title={chatOpen ? 'Hide Loop AI' : 'Show Loop AI'}
            >
              {chatOpen ? <PanelLeftClose className="h-3 w-3" /> : <PanelLeftOpen className="h-3 w-3" />}
              <MessageSquare className="h-3 w-3" />
            </Button>
            <Button
              onClick={() => {
                localStorage.removeItem('loop-ai-director-chat');
                setSegments([]);
                setCurrentCommercial(null);
                setName('Untitled Commercial');
                setFinalVideoUrl(null);
                setActiveTab('scenes');
              }}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
            >
              <Film className="h-3 w-3 mr-1" /> New
            </Button>
            <Button
              onClick={() => {
                const demoSegments: CommercialSegment[] = [
                  {
                    id: crypto.randomUUID(),
                    type: 'speaking',
                    script: "I used to spend hours editing videos — late nights, missed deadlines, constant frustration…",
                    character: { name: 'Sarah — Marketing Director', description: 'A confident 30-year-old woman with shoulder-length brown hair, wearing a navy blazer over a white top, warm smile, professional studio background', referenceImages: [] },
                    duration: 6,
                    transition: 'fade-in',
                    status: 'pending',
                  },
                  {
                    id: crypto.randomUUID(),
                    type: 'broll',
                    brollPrompts: ['Frustrated person at a desk surrounded by multiple screens showing complex video editing software, dim office lighting, cinematic close-up of hands on keyboard'],
                    voiceoverText: 'Traditional video editing takes forever — and costs a fortune',
                    duration: 4,
                    transition: 'cut',
                    status: 'pending',
                  },
                  {
                    id: crypto.randomUUID(),
                    type: 'speaking',
                    script: "Then I found this AI tool — and everything changed overnight. One click and my first ad was done in minutes!",
                    character: { name: 'Sarah — Marketing Director', description: 'A confident 30-year-old woman with shoulder-length brown hair, wearing a navy blazer over a white top, excited expression, gesturing with hands, professional studio background', referenceImages: [] },
                    duration: 8,
                    transition: 'cut',
                    status: 'pending',
                  },
                  {
                    id: crypto.randomUUID(),
                    type: 'broll',
                    brollPrompts: ['Sleek modern laptop showing an AI video generation dashboard with colorful progress bars, bright clean workspace, cinematic product shot with soft bokeh background'],
                    voiceoverText: 'Create studio-quality commercials in minutes — not days',
                    duration: 5,
                    transition: 'crossfade',
                    status: 'pending',
                  },
                  {
                    id: crypto.randomUUID(),
                    type: 'speaking',
                    script: "Try it free today — you'll never go back to the old way. Trust me on that!",
                    character: { name: 'Sarah — Marketing Director', description: 'A confident 30-year-old woman with shoulder-length brown hair, wearing a navy blazer over a white top, big genuine smile, leaning slightly forward, professional studio background', referenceImages: [] },
                    duration: 5,
                    transition: 'cut',
                    status: 'pending',
                  },
                ];
                setSegments(demoSegments);
                setName('AI Video Tool — Demo Ad');
                setCurrentCommercial(null);
                setFinalVideoUrl(null);
                setActiveTab('scenes');
                toast.success('Demo commercial loaded! Hit Generate to test.');
              }}
              variant="outline"
              size="sm"
              className="h-7 text-xs"
            >
              <Clapperboard className="h-3 w-3 mr-1" /> Demo
            </Button>
            <SavedCommercialsDrawer
              onLoad={(id) => navigate(`?edit=${id}`)}
              refreshTrigger={currentCommercial}
            />
            <Button onClick={handleSave} variant="outline" size="sm" className="h-7 text-xs">
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
            {finalVideoUrl && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href={finalVideoUrl} download target="_blank" rel="noopener">
                  <Download className="h-3 w-3 mr-1" /> Download
                </a>
              </Button>
            )}
          </div>
        </div>

        {/* Main Split Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Loop AI Director Chat — collapsible */}
          <div
            className={cn(
              'shrink-0 border-r border-border/50 flex flex-col bg-muted/20 transition-all duration-300 overflow-hidden',
              chatOpen ? 'w-[420px]' : 'w-0 border-r-0'
            )}
          >
            {chatOpen && (
              <LoopAIDirector
                onApplyStrategy={handleApplyStrategy}
                onUpdateSegment={updateSegment}
                onAddSegment={addSegment}
                onDeleteSegment={deleteSegment}
                onGenerateCharacter={generateCharacterForSegment}
                onGenerateBrollPreview={generateBrollPreview}
                onSaveToDb={handleSaveToDb}
                onGenerateMusic={handleGenerateMusic}
                onGenerateVideo={handleGenerateVideo}
                onExtendClip={handleExtendClip}
                onDuplicateSegment={duplicateSegment}
                onReorderSegments={reorderSegments}
                onGenerateTwinAngles={handleGenerateTwinAngles}
                segments={segments}
                targetDuration={targetDuration}
                onTargetDurationChange={setTargetDuration}
                focusedSegmentId={focusedSegmentId}
                onClearFocusedSegment={() => setFocusedSegmentId(null)}
              />
            )}
          </div>

          {/* Right: Preview & Production Panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Timeline Preview + Fullscreen */}
            {segments.length > 0 && (
              <div className="px-4 py-3 border-b border-border/50 bg-background/50 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Film className="h-3 w-3" /> {segments.length} segments</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {segments.reduce((s, seg) => s + seg.duration, 0)}s total</span>
                    <span>~{Math.ceil(segments.length * 1.5)} min to generate</span>
                  </div>
                  <Button
                    onClick={() => setPreviewOpen(true)}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                  >
                    <Eye className="h-3 w-3" /> Fullscreen Preview
                  </Button>
                </div>
                <TimelinePreview segments={segments} onReorder={reorderSegments} onSelectSegment={handleTimelineSelectSegment} />
              </div>
            )}

            {/* Tabs */}
            <div className="flex-1 overflow-auto p-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className={cn("w-full mb-4", finalVideoUrl ? "grid grid-cols-4" : "grid grid-cols-3")}>
                  <TabsTrigger value="scenes" className="gap-1 text-xs">
                    <Film className="h-3 w-3" /> Scenes ({speakingSegments.length})
                  </TabsTrigger>
                  <TabsTrigger value="broll" className="gap-1 text-xs">
                    <Image className="h-3 w-3" /> B-Roll ({brollSegments.length})
                  </TabsTrigger>
                  {finalVideoUrl && (
                    <TabsTrigger value="final-cut" className="gap-1 text-xs">
                      <Tv className="h-3 w-3" /> Final Cut
                    </TabsTrigger>
                  )}
                  <TabsTrigger value="saved" className="gap-1 text-xs">
                    <Video className="h-3 w-3" /> Saved ({savedCommercials.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="scenes">
                  <SegmentTimeline
                    segments={speakingSegments}
                    onUpdate={updateSegment}
                    onDelete={deleteSegment}
                    onDuplicate={duplicateSegment}
                    onAdd={() => handleSmartAddScene('speaking')}
                    onReorder={reorderSegments}
                    onGenerateCharacter={generateCharacterForSegment}
                    segmentFilter="speaking"
                    isAddingScene={isSuggestingScene}
                  />
                </TabsContent>

                <TabsContent value="broll">
                  <SegmentTimeline
                    segments={brollSegments}
                    onUpdate={updateSegment}
                    onDelete={deleteSegment}
                    onDuplicate={duplicateSegment}
                    onAdd={() => handleSmartAddScene('broll')}
                    onReorder={reorderSegments}
                    segmentFilter="broll"
                    isAddingScene={isSuggestingScene}
                  />
                </TabsContent>

                {finalVideoUrl && (
                  <TabsContent value="final-cut">
                    <div className="space-y-6">
                      {/* Large Video Player */}
                      <div className="rounded-xl overflow-hidden border border-border bg-black">
                        <video
                          src={finalVideoUrl}
                          controls
                          autoPlay={activeTab === 'final-cut'}
                          className="w-full max-h-[60vh]"
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button variant="default" size="sm" className="gap-1.5" asChild>
                          <a href={finalVideoUrl} download target="_blank" rel="noopener">
                            <Download className="h-3.5 w-3.5" /> Download MP4
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            navigator.clipboard.writeText(finalVideoUrl);
                            toast.success('Video URL copied to clipboard');
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" /> Copy Link
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => window.open(finalVideoUrl, '_blank')}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={handleGenerate}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Regenerate
                        </Button>
                      </div>

                      {/* Per-Segment Clips */}
                      {segments.some(s => s.videoUrl) && (
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Film className="h-4 w-4 text-primary" /> Individual Clips
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                            {segments.filter(s => s.videoUrl).map((seg, i) => (
                              <div key={seg.id} className="rounded-lg border border-border overflow-hidden bg-muted/30">
                                <video src={seg.videoUrl} controls className="w-full aspect-video" />
                                <div className="p-2">
                                  <p className="text-xs font-medium truncate">
                                    {seg.type === 'speaking' ? `Scene ${i + 1}` : `B-Roll ${i + 1}`}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {seg.script?.slice(0, 60) || seg.brollPrompts?.[0]?.slice(0, 60) || ''}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="saved">
                  {savedCommercials.length === 0 ? (
                    <div className="text-center py-8 text-sm text-muted-foreground">No saved commercials</div>
                  ) : (
                    <div className="space-y-2">
                      {savedCommercials.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <button className="flex-1 text-left" onClick={() => navigate(`?edit=${c.id}`)}>
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground">{c.segments?.length || 0} segments</p>
                          </button>
                          <div className="flex gap-1">
                            {c.video_url && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <a href={c.video_url} target="_blank" rel="noopener"><Download className="h-3 w-3" /></a>
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Bottom Generation Bar */}
            <div className="px-4 py-3 border-t border-border/50 bg-background/95 shrink-0">
              {isGenerating ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs font-medium">Generating commercial...</span>
                    <span className="text-xs text-muted-foreground ml-auto">{Math.round(generationProgress)}%</span>
                  </div>
                  <Progress value={generationProgress} className="h-1.5" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Format & Style selectors */}
                  <div className="flex gap-2">
                    <Select value={videoFormat} onValueChange={(v) => setVideoFormat(v as VideoFormat)}>
                      <SelectTrigger className="h-7 text-xs w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9:16"><div className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> 9:16</div></SelectItem>
                        <SelectItem value="16:9"><div className="flex items-center gap-1"><Monitor className="h-3 w-3" /> 16:9</div></SelectItem>
                        <SelectItem value="1:1">1:1 Square</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={videoStyle} onValueChange={(v) => setVideoStyle(v as VideoStyle)}>
                      <SelectTrigger className="h-7 text-xs flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tiktok-meme">🎭 TikTok Meme</SelectItem>
                        <SelectItem value="tiktok-talking-head">🗣️ TikTok Talking Head</SelectItem>
                        <SelectItem value="instagram-reel">📱 Instagram Reel</SelectItem>
                        <SelectItem value="youtube-ad">📺 YouTube Ad</SelectItem>
                        <SelectItem value="professional-ad">🎬 Professional Ad</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    {segments.length > 0 && (
                      <Button onClick={() => setPreviewOpen(true)} variant="outline" size="sm" className="gap-1 text-xs">
                        <Eye className="h-3 w-3" /> Preview
                      </Button>
                    )}
                    {hasCharacters && !allApproved && (
                      <Button onClick={approveAllSegments} variant="outline" size="sm" className="gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" /> Approve All
                      </Button>
                    )}
                    <Button
                      onClick={handleGenerate}
                      disabled={segments.length === 0}
                      className="flex-1 gap-2"
                      size="sm"
                    >
                      <Play className="h-3 w-3" /> Generate Commercial
                    </Button>
                  </div>
                </div>
              )}

              {finalVideoUrl && !isGenerating && (
                <div className="mt-2">
                  <Button
                    onClick={() => setActiveTab('final-cut')}
                    variant="ai"
                    size="sm"
                    className="w-full gap-2"
                  >
                    <Tv className="h-4 w-4" /> Watch Final Cut
                  </Button>
                </div>
              )}

              {musicUrl && (
                <div className="mt-2 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                  <Music className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground">Background Music</span>
                  <audio src={musicUrl} controls className="h-7 flex-1" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <StoryboardPreview
        segments={segments}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        commercialName={name}
      />
    </Layout>
  );
}
