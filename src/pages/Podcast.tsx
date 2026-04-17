import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { VideoPlayer } from '@/components/VideoPlayer';
import { PodcastAIDirector } from '@/components/PodcastAIDirector';
import { Mic, Loader2, Play, Download, User, Clock, RotateCcw, Sparkles, Wand2, Check } from 'lucide-react';
import type { AITwin } from '@/types/aiTwin';

interface ScriptVariation {
  id: string;
  styleLabel: string;   // e.g. "Educational"
  settingLabel: string; // e.g. "Home office"
  hook: string;         // 1-line teaser
  narration: string;    // full script
  visualDescription: string; // setting/wardrobe/lighting prompt
}

const DURATION_OPTIONS = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '90', label: '1.5 minutes' },
  { value: '120', label: '2 minutes' },
  { value: '180', label: '3 minutes' },
];

const Podcast = () => {
  const { toast } = useToast();
  const { user } = useAuth();

  // State
  const [twins, setTwins] = useState<AITwin[]>([]);
  const [loadingTwins, setLoadingTwins] = useState(true);
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState('60');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // 4-variation flow
  const [variations, setVariations] = useState<ScriptVariation[]>([]);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);

  const selectedTwin = twins.find(t => t.id === selectedTwinId);

  // Auto-estimate duration from word count
  useEffect(() => {
    if (!message.trim()) return;
    const words = message.trim().split(/\s+/).length;
    const estimatedSeconds = Math.round(words / 2.5);
    const closest = DURATION_OPTIONS.reduce((best, opt) => {
      const diff = Math.abs(parseInt(opt.value) - estimatedSeconds);
      return diff < Math.abs(parseInt(best.value) - estimatedSeconds) ? opt : best;
    });
    setDuration(closest.value);
  }, [message]);

  // Load twins
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('get_twins_summary', { _user_id: user.id });
        if (error) throw error;
        const mapped: AITwin[] = (data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          reference_images: t.first_image ? [t.first_image] : [],
          voice_cloning_key: t.voice_cloning_key,
          voice_sample_url: t.voice_sample_url,
          face_description: t.face_description,
          gender: t.gender,
          voice_engine: (t.voice_engine || 'speechify') as AITwin['voice_engine'],
          google_voice_id: t.google_voice_id,
        }));
        setTwins(mapped);
      } catch (err) {
        console.error('Failed to load twins:', err);
      } finally {
        setLoadingTwins(false);
      }
    })();
  }, [user?.id]);

  // Build TTS body
  const buildTtsBody = (text: string, twin: AITwin) => {
    const body: Record<string, any> = { text, speakingRate: 0.92 };
    if (twin.voice_cloning_key) {
      body.voiceCloningKey = twin.voice_cloning_key;
      return body;
    }
    const isFemale = twin.gender?.toLowerCase() === 'female';
    body.voice = isFemale ? 'English_compelling_lady1' : 'English_magnetic_voiced_man';
    body.gender = twin.gender || 'male';
    return body;
  };

  // Helper: TTS
  const generateTTS = async (text: string, twin: AITwin, label: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('text-to-speech', {
      body: buildTtsBody(text, twin)
    });
    if (error) throw error;
    if (!data?.audioContent) throw new Error('No audio generated');

    if (!user) return `data:audio/mp3;base64,${data.audioContent}`;
    const bytes = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
    const fileName = `${user.id}/podcast/${Date.now()}-${label}.mp3`;
    const { data: upload, error: uploadErr } = await supabase.storage
      .from('reels').upload(fileName, bytes, { contentType: 'audio/mp3' });
    if (!uploadErr && upload) {
      const { data: pub } = supabase.storage.from('reels').getPublicUrl(fileName);
      return pub.publicUrl;
    }
    return `data:audio/mp3;base64,${data.audioContent}`;
  };

  // Helper: generate scene image
  const generateSceneImage = async (prompt: string, twin: AITwin): Promise<string> => {
    const portrait = twin.reference_images[0];
    const { data: { session } } = await supabase.auth.getSession();
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: portrait } },
            { type: 'text', text: `This is the reference photo. Generate a NEW image of this EXACT same person.\n\n${prompt}` }
          ]
        }],
        model: 'google/gemini-3.1-flash-image-preview',
        modalities: ['image', 'text']
      })
    });
    if (!res.ok) return portrait;
    const imgData = await res.json();
    const imgUrl = imgData.imageUrl || imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imgUrl) return portrait;

    if (imgUrl.startsWith('data:') && user) {
      try {
        const matches = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const imgBytes = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0));
          const fn = `${user.id}/podcast/${Date.now()}-scene.png`;
          const { data: up, error: upErr } = await supabase.storage
            .from('reels').upload(fn, imgBytes, { contentType: matches[1], upsert: true });
          if (!upErr && up) {
            const { data: pub } = supabase.storage.from('reels').getPublicUrl(fn);
            return pub.publicUrl;
          }
        }
      } catch {}
    }
    return imgUrl.startsWith('data:') ? portrait : imgUrl;
  };

  // Helper: poll task
  const pollTask = async (taskId: string, max = 120): Promise<string> => {
    let attempts = 0;
    while (attempts < max) {
      attempts++;
      await new Promise(r => setTimeout(r, 3000));
      const { data } = await supabase.functions.invoke('wavespeed-video', {
        body: { action: 'status', taskId }
      });
      if (data?.status === 'completed' && data?.videoUrl) return data.videoUrl;
      if (data?.status === 'failed') throw new Error(data?.error || 'Failed');
    }
    throw new Error('Timed out');
  };

  // Generate 4 distinct script variations (different styles + settings)
  const generateVariations = async () => {
    if (!message.trim()) {
      toast({ title: 'Topic required', description: 'Enter what you want to talk about.', variant: 'destructive' });
      return;
    }
    setIsGeneratingVariations(true);
    setVariations([]);
    setActiveVariationId(null);
    try {
      const dur = parseInt(duration);
      const wordTarget = Math.round(dur * 2.5);

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You write 4 distinct talking-head video scripts for the SAME topic. Each variation must use a DIFFERENT style and a DIFFERENT real-world setting.

Vary across these axes:
- Style: educational, casual/conversational, punchy/high-energy, storytelling
- Setting: home office, outdoor (park/street), kitchen, car/passenger seat, coffee shop, bedroom — pick 4 different ones
- Hook type: question, bold claim, story opener, surprising stat

Rules per script:
- ~${wordTarget} words (target ${dur}s at ~2.5 words/sec)
- Natural spoken language, short sentences (8-15 words)
- Strong hook in first sentence
- End with a clear call to action
- NO stage directions, NO speaker labels, NO timestamps

Return ONLY valid JSON:
{
  "variations": [
    {
      "styleLabel": "Educational",
      "settingLabel": "Home office, soft window light",
      "hook": "one-line teaser",
      "narration": "full spoken script ~${wordTarget} words",
      "visualDescription": "iPhone selfie of the person in [setting]. [wardrobe]. [lighting]. [mood]. NO text overlays."
    }
    // ... 4 total, all different
  ]
}`
            },
            { role: 'user', content: `Topic: ${message}\n\nWrite 4 distinct ~${dur}s talking-head scripts. All 4 must feel meaningfully different in style AND setting.` }
          ]
        }
      });
      if (error) throw error;
      const content = data?.response || data?.choices?.[0]?.message?.content || data?.content || (typeof data === 'string' ? data : '');
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      const arr: ScriptVariation[] = (parsed.variations || []).slice(0, 4).map((v: any, i: number) => ({
        id: `var-${Date.now()}-${i}`,
        styleLabel: v.styleLabel || `Variation ${i + 1}`,
        settingLabel: v.settingLabel || 'Studio',
        hook: v.hook || '',
        narration: v.narration || '',
        visualDescription: v.visualDescription || '',
      })).filter((v: ScriptVariation) => v.narration);
      if (arr.length === 0) throw new Error('No variations returned');
      setVariations(arr);
      setActiveVariationId(arr[0].id);
      toast({ title: '✨ 4 Scripts Ready', description: 'Pick one to render, or generate again.' });
    } catch (err: any) {
      console.error('Variations error:', err);
      toast({ title: 'Failed to generate variations', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingVariations(false);
    }
  };

  // Main: Generate Script + Video
  const generate = async (preset?: ScriptVariation) => {
    if (!message.trim()) {
      toast({ title: 'Message required', description: 'Enter what you want to say.', variant: 'destructive' });
      return;
    }
    if (!selectedTwin) {
      toast({ title: 'Select a character', description: 'Pick an AI Twin first.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setVideoUrl(null);
    setAudioUrl(null);

    try {
      const dur = parseInt(duration);
      const wordTarget = Math.round(dur * 2.5);

      // Step 1: Use preset script if provided, else generate one
      let narration: string;
      let visualDesc: string;
      if (preset) {
        narration = preset.narration;
        visualDesc = preset.visualDescription;
      } else {
        setProgressStatus('Writing script...');
        const { data: scriptData, error: scriptErr } = await supabase.functions.invoke('ai', {
          body: {
            messages: [
              {
                role: 'system',
                content: `You are a scriptwriter for talking-head videos. Write a natural, conversational monologue.

Target: ${dur} seconds (~${wordTarget} words).
Character: ${selectedTwin.face_description || selectedTwin.name}

Rules:
- Write naturally, as a real person talks on camera
- Short sentences (8-15 words). Vary length for rhythm
- Hook the viewer in the first sentence
- End with a clear call to action
- NO stage directions, NO speaker labels

Return ONLY a JSON object:
{
  "narration": "The full script text...",
  "visualDescription": "Brief visual direction for the character in a professional studio setting"
}`
              },
              { role: 'user', content: `Write a ${dur}-second talking head script for:\n\n${message}` }
            ]
          }
        });
        if (scriptErr) throw scriptErr;
        const content = scriptData?.response || scriptData?.choices?.[0]?.message?.content || scriptData?.content || (typeof scriptData === 'string' ? scriptData : '');
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
          narration = parsed.narration;
          visualDesc = parsed.visualDescription || '';
        } catch {
          narration = content.replace(/```[\s\S]*?```/g, '').trim();
          visualDesc = `Professional studio, ${selectedTwin.face_description || selectedTwin.name} speaking to camera`;
        }
      }

      setProgress(15);

      // Step 2: Generate TTS
      setProgressStatus('Generating voiceover...');
      const ttsUrl = await generateTTS(narration, selectedTwin, 'podcast');
      setAudioUrl(ttsUrl);
      setProgress(30);

      // Step 3: Generate character image
      setProgressStatus('Creating character portrait...');
      const imgPrompt = `Photorealistic selfie of this EXACT person filmed on an iPhone front camera.
CHARACTER: ${selectedTwin.face_description || selectedTwin.name}
GENDER: ${selectedTwin.gender || 'unspecified'}
CAMERA: iPhone front-facing camera, slight low angle, arm's length distance
SETTING: Casual real environment — home office or living room, natural window light
EXPRESSION: Mid-sentence speaking, relaxed and authentic, looking directly at camera
QUALITY: Ultra photorealistic, natural skin with pores, no retouching. NO text, NO watermarks.`;
      const sceneImg = await generateSceneImage(imgPrompt, selectedTwin);
      setProgress(45);

      // Step 4: Create lip-sync video
      setProgressStatus('Rendering video with lip-sync...');
      const { data: videoData, error: videoErr } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk-hd',
          imageUrls: [sceneImg],
          audioUrl: ttsUrl,
          prompt: `Real person talking naturally on iPhone front camera. Wide fluid mouth movements with visible jaw and lip motion. Natural head movements — slight tilts, nods, eyebrow raises. Subtle handheld camera micro-shake. Casual, authentic energy. NOT cinematic, NOT polished — raw and real like an iPhone selfie video.`,
          aspectRatio: '9:16',
        }
      });
      if (videoErr) throw videoErr;
      if (!videoData?.taskId) {
        const apiError = videoData?.error || 'No video task created';
        throw new Error(apiError.includes('credits') ? 'WaveSpeed API credits exhausted. Please top up your WaveSpeed account.' : apiError);
      }
      setProgress(55);

      // Step 5: Poll until done
      setProgressStatus('Rendering... (1-4 minutes)');
      let finalUrl: string;
      let attempts = 0;
      const maxAttempts = 150;
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 3000));
        const { data: status } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId: videoData.taskId }
        });
        if (status?.status === 'completed' && status?.videoUrl) {
          finalUrl = status.videoUrl;
          break;
        }
        if (status?.status === 'failed') throw new Error(status?.error || 'Video failed');
        setProgress(55 + (attempts / maxAttempts) * 40);
      }
      if (!finalUrl!) throw new Error('Video timed out');

      setVideoUrl(finalUrl);
      setProgress(100);
      setProgressStatus('Done! 🎬');
      toast({ title: '🎬 Video Ready!', description: 'Your talking head video is complete.' });

    } catch (err: any) {
      console.error('Generation error:', err);
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setMessage('');
    setVideoUrl(null);
    setAudioUrl(null);
    setProgress(0);
    setProgressStatus('');
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel — AI Creative Director */}
        <div className="lg:w-[420px] xl:w-[460px] border-r border-border flex flex-col bg-background order-2 lg:order-1 min-h-[300px] lg:min-h-0 lg:h-full">
          <PodcastAIDirector
            onUseScript={(script) => setMessage(script)}
            selectedCharacterName={selectedTwin?.name}
          />
        </div>

        {/* Right Panel — Production Controls */}
        <div className="flex-1 overflow-y-auto order-1 lg:order-2">
          <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
            {/* Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Mic className="w-6 h-6 text-primary" />
                <h1 className="text-2xl font-bold">Podcast Talking Head</h1>
              </div>
              <p className="text-sm text-muted-foreground">Select a character, craft your script, and generate a professional talking-head video.</p>
            </div>

            {/* Video Result */}
            {videoUrl ? (
              <Card className="border-primary/20">
                <CardContent className="p-5 space-y-4">
                  <VideoPlayer videoUrl={videoUrl} title="Podcast Talking Head" className="rounded-xl w-full max-w-xs mx-auto aspect-[9/16]" />
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" asChild>
                      <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 mr-1" /> Download
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" onClick={reset}>
                      <RotateCcw className="w-4 h-4 mr-1" /> New Video
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Step 1: Character Selection */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" /> 1. Choose Character
                  </Label>
                  {loadingTwins ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading characters...
                    </div>
                  ) : twins.length === 0 ? (
                    <Card className="border-dashed">
                      <CardContent className="p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          No AI Twins found. <a href="/ai-twin" className="text-primary underline font-medium">Create one first →</a>
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {twins.map(twin => (
                        <button
                          key={twin.id}
                          onClick={() => setSelectedTwinId(twin.id)}
                          disabled={isGenerating}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                            selectedTwinId === twin.id
                              ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                              : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50'
                          } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Avatar className="w-10 h-10 flex-shrink-0">
                            {twin.reference_images[0] ? (
                              <img src={twin.reference_images[0]} alt={twin.name} className="object-cover" />
                            ) : (
                              <AvatarFallback><User className="w-5 h-5" /></AvatarFallback>
                            )}
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{twin.name}</p>
                            {twin.voice_cloning_key && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Cloned</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 2: Script */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> 2. Your Script
                  </Label>
                  <Textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="What should they say? Describe the topic or paste a script. Use the AI Director on the left to generate ideas..."
                    className="min-h-[140px] resize-y rounded-xl text-sm"
                    disabled={isGenerating}
                  />
                  <div className="flex items-center justify-between">
                    {message.trim() ? (
                      <p className="text-xs text-muted-foreground">
                        ~{message.trim().split(/\s+/).length} words • est. {Math.round(message.trim().split(/\s+/).length / 2.5)}s
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">💡 Tip: Use the AI Director to brainstorm content ideas</p>
                    )}
                  </div>
                </div>

                {/* Step 3: Duration */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" /> 3. Duration
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {DURATION_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setDuration(o.value)}
                        disabled={isGenerating}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          duration === o.value
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-accent/50'
                        } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
                  size="lg"
                  onClick={generate}
                  disabled={isGenerating || !selectedTwinId || !message.trim()}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {progressStatus || 'Generating...'}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Generate Talking Head
                    </>
                  )}
                </Button>

                {/* Progress */}
                {isGenerating && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2 rounded-full" />
                    <p className="text-xs text-center text-muted-foreground">{progressStatus}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Podcast;
