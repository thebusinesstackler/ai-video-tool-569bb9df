import React, { useState, useEffect } from 'react';
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
import { createWaveSpeedVideo, getWaveSpeedVideoJob } from '@/lib/wavespeed';
import {
  Globe, Sparkles, Play, Clock, Film, Music, Mic, Loader2, CheckCircle2,
  ArrowRight, RefreshCw, ChevronRight, Wand2, AlertCircle, Video, FileText, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAITwins } from '@/hooks/useAITwins';
import { isSpeechifyVoiceId } from '@/lib/voiceUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';

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
type StageStatus = 'queued' | 'in_progress' | 'done' | 'failed' | 'partial';

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
  const [editedProductType, setEditedProductType] = useState('');
  const [selectedVideoTypes, setSelectedVideoTypes] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [conceptCount, setConceptCount] = useState(3);
  const [concepts, setConcepts] = useState<VideoConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<number | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [productionStatus, setProductionStatus] = useState<Record<string, StageStatus>>({ scenes: 'queued', voiceover: 'queued', music: 'queued', video: 'queued' });
  const [productionErrors, setProductionErrors] = useState<Record<string, string>>({});
  const [completedScenes, setCompletedScenes] = useState<any[]>([]);
  const [completedVoiceover, setCompletedVoiceover] = useState<string | null>(null);
  const [completedMusic, setCompletedMusic] = useState<string | null>(null);
  const [completedVideoUrl, setCompletedVideoUrl] = useState<string | null>(null);
  const [assemblingVideo, setAssemblingVideo] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const { twins } = useAITwins();
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const selectedTwin = selectedTwinId ? twins.find(t => t.id === selectedTwinId) || null : null;

  // Auto-select the first twin that has a cloned voice
  useEffect(() => {
    if (selectedTwinId || !twins.length) return;
    const withVoice = twins.find(t => !!t.voice_cloning_key);
    if (withVoice) setSelectedTwinId(withVoice.id);
  }, [twins, selectedTwinId]);

  // Load existing drafts on mount
  useEffect(() => {
    if (!user) return;
    const loadDrafts = async () => {
      setLoadingDrafts(true);
      try {
        const { data } = await (supabase.from('lifestyle_stories' as any) as any)
          .select('id, title, brand_url, brand_analysis, concepts, selected_concept_index, duration, scenes, status, updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(10);
        setDrafts(data || []);
      } catch (err) {
        console.error('Failed to load drafts:', err);
      } finally {
        setLoadingDrafts(false);
      }
    };
    loadDrafts();
  }, [user]);

  const resumeDraft = (draft: any) => {
    setStoryId(draft.id);
    setUrl(draft.brand_url || '');
    const analysis = draft.brand_analysis as BrandAnalysis;
    setBrandAnalysis(analysis);
    setEditedProductType(analysis?.product_type || '');
    if (draft.duration) setDuration(draft.duration);

    if (draft.concepts && (draft.concepts as any[]).length > 0) {
      setConcepts(draft.concepts as VideoConcept[]);
      setStep('concepts');
    } else {
      setStep('analysis');
    }
    toast({ title: 'Draft loaded', description: `Resuming "${draft.title || 'Untitled'}"` });
  };

  const deleteDraft = async (draftId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await (supabase.from('lifestyle_stories' as any) as any).delete().eq('id', draftId);
    setDrafts(prev => prev.filter(d => d.id !== draftId));
    toast({ title: 'Draft deleted' });
  };

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
      setEditedProductType(data.analysis.product_type || '');
      setStep('analysis');
      toast({ title: 'Brand Analyzed!', description: `Found insights for ${data.analysis.brand_name}` });

      // Save as draft
      if (user) {
        const { data: draftRecord } = await (supabase.from('lifestyle_stories' as any) as any).insert({
          user_id: user.id,
          brand_url: url.trim(),
          brand_analysis: data.analysis,
          title: data.analysis.brand_name,
          status: 'draft',
        }).select('id').single();
        if (draftRecord?.id) {
          setStoryId(draftRecord.id);
          setDrafts(prev => [{ ...draftRecord, title: data.analysis.brand_name, brand_url: url.trim(), brand_analysis: data.analysis, concepts: [], status: 'draft', updated_at: new Date().toISOString() }, ...prev]);
        }
      }
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
      // Use edited product type
      const adjustedAnalysis = { ...brandAnalysis, product_type: editedProductType };
      const { data, error } = await supabase.functions.invoke('generate-lifestyle-concepts', {
        body: {
          brandAnalysis: adjustedAnalysis,
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

      // Update draft with concepts
      if (storyId) {
        await (supabase.from('lifestyle_stories' as any) as any).update({
          concepts: data.concepts,
          duration,
        }).eq('id', storyId);
      }
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
    setProductionStatus({ scenes: 'in_progress', voiceover: 'queued', music: 'queued', video: 'queued' });
    setProductionErrors({});
    setCompletedScenes([]);
    setCompletedVoiceover(null);
    setCompletedMusic(null);
    setCompletedVideoUrl(null);

    try {
      // Update existing draft or create new record
      let currentStoryId = storyId;
      if (currentStoryId) {
        await (supabase.from('lifestyle_stories' as any) as any).update({
          selected_concept_index: index,
          scenes: concept.scenes,
          title: concept.title,
          status: 'generating',
        }).eq('id', currentStoryId);
      } else {
        const { data: storyRecord } = await (supabase.from('lifestyle_stories' as any) as any).insert({
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
        currentStoryId = storyRecord?.id || null;
        if (currentStoryId) setStoryId(currentStoryId);
      }

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

      const successfulScenes = sceneResults.filter(s => s.image_url);
      if (successfulScenes.length === 0) {
        setProductionStatus(prev => ({ ...prev, scenes: 'failed' }));
        setProductionErrors(prev => ({ ...prev, scenes: 'All scene images failed to generate' }));
      } else if (successfulScenes.length < concept.scenes.length) {
        setProductionStatus(prev => ({ ...prev, scenes: 'partial' }));
        setProductionErrors(prev => ({ ...prev, scenes: `${successfulScenes.length}/${concept.scenes.length} scenes generated` }));
      } else {
        setProductionStatus(prev => ({ ...prev, scenes: 'done' }));
      }
      setCompletedScenes(sceneResults);

      // Generate voiceover
      setProductionStatus(prev => ({ ...prev, voiceover: 'in_progress' }));
      let voiceoverUrl: string | null = null;
      try {
        // Prefer the selected AI Twin's cloned voice (same routing as MovieSceneCreator).
        // Fall back to auto-matched Speechify voice when no twin clone is available.
        const twinKey = selectedTwin?.voice_cloning_key || null;
        const twinIsSpeechify = isSpeechifyVoiceId(twinKey);
        let speechifyVoiceId: string | undefined = twinIsSpeechify ? twinKey! : undefined;
        const voiceCloningKey: string | undefined = twinKey && !twinIsSpeechify ? twinKey : undefined;

        if (!speechifyVoiceId && !voiceCloningKey) {
          try {
            const { data: matchData } = await supabase.functions.invoke('match-speechify-voice', {
              body: {
                characterDescription: `Brand: ${brandAnalysis?.brand_name || ''}. Audience: ${brandAnalysis?.target_audience || ''}. Visual style: ${brandAnalysis?.visual_style || ''}. Concept: ${concept.type} — ${concept.hook}`,
                tone: brandAnalysis?.brand_tone || concept.music_mood,
                scriptSample: concept.voiceover_script,
              },
            });
            speechifyVoiceId = matchData?.voiceId;
            if (speechifyVoiceId) {
              console.log(`🎙️ Lifestyle voice matched: ${matchData.displayName} — ${matchData.reasoning}`);
            }
          } catch (e) {
            console.warn('Speechify voice match failed, using default:', e);
          }
        } else {
          console.log(`🎙️ Using AI Twin cloned voice (${twinIsSpeechify ? 'Speechify' : 'Google'}): ${selectedTwin?.name}`);
        }

        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
          body: {
            text: concept.voiceover_script,
            voice: speechifyVoiceId || voiceCloningKey ? 'cloned' : 'alloy',
            speechifyVoiceId,
            voiceCloningKey,
            gender: selectedTwin?.gender || undefined,
          },
        });
        if (ttsError) throw ttsError;
        voiceoverUrl = ttsData?.audioUrl || null;
        if (!voiceoverUrl) throw new Error('No audio URL returned');
        setProductionStatus(prev => ({ ...prev, voiceover: 'done' }));
      } catch (err: any) {
        console.error('Voiceover generation failed:', err);
        setProductionStatus(prev => ({ ...prev, voiceover: 'failed' }));
        setProductionErrors(prev => ({ ...prev, voiceover: err.message || 'Voiceover failed' }));
      }
      setCompletedVoiceover(voiceoverUrl);

      // Generate background music — pass mood not prompt
      setProductionStatus(prev => ({ ...prev, music: 'in_progress' }));
      let musicUrl: string | null = null;
      try {
        const { data: musicData, error: musicError } = await supabase.functions.invoke('generate-music', {
          body: {
            mood: `${concept.music_mood} background music for a ${concept.type} video`,
            duration,
          },
        });
        if (musicError) throw musicError;
        musicUrl = musicData?.audioUrl || null;
        if (!musicUrl) throw new Error('No music URL returned');
        setProductionStatus(prev => ({ ...prev, music: 'done' }));
      } catch (err: any) {
        console.error('Music generation failed:', err);
        setProductionStatus(prev => ({ ...prev, music: 'failed' }));
        setProductionErrors(prev => ({ ...prev, music: err.message || 'Music generation failed' }));
      }
      setCompletedMusic(musicUrl);

      // Update DB record
      if (currentStoryId) {
        await supabase.from('lifestyle_stories' as any).update({
          scenes: sceneResults,
          voiceover_url: voiceoverUrl,
          music_url: musicUrl,
          status: successfulScenes.length > 0 ? 'assets_ready' : 'failed',
        }).eq('id', currentStoryId);
      }

      // Auto-proceed to video assembly if we have scenes
      if (successfulScenes.length > 0) {
        toast({ title: 'Assets ready — assembling video…' });
        setProductionStatus(prev => ({ ...prev, video: 'in_progress' }));
        setAssemblingVideo(true);

        try {
          const videoClips: string[] = [];
          for (const scene of successfulScenes) {
            try {
              const taskId = await createWaveSpeedVideo({
                prompt: scene.visual_prompt,
                imageUrls: [scene.image_url],
                model: 'wan-2.5-i2v',
                aspectRatio: '16:9',
                duration: Math.min(scene.duration_seconds || 5, 10),
                userId: user.id,
                source: 'lifestyle',
              });

              let job = await getWaveSpeedVideoJob(taskId);
              let attempts = 0;
              while (job.status !== 'completed' && job.status !== 'failed' && attempts < 60) {
                await new Promise(r => setTimeout(r, 5000));
                job = await getWaveSpeedVideoJob(taskId);
                attempts++;
              }

              if (job.status === 'completed' && job.videoUrl) {
                videoClips.push(job.videoUrl);
              } else {
                console.error(`Scene ${scene.scene_number} video failed:`, job.error);
              }
            } catch (err) {
              console.error(`Scene ${scene.scene_number} video error:`, err);
            }
          }

          if (videoClips.length === 0) throw new Error('No video clips were generated');

          const audioTracks: string[] = [];
          if (voiceoverUrl) audioTracks.push(voiceoverUrl);
          if (musicUrl) audioTracks.push(musicUrl);

          const { data: stitchData, error: stitchError } = await supabase.functions.invoke('creatomate-stitch', {
            body: {
              clips: videoClips.map((clipUrl, idx) => ({
                url: clipUrl,
                duration: successfulScenes[idx]?.duration_seconds || 5,
              })),
              audioUrls: audioTracks,
              aspectRatio: '16:9',
            },
          });

          if (stitchError) throw stitchError;
          const finalVideoUrl = stitchData?.videoUrl || stitchData?.url || null;
          if (!finalVideoUrl) throw new Error('No video URL returned from stitching');

          setCompletedVideoUrl(finalVideoUrl);
          setProductionStatus(prev => ({ ...prev, video: 'done' }));

          if (currentStoryId) {
            await supabase.from('lifestyle_stories' as any).update({
              video_url: finalVideoUrl,
              status: 'completed',
            }).eq('id', currentStoryId);
          }

          toast({ title: 'Video complete!', description: 'Your lifestyle story video is ready to view.' });
        } catch (videoErr: any) {
          console.error('Video assembly failed:', videoErr);
          setProductionStatus(prev => ({ ...prev, video: 'failed' }));
          setProductionErrors(prev => ({ ...prev, video: videoErr.message || 'Video assembly failed' }));
          toast({ title: 'Video assembly failed', description: videoErr.message, variant: 'destructive' });
        } finally {
          setAssemblingVideo(false);
        }
      } else {
        toast({
          title: 'Production Failed',
          description: 'No scene images could be generated.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      const friendly = getFriendlyError(err);
      toast({ title: friendly.title, description: friendly.description, variant: 'destructive' });
    } finally {
      setGeneratingVideo(false);
    }
  };

  const retryStage = async (stage: string) => {
    if (!selectedConcept || !concepts[selectedConcept]) return;
    const concept = concepts[selectedConcept];

    if (stage === 'music') {
      setProductionStatus(prev => ({ ...prev, music: 'in_progress' }));
      setProductionErrors(prev => { const n = { ...prev }; delete n.music; return n; });
      try {
        const { data: musicData, error: musicError } = await supabase.functions.invoke('generate-music', {
          body: {
            mood: `${concept.music_mood} background music for a ${concept.type} video`,
            duration,
          },
        });
        if (musicError) throw musicError;
        const musicUrl = musicData?.audioUrl || null;
        if (!musicUrl) throw new Error('No music URL returned');
        setCompletedMusic(musicUrl);
        setProductionStatus(prev => ({ ...prev, music: 'done' }));
        toast({ title: 'Music generated!' });
      } catch (err: any) {
        setProductionStatus(prev => ({ ...prev, music: 'failed' }));
        setProductionErrors(prev => ({ ...prev, music: err.message || 'Music generation failed' }));
      }
    }

    if (stage === 'voiceover') {
      setProductionStatus(prev => ({ ...prev, voiceover: 'in_progress' }));
      setProductionErrors(prev => { const n = { ...prev }; delete n.voiceover; return n; });
      try {
        const twinKey = selectedTwin?.voice_cloning_key || null;
        const twinIsSpeechify = isSpeechifyVoiceId(twinKey);
        let speechifyVoiceId: string | undefined = twinIsSpeechify ? twinKey! : undefined;
        const voiceCloningKey: string | undefined = twinKey && !twinIsSpeechify ? twinKey : undefined;

        if (!speechifyVoiceId && !voiceCloningKey) {
          try {
            const { data: matchData } = await supabase.functions.invoke('match-speechify-voice', {
              body: {
                characterDescription: `Brand: ${brandAnalysis?.brand_name || ''}. Audience: ${brandAnalysis?.target_audience || ''}. Visual style: ${brandAnalysis?.visual_style || ''}. Concept: ${concept.type} — ${concept.hook}`,
                tone: brandAnalysis?.brand_tone || concept.music_mood,
                scriptSample: concept.voiceover_script,
              },
            });
            speechifyVoiceId = matchData?.voiceId;
          } catch (e) {
            console.warn('Speechify voice match failed:', e);
          }
        }

        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
          body: {
            text: concept.voiceover_script,
            voice: speechifyVoiceId || voiceCloningKey ? 'cloned' : 'alloy',
            speechifyVoiceId,
            voiceCloningKey,
            gender: selectedTwin?.gender || undefined,
          },
        });
        if (ttsError) throw ttsError;
        const voiceoverUrl = ttsData?.audioUrl || null;
        if (!voiceoverUrl) throw new Error('No audio URL returned');
        setCompletedVoiceover(voiceoverUrl);
        setProductionStatus(prev => ({ ...prev, voiceover: 'done' }));
        toast({ title: 'Voiceover generated!' });
      } catch (err: any) {
        setProductionStatus(prev => ({ ...prev, voiceover: 'failed' }));
        setProductionErrors(prev => ({ ...prev, voiceover: err.message || 'Voiceover failed' }));
      }
    }
  };

  const assembleVideo = async () => {
    if (!user || selectedConcept === null) return;
    const concept = concepts[selectedConcept];
    const scenesWithImages = completedScenes.filter(s => s.image_url);
    if (scenesWithImages.length === 0) {
      toast({ title: 'No scenes available', description: 'Generate scene images first.', variant: 'destructive' });
      return;
    }

    setAssemblingVideo(true);
    setProductionStatus(prev => ({ ...prev, video: 'in_progress' }));
    setProductionErrors(prev => { const n = { ...prev }; delete n.video; return n; });

    try {
      // Animate each scene image into a video clip
      const videoClips: string[] = [];
      for (const scene of scenesWithImages) {
        try {
          const taskId = await createWaveSpeedVideo({
            prompt: scene.visual_prompt,
            imageUrls: [scene.image_url],
            model: 'wan-2.5-i2v',
            aspectRatio: '16:9',
            duration: Math.min(scene.duration_seconds || 5, 10),
            userId: user.id,
            source: 'lifestyle',
          });

          // Poll for completion
          let job = await getWaveSpeedVideoJob(taskId);
          let attempts = 0;
          while (job.status !== 'completed' && job.status !== 'failed' && attempts < 60) {
            await new Promise(r => setTimeout(r, 5000));
            job = await getWaveSpeedVideoJob(taskId);
            attempts++;
          }

          if (job.status === 'completed' && job.videoUrl) {
            videoClips.push(job.videoUrl);
          } else {
            console.error(`Scene ${scene.scene_number} video failed:`, job.error);
          }
        } catch (err) {
          console.error(`Scene ${scene.scene_number} video error:`, err);
        }
      }

      if (videoClips.length === 0) {
        throw new Error('No video clips were generated');
      }

      // Stitch clips together with audio
      const audioTracks: string[] = [];
      if (completedVoiceover) audioTracks.push(completedVoiceover);
      if (completedMusic) audioTracks.push(completedMusic);

      const { data: stitchData, error: stitchError } = await supabase.functions.invoke('creatomate-stitch', {
        body: {
          clips: videoClips.map((url, i) => ({
            url,
            duration: scenesWithImages[i]?.duration_seconds || 5,
          })),
          audioUrls: audioTracks,
          aspectRatio: '16:9',
        },
      });

      if (stitchError) throw stitchError;
      const finalVideoUrl = stitchData?.videoUrl || stitchData?.url || null;
      if (!finalVideoUrl) throw new Error('No video URL returned from stitching');

      setCompletedVideoUrl(finalVideoUrl);
      setProductionStatus(prev => ({ ...prev, video: 'done' }));
      toast({ title: 'Video assembled!', description: 'Your lifestyle story video is ready.' });
    } catch (err: any) {
      console.error('Video assembly failed:', err);
      setProductionStatus(prev => ({ ...prev, video: 'failed' }));
      setProductionErrors(prev => ({ ...prev, video: err.message || 'Video assembly failed' }));
      toast({ title: 'Video assembly failed', description: err.message, variant: 'destructive' });
    } finally {
      setAssemblingVideo(false);
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

  const getStageIcon = (status: StageStatus, FallbackIcon: any) => {
    if (status === 'in_progress') return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    if (status === 'done') return <CheckCircle2 className="w-4 h-4 text-primary" />;
    if (status === 'failed') return <AlertCircle className="w-4 h-4 text-destructive" />;
    if (status === 'partial') return <AlertCircle className="w-4 h-4 text-amber-500" />;
    return <FallbackIcon className="w-4 h-4 text-muted-foreground" />;
  };

  const getStageLabel = (status: StageStatus, errorMsg?: string) => {
    if (status === 'in_progress') return 'In progress';
    if (status === 'done') return 'Done';
    if (status === 'failed') return errorMsg || 'Failed';
    if (status === 'partial') return errorMsg || 'Partial';
    return 'Queued';
  };

  const allDone = !generatingVideo && completedScenes.length > 0;
  const hasAnyFailure = Object.values(productionStatus).some(s => s === 'failed' || s === 'partial');
  const scenesReady = completedScenes.filter(s => s.image_url).length > 0;

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
          <>
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

          {/* Multi-speaker conversation builder */}
          <ConversationBuilder aspectRatio="9:16" source="lifestyle-stories" />

          {/* Saved Drafts */}
          {drafts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Recent Drafts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {drafts.map(draft => (
                    <button
                      key={draft.id}
                      onClick={() => resumeDraft(draft)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-accent/50 transition-colors text-left"
                    >
                      <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{draft.title || 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground truncate">{draft.brand_url}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {draft.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDistanceToNow(new Date(draft.updated_at), { addSuffix: true })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={(e) => deleteDraft(draft.id, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          </>
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
                    { label: 'Brand Tone', value: brandAnalysis.brand_tone, editable: false },
                    { label: 'Target Audience', value: brandAnalysis.target_audience, editable: false },
                    { label: 'Visual Style', value: brandAnalysis.visual_style, editable: false },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{item.label}</p>
                      <p className="text-sm font-medium capitalize">{item.value}</p>
                    </div>
                  ))}
                  {/* Editable Product Type */}
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Product Type (editable)</p>
                    <Input
                      value={editedProductType}
                      onChange={(e) => setEditedProductType(e.target.value)}
                      placeholder="e.g. skincare serum, running shoes..."
                      className="h-8 text-sm"
                    />
                  </div>
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
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xl font-semibold">Video Concepts</h2>
              <div className="flex items-center gap-2">
                {twins.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-muted-foreground" />
                    <Select value={selectedTwinId ?? 'none'} onValueChange={(v) => setSelectedTwinId(v === 'none' ? null : v)}>
                      <SelectTrigger className="w-[220px] h-9">
                        <SelectValue placeholder="Voice: Auto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Auto-matched voice</SelectItem>
                        {twins.map(t => (
                          <SelectItem key={t.id} value={t.id} disabled={!t.voice_cloning_key}>
                            {t.name}{t.voice_cloning_key ? ` (${isSpeechifyVoiceId(t.voice_cloning_key) ? 'Speechify' : 'Google'} clone)` : ' (no voice)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setStep('analysis')}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
                </Button>
              </div>
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

                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          <Mic className="w-3 h-3" /> Voiceover Script
                        </p>
                        <p className="text-sm">{concept.voiceover_script}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Music mood:</span>
                        <Badge variant="outline">{concept.music_mood}</Badge>
                      </div>

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
                    Generating assets… Each scene image, voiceover, and music track will be created.
                  </p>
                </div>
              ) : hasAnyFailure ? (
                <div className="flex items-center gap-3 p-6 rounded-lg bg-destructive/10 justify-center">
                  <AlertCircle className="w-6 h-6 text-destructive" />
                  <p className="text-sm font-medium text-destructive">Some stages failed. Use the retry buttons below.</p>
                </div>
              ) : allDone && !completedVideoUrl ? (
                <div className="flex items-center gap-3 p-6 rounded-lg bg-primary/10 justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <p className="text-sm font-medium">Assets ready! Generate the final video below.</p>
                </div>
              ) : completedVideoUrl ? (
                <div className="flex items-center gap-3 p-6 rounded-lg bg-primary/10 justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                  <p className="text-sm font-medium">Video complete!</p>
                </div>
              ) : null}

              {/* Stage cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  { icon: Film, label: 'Scenes', key: 'scenes' },
                  { icon: Mic, label: 'Voiceover', key: 'voiceover' },
                  { icon: Music, label: 'Music', key: 'music' },
                  { icon: Video, label: 'Video', key: 'video' },
                ].map(item => (
                  <div key={item.key} className="flex items-center gap-2 p-3 rounded-lg border border-border">
                    {getStageIcon(productionStatus[item.key] as StageStatus, item.icon)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className={cn(
                        "text-xs truncate",
                        productionStatus[item.key] === 'failed' ? 'text-destructive' :
                        productionStatus[item.key] === 'partial' ? 'text-amber-500' :
                        'text-muted-foreground'
                      )}>
                        {getStageLabel(productionStatus[item.key] as StageStatus, productionErrors[item.key])}
                      </p>
                    </div>
                    {(productionStatus[item.key] === 'failed') && (item.key === 'music' || item.key === 'voiceover') && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => retryStage(item.key)}>
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
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
                            <AlertCircle className="w-5 h-5 text-destructive" />
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

              {/* Generate Video Button */}
              {!generatingVideo && scenesReady && !completedVideoUrl && productionStatus.video !== 'in_progress' && (
                <Button
                  onClick={assembleVideo}
                  disabled={assemblingVideo}
                  className="w-full"
                  size="lg"
                >
                  {assemblingVideo ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Video className="w-4 h-4 mr-2" />
                  )}
                  {assemblingVideo ? 'Assembling Video…' : 'Generate Video'}
                </Button>
              )}

              {/* Final video player */}
              {completedVideoUrl && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Final Video</p>
                  <video src={completedVideoUrl} controls className="w-full rounded-lg" />
                </div>
              )}

              {!generatingVideo && !assemblingVideo && (
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
