import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { PodcastAIDirector, type VideoPlan } from '@/components/PodcastAIDirector';
import { PodcastFromContent } from '@/components/podcast/PodcastFromContent';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Mic, Loader2, Play, Download, User, Clock, RotateCcw, Sparkles, Wand2, Check, Globe, Upload, X, Headphones, Layers, History, Trash2, CheckSquare, Square, RefreshCw } from 'lucide-react';
import type { AITwin } from '@/types/aiTwin';
import { PodcastAspectRatioPicker, type PodcastAspectRatio } from '@/components/PodcastAspectRatioPicker';

const ASPECT_FRAMING: Record<PodcastAspectRatio, string> = {
  '9:16': 'VERTICAL 9:16 portrait framing for TikTok/Reels/Shorts. Subject head-and-shoulders centered with generous headroom, full vertical composition.',
  '16:9': 'HORIZONTAL 16:9 landscape framing for YouTube/web. Subject head-and-shoulders centered with cinematic widescreen composition.',
  '1:1': 'SQUARE 1:1 framing for Instagram feed. Subject head-and-shoulders centered, balanced square composition.',
};
const ASPECT_CSS: Record<PodcastAspectRatio, string> = {
  '9:16': 'aspect-[9/16] max-w-xs',
  '16:9': 'aspect-video max-w-2xl',
  '1:1': 'aspect-square max-w-md',
};

interface BrandContext {
  brandName?: string;
  brandDescription?: string;
  productLines?: string;     // e.g. "Lion's Mane (Focus), Reishi (Calm), ..."
  audience?: string;
  websiteSummary?: string;
  websiteUrl?: string;
}

interface ProductImage {
  productName: string;
  imageUrl: string;
}

interface ScriptVariation {
  id: string;
  styleLabel: string;
  settingLabel: string;
  hook: string;
  narration: string;
  visualDescription: string;
  featuredProduct?: string;
  audience?: string;
  showProduct?: boolean; // hint that this script benefits from showing the product on-screen
}

const DURATION_OPTIONS = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '90', label: '1.5 minutes' },
  { value: '120', label: '2 minutes' },
  { value: '180', label: '3 minutes' },
  { value: '240', label: '4 minutes' },
  { value: '300', label: '5 minutes' },
];

const MIN_DURATION = 10;
const MAX_DURATION = 300;

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
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [backgroundTask, setBackgroundTask] = useState<{ taskId: string; projectId: string | null } | null>(() => {
    try {
      const raw = localStorage.getItem('podcast-active-task-v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  // 4-variation flow
  const [variations, setVariations] = useState<ScriptVariation[]>([]);
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [activeVariationId, setActiveVariationId] = useState<string | null>(null);

  // Brand context
  const [brandContext, setBrandContext] = useState<BrandContext>({});
  const [brandUrl, setBrandUrl] = useState('');
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);

  // Custom uploaded audio (overrides TTS)
  const [customAudioUrl, setCustomAudioUrl] = useState<string | null>(null);
  const [customAudioName, setCustomAudioName] = useState<string | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Brand product images (used to feature the product in shot)
  const [productImages, setProductImages] = useState<ProductImage[]>([]);

  // ===== Bulk planning + queue =====
  interface BulkItem {
    id: string;
    plan: VideoPlan;
    selected: boolean;
    status: 'pending' | 'script' | 'voice' | 'image' | 'video' | 'done' | 'failed';
    progress: number;
    videoUrl?: string;
    audioUrl?: string;
    sceneImageUrl?: string;
    error?: string;
    projectId?: string;
    assignedTwinId?: string | null;
    assignedTwinName?: string | null;
  }
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [bulkOutput, setBulkOutput] = useState<'video' | 'voiceover'>('video');
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const bulkStopRef = useRef(false);
  const [aspectRatio, setAspectRatio] = useState<PodcastAspectRatio>('9:16');
  const [activeTab, setActiveTab] = useState<string>('talking-head');

  // ===== History =====
  interface HistoryProject {
    id: string;
    topic: string;
    hook?: string | null;
    narration: string;
    style_label?: string | null;
    setting_label?: string | null;
    audience?: string | null;
    twin_name?: string | null;
    duration?: number | null;
    audio_url?: string | null;
    video_url?: string | null;
    status: string;
    created_at: string;
  }
  const [history, setHistory] = useState<HistoryProject[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const selectedTwin = twins.find(t => t.id === selectedTwinId);
  const isUuid = (value?: string | null) => !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  useEffect(() => {
    try {
      if (backgroundTask?.taskId) {
        localStorage.setItem('podcast-active-task-v1', JSON.stringify(backgroundTask));
      } else {
        localStorage.removeItem('podcast-active-task-v1');
      }
    } catch {}
  }, [backgroundTask]);

  const recoverPodcastTasks = useCallback(async () => {
    if (!user?.id) return;
    const { data: tasks } = await supabase
      .from('video_tasks')
      .select('task_id,source_id,status,video_url')
      .eq('user_id', user.id)
      .eq('source', 'podcast')
      .in('status', ['pending', 'processing', 'completed'])
      .not('source_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);

    let recoveredUrl: string | null = null;
    for (const task of tasks || []) {
      const { data: status } = await supabase.functions.invoke('wavespeed-video', {
        body: { action: 'status', taskId: task.task_id }
      });
      const url = status?.videoUrl || task.video_url;
      if ((status?.status === 'completed' || task.status === 'completed') && url) {
        await supabase.from('podcast_projects').update({ video_url: url, status: 'done', error: null }).eq('id', task.source_id);
        recoveredUrl = recoveredUrl || url;
        setVideoUrl(prev => prev || url);
        setBackgroundTask(prev => prev?.taskId === task.task_id ? null : prev);
      } else if (status?.status === 'failed') {
        await supabase.from('podcast_projects').update({ status: 'failed', error: status?.error || 'Video failed' }).eq('id', task.source_id);
      }
    }
    if (recoveredUrl) {
      setProgress(100);
      setProgressStatus('Done! 🎬');
      setGenerationError(null);
    }
  }, [user?.id]);

  // Auto-estimate duration from word count
  useEffect(() => {
    if (!message.trim()) return;
    const words = message.trim().split(/\s+/).length;
    const estimatedSeconds = Math.round(words / 2.0);
    const closest = DURATION_OPTIONS.reduce((best, opt) => {
      const diff = Math.abs(parseInt(opt.value) - estimatedSeconds);
      return diff < Math.abs(parseInt(best.value) - estimatedSeconds) ? opt : best;
    });
    setDuration(closest.value);
  }, [message]);

  // Upload custom audio for lip-sync
  const handleAudioUpload = async (file: File) => {
    if (!file || !user) return;
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 50MB', variant: 'destructive' });
      return;
    }
    setIsUploadingAudio(true);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const fileName = `${user.id}/podcast/uploaded-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('reels')
        .upload(fileName, file, { contentType: file.type || 'audio/mpeg', upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('reels').getPublicUrl(fileName);
      setCustomAudioUrl(pub.publicUrl);
      setCustomAudioName(file.name);
      toast({ title: 'Audio uploaded', description: 'Will be used instead of TTS for lip-sync.' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingAudio(false);
    }
  };

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
        // Auto-select the first twin so "Use This Script" always has an avatar to feature.
        if (mapped.length > 0) {
          setSelectedTwinId(prev => prev ?? mapped[0].id);
        }
      } catch (err) {
        console.error('Failed to load twins:', err);
      } finally {
        setLoadingTwins(false);
      }
    })();
  }, [user?.id]);

  // Load brand + product context (profile, brands, products, last reels). Auto-bootstrap
  // a Lifecykel context for known brand owner accounts.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const [profileRes, brandsRes, productsRes, reelsRes] = await Promise.all([
          supabase.from('profiles').select('first_name,last_name,company_name,brand_description,content_goal').eq('user_id', user.id).maybeSingle(),
          supabase.from('brands').select('name,description').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(3),
          supabase.from('products').select('id,name,description,category,target_audience,benefits').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(8),
          supabase.from('reels').select('topic').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5),
        ]);

        const profile = profileRes.data;
        const brands = brandsRes.data || [];
        const products = productsRes.data || [];
        const recentTopics = (reelsRes.data || []).map((r: any) => r.topic).filter(Boolean);

        // Pull primary product image for each product (for in-shot product placement)
        if (products.length) {
          const productIds = products.map((p: any) => p.id);
          const { data: gallery } = await supabase
            .from('product_gallery')
            .select('product_id,image_url,is_primary')
            .in('product_id', productIds)
            .order('is_primary', { ascending: false });
          const seen = new Set<string>();
          const imgs: ProductImage[] = [];
          (gallery || []).forEach((g: any) => {
            if (seen.has(g.product_id)) return;
            seen.add(g.product_id);
            const prod = products.find((p: any) => p.id === g.product_id);
            if (prod) imgs.push({ productName: prod.name, imageUrl: g.image_url });
          });
          setProductImages(imgs);
        }

        const isLifecykel =
          (user.email || '').toLowerCase().includes('lifecykel') ||
          brands.some((b: any) => /lifecykel/i.test(b.name || '')) ||
          /lifecykel/i.test(profile?.company_name || '');

        const ctx: BrandContext = {
          brandName: brands[0]?.name || profile?.company_name || (isLifecykel ? 'Lifecykel' : undefined),
          brandDescription: brands[0]?.description || profile?.brand_description ||
            (isLifecykel ? "Functional mushroom extracts (Lion's Mane, Reishi, Cordyceps, Chaga, Turkey Tail, Tremella) for focus, calm, energy, immunity, gut, and skin." : undefined),
          productLines: products.length
            ? products.map((p: any) => `${p.name}${p.category ? ` (${p.category})` : ''}${p.target_audience ? ` — for ${p.target_audience}` : ''}`).join('; ')
            : (isLifecykel ? "Lion's Mane (focus), Reishi (calm/sleep), Cordyceps (energy), Chaga (immunity), Turkey Tail (gut), Tremella (skin)" : undefined),
          audience: products[0]?.target_audience || profile?.content_goal,
          websiteSummary: recentTopics.length ? `Recent video topics: ${recentTopics.slice(0, 3).join(' | ')}` : undefined,
        };
        setBrandContext(ctx);
      } catch (err) {
        console.error('Brand context load failed:', err);
      }
    })();
  }, [user?.id, user?.email]);

  // Analyze a brand URL on demand and merge into brandContext
  const analyzeBrandUrl = async () => {
    const url = brandUrl.trim();
    if (!url) {
      toast({ title: 'Enter a URL', description: 'Paste your brand website URL first.', variant: 'destructive' });
      return;
    }
    setIsAnalyzingBrand(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-brand-website', { body: { url } });
      if (error) throw error;
      const a = data?.analysis || data || {};
      setBrandContext(prev => ({
        ...prev,
        brandName: a.brandName || a.name || prev.brandName,
        brandDescription: a.description || a.brandDescription || prev.brandDescription,
        productLines: a.products || a.productLines || prev.productLines,
        audience: a.targetAudience || a.audience || prev.audience,
        websiteSummary: a.summary || a.tagline || prev.websiteSummary,
        websiteUrl: url,
      }));
      toast({ title: '✨ Brand analyzed', description: 'Variations will now reflect your brand & products.' });
    } catch (err: any) {
      console.error('Brand analyze failed:', err);
      toast({ title: 'Analyze failed', description: err.message || 'Try again.', variant: 'destructive' });
    } finally {
      setIsAnalyzingBrand(false);
    }
  };

  // Build TTS body
  const buildTtsBody = (text: string, twin: AITwin) => {
    const isFemale = twin.gender?.toLowerCase() === 'female' || twin.gender?.toLowerCase() === 'woman';
    const body: Record<string, any> = {
      text,
      speed: 0.82,
      gender: twin.gender || (isFemale ? 'female' : 'male'),
      voice: isFemale ? 'nova' : 'echo',
    };
    if (twin.voice_cloning_key) {
      body.voiceCloningKey = twin.voice_cloning_key;
      return body;
    }
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

  // Helper: generate scene image (optionally with a product reference image to feature in shot)
  const generateSceneImage = async (prompt: string, twin: AITwin, productImageUrl?: string): Promise<string> => {
    const portrait = twin.reference_images[0];
    const { data: { session } } = await supabase.auth.getSession();
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

    const messageContent: any[] = [
      { type: 'image_url', image_url: { url: portrait } },
    ];
    if (productImageUrl) {
      messageContent.push({ type: 'image_url', image_url: { url: productImageUrl } });
      messageContent.push({
        type: 'text',
        text: `Image 1 is the reference person. Image 2 is the product. Generate a NEW photo of the EXACT person from image 1 holding or visibly featuring the EXACT product from image 2 (preserve product label, colors, and shape pixel-perfect).\n\n${prompt}`,
      });
    } else {
      messageContent.push({
        type: 'text',
        text: `This is the reference photo. Generate a NEW image of this EXACT same person.\n\n${prompt}`,
      });
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: messageContent }],
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
      const wordTarget = Math.round(dur * 2.0);

      const brandBlock = [
        brandContext.brandName && `Brand: ${brandContext.brandName}`,
        brandContext.brandDescription && `About: ${brandContext.brandDescription}`,
        brandContext.productLines && `Products: ${brandContext.productLines}`,
        brandContext.audience && `Target audience: ${brandContext.audience}`,
        brandContext.websiteSummary && `Notes: ${brandContext.websiteSummary}`,
        brandContext.websiteUrl && `Website: ${brandContext.websiteUrl}`,
      ].filter(Boolean).join('\n');

      const hasBrand = brandBlock.length > 0;

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You write 4 distinct talking-head video scripts for the SAME brand. Each variation must use a DIFFERENT style, a DIFFERENT real-world setting, and ideally highlight a DIFFERENT product or angle from the brand catalog below.

${hasBrand ? `BRAND CONTEXT (use this — every script must sound like it's from THIS brand, not generic):\n${brandBlock}\n` : 'No brand context available — keep scripts generic but still on-topic.\n'}
Vary across these axes:
- Style: educational, casual/conversational, punchy/high-energy, storytelling
- Setting: home office, outdoor (park/street), kitchen, car/passenger seat, coffee shop, bedroom — pick 4 different ones
- Hook type: question, bold claim, personal story, surprising stat
${hasBrand ? '- Product/angle: each script should naturally feature a different product or benefit from the brand catalog above' : ''}

Rules per script:
- ~${wordTarget} words (target ${dur}s at ~2.0 words/sec for slower expressive delivery)
- Natural spoken language, short sentences (8-15 words)
- Strong hook in first sentence
- ${hasBrand ? `Mention the brand or a specific product naturally (don't be salesy). Speak to the right audience for that product.` : 'Strong narrative arc.'}
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
      "visualDescription": "iPhone selfie of the person in [setting]. [wardrobe]. [lighting]. [mood]. NO text overlays.",
      "featuredProduct": "${hasBrand ? 'EXACT product name from the brand catalog above (must match one of them verbatim if showProduct is true)' : 'topic angle'}",
      "showProduct": ${hasBrand ? 'true if the script benefits from physically showing the product on-screen (e.g. unboxing, demo, "this is what I take every morning"), false otherwise' : 'false'},
      "audience": "who this script speaks to"
    }
    // ... 4 total, all different
  ]
}`
            },
            { role: 'user', content: `Topic / direction: ${message}\n\nWrite 4 distinct ~${dur}s talking-head scripts. All 4 must feel meaningfully different in style, setting${hasBrand ? ', AND featured product/angle from the brand catalog' : ''}.` }
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
        featuredProduct: v.featuredProduct || v.product || undefined,
        audience: v.audience || v.targetAudience || undefined,
        showProduct: !!v.showProduct,
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
  const generate = async (preset?: ScriptVariation, overrideMessage?: string, overrideTwin?: AITwin) => {
    const effectiveMessage = (overrideMessage ?? message).trim();
    const twinForGeneration = overrideTwin ?? selectedTwin;
    if (!preset && !effectiveMessage) {
      toast({ title: 'Message required', description: 'Enter what you want to say or pick a variation.', variant: 'destructive' });
      return;
    }
    if (!twinForGeneration) {
      toast({ title: 'Select a character', description: 'Pick an AI Twin first.', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setProgress(5);
    setGenerationError(null);
    setVideoUrl(null);
    setAudioUrl(null);
    setBackgroundTask(null);
    let podcastProjectId: string | null = null;
    let activeTaskId: string | null = null;

    try {
      const dur = parseInt(duration);
      const wordTarget = Math.round(dur * 2.0);

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
Character: ${twinForGeneration.face_description || twinForGeneration.name}

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
              { role: 'user', content: `Write a ${dur}-second talking head script for:\n\n${effectiveMessage}` }
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
          visualDesc = `Professional studio, ${twinForGeneration.face_description || twinForGeneration.name} speaking to camera`;
        }
      }

      setProgress(15);

      // Step 2: Generate TTS (or use uploaded audio)
      let ttsUrl: string;
      if (customAudioUrl) {
        setProgressStatus('Using uploaded audio...');
        ttsUrl = customAudioUrl;
      } else {
        setProgressStatus('Generating voiceover...');
        ttsUrl = await generateTTS(narration, twinForGeneration, 'podcast');
      }
      setAudioUrl(ttsUrl);
      setProgress(30);

      // Step 3: Generate character image (optionally featuring the product on-screen)
      setProgressStatus('Creating character portrait...');
      // Resolve product image: variation can flag showProduct + featuredProduct, else fallback to brand's primary product
      let productImgUrl: string | undefined;
      if (preset?.showProduct && preset.featuredProduct && productImages.length) {
        const needle = preset.featuredProduct.toLowerCase();
        const match = productImages.find(p => needle.includes(p.productName.toLowerCase()) || p.productName.toLowerCase().includes(needle));
        productImgUrl = match?.imageUrl || productImages[0].imageUrl;
      }
      const productLine = productImgUrl
        ? `\nFEATURED PRODUCT: The person should be naturally holding or showing the product visible in the second reference image (preserve product label/colors exactly).`
        : '';
      const imgPrompt = `Photorealistic selfie of this EXACT person filmed on an iPhone front camera.
CHARACTER: ${twinForGeneration.face_description || twinForGeneration.name}
GENDER: ${twinForGeneration.gender || 'unspecified'}
CAMERA: iPhone front-facing camera, slight low angle, arm's length distance
ASPECT RATIO: ${aspectRatio} — ${ASPECT_FRAMING[aspectRatio]}
SETTING & STYLE: ${visualDesc || 'Casual real environment — home office or living room, natural window light'}
EXPRESSION: Mid-sentence speaking, relaxed and authentic, looking directly at camera${productLine}
QUALITY: Ultra photorealistic, natural skin with pores, no retouching. NO text, NO watermarks.`;
      const sceneImg = await generateSceneImage(imgPrompt, twinForGeneration, productImgUrl);
      setProgress(45);

      const activeVar = variations.find(v => v.id === activeVariationId);
      if (user) {
        const { data: project } = await supabase.from('podcast_projects').insert({
          user_id: user.id,
          topic: (message.trim() || effectiveMessage).slice(0, 200) || 'Untitled podcast',
          hook: activeVar?.hook || null,
          narration,
          visual_description: visualDesc || null,
          style_label: activeVar?.styleLabel || preset?.styleLabel || null,
          setting_label: activeVar?.settingLabel || preset?.settingLabel || null,
          audience: activeVar?.audience || null,
          featured_product: activeVar?.featuredProduct || null,
          twin_id: isUuid(twinForGeneration.id) ? twinForGeneration.id : null,
          twin_name: twinForGeneration.name || null,
          duration: dur,
          audio_url: ttsUrl,
          scene_image_url: sceneImg,
          status: 'processing',
        }).select('id').single();
        podcastProjectId = project?.id || null;
      }

      // Step 4: Create lip-sync video
      setProgressStatus('Rendering video with lip-sync...');
      const { data: videoData, error: videoErr } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk-hd',
          imageUrls: [sceneImg],
          audioUrl: ttsUrl,
          prompt: `Natural expressive talking-head selfie. The person speaks calmly and deliberately with realistic pauses, visible breathing, expressive eyebrows, warm eye contact, subtle smiles, small head tilts, gentle nods, and accurate lip-sync/jaw motion. Match the voice to the person's age, gender, and face. Keep movements human and restrained, not robotic. Subtle handheld iPhone micro-shake, natural daylight, authentic unpolished realism.`,
          aspectRatio,
          userId: user?.id,
          source: 'podcast',
          sourceId: podcastProjectId,
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
      let finalUrl: string | null = null;
      let attempts = 0;
      const maxAttempts = 150;
      const taskId = videoData.taskId;
      activeTaskId = taskId;
      setBackgroundTask({ taskId, projectId: podcastProjectId });
      let consecutiveFailures = 0;
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 3000));
        const { data: status, error: statusErr } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId }
        });
        if (statusErr) console.warn('WaveSpeed status check failed, retrying:', statusErr);
        if (status?.status === 'completed' && status?.videoUrl) {
          finalUrl = status.videoUrl;
          break;
        }
        if (status?.status === 'failed') {
          consecutiveFailures++;
          if (consecutiveFailures >= 5) throw new Error(status?.error || 'Video failed');
        } else if (status?.status) {
          consecutiveFailures = 0;
        }
        setProgress(55 + (attempts / maxAttempts) * 40);
      }
      if (!finalUrl && user) {
        const { data: recovered } = await supabase
          .from('video_tasks')
          .select('video_url,status')
          .eq('user_id', user.id)
          .eq('task_id', taskId)
          .maybeSingle();
        if (recovered?.status === 'completed' && recovered.video_url) {
          finalUrl = recovered.video_url;
        }
      }
      if (!finalUrl) throw new Error('Video timed out');

      setVideoUrl(finalUrl);
      setBackgroundTask(null);
      setProgress(100);
      setProgressStatus('Done! 🎬');
      setGenerationError(null);

      // Save to history
      if (podcastProjectId) {
        await supabase.from('podcast_projects').update({
          video_url: finalUrl,
          status: 'done',
          error: null,
        }).eq('id', podcastProjectId);
      }

      toast({ title: '🎬 Video Ready!', description: 'Your talking head video is complete.' });

    } catch (err: any) {
      console.error('Generation error:', err);
      const msg = err?.message || 'Unknown error';
      const stillProcessing = /timed out|status|Failed to get video job status/i.test(msg) && !!activeTaskId;
      if (podcastProjectId && !stillProcessing) {
        await supabase.from('podcast_projects').update({ status: 'failed', error: msg }).eq('id', podcastProjectId);
      }
      if (stillProcessing) {
        setProgressStatus('Still rendering in the background...');
        setProgress(prev => Math.max(prev, 95));
        setGenerationError(null);
        toast({ title: 'Still rendering', description: 'Marcus will keep checking and show the video here when WaveSpeed finishes.' });
        return;
      }
      setGenerationError(msg);
      const isCredits = /credits?\s*(exhausted|run out|insufficient)|top\s*up|insufficient.*balance/i.test(msg);
      toast({
        title: isCredits ? '⚠️ WaveSpeed Credits Exhausted' : 'Generation Failed',
        description: isCredits
          ? 'The lip-sync video service is out of credits. Top up your WaveSpeed account, then click Generate Video again — your script is preserved.'
          : msg,
        variant: 'destructive',
        duration: isCredits ? 12000 : 6000,
      });
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
    setVariations([]);
    setActiveVariationId(null);
  };

  // ===== Bulk: receive plans from director, run queue =====
  const handleBatchPlan = (plans: VideoPlan[]) => {
    if (!plans?.length) return;

    const findTwinByName = (name?: string) => {
      if (!name) return null;
      const norm = name.trim().toLowerCase();
      return twins.find(t => t.name.trim().toLowerCase() === norm) || null;
    };

    const items: BulkItem[] = plans.map((p, i) => {
      // 1) Try the AI-assigned twin name
      let twin = findTwinByName(p.twinName);
      // 2) Fallback: rotate through the available twins so every plan gets a different cast
      if (!twin && twins.length > 0) {
        twin = twins[i % twins.length];
      }
      // 3) Last resort: the user's currently-selected twin (or null)
      if (!twin) twin = selectedTwin || null;

      return {
        id: `plan-${Date.now()}-${i}`,
        plan: p,
        selected: true,
        status: 'pending',
        progress: 0,
        assignedTwinId: twin?.id || null,
        assignedTwinName: twin?.name || p.twinName || null,
      };
    });
    setBulkItems(items);
    setActiveTab('bulk');

    const distinctCast = new Set(items.map(i => i.assignedTwinName).filter(Boolean));
    toast({
      title: `${plans.length} videos queued — starting now`,
      description: distinctCast.size > 1
        ? `Cast across ${distinctCast.size} AI twins. Generating sequentially.`
        : 'Generating sequentially. You can stop at any time.',
    });

    // Auto-start bulk generation so the user immediately sees progress.
    // Pass items directly to avoid stale-closure read of bulkItems state.
    setTimeout(() => { startBulkGeneration(items); }, 50);
  };

  const updateBulkItem = (id: string, patch: Partial<BulkItem>) => {
    setBulkItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  };

  const saveProjectToHistory = async (item: BulkItem, finalStatus: 'done' | 'failed', extra: Partial<HistoryProject> = {}) => {
    if (!user) return null;
    const payload = {
      user_id: user.id,
      topic: item.plan.topic,
      hook: item.plan.hook || null,
      narration: item.plan.narration,
      audience: item.plan.audience || null,
      twin_id: isUuid(item.assignedTwinId) ? item.assignedTwinId : isUuid(selectedTwinId) ? selectedTwinId : null,
      twin_name: item.assignedTwinName ?? selectedTwin?.name ?? null,
      duration: item.plan.duration || parseInt(duration) || 60,
      audio_url: item.audioUrl || null,
      video_url: item.videoUrl || null,
      scene_image_url: item.sceneImageUrl || null,
      status: finalStatus,
      error: item.error || null,
      ...extra,
    };
    if (item.projectId) {
      await supabase.from('podcast_projects').update(payload).eq('id', item.projectId);
      return item.projectId;
    }
    const { data } = await supabase.from('podcast_projects').insert(payload).select('id').single();
    return data?.id || null;
  };

  const processBulkItem = async (item: BulkItem, twin: AITwin): Promise<void> => {
    try {
      // 1. TTS
      updateBulkItem(item.id, { status: 'voice', progress: 15 });
      const ttsUrl = await generateTTS(item.plan.narration, twin, `bulk-${item.id}`);
      updateBulkItem(item.id, { audioUrl: ttsUrl, progress: 35 });

      if (bulkOutput === 'voiceover') {
        updateBulkItem(item.id, { status: 'done', progress: 100 });
        const id = await saveProjectToHistory({ ...item, audioUrl: ttsUrl }, 'done');
        if (id) updateBulkItem(item.id, { projectId: id });
        return;
      }

      // 2. Scene image
      updateBulkItem(item.id, { status: 'image', progress: 45 });
      const visualDesc = `iPhone selfie of the person speaking on ${item.plan.topic}. Casual real environment — home office, coffee shop, or living room. Natural daylight. Mid-sentence expression.`;
      const imgPrompt = `Photorealistic selfie of this EXACT person filmed on an iPhone front camera.
CHARACTER: ${twin.face_description || twin.name}
GENDER: ${twin.gender || 'unspecified'}
CAMERA: iPhone front-facing, slight low angle, arm's length
ASPECT RATIO: ${aspectRatio} — ${ASPECT_FRAMING[aspectRatio]}
SETTING: ${visualDesc}
EXPRESSION: Mid-sentence speaking, relaxed and authentic, looking directly at camera
QUALITY: Ultra photorealistic, natural skin, no retouching. NO text, NO watermarks.`;
      const sceneImg = await generateSceneImage(imgPrompt, twin);
      updateBulkItem(item.id, { sceneImageUrl: sceneImg, progress: 55 });

      // 3. Lip-sync video
      updateBulkItem(item.id, { status: 'video', progress: 60 });
      const { data: videoData, error: videoErr } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk-hd',
          imageUrls: [sceneImg],
          audioUrl: ttsUrl,
          prompt: `Real person talking naturally on iPhone front camera. Wide fluid mouth movements. Natural head movements — slight tilts, nods, eyebrow raises. Subtle handheld micro-shake. Casual, authentic energy.`,
          aspectRatio,
        }
      });
      if (videoErr) throw videoErr;
      if (!videoData?.taskId) {
        const apiError = videoData?.error || 'No video task created';
        throw new Error(apiError.includes('credits') ? '💳 WaveSpeed credits exhausted. Top up & retry.' : apiError);
      }

      // 4. Poll
      let attempts = 0;
      const maxAttempts = 150;
      let finalUrl: string | undefined;
      while (attempts < maxAttempts) {
        if (bulkStopRef.current) throw new Error('Stopped by user');
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
        updateBulkItem(item.id, { progress: 60 + (attempts / maxAttempts) * 35 });
      }
      if (!finalUrl) throw new Error('Video timed out');

      const completed = { ...item, audioUrl: ttsUrl, sceneImageUrl: sceneImg, videoUrl: finalUrl };
      updateBulkItem(item.id, { videoUrl: finalUrl, status: 'done', progress: 100 });
      const id = await saveProjectToHistory(completed, 'done');
      if (id) updateBulkItem(item.id, { projectId: id });
    } catch (err: any) {
      console.error('Bulk item failed:', err);
      const failed = { ...item, error: err.message };
      updateBulkItem(item.id, { status: 'failed', error: err.message });
      await saveProjectToHistory(failed, 'failed');
    }
  };

  const resolveItemTwin = (item: BulkItem): AITwin | null => {
    if (item.assignedTwinId) {
      const found = twins.find(t => t.id === item.assignedTwinId);
      if (found) return found;
    }
    if (item.assignedTwinName) {
      const norm = item.assignedTwinName.trim().toLowerCase();
      const byName = twins.find(t => t.name.trim().toLowerCase() === norm);
      if (byName) return byName;
    }
    return selectedTwin || null;
  };

  const startBulkGeneration = async (overrideItems?: BulkItem[]) => {
    if (twins.length === 0) {
      toast({ title: 'No AI twins available', description: 'Create at least one AI Twin first.', variant: 'destructive' });
      return;
    }
    const source = overrideItems ?? bulkItems;
    const queue = source.filter(i => i.selected && i.status !== 'done');
    if (queue.length === 0) {
      toast({ title: 'Nothing selected', description: 'Tick at least one script.', variant: 'destructive' });
      return;
    }
    // Verify every queued item has a resolvable twin
    const missing = queue.find(it => !resolveItemTwin(it));
    if (missing) {
      toast({ title: 'Missing cast for an item', description: `"${missing.plan.topic}" has no twin assigned. Pick a default character first.`, variant: 'destructive' });
      return;
    }
    bulkStopRef.current = false;
    setIsBulkRunning(true);
    toast({ title: `Bulk generating ${queue.length} ${bulkOutput === 'video' ? 'videos' : 'voiceovers'}`, description: 'Running sequentially. You can stop at any time.' });
    let stopped = false;
    for (const item of queue) {
      if (bulkStopRef.current) {
        stopped = true;
        updateBulkItem(item.id, { status: 'failed', error: 'Stopped by user' });
        continue;
      }
      const twin = resolveItemTwin(item)!;
      await processBulkItem(item, twin);
    }
    setIsBulkRunning(false);
    bulkStopRef.current = false;
    loadHistory();
    toast({
      title: stopped ? '⏹ Bulk run stopped' : '✅ Bulk run complete',
      description: stopped ? 'Remaining items were skipped.' : 'Check History tab to edit & re-render.',
    });
  };

  const stopBulkGeneration = () => {
    if (!isBulkRunning) return;
    bulkStopRef.current = true;
    toast({ title: 'Stopping…', description: 'Will halt after the current step finishes.' });
  };

  const retryBulkItem = async (id: string) => {
    const item = bulkItems.find(i => i.id === id);
    if (!item) return;
    const twin = resolveItemTwin(item);
    if (!twin) {
      toast({ title: 'No twin for this plan', description: 'Pick a default character first.', variant: 'destructive' });
      return;
    }
    updateBulkItem(id, { status: 'pending', progress: 0, error: undefined });
    setIsBulkRunning(true);
    await processBulkItem({ ...item, status: 'pending', progress: 0, error: undefined }, twin);
    setIsBulkRunning(false);
    loadHistory();
  };

  const toggleBulkSelected = (id: string) => {
    setBulkItems(prev => prev.map(it => it.id === id ? { ...it, selected: !it.selected } : it));
  };

  const removeBulkItem = (id: string) => {
    setBulkItems(prev => prev.filter(it => it.id !== id));
  };

  // ===== History =====
  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('podcast_projects')
        .select('id,topic,hook,narration,style_label,setting_label,audience,twin_name,duration,audio_url,video_url,status,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setHistory((data as HistoryProject[]) || []);
    } catch (err) {
      console.error('Load history failed:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  useEffect(() => {
    recoverPodcastTasks().finally(() => loadHistory());
  }, [recoverPodcastTasks, loadHistory]);

  useEffect(() => {
    if (!user?.id || !backgroundTask?.taskId || videoUrl) return;
    let cancelled = false;
    const check = async () => {
      const { data: status } = await supabase.functions.invoke('wavespeed-video', {
        body: { action: 'status', taskId: backgroundTask.taskId }
      });
      if (cancelled) return;
      if (status?.status === 'completed' && status?.videoUrl) {
        if (backgroundTask.projectId) {
          await supabase.from('podcast_projects').update({ video_url: status.videoUrl, status: 'done', error: null }).eq('id', backgroundTask.projectId);
        }
        setVideoUrl(status.videoUrl);
        setProgress(100);
        setProgressStatus('Done! 🎬');
        setGenerationError(null);
        setBackgroundTask(null);
        loadHistory();
      } else if (status?.status === 'failed') {
        setGenerationError(status?.error || 'Video failed');
        setProgressStatus('Generation failed');
        setBackgroundTask(null);
      } else {
        setProgress(prev => Math.max(prev, Math.min(98, status?.progress || 95)));
        setProgressStatus('Still rendering in the background...');
      }
    };
    check();
    const id = window.setInterval(check, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [user?.id, backgroundTask, videoUrl, loadHistory]);

  const deleteHistoryItem = async (id: string) => {
    if (!confirm('Delete this podcast project?')) return;
    await supabase.from('podcast_projects').delete().eq('id', id);
    setHistory(prev => prev.filter(h => h.id !== id));
    toast({ title: 'Deleted' });
  };

  const editFromHistory = (h: HistoryProject) => {
    setMessage(h.narration);
    if (h.duration) setDuration(String(h.duration));
    setActiveTab('talking-head');
    toast({ title: 'Loaded into editor', description: 'Tweak the script and re-render.' });
  };

  return (
    <Layout>
      <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row overflow-hidden">
        {/* Left Panel — AI Creative Director */}
        <div className="lg:w-[420px] xl:w-[460px] border-r border-border flex flex-col bg-background order-2 lg:order-1 min-h-[300px] lg:min-h-0 lg:h-full">
          <PodcastAIDirector
            onUseScript={async (script) => {
              setMessage(script);
              setActiveTab('talking-head');
              // Auto-pick the best-fit avatar if none selected: first available twin.
              let twinForRun = selectedTwin;
              if (!twinForRun && twins.length > 0) {
                twinForRun = twins[0];
                setSelectedTwinId(twinForRun.id);
                toast({ title: `Featuring ${twinForRun.name}`, description: 'Auto-selected your avatar for this video.' });
              }

              // No AI Twin at all — synthesize a person that fits the script using AI.
              if (!twinForRun) {
                try {
                  toast({ title: '🎭 Generating a person to match your script…', description: 'No AI Twin selected — creating one with AI.' });
                  const { data: { session } } = await supabase.auth.getSession();
                  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
                  const personPrompt = `Photorealistic iPhone front-camera selfie portrait of a real-looking person who would naturally deliver this talking-head script. Pick gender, age, ethnicity, wardrobe, and setting that BEST FITS the tone and topic of the script. Natural daylight, unretouched, authentic, looking directly at camera, mid-sentence with warm expressive eyes and relaxed eyebrows. ${ASPECT_FRAMING[aspectRatio]} NO text, NO watermarks.\n\nSCRIPT:\n"""${script}"""`;
                  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      messages: [{ role: 'user', content: [{ type: 'text', text: personPrompt }] }],
                      model: 'google/gemini-3.1-flash-image-preview',
                      modalities: ['image', 'text'],
                    }),
                  });
                  const imgData = await res.json();
                  let portrait = imgData.imageUrl || imgData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
                  if (portrait?.startsWith('data:') && user) {
                    const m = portrait.match(/^data:([^;]+);base64,(.+)$/);
                    if (m) {
                      const bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
                      const fn = `${user.id}/podcast/${Date.now()}-synthetic-person.png`;
                      const { data: up } = await supabase.storage.from('reels').upload(fn, bytes, { contentType: m[1], upsert: true });
                      if (up) portrait = supabase.storage.from('reels').getPublicUrl(fn).data.publicUrl;
                    }
                  }
                  if (!portrait) throw new Error('Could not generate person image');
                  twinForRun = {
                    id: `synthetic-${Date.now()}`,
                    name: 'AI Person',
                    reference_images: [portrait],
                    voice_cloning_key: undefined,
                    voice_sample_url: undefined,
                    face_description: 'AI-generated person matching the script tone',
                    gender: /\b(woman|female|mother|girl|she|her)\b/i.test(script) ? 'female' : 'male',
                    voice_engine: 'speechify',
                  } as AITwin;
                } catch (err: any) {
                  console.error('Synthetic person generation failed:', err);
                  toast({ title: 'Could not synthesize person', description: err.message || 'Please create an AI Twin first.', variant: 'destructive' });
                  return;
                }
              }

              const preset: ScriptVariation = {
                id: `marcus-${Date.now()}`,
                styleLabel: 'Marcus',
                settingLabel: 'Selfie',
                hook: script.split(/[.!?]/)[0]?.trim() || '',
                narration: script,
                visualDescription: `Talking-head selfie of ${twinForRun.name} delivering the script naturally on iPhone front camera with expressive eyes, small eyebrow lifts, soft head tilts, and calm pauses between thoughts.`,
              };
              generate(preset, script, twinForRun);
            }}
            onUseBatchPlan={handleBatchPlan}
            selectedCharacterName={selectedTwin?.name}
            brandContext={{
              brandName: brandContext.brandName,
              brandDescription: brandContext.brandDescription,
              productLines: brandContext.productLines,
              audience: brandContext.audience,
              websiteUrl: brandContext.websiteUrl,
              websiteSummary: brandContext.websiteSummary,
              userEmail: user?.email,
            }}
            availableTwins={twins.map(t => ({
              name: t.name,
              gender: t.gender,
              description: t.face_description || t.description,
            }))}
            isGenerating={isGenerating}
            generationStatus={progressStatus}
            generationProgress={progress}
            generationError={generationError}
            finalVideoUrl={videoUrl}
          />
        </div>

        {/* Right Panel — Production Controls */}
        <div className="flex-1 overflow-y-auto order-1 lg:order-2">
          <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-4 w-full mb-4">
                <TabsTrigger value="talking-head">
                  <Mic className="w-3.5 h-3.5 mr-1" /> Single
                </TabsTrigger>
                <TabsTrigger value="bulk">
                  <Layers className="w-3.5 h-3.5 mr-1" /> Bulk
                  {bulkItems.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">{bulkItems.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="from-content">
                  <Headphones className="w-3.5 h-3.5 mr-1" /> Podcast
                </TabsTrigger>
                <TabsTrigger value="history">
                  <History className="w-3.5 h-3.5 mr-1" /> History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="talking-head" className="space-y-5 mt-0">
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
                  <VideoPlayer videoUrl={videoUrl} title="Podcast Talking Head" className={`rounded-xl w-full mx-auto ${ASPECT_CSS[aspectRatio]}`} />
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
                        ~{message.trim().split(/\s+/).length} words • est. {Math.round(message.trim().split(/\s+/).length / 2.0)}s
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">💡 Tip: Use the AI Director to brainstorm content ideas</p>
                    )}
                  </div>
                  {/* Brand context strip — drives 4 variations */}
                  <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <p className="text-xs font-semibold truncate">
                          {brandContext.brandName ? `Brand: ${brandContext.brandName}` : 'No brand connected'}
                        </p>
                      </div>
                      {brandContext.productLines && (
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          {brandContext.productLines.split(';').length} products
                        </Badge>
                      )}
                    </div>
                    {brandContext.productLines && (
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{brandContext.productLines}</p>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={brandUrl}
                        onChange={e => setBrandUrl(e.target.value)}
                        placeholder={brandContext.websiteUrl || 'Optional: paste brand URL to refine context'}
                        className="h-8 text-xs rounded-lg"
                        disabled={isAnalyzingBrand}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={analyzeBrandUrl}
                        disabled={isAnalyzingBrand || !brandUrl.trim()}
                        className="h-8 text-xs rounded-lg flex-shrink-0"
                      >
                        {isAnalyzingBrand ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Analyze'}
                      </Button>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={generateVariations}
                    disabled={isGenerating || isGeneratingVariations || !message.trim()}
                    className="w-full rounded-lg border-dashed"
                  >
                    {isGeneratingVariations ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Writing 4 brand-aware variations...</>
                    ) : (
                      <><Wand2 className="w-4 h-4 mr-2" /> Generate 4 Script Variations {brandContext.brandName ? `(for ${brandContext.brandName})` : '(different styles & settings)'}</>
                    )}
                  </Button>
                </div>

                {/* Script Variations */}
                {variations.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" /> Pick a variation to render
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {variations.map((v) => {
                        const isActive = activeVariationId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setActiveVariationId(v.id)}
                            disabled={isGenerating}
                            className={`text-left p-3 rounded-xl border-2 transition-all space-y-2 ${
                              isActive
                                ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                                : 'border-border hover:border-muted-foreground/30 hover:bg-accent/50'
                            } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-wrap gap-1">
                                <Badge variant="secondary" className="text-[10px]">{v.styleLabel}</Badge>
                                <Badge variant="outline" className="text-[10px]">{v.settingLabel}</Badge>
                                {v.featuredProduct && (
                                  <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30 hover:bg-primary/20">{v.featuredProduct}</Badge>
                                )}
                                {v.showProduct && productImages.length > 0 && (
                                  <Badge className="text-[10px] bg-primary/15 text-primary border-primary/40">📦 Show product</Badge>
                                )}
                              </div>
                              {isActive && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                            </div>
                            {v.hook && <p className="text-xs font-medium text-foreground line-clamp-2">{v.hook}</p>}
                            <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">{v.narration}</p>
                            <div className="flex items-center justify-between gap-2 pt-0.5">
                              <p className="text-[10px] text-muted-foreground/70">~{v.narration.trim().split(/\s+/).length} words</p>
                              {v.audience && <p className="text-[10px] text-muted-foreground/70 truncate ml-2">→ {v.audience}</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {activeVariationId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const v = variations.find(x => x.id === activeVariationId);
                          if (v) setMessage(v.narration);
                        }}
                        className="text-xs"
                      >
                        Load selected script into the textarea above
                      </Button>
                    )}
                  </div>
                )}

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
                  {/* Custom duration input */}
                  <div className="flex items-center gap-2 pt-1">
                    <Label htmlFor="custom-duration" className="text-xs text-muted-foreground whitespace-nowrap">
                      Or enter exact length:
                    </Label>
                    <Input
                      id="custom-duration"
                      type="number"
                      min={MIN_DURATION}
                      max={MAX_DURATION}
                      step={5}
                      value={duration}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === '') { setDuration(''); return; }
                        const n = Math.max(MIN_DURATION, Math.min(MAX_DURATION, parseInt(v) || MIN_DURATION));
                        setDuration(String(n));
                      }}
                      disabled={isGenerating}
                      className="h-8 w-20 text-sm rounded-lg"
                    />
                    <span className="text-xs text-muted-foreground">
                          seconds (~{Math.round((parseInt(duration) || 0) * 2.0)} words)
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">
                    Range: {MIN_DURATION}–{MAX_DURATION}s. Scripts auto-target ~2.0 words/sec for slower, expressive delivery.
                  </p>
                </div>

                {/* Custom Audio Upload (overrides TTS) */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Upload className="w-4 h-4 text-primary" /> Custom voiceover (optional)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Upload an MP3/WAV to lip-sync onto the character instead of generating TTS.
                  </p>
                  {customAudioUrl ? (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{customAudioName}</p>
                        <audio src={customAudioUrl} controls className="w-full mt-2 h-8" />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => { setCustomAudioUrl(null); setCustomAudioName(null); }}
                        disabled={isGenerating}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="block border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:bg-accent/30 transition-colors">
                      <input
                        type="file"
                        accept="audio/mpeg,audio/mp3,audio/wav,audio/m4a,audio/x-m4a,.mp3,.wav,.m4a"
                        className="hidden"
                        disabled={isUploadingAudio || isGenerating}
                        onChange={(e) => e.target.files?.[0] && handleAudioUpload(e.target.files[0])}
                      />
                      {isUploadingAudio ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" /> Uploading...
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Click to upload MP3, WAV, or M4A (max 50MB)
                        </p>
                      )}
                    </label>
                  )}
                </div>

                <PodcastAspectRatioPicker value={aspectRatio} onChange={setAspectRatio} />

                {(() => {
                  const activeVar = variations.find(v => v.id === activeVariationId) || null;
                  const hasInput = activeVar ? true : !!message.trim();
                  return (
                    <Button
                      className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20"
                      size="lg"
                      onClick={() => generate(activeVar || undefined)}
                      disabled={isGenerating || !selectedTwinId || !hasInput}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          {progressStatus || 'Generating...'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 mr-2" />
                          {activeVar ? `Render "${activeVar.styleLabel}" variation` : 'Generate Talking Head'}
                        </>
                      )}
                    </Button>
                  );
                })()}

                {/* Progress */}
                {isGenerating && (
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2 rounded-full" />
                    <p className="text-xs text-center text-muted-foreground">{progressStatus}</p>
                  </div>
                )}
              </>
            )}
              </TabsContent>

              <TabsContent value="from-content" className="mt-0">
                <PodcastFromContent
                  onUseTranscriptForVideo={(t) => setMessage(t)}
                />
              </TabsContent>

              {/* ============== BULK QUEUE ============== */}
              <TabsContent value="bulk" className="space-y-4 mt-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Layers className="w-6 h-6 text-primary" />
                    <h1 className="text-2xl font-bold">Bulk Generate</h1>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ask Marcus to "Plan 10 Videos" → he'll cast a different AI Twin per video → review → bulk render.
                  </p>
                </div>

                {twins.length === 0 ? (
                  <Card className="border-dashed border-destructive/40">
                    <CardContent className="p-3 text-xs text-muted-foreground">
                      ⚠️ You need at least one AI Twin to run a bulk content batch.
                    </CardContent>
                  </Card>
                ) : !selectedTwin && bulkItems.some(i => !i.assignedTwinId) && (
                  <Card className="border-dashed border-primary/30">
                    <CardContent className="p-3 text-xs text-muted-foreground">
                      ⚠️ Some plans have no twin assigned. Pick a default character on the <button className="underline text-primary" onClick={() => setActiveTab('talking-head')}>Single tab</button> as a fallback.
                    </CardContent>
                  </Card>
                )}

                {bulkItems.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center space-y-3">
                      <Layers className="w-10 h-10 mx-auto text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        No queue yet. Click <strong>"Plan 10 Videos"</strong> in Marcus on the left.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Output type + actions */}
                    <Card>
                      <CardContent className="p-3 space-y-3">
                        {bulkOutput === 'video' && (
                          <PodcastAspectRatioPicker value={aspectRatio} onChange={setAspectRatio} />
                        )}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setBulkOutput('video')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${bulkOutput === 'video' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}
                            >
                              🎬 Full talking-head video
                            </button>
                            <button
                              type="button"
                              onClick={() => setBulkOutput('voiceover')}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${bulkOutput === 'voiceover' ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}
                            >
                              🎙️ Voiceover only (faster)
                            </button>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => setBulkItems(prev => prev.map(i => ({ ...i, selected: true })))}>
                              <CheckSquare className="w-3 h-3 mr-1" /> All
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => setBulkItems(prev => prev.map(i => ({ ...i, selected: false })))}>
                              <Square className="w-3 h-3 mr-1" /> None
                            </Button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1 h-11 rounded-xl bg-gradient-to-r from-primary to-primary/80"
                            onClick={() => startBulkGeneration()}
                            disabled={isBulkRunning || twins.length === 0 || bulkItems.filter(i => i.selected && i.status !== 'done').length === 0}
                          >
                            {isBulkRunning ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running queue...</>
                            ) : (
                              <><Sparkles className="w-4 h-4 mr-2" /> Bulk generate {bulkItems.filter(i => i.selected && i.status !== 'done').length} {bulkOutput === 'video' ? 'videos' : 'voiceovers'}</>
                            )}
                          </Button>
                          {isBulkRunning && (
                            <Button
                              variant="destructive"
                              className="h-11 rounded-xl"
                              onClick={stopBulkGeneration}
                              disabled={bulkStopRef.current}
                            >
                              <X className="w-4 h-4 mr-1" /> Stop
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Queue list */}
                    <div className="space-y-2">
                      {bulkItems.map((it, idx) => (
                        <Card key={it.id} className={`${it.status === 'done' ? 'border-primary/30 bg-primary/5' : it.status === 'failed' ? 'border-destructive/40' : ''}`}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => toggleBulkSelected(it.id)}
                                disabled={isBulkRunning || it.status === 'done'}
                                className="mt-0.5 flex-shrink-0"
                              >
                                {it.selected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                              </button>
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-mono text-muted-foreground">#{idx + 1}</span>
                                  <p className="text-sm font-semibold truncate">{it.plan.topic}</p>
                                  {it.assignedTwinName && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-primary/40 text-primary">
                                      🎭 {it.assignedTwinName}
                                    </Badge>
                                  )}
                                  {it.status === 'done' && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">Done</Badge>}
                                  {it.status === 'failed' && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
                                  {it.status !== 'pending' && it.status !== 'done' && it.status !== 'failed' && (
                                    <Badge variant="secondary" className="text-[10px]"><Loader2 className="w-2.5 h-2.5 mr-1 animate-spin inline" /> {it.status}</Badge>
                                  )}
                                </div>
                                {it.plan.hook && <p className="text-[11px] text-muted-foreground line-clamp-1 italic">"{it.plan.hook}"</p>}
                                <p className="text-[11px] text-muted-foreground line-clamp-2">{it.plan.narration}</p>
                                {it.error && <p className="text-[11px] text-destructive">{it.error}</p>}
                                {it.status !== 'pending' && it.status !== 'done' && it.status !== 'failed' && (
                                  <Progress value={it.progress} className="h-1" />
                                )}
                                {it.videoUrl && (
                                  <video src={it.videoUrl} controls className="w-32 rounded-md mt-1 aspect-[9/16] object-cover" />
                                )}
                                {!it.videoUrl && it.audioUrl && (
                                  <audio src={it.audioUrl} controls className="w-full h-7 mt-1" />
                                )}
                              </div>
                              <div className="flex flex-col gap-1">
                                {it.status === 'failed' && (
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs"
                                    onClick={() => retryBulkItem(it.id)} disabled={isBulkRunning}>
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs"
                                  onClick={() => removeBulkItem(it.id)} disabled={isBulkRunning}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* ============== HISTORY ============== */}
              <TabsContent value="history" className="space-y-4 mt-0">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <History className="w-6 h-6 text-primary" />
                      <h1 className="text-2xl font-bold">Podcast History</h1>
                    </div>
                    <p className="text-sm text-muted-foreground">All your talking-head projects. Click to edit & re-render.</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={loadHistory}>
                    <RefreshCw className={`w-4 h-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                  </Button>
                </div>

                {loadingHistory ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                ) : history.length === 0 ? (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      No podcast projects yet. Generate one to see it here.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {history.map(h => (
                      <Card key={h.id} className={h.status === 'done' ? 'border-primary/20' : h.status === 'failed' ? 'border-destructive/30' : ''}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <p className="text-sm font-semibold truncate">{h.topic}</p>
                                {h.status === 'done' && <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">Done</Badge>}
                                {h.status === 'failed' && <Badge variant="destructive" className="text-[10px]">Failed</Badge>}
                                {h.twin_name && <Badge variant="outline" className="text-[10px]">{h.twin_name}</Badge>}
                                {h.duration && <Badge variant="outline" className="text-[10px]">{h.duration}s</Badge>}
                              </div>
                              {h.hook && <p className="text-[11px] text-muted-foreground italic line-clamp-1">"{h.hook}"</p>}
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{h.narration}</p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1">{new Date(h.created_at).toLocaleString()}</p>
                            </div>
                            <div className="flex flex-col gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => editFromHistory(h)} title="Edit script">
                                <Wand2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                onClick={() => deleteHistoryItem(h.id)} title="Delete">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {h.video_url && (
                              <video src={h.video_url} controls className="w-28 rounded-md aspect-[9/16] object-cover" />
                            )}
                            {!h.video_url && h.audio_url && (
                              <audio src={h.audio_url} controls className="w-full h-8" />
                            )}
                            {h.video_url && (
                              <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                                <a href={h.video_url} download target="_blank" rel="noopener noreferrer">
                                  <Download className="w-3 h-3 mr-1" /> Download
                                </a>
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Podcast;
