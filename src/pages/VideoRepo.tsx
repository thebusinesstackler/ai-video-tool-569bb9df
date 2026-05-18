import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Upload,
  Save,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Package,
  Scissors,
  Lock,
} from 'lucide-react';
import { ProductPickerDialog, type SelectedProductContext } from '@/components/ProductPickerDialog';
import { FrameExtractorDialog } from '@/components/FrameExtractorDialog';
import { ARCHETYPE_LIST, CONTENT_ARCHETYPES, buildArchetypeBlock, type ContentArchetypeId } from '@/data/contentArchetypes';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { createWaveSpeedVideo, getWaveSpeedVideoJob } from '@/lib/wavespeed';
import { downloadSocialVideoToStorage } from '@/lib/socialVideoDownload';
import ReactMarkdown from 'react-markdown';

interface MotionApprovalCard {
  strategy: string;
  startUrl: string;
  endUrl: string;
  motionPrompt: string;
  model: 'keyframe-interpolation' | 'vidu-start-end' | 'seedance-i2v';
  duration: 5 | 10;
  productImageUrl?: string | null;
  productName?: string | null;
  productSwapStatus?: 'none' | 'applied' | 'partial' | 'failed';
  productSwapNote?: string | null;
  status: 'pending' | 'approved' | 'cancelled';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { type: 'image' | 'video'; url: string; name?: string }[];
  videoResult?: { url: string; status: string };
  approvalCard?: MotionApprovalCard;
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
  model?: string | null;
  external_task_id?: string | null;
  custom_name?: string | null;
}

const MODEL_OPTIONS = [
  'openai/sora-2/image-to-video',
  'openai/sora-2/text-to-video',
  'wan-2.5-i2v',
  'wan-2.5-t2v',
  'veo3',
  'kling-1.5',
  'runway-gen3',
  'pika-1.0',
  'other',
];

const statusColors: Record<string, string> = {
  analyzing: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  generating: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  completed: 'bg-green-500/15 text-green-600 border-green-500/30',
  failed: 'bg-red-500/15 text-red-600 border-red-500/30',
};

const VideoRepo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState<'create' | 'history' | 'import'>('create');
  const [activeTab, setActiveTab] = useState<'ad' | 'motion'>('ad');
  const [mode, setMode] = useState<'guided' | 'freeform'>('guided');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [referenceVideoUrl, setReferenceVideoUrl] = useState<string | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [referenceVideoName, setReferenceVideoName] = useState('');
  const [productImageName, setProductImageName] = useState('');
  const [referenceVideoFile, setReferenceVideoFile] = useState<File | null>(null);
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [soraDuration, setSoraDuration] = useState<10 | 20>(10);
  const [lockProduct, setLockProduct] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [selectedProductCtx, setSelectedProductCtx] = useState<SelectedProductContext | null>(null);
  const [inputMode, setInputMode] = useState<'i2v' | 't2v'>('i2v');
  const [outputFormat, setOutputFormat] = useState<'9:16' | '16:9'>('9:16');
  const [bulkCount, setBulkCount] = useState<number>(1);
  const [contentStyle, setContentStyle] = useState<ContentArchetypeId>('auto');
  const [brandProfile, setBrandProfile] = useState<{ company_name: string | null; brand_url: string | null; brand_description: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isDownloadingUrl, setIsDownloadingUrl] = useState(false);

  // Iterative chat state
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [followUpImageFile, setFollowUpImageFile] = useState<File | null>(null);
  const [followUpImageUrl, setFollowUpImageUrl] = useState<string | null>(null);
  const [followUpImageName, setFollowUpImageName] = useState('');
  const [lastVideoPrompt, setLastVideoPrompt] = useState<string | null>(null);
  const [lastPersistentImageUrl, setLastPersistentImageUrl] = useState<string | null>(null);
  const followUpFileRef = useRef<HTMLInputElement>(null);

  // Motion tab state
  const [motionStartFrame, setMotionStartFrame] = useState<File | null>(null);
  const [motionStartFramePreview, setMotionStartFramePreview] = useState<string | null>(null);
  const [motionEndFrame, setMotionEndFrame] = useState<File | null>(null);
  const [motionEndFramePreview, setMotionEndFramePreview] = useState<string | null>(null);
  const [motionModel, setMotionModel] = useState<'keyframe-interpolation' | 'vidu-start-end' | 'seedance-i2v'>('keyframe-interpolation');
  const [motionPrompt, setMotionPrompt] = useState('');
  const [motionDuration, setMotionDuration] = useState<5 | 10>(5);
  const [isMotionGenerating, setIsMotionGenerating] = useState(false);
  const [isAutoMotion, setIsAutoMotion] = useState(false);
  const [autoMotionStatus, setAutoMotionStatus] = useState<string>('');
  const motionStartRef = useRef<HTMLInputElement>(null);
  const motionEndRef = useRef<HTMLInputElement>(null);


  // History state
  const [historyProjects, setHistoryProjects] = useState<VideoRepoProject[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedProject, setSelectedProject] = useState<VideoRepoProject | null>(null);
  const [frameExtractor, setFrameExtractor] = useState<{ url: string; projectId: string; label: string } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 9;

  // Import tab state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importVideoUrl, setImportVideoUrl] = useState<string | null>(null);
  const [importFrames, setImportFrames] = useState<string[]>([]);
  const [isImportAnalyzing, setIsImportAnalyzing] = useState(false);
  const [importAnalysis, setImportAnalysis] = useState<any>(null);
  const [importSuggestedPrompt, setImportSuggestedPrompt] = useState('');
  const [importModel, setImportModel] = useState('');
  const [importTaskId, setImportTaskId] = useState('');
  const [importCustomName, setImportCustomName] = useState('');
  const [isImportSaving, setIsImportSaving] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  const [importUrlInput, setImportUrlInput] = useState('');
  const [isImportingFromUrl, setIsImportingFromUrl] = useState(false);
  const importVideoInputRef = useRef<HTMLInputElement>(null);

  const hasComposerInput = inputMode === 't2v'
    ? Boolean(prompt.trim())
    : Boolean(prompt.trim() || referenceVideoUrl || productImageUrl);
  const hasFollowUpInput = Boolean(followUpPrompt.trim() || followUpImageUrl);
  const conversationComplete = messages.some(m => m.videoResult) || messages.some(m => m.content.includes('```video-prompt'));
  const showFollowUpComposer = conversationComplete && !isAnalyzing && !isGenerating;
  const showConversation = messages.length > 0 || isAnalyzing || isGenerating || isExtractingFrames;
  const statusLabel = isExtractingFrames
    ? 'Extracting key frames from your reference video...'
    : isAnalyzing
      ? 'Researching the reference video and writing your new ad...'
      : isGenerating
        ? 'Generating your video with Sora 2...'
        : null;

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    window.requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  };

  useEffect(() => {
    if (!showConversation) return;
    scrollToBottom(messages.length > 0 ? 'smooth' : 'auto');
  }, [messages, showConversation, isAnalyzing, isGenerating, isExtractingFrames]);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('video_repo_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistoryProjects((data as VideoRepoProject[]) || []);
    } catch (err: any) {
      console.error('Error fetching history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

  // Fetch brand profile (company name, URL, description) for brand-aware prompts
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('company_name, brand_url, brand_description')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) setBrandProfile(data);
    })();
  }, [user]);

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
    const fileName = `${user.id}/video-repo/${subfolder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('reels').upload(fileName, file, { contentType: file.type });
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
        // Auto-detect output format from reference video aspect
        if (video.videoWidth && video.videoHeight) {
          const aspect = video.videoWidth / video.videoHeight;
          const detected: '9:16' | '16:9' = aspect < 1 ? '9:16' : '16:9';
          setOutputFormat((prev) => {
            if (prev !== detected) {
              toast({
                title: detected === '9:16' ? 'Detected vertical format' : 'Detected horizontal format',
                description: `Set to ${detected === '9:16' ? 'Reel (9:16)' : 'YouTube (16:9)'}. You can change this anytime.`,
              });
            }
            return detected;
          });
        }
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
    setSelectedProductCtx(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleProductPicked = (ctx: SelectedProductContext) => {
    setSelectedProductCtx(ctx);
    setProductImageUrl(ctx.imageUrl);
    setProductImageName(`${ctx.productName}${ctx.imageLabel ? ` — ${ctx.imageLabel}` : ''}`);
    setProductImageFile(null); // URL already in storage
    toast({ title: 'Product added', description: `${ctx.productName} will be featured in the video.` });
  };

  const handleUrlImport = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed || isDownloadingUrl) return;
    try {
      new URL(trimmed);
    } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid TikTok, YouTube, or video URL.', variant: 'destructive' });
      return;
    }
    setIsDownloadingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('download-video-url', {
        body: { url: trimmed },
      });
      if (error) throw new Error(typeof error === 'object' && 'message' in error ? error.message : 'Download failed');
      
      let finalVideoUrl = data?.videoUrl;
      
      // Handle client-side download fallback
      if (!finalVideoUrl && data?.clientDownload && data?.downloadUrl && data?.signedUploadUrl && data?.publicUrl) {
        toast({ title: 'Downloading video...', description: 'Browser is fetching the video directly.' });
        
        const fetchHeaders: Record<string, string> = {};
        if (data.rapidApiKey) {
          fetchHeaders['X-RapidAPI-Key'] = data.rapidApiKey;
          fetchHeaders['X-RapidAPI-Host'] = 'social-media-video-downloader.p.rapidapi.com';
        }
        
        let videoBlob: Blob | null = null;
        try {
          const resp = await fetch(data.downloadUrl, { headers: fetchHeaders });
          if (resp.ok) {
            const blob = await resp.blob();
            if (blob.size > 1000) videoBlob = blob;
          }
        } catch {
          try {
            const resp = await fetch(data.downloadUrl);
            if (resp.ok) {
              const blob = await resp.blob();
              if (blob.size > 1000) videoBlob = blob;
            }
          } catch { /* continue */ }
        }
        
        if (videoBlob && videoBlob.size <= 100 * 1024 * 1024) {
          const uploadResp = await fetch(data.signedUploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': videoBlob.type || 'video/mp4' },
            body: videoBlob,
          });
          if (uploadResp.ok) {
            finalVideoUrl = data.publicUrl;
          }
        }
      }
      
      if (!finalVideoUrl) throw new Error(data?.error || 'YouTube blocked this download. Please download the video to your device first, then drag & drop it here.');

      // Set as reference video
      if (referenceVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(referenceVideoUrl);
      setReferenceVideoUrl(finalVideoUrl);
      try {
        const hostname = new URL(trimmed).hostname.replace('www.', '');
        setReferenceVideoName(`${hostname} import`);
      } catch {
        setReferenceVideoName('URL import');
      }
      setReferenceVideoFile(null);
      setUrlInput('');
      setVideoFrames([]);

      // Extract frames from the downloaded video
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
      toast({ title: 'Import failed', description: err.message || 'Could not download video from URL', variant: 'destructive' });
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

  const analyzeAndGenerate = async () => {
    if (isExtractingFrames) {
      toast({ title: 'Reference video still processing', description: 'Please wait for frame extraction to finish.' });
      return;
    }
    const trimmedPrompt = prompt.trim();
    if (inputMode === 't2v') {
      if (!trimmedPrompt) return;
    } else {
      if (!trimmedPrompt && !referenceVideoUrl && !productImageUrl) return;
    }

    // Upload files to storage for persistence
    let persistentVideoUrl: string | null = null;
    let persistentImageUrl: string | null = null;

    try {
      if (referenceVideoFile) {
        persistentVideoUrl = await uploadFileToStorage(referenceVideoFile, 'videos');
      } else if (referenceVideoUrl && !referenceVideoUrl.startsWith('blob:')) {
        // URL import — already stored in Supabase Storage
        persistentVideoUrl = referenceVideoUrl;
      }
      if (productImageFile) {
        persistentImageUrl = await uploadFileToStorage(productImageFile, 'images');
      } else if (productImageUrl && !productImageUrl.startsWith('blob:')) {
        // Remix / picked-from-gallery — image already lives at a public URL
        persistentImageUrl = productImageUrl;
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'File upload failed', description: err.message, variant: 'destructive' });
    }

    // Create DB record
    let projectId: string | null = null;
    if (user) {
      try {
        const { data: insertedRow, error: insertErr } = await supabase
          .from('video_repo_projects')
          .insert({
            user_id: user.id,
            prompt: trimmedPrompt || 'Analyze reference and generate ad',
            reference_video_url: persistentVideoUrl,
            product_image_url: persistentImageUrl,
            status: 'analyzing',
          })
          .select('id')
          .single();
        if (insertErr) console.error('Insert error:', insertErr);
        else { projectId = insertedRow.id; setCurrentProjectId(insertedRow.id); }
      } catch (err) {
        console.error('DB insert error:', err);
      }
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmedPrompt || 'Analyze this reference and generate a UGC ad video.',
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

      // Brand block — derive the brand ONLY from what the user's idea/request says.
      // Do NOT pull from the saved profile; each video can be for a different brand.
      const brandBlock = `\n\n**🏷️ BRAND SOURCING RULE (read carefully):**
The brand for THIS video comes ONLY from the user's request below (and the attached product image, if any). It is NOT stored anywhere else — there is no global "house brand".

🚫 ABSOLUTE RULES (violating these = broken output):
- Do NOT invent, hallucinate, or substitute a brand name. No "Adtomic", "Adtp,oc", "BrandX", or any random startup name.
- Do NOT invent a website URL. No "yoursite.com", "brand.app", "YourWebsite.com", or any made-up domain.
- If the user explicitly names a brand or URL in their request (e.g. "make an ad for busybee.guru"), use that EXACT name and that EXACT URL verbatim — character-for-character — in the script, voiceover, and on-screen CTA. Do NOT respell phonetically: "busybee" must NEVER become "Buzzy Bee", "Busy Bee", or "BusyBee". Copy the spelling letter-for-letter from the user's message.
- If the user does NOT name a brand, stay completely generic — refer to "this product", "the bottle", "the kit". The CTA must be a felt benefit ("Clear by 3pm.") or specific number ("11 days. No fog.") — NEVER a fake URL or made-up brand name.
- The product on screen must match the attached reference image (if provided). Do NOT redesign labels or invent product names that aren't visible on the reference.`;


      // Recent-history awareness — gives Marco the last 8 successful concepts so it doesn't repeat itself
      const recentSuccesses = (historyProjects || [])
        .filter((p) => p.status === 'completed' && (p.prompt || p.analysis_text))
        .slice(0, 8);
      const historyBlock = recentSuccesses.length > 0
        ? `\n\n**📚 RECENT WORK FOR THIS BRAND (avoid repeating these — make this one distinct):**
${recentSuccesses.map((p, i) => {
  const concept = (p.analysis_text || p.prompt || '').replace(/\s+/g, ' ').slice(0, 180);
  return `${i + 1}. [${p.model || 'video'}] ${(p.custom_name || p.prompt || 'Untitled').slice(0, 60)} — ${concept}${concept.length >= 180 ? '…' : ''}`;
}).join('\n')}
RULES: Do NOT reuse the same hook, opening line, setting, or shot composition from the videos above. Vary the archetype, beverage choice (water/coffee/tea/smoothie/juice), location, time-of-day, and emotional arc. If the user keeps making the same product, your job is to find a NEW angle each time.`
        : '';

      const systemPrompt = (inputMode === 't2v'
        ? `You are a UGC ad video strategist and creative director specializing in pure text-to-video generation (no product image required). Your job is to translate the user's idea into a cinematic, scroll-stopping ad concept built from scratch. Focus on scene/concept storytelling: vivid setting, character casting, action choreography, lighting mood, camera movement, sound design. Enforce: a dynamic hook in the first 1.5s, a spoken voice script paced at ~2.5 words/second, studio-clean broadcast audio, and a varied creative style — never default to the same format twice (rotate Founder POV, ASMR Ritual, PAS, Mockumentary, Before/After, Kinetic Typography, Day-in-the-Life, etc.).`
        : `You are a UGC ad video strategist and visual analyst. When given reference video frames, study them carefully: identify the hook technique (first 3 seconds), pacing rhythm, camera movements, talent actions, lighting style, text overlays, and transition patterns. Use these insights to craft a new video that captures the same energy and conversion potential.`)
        + brandBlock
        + historyBlock;

      const productContextBlock = selectedProductCtx
        ? `\n\n**FEATURED PRODUCT (must appear naturally in the ad):**
- Name: ${selectedProductCtx.productName}
${selectedProductCtx.description ? `- Description: ${selectedProductCtx.description}` : ''}
${selectedProductCtx.benefits && selectedProductCtx.benefits.length ? `- Key benefits: ${selectedProductCtx.benefits.join(', ')}` : ''}
${selectedProductCtx.targetAudience ? `- Target audience: ${selectedProductCtx.targetAudience}` : ''}
- Reference image: provided above (treat as the hero product to feature)`
        : '';

      const productFidelityBlock = persistentImageUrl
        ? `\n\n**🔒 PRODUCT FIDELITY (NON-NEGOTIABLE):**
The attached image is the EXACT hero product. The video model MUST keep label text, color, bottle/box shape, cap, branding, and proportions PIXEL-IDENTICAL to the reference image. Do NOT redesign, restyle, recolor, or invent variants. Do NOT change the label typography. The product on screen must be visually indistinguishable from the reference.`
        : '';

      const archetypeBlock = buildArchetypeBlock(contentStyle);
      const archetype = CONTENT_ARCHETYPES[contentStyle];
      const noDialogue = archetype.noDialogue === true;
      const disableHookBank = archetype.disableHookBank === true;
      const disableCTA = archetype.disableCTA === true;

      const analysisInstruction = `User request: "${userMsg.content}"

${videoFrames.length > 0 ? `Reference video: "${referenceVideoName}" — I've provided ${videoFrames.length} key frames above. Study them carefully.` : ''}
${productImageUrl ? 'Product image provided above — incorporate this product naturally.' : ''}${productContextBlock}${productFidelityBlock}${archetypeBlock}

Target duration: ${soraDuration} seconds. The script and action MUST fully fill this duration with a complete arc that respects the ARCHETYPE LOCK above — no fade-outs before the end, no dead air.

Provide:
1. **Reference Analysis**: ${contentStyle === 'auto' ? 'Begin with "ARCHETYPE: [chosen archetype name]" and a 1-line reason. Then describe' : `Confirm "ARCHETYPE: ${archetype.label}" then describe`} what you observed in the reference frames (if any) — hook type, pacing, camera style, talent energy.
${disableHookBank ? '' : '2. **Hook Strategy**: How the first 1.5–3 seconds will stop the scroll, written to the archetype\'s opening rule (NOT a generic "I used to feel…" opener).'}
${noDialogue
  ? `${disableHookBank ? '2' : '3'}. **SOUND DESIGN MANIFEST**: Timed beats (0-3s, 3-8s, etc.) summing to exactly ${soraDuration}s. List every sound + texture (NO spoken words). Example: "0–2s: glass placed on counter (clink), 2–4s: dropper squeeze (3 distinct squeezes), 4–6s: drops hitting liquid (plip, plip, plip)."`
  : `${disableHookBank ? '2' : '3'}. **Scene-by-Scene Script**: Timed beats (0-3s, 3-8s, etc.) summing to exactly ${soraDuration}s. Voiceover paced at a NATURAL conversational ~1.9 words/second (HARD CAP: ${Math.max(1, Math.floor((soraDuration - 4) * 1.9))} words total for the ENTIRE spoken script — count every word, do NOT exceed). Leave ~2s of silent breathing room at the START and ~2s at the END so the actor finishes comfortably before the clip cuts. Write spoken lines in the archetype's voice — NOT polished ad copy. Use contractions, real diction, allowed filler. If the script would exceed the word cap, CUT lines — never compress delivery or rush the pace.`}
${disableHookBank ? '3' : '4'}. **PERFORMANCE DIRECTION** — required labeled lines for the actor (skip if archetype is ASMR with no actor face): BREATH:, EYES:, HANDS:, POSTURE:, MICRO-EXPRESSION:, PACING:, EMOTIONAL ARC:. Match the archetype's acting rules above.
${disableHookBank ? '4' : '5'}. **CAMERA INTELLIGENCE** — labeled lines: LENS FEEL:, ENERGY: (handheld/locked/slider/etc), CUT PACING:, PUSH-IN:, FOCUS:. Match the archetype's camera direction above.
${disableHookBank ? '5' : '6'}. **ACTION MANIFEST** — a literal bullet list of countable physical actions the video model MUST execute exactly. Be specific with COUNTS and TARGETS. For dropper/tincture products: ALWAYS specify "squeeze dropper 3-5 times — multiple visible drops fall into a [water glass / coffee mug / tea cup / smoothie / juice]" — NEVER just "a dropper in water." Pick a beverage that fits the scene (water, coffee, tea, smoothie, juice) and name it explicitly. Other examples: "hand lifts glass once," "stir spoon clockwise twice." Format:
\`\`\`
ACTION MANIFEST (execute exactly):
- [action 1 with explicit count/direction]
- [action 2]
\`\`\`
${disableHookBank ? '6' : '7'}. **CONTINUITY ANCHOR** (only if 2 segments): list things that MUST match across clips — same shirt, same hand position, same product placement, same lighting angle.
${disableHookBank ? '7' : '8'}. **Product Integration**: How and when the product appears, per the archetype's product-integration rule (must match reference image exactly if attached).
${disableCTA ? '' : `${disableHookBank ? '8' : '9'}. **CTA / Closing**: Final 2-3 seconds payoff line + on-screen text. BANNED: "Revitalize Your Day", "Try It Today", "Transform Your Life", "YourWebsite.com", any placeholder URL, any invented brand name. Use ONE of: a specific number ("11 days. No fog."), a direct test ("Try it for a week."), a felt benefit ("Clear by 3pm."), OR — only if the user's request explicitly names a brand or URL — the EXACT name/URL the user wrote (verbatim, no edits). Never invent a brand or domain.`}

Then provide a final **VIDEO PROMPT** block:

\`\`\`video-prompt
[180–280 word cinematic directive that EXECUTES the ARCHETYPE LOCK above. Cover: environment, character, action choreography (literal counts from ACTION MANIFEST — non-negotiable), camera movement (per archetype), lighting, product placement (pixel-identical to reference if attached), pacing, performance direction (per archetype), final-frame description.

🎬 **SHOT STRUCTURE (MANDATORY — this is an ad, not a single locked-off take):** Break the ${soraDuration}s into ${soraDuration <= 10 ? '2–3' : '3–4'} distinct shots with clean hard CUTS between them. For EACH shot write a labeled block: \`SHOT 1 (0–Xs) — [framing: WIDE / MEDIUM / CLOSE-UP / INSERT / OVER-THE-SHOULDER]: [action + camera + what's on screen]\`. Vary framing between shots (don't stay in the same medium shot the whole time). Typical pattern: HOOK shot (tight, attention-grabbing) → DEMO / RITUAL shots (medium + insert close-ups of the product in use) → PAYOFF / HERO shot (clean product hero or satisfied-user close-up). The CUTS themselves must be written into the prompt as "CUT TO:" so Sora-2 actually renders them.

🏁 **CLOSE-OUT (MANDATORY):** The final shot must be a deliberate HERO BEAT — a clean, held composition of the product (or product + brand-confident user) with the on-screen CTA text fully visible for the last 1.5–2s. No fade-out, no motion-blur exit, no mid-action freeze. The viewer's last frame must be a screenshot-worthy hero shot that names the brand.

🔊 **AUDIO IS MANDATORY — Sora-2 only renders sound when explicitly written in this prompt.** You MUST include an "AUDIO:" section near the end with:
${noDialogue
  ? `  • Detailed diegetic sound design — every sound, in order, with texture words (clink, squeeze, plip, pour, whoosh, ambient room tone). NO music unless specified. NO speech.`
  : `  • The full spoken voiceover written as literal quoted dialogue, e.g.: \`The woman speaks directly to camera in a warm, conversational tone: "I tried this for 11 days. By day 4, the brain fog was just… gone."\` — include EVERY word she says, in quotes, with delivery direction (warm/dry/excited/whispered). Sora-2 will NOT generate speech without quoted lines in this prompt.\n  • Plus diegetic ambient sound (room tone, dropper squeeze, glass clink, etc.).\n  • Voice gender + age + tone descriptor (e.g. "female, late 20s, warm and grounded").`}

Explicitly state "Follow the ACTION MANIFEST literally — counts are non-negotiable." End with the HERO close-out shot description so the ${soraDuration}s video lands on a complete brand payoff, not a cut-off.]
\`\`\``

      contentParts.push({ type: 'text', text: analysisInstruction });

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
          ? JSON.stringify(aiError)
          : (aiError.message || 'AI analysis failed');
        throw new Error(errorBody);
      }

      if (!aiData?.response) {
        throw new Error('No response from AI. The model may be overloaded — please try again.');
      }

      const analysisText = aiData.response;

      // Update DB with analysis
      if (projectId) {
        await supabase.from('video_repo_projects').update({ analysis_text: analysisText, status: 'generating' }).eq('id', projectId);
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: analysisText,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsAnalyzing(false);

      const videoPromptMatch = analysisText.match(/```video-prompt\n([\s\S]*?)```/);
      if (videoPromptMatch) {
        const videoPrompt = videoPromptMatch[1].trim();
        setLastVideoPrompt(videoPrompt);
        setLastPersistentImageUrl(persistentImageUrl);

        // Update DB with video prompt
        if (projectId) {
          await supabase.from('video_repo_projects').update({ video_prompt: videoPrompt }).eq('id', projectId);
        }

        setIsGenerating(true);

        const generatingMsg: ChatMessage = {
          id: `assistant-gen-${Date.now()}`,
          role: 'assistant',
          content: '🎬 Generating your UGC ad video with Sora-2... This may take a few minutes.',
        };
        setMessages((prev) => [...prev, generatingMsg]);

        const isT2V = inputMode === 't2v' || !persistentImageUrl;
        const useProductLock = lockProduct && !!persistentImageUrl && !isT2V;
        const generationModel = useProductLock ? 'wan-2.5-i2v' : 'sora-2';
        if (useProductLock) {
          setMessages((prev) => prev.map(m => m.id === generatingMsg.id ? { ...m, content: `🔒 Locking product to attached reference image. 🎬 Generating with Wan 2.5 i2v (product-locked) for pixel-accurate product fidelity...` } : m));
        } else if (isT2V) {
          setMessages((prev) => prev.map(m => m.id === generatingMsg.id ? { ...m, content: `📝 Text → Video: Generating with Sora 2...` } : m));
        } else {
          setMessages((prev) => prev.map(m => m.id === generatingMsg.id ? { ...m, content: `🎬 Generating with Sora 2...` } : m));
        }
        console.log('[VideoRepo] Generation routing:', { generationModel, hasImage: !!persistentImageUrl, persistentImageUrl, useProductLock, isT2V });
        // Build N variants. 3 base creative variations cycled across bulkCount.
        const variantHints = [
          '', // base
          '\n\n[Variation B] Try a different opening hook angle and slightly faster pacing while keeping the same product, characters, setting, and overall message.',
          '\n\n[Variation C] Use an alternate camera framing (e.g. tighter close-up or wider establishing shot) and a different lighting mood while keeping the same product, characters, setting, and overall message.',
        ];
        const totalVariants = Math.max(1, bulkCount);
        const variantPrompts = Array.from({ length: totalVariants }, (_, i) => videoPrompt + variantHints[i % variantHints.length]);

        if (totalVariants > 1) {
          setMessages((prev) => prev.map(m => m.id === generatingMsg.id ? { ...m, content: `🎬 Bulk generating ${totalVariants} variants in parallel...` } : m));
        }

        const runOne = async (variantPrompt: string, idx: number) => {
          try {
            const taskId = await createWaveSpeedVideo({
              prompt: variantPrompt,
              model: generationModel,
              aspectRatio: outputFormat,
              duration: soraDuration,
              userId: user?.id,
              source: 'video-repo',
              ...(persistentImageUrl ? { imageUrls: [persistentImageUrl] } : {}),
            });
            let attempts = 0;
            const maxAttempts = 120;
            while (attempts < maxAttempts) {
              await new Promise((r) => setTimeout(r, 5000));
              const job = await getWaveSpeedVideoJob(taskId);
              if (job.status === 'completed' && job.videoUrl) {
                if (user) {
                  await supabase.from('generated_images').insert({
                    user_id: user.id,
                    image_url: job.videoUrl,
                    prompt: variantPrompt,
                    source: 'video-repo',
                    reference_image_url: persistentImageUrl,
                  });
                }
                const resultMsg: ChatMessage = {
                  id: `result-${Date.now()}-${idx}`,
                  role: 'assistant',
                  content: totalVariants > 1 ? `✅ Variant ${idx + 1} of ${totalVariants} ready!` : '✅ Your UGC ad video is ready! You can download it or use it directly.',
                  videoResult: { url: job.videoUrl, status: 'completed' },
                };
                setMessages((prev) => prev.concat(resultMsg));
                return job.videoUrl;
              }
              if (job.status === 'failed') throw new Error(job.error || 'Video generation failed');
              attempts++;
            }
            throw new Error('Video generation timed out.');
          } catch (e: any) {
            const errorMsg: ChatMessage = {
              id: `error-${Date.now()}-${idx}`,
              role: 'assistant',
              content: `⚠️ Variant ${idx + 1} failed: ${e.message}`,
            };
            setMessages((prev) => prev.concat(errorMsg));
            return null;
          }
        };

        try {
          const results = await Promise.all(variantPrompts.map((p, i) => runOne(p, i)));
          const firstUrl = results.find((u) => !!u) || null;
          if (projectId && firstUrl) {
            await supabase.from('video_repo_projects').update({
              generated_video_url: firstUrl,
              status: 'completed',
            }).eq('id', projectId);
          }
          setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id));
          fetchHistory();
        } catch (genErr: any) {
          if (projectId) {
            await supabase.from('video_repo_projects').update({ status: 'failed' }).eq('id', projectId);
          }
          const errorMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Video generation encountered an issue: ${genErr.message}. You can copy the video prompt above and try again.`,
          };
          setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id).concat(errorMsg));
        }
        setIsGenerating(false);
      } else {
        // No video prompt extracted - mark as completed (analysis only)
        if (projectId) {
          await supabase.from('video_repo_projects').update({ status: 'completed' }).eq('id', projectId);
        }
      }
      fetchHistory();
    } catch (err: any) {
      console.error('[VideoRepo] Analysis error:', err);
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
      setIsGenerating(false);
      fetchHistory();
    }
  };

  // === Follow-up chat handler ===
  const handleFollowUp = async () => {
    const trimmed = followUpPrompt.trim();
    if (!trimmed && !followUpImageUrl) return;
    if (isAnalyzing || isGenerating) return;

    // Upload new product image if provided
    let newImageUrl: string | null = lastPersistentImageUrl;
    if (followUpImageFile) {
      try {
        newImageUrl = await uploadFileToStorage(followUpImageFile, 'images');
        setLastPersistentImageUrl(newImageUrl);
      } catch (err: any) {
        toast({ title: 'Image upload failed', description: err.message, variant: 'destructive' });
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed || 'Update the video with the new product image.',
      attachments: followUpImageUrl ? [{ type: 'image' as const, url: followUpImageUrl, name: followUpImageName }] : [],
    };
    setMessages(prev => [...prev, userMsg]);
    setFollowUpPrompt('');
    setFollowUpImageFile(null);
    setFollowUpImageUrl(null);
    setFollowUpImageName('');
    setIsAnalyzing(true);
    scrollToBottom('auto');

    try {
      // Build conversation history for AI context
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const contentParts: any[] = [];
      if (newImageUrl && followUpImageFile) {
        contentParts.push({ type: 'text', text: 'The user has provided a new product image to use:' });
        contentParts.push({ type: 'image_url', image_url: { url: newImageUrl } });
      }
      contentParts.push({
        type: 'text',
        text: `User feedback: "${trimmed}"

Previous video prompt was:
\`\`\`
${lastVideoPrompt || 'N/A'}
\`\`\`

Based on the user's feedback, revise the script and provide an updated **VIDEO PROMPT** block:

\`\`\`video-prompt
[Your revised detailed video generation prompt — 80-150 words. Incorporate the user's requested changes.]
\`\`\``,
      });

      const systemPrompt = `You are a UGC ad video strategist helping iterate on a video script. The user has already generated a video and wants to make changes. Review the conversation history, understand their feedback, and provide a revised script with an updated video-prompt block. Be concise — focus on what changed and why.`;

      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: contentParts.length > 1 ? contentParts : contentParts[contentParts.length - 1].text },
          ],
        },
      });

      if (aiError) throw new Error(typeof aiError === 'object' && 'message' in aiError ? aiError.message : 'AI analysis failed');
      if (!aiData?.response) throw new Error('No response from AI');

      const responseText = aiData.response;
      const videoPromptMatch = responseText.match(/```video-prompt\n([\s\S]*?)```/);

      if (videoPromptMatch) {
        const newVideoPrompt = videoPromptMatch[1].trim();
        setLastVideoPrompt(newVideoPrompt);

        // Update DB
        if (currentProjectId) {
          await supabase.from('video_repo_projects').update({
            video_prompt: newVideoPrompt,
            product_image_url: newImageUrl,
            status: 'generating',
          }).eq('id', currentProjectId);
        }
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: responseText,
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsAnalyzing(false);

      // Auto-generate if video prompt found
      if (videoPromptMatch) {
        const newVideoPrompt = videoPromptMatch[1].trim();
        setIsGenerating(true);

        const generatingMsg: ChatMessage = {
          id: `assistant-gen-${Date.now()}`,
          role: 'assistant',
          content: '🎬 Regenerating your video with the updated script...',
        };
        setMessages(prev => [...prev, generatingMsg]);

        const useProductLockFollow = lockProduct && !!newImageUrl;
        const followModel = useProductLockFollow ? 'wan-2.5-i2v' : 'sora-2';
        try {
          const taskId = await createWaveSpeedVideo({
            prompt: newVideoPrompt,
            model: followModel,
            aspectRatio: outputFormat,
            duration: soraDuration,
            userId: user?.id,
            source: 'video-repo',
            ...(newImageUrl ? { imageUrls: [newImageUrl] } : {}),
          });

          let attempts = 0;
          const maxAttempts = 120;
          while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 5000));
            const job = await getWaveSpeedVideoJob(taskId);
            if (job.status === 'completed' && job.videoUrl) {
              if (currentProjectId) {
                await supabase.from('video_repo_projects').update({
                  generated_video_url: job.videoUrl,
                  status: 'completed',
                }).eq('id', currentProjectId);
              }

              const resultMsg: ChatMessage = {
                id: `result-${Date.now()}`,
                role: 'assistant',
                content: '✅ Updated video is ready! Review it below — feel free to send more feedback to iterate further.',
                videoResult: { url: job.videoUrl, status: 'completed' },
              };
              setMessages(prev => prev.filter(m => m.id !== generatingMsg.id).concat(resultMsg));
              fetchHistory();
              break;
            }
            if (job.status === 'failed') throw new Error(job.error || 'Video generation failed');
            attempts++;
          }
          if (attempts >= maxAttempts) throw new Error('Generation timed out');
        } catch (genErr: any) {
          if (currentProjectId) {
            await supabase.from('video_repo_projects').update({ status: 'failed' }).eq('id', currentProjectId);
          }
          const errorMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Regeneration failed: ${genErr.message}. You can try again with different feedback.`,
          };
          setMessages(prev => prev.filter(m => m.id !== generatingMsg.id).concat(errorMsg));
        }
        setIsGenerating(false);
      }
      fetchHistory();
    } catch (err: any) {
      console.error('[VideoRepo] Follow-up error:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ ${err.message}. Please try again.`,
      };
      setMessages(prev => [...prev, errorMsg]);
      setIsAnalyzing(false);
      setIsGenerating(false);
    }
  };

  const handleFollowUpImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFollowUpImageName(file.name);
    setFollowUpImageFile(file);
    const url = await fileToDataUrl(file);
    if (url) setFollowUpImageUrl(url);
    e.target.value = '';
  };

  const handleFollowUpKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleFollowUp();
    }
  };

  // === Motion Video handlers ===
  const handleMotionStartFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMotionStartFrame(file);
    setMotionStartFramePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleMotionEndFrame = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMotionEndFrame(file);
    setMotionEndFramePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const generateMotionVideo = async (overrides?: {
    startUrl?: string;
    endUrl?: string;
    promptText?: string;
    startPreview?: string;
    endPreview?: string;
  }) => {
    const hasOverrideStart = !!overrides?.startUrl;
    if (!hasOverrideStart && !motionStartFrame) {
      toast({ title: 'Start frame required', description: 'Please upload at least a start frame image.', variant: 'destructive' });
      return;
    }
    if (motionModel === 'vidu-start-end' && !overrides?.endUrl && !motionEndFrame) {
      toast({ title: 'End frame required', description: 'VIDU requires both a start and end frame.', variant: 'destructive' });
      return;
    }
    if (!user) return;

    setIsMotionGenerating(true);

    const promptForRun = (overrides?.promptText ?? motionPrompt).trim();
    const startPreviewUrl = overrides?.startPreview || overrides?.startUrl || motionStartFramePreview!;
    const endPreviewUrl = overrides?.endPreview || overrides?.endUrl || motionEndFramePreview;

    const userMsg: ChatMessage = {
      id: `user-motion-${Date.now()}`,
      role: 'user',
      content: promptForRun || `Generate a ${motionModel} motion video from keyframes`,
      attachments: [
        { type: 'image' as const, url: startPreviewUrl, name: 'Start Frame' },
        ...(endPreviewUrl ? [{ type: 'image' as const, url: endPreviewUrl, name: 'End Frame' }] : []),
      ],
    };
    setMessages(prev => [...prev, userMsg]);
    scrollToBottom('auto');

    try {
      // Resolve frame URLs (upload only when not overridden)
      const startUrl = overrides?.startUrl || (await uploadFileToStorage(motionStartFrame!, 'motion-frames'));
      let endUrl: string | undefined = overrides?.endUrl;
      if (!endUrl && motionEndFrame) {
        endUrl = await uploadFileToStorage(motionEndFrame, 'motion-frames');
      }

      // Create DB record
      let projectId: string | null = null;
      const { data: insertedRow, error: insertErr } = await supabase
        .from('video_repo_projects')
        .insert({
          user_id: user.id,
          prompt: promptForRun || 'Motion video from keyframes',
          product_image_url: startUrl,
          status: 'generating',
          model: motionModel,
        })
        .select('id')
        .single();
      if (!insertErr) { projectId = insertedRow.id; setCurrentProjectId(insertedRow.id); }

      const generatingMsg: ChatMessage = {
        id: `assistant-motion-gen-${Date.now()}`,
        role: 'assistant',
        content: `🎬 Generating motion video with ${motionModel === 'keyframe-interpolation' ? 'Kling 2.6 Pro' : motionModel === 'vidu-start-end' ? 'VIDU 2.0' : 'Seedance'}... This may take a few minutes.`,
      };
      setMessages(prev => [...prev, generatingMsg]);

      const taskId = await createWaveSpeedVideo({
        prompt: promptForRun || 'Smooth cinematic transition between keyframes',
        model: motionModel,
        startFrameUrl: startUrl,
        endFrameUrl: endUrl,
        aspectRatio: '16:9',
        duration: motionModel === 'keyframe-interpolation' ? motionDuration : undefined,
        userId: user.id,
        source: 'video-repo-motion',
      });

      let attempts = 0;
      const maxAttempts = 120;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        const job = await getWaveSpeedVideoJob(taskId);

        if (job.status === 'completed' && job.videoUrl) {
          if (projectId) {
            await supabase.from('video_repo_projects').update({
              generated_video_url: job.videoUrl,
              status: 'completed',
            }).eq('id', projectId);
          }

          const resultMsg: ChatMessage = {
            id: `result-motion-${Date.now()}`,
            role: 'assistant',
            content: '✅ Your motion video is ready!',
            videoResult: { url: job.videoUrl, status: 'completed' },
          };
          setMessages(prev => prev.filter(m => m.id !== generatingMsg.id).concat(resultMsg));
          fetchHistory();
          break;
        }
        if (job.status === 'failed') throw new Error(job.error || 'Video generation failed');
        attempts++;
      }
      if (attempts >= maxAttempts) throw new Error('Generation timed out');
    } catch (err: any) {
      console.error('[Motion Video] Error:', err);
      const errorMsg: ChatMessage = {
        id: `error-motion-${Date.now()}`,
        role: 'assistant',
        content: `❌ Motion video failed: ${err.message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
      toast({ title: 'Motion video failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsMotionGenerating(false);
    }
  };

  // ✨ One-click: pick a strategy → generate start+end frames → run motion video
  const autoGenerateMotionVideo = async () => {
    if (!user) return;
    if (isMotionGenerating || isAutoMotion) return;

    setIsAutoMotion(true);
    setAutoMotionStatus('Picking creative strategy...');

    try {
      // Brand line comes ONLY from the current request / attached product — never the saved profile.
      const brandLine = 'Brand: (derive ONLY from the user\'s request and the attached product reference image. Do NOT invent a brand name, URL, category, or product type. If the user did not name a brand, keep visuals product-focused and generic.)';

      const hasProductRef = Boolean(productImageUrl && !productImageUrl.startsWith('blob:'));
      const productName = selectedProductCtx?.productName || productImageName || null;
      const productBenefits = selectedProductCtx?.benefits?.length ? selectedProductCtx.benefits.join(', ') : null;

      const productHint = hasProductRef
        ? `**LOCKED PRODUCT** — the user has provided a real product image (${productName || 'see reference'}). Both keyframes MUST feature THIS exact product as shown in the reference (same shape, label, color, packaging). Do NOT invent a new product, do NOT swap label colors, do NOT change the form factor. The hero product is THIS exact product.${productBenefits ? ` Key benefits to evoke visually: ${productBenefits}.` : ''}`
        : productName
          ? `Subject: ${productName} on a clean styled surface. Do not invent a category — use only what the name implies.`
          : `Subject: the product or scene described by the user's prompt on a clean styled surface. Do not invent a brand or product category.`;

      const strategyPrompt = `You are a cinematic motion-video director. Pick ONE high-performing strategy from this list and design a 5-second hero motion clip:
- Macro Pour (extract dropping into water/glass)
- Hero Push-In (slow camera push onto product)
- Day-to-Night Mood Shift (lighting evolves)
- Ingredient Burst (mushroom/ingredient swirling around bottle)
- Product Reveal (object slides/rotates into frame)

${brandLine}
${productHint}

⚠️ CRITICAL CONTINUITY RULES (a video reviewer will reject the clip if violated):
1. The START frame and END frame must feature the SAME hero character and the SAME locked product, but they must be TWO DISTINCT SCENES or shot setups. Different background, composition, and action are required.
2. The character identity must remain exact across both frames: same face, same age, same hair, same wardrobe, same hand dominance, same skin tone, same makeup level. This is the same person in scene one and scene two.
3. If a HUMAN appears in either frame, that human MUST appear in both frames actively interacting with the product. Never show a floating dropper, floating bottle, or a disconnected hand. Props must be physically grounded.
4. Prefer "person-and-product" or "hands-and-product" for this brand. Only use "product-only" if there is a compelling reason and the story still feels premium.
5. The END frame must be a story progression from the START frame — not a duplicate. Think scene one → scene two, while still feeling like one premium ad concept.
6. If the locked product is provided, the bottle in BOTH frames must visually match that real product exactly (label, shape, color, cap/dropper, proportions).

Return STRICT JSON ONLY (no prose, no markdown, no code fences) matching exactly:
{
  "strategy": "Macro Pour" | "Hero Push-In" | "Day-to-Night Mood Shift" | "Ingredient Burst" | "Product Reveal",
  "subjectMode": "product-only" | "hands-and-product" | "person-and-product",
  "identityAnchor": "one sentence that explicitly locks the person identity and styling to repeat across both frames",
  "startFramePrompt": "detailed photoreal prompt for the FIRST frame — scene one. Describe subject, composition, lighting, lens, mood, and exactly how the character is interacting with the product. 16:9. No text overlay.",
  "endFramePrompt": "detailed photoreal prompt for the LAST frame — scene two. A clearly different setting or shot from the first frame, but with the SAME character identity, SAME wardrobe, and SAME product. 16:9. No text overlay.",
  "motionPrompt": "describe the camera motion + subject motion that interpolates between the two frames in 5 seconds, cinematic, smooth, no cuts"
}`;

      const callStrategy = async (model: string) => {
        return await supabase.functions.invoke('ai', {
          body: {
            model,
            messages: [{ role: 'user', content: strategyPrompt }],
          },
        });
      };

      const extractPlan = (stratData: any): any => {
        const toolCalls = stratData?.choices?.[0]?.message?.tool_calls;
        if (toolCalls?.[0]?.function?.arguments) {
          try { return JSON.parse(toolCalls[0].function.arguments); } catch {}
        }
        const raw: string =
          stratData?.content ||
          stratData?.choices?.[0]?.message?.content ||
          stratData?.text ||
          (typeof stratData === 'string' ? stratData : '');
        if (!raw) return null;
        try { return JSON.parse(raw); } catch {}
        const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
        const candidate = fenced ? fenced[1] : raw;
        const match = candidate.match(/\{[\s\S]*\}/);
        if (match) { try { return JSON.parse(match[0]); } catch {} }
        return null;
      };

      let { data: stratData, error: stratErr } = await callStrategy('google/gemini-2.5-flash');
      let plan = stratErr ? null : extractPlan(stratData);

      if (!plan || !plan.startFramePrompt || !plan.endFramePrompt) {
        console.warn('[Auto Motion] First strategy attempt failed, retrying with Pro...', stratData);
        const retry = await callStrategy('google/gemini-2.5-pro');
        if (!retry.error) plan = extractPlan(retry.data);
      }

      if (!plan || !plan.startFramePrompt || !plan.endFramePrompt) {
        console.warn('[Auto Motion] AI strategy unavailable, using fallback Macro Pour template');
        plan = {
          strategy: 'Macro Pour',
          subjectMode: 'person-and-product',
          identityAnchor: 'The same premium wellness creator appears in both frames: late-20s woman, warm brunette hair, clean natural makeup, cream knit top, refined feminine styling, calm confident expression.',
          startFramePrompt: `Scene one, cinematic 16:9 medium close-up — the wellness creator stands at a bright kitchen counter holding the exact mushroom extract dropper bottle above a clear glass of water, preparing to add it to her ritual. Morning daylight, premium editorial realism, shallow depth of field, physically grounded hand-to-product interaction. ${brandLine}`,
          endFramePrompt: `Scene two, cinematic 16:9 medium portrait — the SAME wellness creator in the SAME cream knit top now stands by a sunlit desk nook holding the SAME exact mushroom extract bottle beside the freshly mixed glass, looking satisfied after the ritual. Different background and composition from scene one, same person and same product, premium editorial realism. ${brandLine}`,
          motionPrompt: 'Single continuous 5-second cinematic move that begins on the creator preparing the dropper ritual at the kitchen counter, then glides with her into a second sunlit nook as she finishes the moment holding the same bottle and glass. Smooth premium camera, grounded hand movement, no cuts, no floating props.',
        };
      }

      setAutoMotionStatus(`Strategy: ${plan.strategy}. Rendering keyframes...`);

      const identityAnchor = typeof plan.identityAnchor === 'string' ? plan.identityAnchor.trim() : '';

      const renderFrame = async ({
        visualPrompt,
        referenceUrl,
        characterInstructions,
      }: {
        visualPrompt: string;
        referenceUrl?: string;
        characterInstructions: string;
      }) => {
        const { data, error } = await supabase.functions.invoke('generate-premium-visual', {
          body: {
            type: 'keyframe',
            topic: visualPrompt,
            style: 'cinematic-motion-keyframe',
            sceneDescriptions: visualPrompt,
            characterDescription: characterInstructions,
            size: '1536x1024',
            referenceImageUrl: referenceUrl,
          },
        });
        if (error) throw new Error(error.message || 'Frame generation failed');
        const url = data?.imageUrl;
        if (!url) throw new Error('Frame generation returned no image');
        return url as string;
      };

      const startUrlRaw = await renderFrame({
        visualPrompt: [
          identityAnchor && `IDENTITY ANCHOR: ${identityAnchor}`,
          'FRAME ROLE: START FRAME. Scene one of a two-scene premium ad story.',
          plan.startFramePrompt,
          hasProductRef ? 'Use the attached real product as the exact bottle reference. Match label, proportions, color, and dropper details exactly.' : 'Show a premium wellness product interaction with physically believable hand placement.',
          'No text, captions, logos, or thumbnail typography. Cinematic 16:9 still frame only.',
        ].filter(Boolean).join('\n'),
        referenceUrl: hasProductRef ? productImageUrl ?? undefined : undefined,
        characterInstructions: hasProductRef
          ? 'Use the attached REAL product image as the product lock. If a person appears, make them a premium wellness creator naturally holding or using that exact product. No floating props.'
          : 'Create a premium wellness creator or grounded hand interaction that looks physically believable and photoreal.',
      });

      const endUrlRaw = await renderFrame({
        visualPrompt: [
          identityAnchor && `IDENTITY ANCHOR: ${identityAnchor}`,
          'FRAME ROLE: END FRAME. Scene two of the same premium ad story.',
          plan.endFramePrompt,
          'This must be a clearly different scene or composition from the start frame while preserving the same person identity and the same product.',
          hasProductRef ? 'The product must still match the user\'s real bottle exactly.' : 'Maintain the same hero subject identity established in the reference frame.',
          'No text, captions, logos, or thumbnail typography. Cinematic 16:9 still frame only.',
        ].filter(Boolean).join('\n'),
        referenceUrl: startUrlRaw,
        characterInstructions: 'Use the attached reference frame as an identity anchor. Keep the exact same character face, hair, wardrobe, hand identity, and the same product, but restage them into a clearly different second scene. No floating props, no disconnected droppers, no duplicate frame.',
      });

      // ─── PRODUCT SWAP PASS ───────────────────────────────────────────
      // Marco's "Product Swap" guarantee: if a product is selected, run a second-pass
      // edit on each keyframe that locks the visible bottle/label to the user's REAL
      // product image. Uses edit-scene-image with the rendered keyframe + the product
      // photo as references — same recipe SegmentCard.handleSwapProduct uses.
      let startUrl = startUrlRaw;
      let endUrl = endUrlRaw;
      let productSwapStatus: 'none' | 'applied' | 'partial' | 'failed' = 'none';
      let productSwapNote: string | null = null;

      if (hasProductRef && productImageUrl) {
        setAutoMotionStatus('Locking product onto keyframes (Product Swap)...');
        const swapPrompt = `Replace the product/bottle in the first reference image with the EXACT product shown in the second reference image. Keep EVERYTHING else identical — same person, same face, same pose, same hand position, same wardrobe, same lighting, same background, same camera angle. ONLY swap the bottle/dropper/label so it matches the user's real product pixel-for-pixel. No floating props — the swapped product must stay in the same hand position as the original.`;
        const productLabel = productName || 'product';

        const swapFrame = async (frameUrl: string): Promise<string> => {
          const { data, error } = await supabase.functions.invoke('edit-scene-image', {
            body: {
              prompt: swapPrompt,
              referenceImages: [frameUrl, productImageUrl],
              characterDescription: identityAnchor || `Premium wellness creator holding ${productLabel}.`,
              productImageUrl,
              productName: productLabel,
            },
          });
          if (error) throw new Error(error.message || 'Product swap failed');
          const url = data?.imageUrl;
          if (!url) throw new Error('Product swap returned no image');
          return url as string;
        };

        const [startSwap, endSwap] = await Promise.allSettled([
          swapFrame(startUrlRaw),
          swapFrame(endUrlRaw),
        ]);

        const startOk = startSwap.status === 'fulfilled';
        const endOk = endSwap.status === 'fulfilled';
        if (startOk) startUrl = (startSwap as PromiseFulfilledResult<string>).value;
        if (endOk) endUrl = (endSwap as PromiseFulfilledResult<string>).value;

        if (startOk && endOk) {
          productSwapStatus = 'applied';
          productSwapNote = `Locked to your real ${productLabel}.`;
        } else if (startOk || endOk) {
          productSwapStatus = 'partial';
          productSwapNote = `⚠️ Product locked on ${startOk ? 'start' : 'end'} frame only — the other frame kept the AI-generated bottle. Re-roll the failed frame before approving.`;
        } else {
          productSwapStatus = 'failed';
          productSwapNote = '⚠️ Product Swap failed on both frames — the bottle in the previews is AI-generated and may not match your real product. Cancel and try again, or approve at your own risk.';
        }
      } else {
        productSwapNote = '⚠️ No product picked from your library — Marco will use a generic bottle. Pick a product before approving for brand-accurate output.';
      }

      // Reflect into the left panel so the user sees what we picked
      setMotionStartFramePreview(startUrl);
      setMotionEndFramePreview(endUrl);
      setMotionPrompt(plan.motionPrompt || '');

      // STOP HERE — push an approval card into the chat. Nothing burns Kling credits until the user clicks Approve.
      const productLine = hasProductRef
        ? (productSwapStatus === 'applied'
            ? `🧴 **Product:** ${productName || 'your product'} — locked onto both keyframes via Product Swap.`
            : productSwapStatus === 'partial'
              ? `🧴 **Product:** ${productName || 'your product'} — locked on one frame only. ${productSwapNote}`
              : `🧴 **Product:** ${productName || 'your product'} — Product Swap FAILED. ${productSwapNote}`)
        : `⚠️ **No product selected** — using a generic bottle. Pick a product from your library for brand-accurate output.`;

      const approvalMsg: ChatMessage = {
        id: `approval-motion-${Date.now()}`,
        role: 'assistant',
        content: `🎬 **Strategy:** ${plan.strategy}\n\n${productLine}\n\nReview the keyframes and motion prompt below — nothing is sent to the video model until you approve.`,
        approvalCard: {
          strategy: plan.strategy,
          startUrl,
          endUrl,
          motionPrompt: plan.motionPrompt || `Smooth cinematic ${plan.strategy} transition`,
          model: motionModel,
          duration: motionDuration,
          productImageUrl: hasProductRef ? productImageUrl : null,
          productName,
          productSwapStatus,
          productSwapNote,
          status: 'pending',
        },
      };
      setMessages(prev => [...prev, approvalMsg]);
      setAutoMotionStatus('');
    } catch (err: any) {
      console.error('[Auto Motion] Error:', err);
      toast({ title: 'Auto-generate failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsAutoMotion(false);
      setAutoMotionStatus('');
    }
  };

  // ===== Motion approval handlers =====
  const approveMotionPlan = async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg?.approvalCard) return;
    const card = msg.approvalCard;

    // Mark this card approved so the buttons disappear
    setMessages(prev => prev.map(m =>
      m.id === messageId && m.approvalCard
        ? { ...m, approvalCard: { ...m.approvalCard, status: 'approved' } }
        : m
    ));

    await generateMotionVideo({
      startUrl: card.startUrl,
      endUrl: card.endUrl,
      promptText: card.motionPrompt,
      startPreview: card.startUrl,
      endPreview: card.endUrl,
    });
  };

  const cancelMotionPlan = (messageId: string) => {
    setMessages(prev => prev.map(m =>
      m.id === messageId && m.approvalCard
        ? { ...m, approvalCard: { ...m.approvalCard, status: 'cancelled' } }
        : m
    ));
    toast({ title: 'Plan cancelled', description: 'No credits were used.' });
  };

  const regenerateMotionPlan = async (messageId: string) => {
    // Mark old card cancelled, then re-run the planner
    setMessages(prev => prev.map(m =>
      m.id === messageId && m.approvalCard
        ? { ...m, approvalCard: { ...m.approvalCard, status: 'cancelled' } }
        : m
    ));
    await autoGenerateMotionVideo();
  };

  const resetImport = () => {
    if (importVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(importVideoUrl);
    setImportFile(null);
    setImportVideoUrl(null);
    setImportFrames([]);
    setIsImportAnalyzing(false);
    setImportAnalysis(null);
    setImportSuggestedPrompt('');
    setImportModel('');
    setImportTaskId('');
    setImportCustomName('');
  };

  const handleImportVideo = async (file: File) => {
    resetImport();
    const objectUrl = URL.createObjectURL(file);
    setImportFile(file);
    setImportVideoUrl(objectUrl);
    setImportCustomName(file.name.replace(/\.[^.]+$/, ''));

    // Extract frames
    setIsImportAnalyzing(true);
    try {
      const frames = await extractVideoFrames(file, 6);
      setImportFrames(frames);

      // Call AI analysis
      const { data, error } = await supabase.functions.invoke('analyze-repurpose-video', {
        body: {
          action: 'analyze',
          platform: 'TikTok',
          frames,
        },
      });

      if (error) throw new Error('AI analysis failed');

      const analysis = data?.analysis || data;
      setImportAnalysis(analysis);

      // Build a suggested prompt from the analysis
      const hook = analysis?.hook?.text || '';
      const topic = analysis?.messaging?.coreTopic || '';
      const formula = analysis?.creativeDirection?.winningFormula || '';
      const suggested = [hook, topic, formula].filter(Boolean).join('. ');
      setImportSuggestedPrompt(suggested || 'AI-generated video');

      toast({ title: 'Analysis complete!', description: 'Review the details and save to your library.' });
    } catch (err: any) {
      console.error('Import analysis error:', err);
      toast({ title: 'Analysis failed', description: err.message, variant: 'destructive' });
      setImportSuggestedPrompt('');
    } finally {
      setIsImportAnalyzing(false);
    }
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setImportDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      handleImportVideo(file);
    } else {
      toast({ title: 'Invalid file', description: 'Please drop a video file.', variant: 'destructive' });
    }
  };

  const handleImportFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImportVideo(file);
    e.target.value = '';
  };

  const handleImportFromUrl = async () => {
    const trimmed = importUrlInput.trim();
    if (!trimmed || isImportingFromUrl) return;

    setIsImportingFromUrl(true);
    try {
      toast({ title: 'Fetching video...', description: 'Downloading from the URL. This can take a moment.' });
      const publicUrl = await downloadSocialVideoToStorage(trimmed, (title, description, variant) =>
        toast({ title, description, variant })
      );

      // Fetch the stored video as a Blob so the existing analysis + save flow works unchanged
      const resp = await fetch(publicUrl);
      if (!resp.ok) throw new Error(`Could not load downloaded video (${resp.status})`);
      const blob = await resp.blob();

      let baseName = 'imported-video';
      try {
        const hostname = new URL(trimmed).hostname.replace('www.', '').split('.')[0];
        baseName = `${hostname}-import`;
      } catch { /* ignore */ }

      const ext = (blob.type.split('/')[1] || 'mp4').split(';')[0];
      const file = new File([blob], `${baseName}.${ext}`, { type: blob.type || 'video/mp4' });

      setImportUrlInput('');
      await handleImportVideo(file);
    } catch (err: any) {
      console.error('URL import error:', err);
      toast({
        title: 'Import failed',
        description: err?.message || 'Could not import that URL. Try downloading it manually and dragging it in.',
        variant: 'destructive',
      });
    } finally {
      setIsImportingFromUrl(false);
    }
  };

  const saveImportedVideo = async () => {
    if (!user || !importFile) return;
    setIsImportSaving(true);
    try {
      // Upload video to storage
      const videoUrl = await uploadFileToStorage(importFile, 'imports');

      // Insert into video_repo_projects
      const { error } = await supabase.from('video_repo_projects').insert({
        user_id: user.id,
        prompt: importSuggestedPrompt || null,
        generated_video_url: videoUrl,
        analysis_text: importAnalysis ? JSON.stringify(importAnalysis) : null,
        video_prompt: importSuggestedPrompt || null,
        status: 'completed',
        custom_name: importCustomName || null,
        model: importModel || null,
        external_task_id: importTaskId || null,
      } as any);

      if (error) throw error;

      toast({ title: 'Video imported!', description: 'Saved to your library. Find it in History.' });
      resetImport();
      fetchHistory();
      setMainTab('history');
    } catch (err: any) {
      console.error('Save import error:', err);
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsImportSaving(false);
    }
  };

  const handleRemixProject = (project: VideoRepoProject) => {
    // Pre-populate the Create tab with data from this project
    if (project.video_prompt || project.prompt) setPrompt(project.video_prompt || project.prompt || '');
    if (project.generated_video_url) {
      setReferenceVideoUrl(project.generated_video_url);
      setReferenceVideoName(project.custom_name || 'Imported video');
    }
    if (project.product_image_url) {
      setProductImageUrl(project.product_image_url);
      setProductImageName('Reference image');
      setProductImageFile(null);
    }
    setSelectedProject(null);
    setMainTab('create');
    toast({ title: 'Remix loaded', description: 'Prompt, reference video, and product image have been loaded. Choose a duration and generate.' });
  };

  const handleSendToChatcut = (project: VideoRepoProject) => {
    if (!project.generated_video_url) {
      toast({ title: 'No generated video', description: 'This project has no generated video to send to Chatcut.', variant: 'destructive' });
      return;
    }
    const payload = {
      videoUrl: project.generated_video_url,
      title: project.custom_name || 'Video Repo clip',
      clipTitle: project.custom_name || 'Video Repo clip',
      productImageUrl: project.product_image_url || null,
      projectId: project.id,
      sourceLabel: project.custom_name || project.prompt?.slice(0, 40) || 'Video Repo clip',
      autoExtractBroll: true,
    };
    sessionStorage.setItem('vizard-to-chatcut', JSON.stringify(payload));
    toast({ title: 'Opening Chatcut AI…', description: 'Marco will auto-extract playable B-roll clips if none exist for this clip.' });
    navigate('/chatcut-ai');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      analyzeAndGenerate();
    }
  };

  // Side-by-side detail view
  if (selectedProject) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedProject(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h2 className="text-xl font-bold text-foreground">Project Details</h2>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedProject.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Badge variant="outline" className={`ml-auto ${statusColors[selectedProject.status] || ''}`}>
              {selectedProject.status}
            </Badge>
          </div>

          {selectedProject.prompt && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Prompt</p>
                <p className="text-sm text-foreground">{selectedProject.prompt}</p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-3">Reference Video</p>
                {selectedProject.reference_video_url ? (
                  <video
                    src={selectedProject.reference_video_url}
                    controls
                    className="w-full rounded-lg aspect-[9/16] object-cover bg-black"
                  />
                ) : (
                  <div className="aspect-[9/16] rounded-lg bg-muted flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No reference video</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-3">Generated Video</p>
                {selectedProject.generated_video_url ? (
                  <div className="space-y-2">
                    <video
                      src={selectedProject.generated_video_url}
                      controls
                      className="w-full rounded-lg aspect-[9/16] object-cover bg-black"
                    />
                    <Button size="sm" variant="secondary" asChild>
                      <a href={selectedProject.generated_video_url} download target="_blank" rel="noopener noreferrer">
                        <Download className="w-3 h-3 mr-1" /> Download
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="aspect-[9/16] rounded-lg bg-muted flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                      {selectedProject.status === 'generating' ? 'Still generating...' : selectedProject.status === 'failed' ? 'Generation failed' : 'No generated video'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {selectedProject.product_image_url && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Product Image</p>
                <img src={selectedProject.product_image_url} alt="Product" className="w-32 h-32 object-cover rounded-lg" />
              </CardContent>
            </Card>
          )}

          {selectedProject.analysis_text && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">AI Analysis</p>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{selectedProject.analysis_text}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleRemixProject(selectedProject)} className="gap-1.5">
              <RefreshCw className="w-4 h-4" /> Remix This Video
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSendToChatcut(selectedProject)}
              disabled={!selectedProject.generated_video_url}
              className="gap-1.5"
              title="Open this video in Chatcut AI to overlay your product image as a PiP layer"
            >
              <Scissors className="w-4 h-4" /> Send to Chatcut AI
            </Button>
            {selectedProject.generated_video_url && (
              <Button
                variant="outline"
                className="gap-1.5"
                onClick={() => setFrameExtractor({
                  url: selectedProject.generated_video_url!,
                  projectId: selectedProject.id,
                  label: selectedProject.custom_name || 'Video',
                })}
                title="Save playable B-Roll clips to use in Chatcut AI"
              >
                <Sparkles className="w-4 h-4" /> Extract B-Roll Clips
              </Button>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] max-w-7xl mx-auto flex-col overflow-hidden">
        <div className="text-center py-4 px-4">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary via-purple-400 to-accent bg-clip-text text-transparent mb-1">
            AI UGC Video Generator
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm max-w-xl mx-auto">
            Generate AI UGC-style video ads in minutes — no creators, no filming, no editing.
          </p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'create' | 'history' | 'import')} className="flex-1 flex flex-col min-h-0">
          <div className="flex justify-center px-4 mb-3">
            <TabsList>
              <TabsTrigger value="create" className="gap-1.5">
                <Play className="w-3.5 h-3.5" /> Create
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Import
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                <History className="w-3.5 h-3.5" /> History
                {historyProjects.length > 0 && (
                  <span className="ml-1 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">{historyProjects.length}</span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="create" className="flex-1 flex flex-col lg:flex-row gap-4 px-4 min-h-0 overflow-hidden mt-0">
            {/* Left: Composer Panel */}
            <div className="w-full lg:w-[420px] lg:min-w-[380px] flex-shrink-0 overflow-y-auto">
              <Card className="bg-card/95 border border-border shadow-sm rounded-2xl overflow-hidden">
                {/* Sub-tabs: Ad / Motion */}
                <div className="flex items-center gap-1 px-3 pt-2.5 pb-2 border-b border-border/60 bg-muted/30">
                  <button
                    onClick={() => setActiveTab('ad')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeTab === 'ad' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" /> Ad Video
                  </button>
                  <button
                    onClick={() => setActiveTab('motion')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeTab === 'motion' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" /> Motion Video
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Beta</Badge>
                  </button>
                </div>

                {activeTab === 'motion' ? (
                  <>
                    {/* Motion Video Composer */}
                    <div className="px-3 py-3 border-b border-border/50 bg-background/70">
                      <div className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">Describe the motion</div>
                      <Textarea
                        placeholder="Describe the motion or transition between your start and end frames..."
                        value={motionPrompt}
                        onChange={(e) => setMotionPrompt(e.target.value)}
                        className="min-h-[60px] rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                        rows={2}
                      />
                    </div>

                    <div className="px-3 py-3 space-y-3 bg-background/60">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">Keyframes</div>

                      {/* Dual image upload */}
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
                        {/* Start Frame */}
                        <div
                          onClick={() => motionStartRef.current?.click()}
                          className="relative border-2 border-dashed rounded-xl p-3 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-1.5 min-h-[120px]"
                        >
                          <input ref={motionStartRef} type="file" accept="image/*" className="hidden" onChange={handleMotionStartFrame} />
                          {motionStartFramePreview ? (
                            <div className="relative w-full">
                              <img src={motionStartFramePreview} alt="Start frame" className="w-full h-24 object-cover rounded-lg" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setMotionStartFrame(null); setMotionStartFramePreview(null); }}
                                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                              >×</button>
                              <p className="text-[10px] text-muted-foreground text-center mt-1">Start Frame</p>
                            </div>
                          ) : (
                            <>
                              <ImagePlus className="w-5 h-5 text-muted-foreground" />
                              <p className="text-[10px] font-medium text-muted-foreground">Start Frame</p>
                              <p className="text-[9px] text-muted-foreground">Required</p>
                            </>
                          )}
                        </div>

                        <ArrowRight className="w-4 h-4 text-muted-foreground" />

                        {/* End Frame */}
                        <div
                          onClick={() => motionEndRef.current?.click()}
                          className="relative border-2 border-dashed rounded-xl p-3 cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-1.5 min-h-[120px]"
                        >
                          <input ref={motionEndRef} type="file" accept="image/*" className="hidden" onChange={handleMotionEndFrame} />
                          {motionEndFramePreview ? (
                            <div className="relative w-full">
                              <img src={motionEndFramePreview} alt="End frame" className="w-full h-24 object-cover rounded-lg" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setMotionEndFrame(null); setMotionEndFramePreview(null); }}
                                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                              >×</button>
                              <p className="text-[10px] text-muted-foreground text-center mt-1">End Frame</p>
                            </div>
                          ) : (
                            <>
                              <ImagePlus className="w-5 h-5 text-muted-foreground" />
                              <p className="text-[10px] font-medium text-muted-foreground">End Frame</p>
                              <p className="text-[9px] text-muted-foreground">{motionModel === 'vidu-start-end' ? 'Required' : 'Optional'}</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Model + duration + generate */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="space-y-1 flex-1 min-w-[140px]">
                            <p className="text-[10px] font-medium text-muted-foreground uppercase">Model</p>
                            <Select value={motionModel} onValueChange={(v: any) => setMotionModel(v)}>
                              <SelectTrigger className="h-8 text-xs rounded-lg bg-background"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="keyframe-interpolation">Kling 2.6 Pro</SelectItem>
                                <SelectItem value="vidu-start-end">VIDU 2.0</SelectItem>
                                <SelectItem value="seedance-i2v">Seedance</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {motionModel === 'keyframe-interpolation' && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-medium text-muted-foreground uppercase">Duration</p>
                              <RadioGroup
                                value={String(motionDuration)}
                                onValueChange={(v) => setMotionDuration(Number(v) as 5 | 10)}
                                className="flex gap-3"
                              >
                                <div className="flex items-center gap-1.5">
                                  <RadioGroupItem value="5" id="dur-5" />
                                  <Label htmlFor="dur-5" className="text-xs cursor-pointer">5s</Label>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <RadioGroupItem value="10" id="dur-10" />
                                  <Label htmlFor="dur-10" className="text-xs cursor-pointer">10s</Label>
                                </div>
                              </RadioGroup>
                            </div>
                          )}
                        </div>

                        <Button
                          variant="outline"
                          className="w-full rounded-xl gap-1.5 border-primary/40 hover:bg-primary/5"
                          onClick={() => autoGenerateMotionVideo()}
                          disabled={isMotionGenerating || isAutoMotion}
                        >
                          {isAutoMotion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                          {isAutoMotion ? (autoMotionStatus || 'Auto-generating...') : '✨ Auto-Generate Motion Video'}
                        </Button>

                        <Button
                          className="w-full rounded-xl gap-1.5"
                          onClick={() => generateMotionVideo()}
                          disabled={isMotionGenerating || isAutoMotion || !motionStartFrame}
                        >
                          {isMotionGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          Generate Motion Video
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Ad Video Composer */}
                    <div className="px-3 py-3 border-b border-border/50 bg-background/70">
                      <div className="flex items-center gap-1 mb-2 p-0.5 rounded-lg bg-muted/60 w-fit">
                        <button
                          type="button"
                          onClick={() => setInputMode('i2v')}
                          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${inputMode === 'i2v' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          🖼 Image → Video
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputMode('t2v')}
                          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${inputMode === 't2v' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                          📝 Text → Video
                        </button>
                      </div>
                      <div className="mb-2">
                        <div className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-[0.18em] flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-primary" /> Content Style
                        </div>
                        <TooltipProvider delayDuration={150}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {ARCHETYPE_LIST.map((a) => {
                              const Icon = a.icon;
                              const active = contentStyle === a.id;
                              return (
                                <Tooltip key={a.id}>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={() => setContentStyle(a.id)}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                        active
                                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                          : 'bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                                      }`}
                                    >
                                      <Icon className="w-3 h-3" />
                                      {a.label}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[240px]">
                                    <div className="text-xs font-semibold mb-0.5">{a.label} — {a.vibe}</div>
                                    <div className="text-[11px] text-muted-foreground">{a.useCase}</div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </TooltipProvider>
                      </div>
                      <div className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">
                        {inputMode === 't2v' ? 'Describe your video' : 'Prompt'}
                      </div>
                      <Textarea
                        placeholder={inputMode === 't2v'
                          ? 'Describe your ad concept — setting, character, action, mood. Marco will turn it into a cinematic Sora-2 Pro directive.'
                          : 'Upload your product image or reference video and describe your idea'}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="min-h-[72px] rounded-xl border border-border bg-background px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                        rows={3}
                      />
                    </div>

                    <div className="px-3 py-3 space-y-3 bg-background/60">
                      {/* Attached files */}
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
                        <p className="text-[11px] text-muted-foreground">
                          We'll analyze {videoFrames.length} key frames to learn the hook, pacing, and camera style.
                        </p>
                      )}

                      {statusLabel && (
                        <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{statusLabel}</span>
                        </div>
                      )}

                      {/* Upload buttons */}
                      <div className="space-y-2">
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductImage} />
                        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleReferenceVideo} />
                        <div className="flex gap-2 flex-wrap">
                          <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg flex-1 min-w-0" onClick={() => setProductPickerOpen(true)}>
                            <Package className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">Pick Product</span>
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg flex-1 min-w-0" onClick={() => fileInputRef.current?.click()}>
                            <ImagePlus className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">Add Image</span>
                          </Button>
                          <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-lg flex-1 min-w-0" onClick={() => videoInputRef.current?.click()}>
                            <Video className="w-3.5 h-3.5 flex-shrink-0" /> <span className="truncate">Reference Video</span>
                          </Button>
                        </div>

                        {/* URL import */}
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-1">
                            <Link className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                            <Input
                              type="url"
                              placeholder="Paste TikTok or YouTube URL"
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlImport(); } }}
                              className="h-8 text-xs rounded-lg pl-8 pr-2 bg-background"
                              disabled={isDownloadingUrl}
                            />
                          </div>
                          {urlInput.trim() && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs rounded-lg gap-1 flex-shrink-0"
                              onClick={handleUrlImport}
                              disabled={isDownloadingUrl}
                            >
                              {isDownloadingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              {isDownloadingUrl ? '...' : 'Import'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Output format */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground flex-shrink-0">Format</span>
                        <div className="inline-flex rounded-lg border border-border/60 bg-background p-0.5">
                          <button
                            type="button"
                            onClick={() => setOutputFormat('9:16')}
                            className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${outputFormat === '9:16' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Optimized for Instagram Reels, TikTok, and YouTube Shorts"
                          >
                            Reel 9:16
                          </button>
                          <button
                            type="button"
                            onClick={() => setOutputFormat('16:9')}
                            className={`px-2.5 py-1 text-[11px] rounded-md transition-colors ${outputFormat === '16:9' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Optimized for standard YouTube videos"
                          >
                            YouTube 16:9
                          </button>
                        </div>
                        <span className="text-[11px] text-muted-foreground flex-shrink-0 ml-2">Bulk</span>
                        <Select value={String(bulkCount)} onValueChange={(v) => setBulkCount(Number(v))}>
                          <SelectTrigger className="h-7 text-[11px] w-[110px] rounded-lg bg-background" title="Generate multiple variants in parallel (each with a slight creative variation)">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 video</SelectItem>
                            <SelectItem value="3">3 videos</SelectItem>
                            <SelectItem value="4">4 videos</SelectItem>
                            <SelectItem value="5">5 videos</SelectItem>
                            <SelectItem value="6">6 videos</SelectItem>
                            <SelectItem value="7">7 videos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Mode + Duration + Send */}
                      <div className="flex items-center gap-2 pt-1">
                        <Select value={mode} onValueChange={(v: 'guided' | 'freeform') => setMode(v)}>
                          <SelectTrigger className="h-8 text-xs w-[110px] rounded-lg bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="guided">Guided</SelectItem>
                            <SelectItem value="freeform">Freeform</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={String(soraDuration)} onValueChange={(v) => setSoraDuration(Number(v) as 10 | 20)}>
                          <SelectTrigger className="h-8 text-xs w-[110px] rounded-lg bg-background" title="Sora video length">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10s</SelectItem>
                            <SelectItem value="20">20s</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          variant={lockProduct ? 'default' : 'outline'}
                          className="h-8 text-xs rounded-lg gap-1 px-2.5"
                          title={lockProduct ? 'Product Lock ON — Wan 2.5 i2v will be used when an image is attached for pixel-accurate product fidelity' : 'Turn on Product Lock to use Wan 2.5 i2v (stricter product fidelity than Sora-2)'}
                          onClick={() => setLockProduct((v) => !v)}
                        >
                          <Lock className="w-3 h-3" />
                          {lockProduct ? 'Product Locked' : 'Lock Product'}
                        </Button>
                        <Button
                          className="flex-1 rounded-xl gap-1.5"
                          onClick={analyzeAndGenerate}
                          disabled={isAnalyzing || isGenerating || isExtractingFrames || !hasComposerInput}
                        >
                          {statusLabel ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                          {inputMode === 't2v' ? 'Generate from Text' : 'Generate'}
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </Card>
            </div>

            {/* Right: Conversation area */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
              {showConversation ? (
                <>
                  <ScrollArea className="flex-1 rounded-2xl border border-border/60 bg-muted/10 px-4">
                    <div className="space-y-4 py-4">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          {msg.role === 'assistant' && (
                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                              <Bot className="w-3.5 h-3.5 text-primary" />
                            </div>
                          )}
                          <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
                            <div className="prose prose-sm dark:prose-invert max-w-none">
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
                            {msg.approvalCard && (
                              <div className="mt-3 space-y-3 rounded-xl border border-primary/30 bg-background/60 p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                                    Review before generating
                                  </span>
                                  <Badge
                                    variant={
                                      msg.approvalCard.status === 'approved'
                                        ? 'default'
                                        : msg.approvalCard.status === 'cancelled'
                                          ? 'outline'
                                          : 'secondary'
                                    }
                                    className="text-[10px]"
                                  >
                                    {msg.approvalCard.status === 'approved'
                                      ? '✓ Approved'
                                      : msg.approvalCard.status === 'cancelled'
                                        ? 'Cancelled'
                                        : 'Pending approval'}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Start frame</div>
                                    <img
                                      src={msg.approvalCard.startUrl}
                                      alt="Start frame"
                                      className="w-full rounded-lg border border-border/60 aspect-video object-cover"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">End frame</div>
                                    <img
                                      src={msg.approvalCard.endUrl}
                                      alt="End frame"
                                      className="w-full rounded-lg border border-border/60 aspect-video object-cover"
                                    />
                                  </div>
                                </div>
                                {msg.approvalCard.productImageUrl ? (
                                  <div className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
                                    msg.approvalCard.productSwapStatus === 'applied'
                                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                                      : msg.approvalCard.productSwapStatus === 'partial'
                                        ? 'bg-amber-500/10 border border-amber-500/30'
                                        : msg.approvalCard.productSwapStatus === 'failed'
                                          ? 'bg-destructive/10 border border-destructive/30'
                                          : 'bg-muted/50'
                                  }`}>
                                    <img
                                      src={msg.approvalCard.productImageUrl}
                                      alt="Locked product"
                                      className="w-10 h-10 rounded object-cover border border-border/60 shrink-0"
                                    />
                                    <div className="text-[11px] leading-snug">
                                      <div className="font-medium">
                                        {msg.approvalCard.productSwapStatus === 'applied' && '✓ Product Swap applied'}
                                        {msg.approvalCard.productSwapStatus === 'partial' && '⚠️ Product Swap partial'}
                                        {msg.approvalCard.productSwapStatus === 'failed' && '⚠️ Product Swap failed'}
                                        {(!msg.approvalCard.productSwapStatus || msg.approvalCard.productSwapStatus === 'none') && 'Locked to your product'}
                                        {msg.approvalCard.productName ? `: ${msg.approvalCard.productName}` : ''}
                                      </div>
                                      {msg.approvalCard.productSwapNote && (
                                        <div className="text-muted-foreground mt-0.5">{msg.approvalCard.productSwapNote}</div>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-1.5">
                                    <span className="text-base">⚠️</span>
                                    <div className="text-[11px] leading-snug">
                                      <div className="font-medium">No product picked</div>
                                      <div className="text-muted-foreground">Marco is using a generic bottle. Pick a product from your library for brand-accurate output.</div>
                                    </div>
                                  </div>
                                )}
                                <div className="rounded-lg bg-muted/40 p-2">
                                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Motion prompt</div>
                                  <p className="text-xs leading-relaxed">{msg.approvalCard.motionPrompt}</p>
                                </div>
                                {msg.approvalCard.status === 'pending' && (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      className="rounded-lg gap-1.5 flex-1"
                                      onClick={() => approveMotionPlan(msg.id)}
                                      disabled={isMotionGenerating || isAutoMotion}
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                      Approve & Generate
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="rounded-lg gap-1.5"
                                      onClick={() => regenerateMotionPlan(msg.id)}
                                      disabled={isMotionGenerating || isAutoMotion}
                                    >
                                      <RefreshCw className="w-3.5 h-3.5" />
                                      Regenerate
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="rounded-lg gap-1.5 text-muted-foreground"
                                      onClick={() => cancelMotionPlan(msg.id)}
                                      disabled={isMotionGenerating || isAutoMotion}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          {msg.role === 'user' && (
                            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                              <User className="w-3.5 h-3.5 text-secondary-foreground" />
                            </div>
                          )}
                        </div>
                      ))}
                      {statusLabel && (
                        <div className="flex gap-3 justify-start">
                          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="text-sm text-muted-foreground">{statusLabel}</span>
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Follow-up composer */}
                  {showFollowUpComposer && (
                    <Card className="border border-primary/20 rounded-xl overflow-hidden mt-3 flex-shrink-0">
                      <div className="px-3 py-2.5 space-y-2 bg-background/60">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Iterate on your video</span>
                        </div>
                        <Textarea
                          placeholder="Describe changes — e.g. 'Make the hook longer', 'Use a different bottle'..."
                          value={followUpPrompt}
                          onChange={(e) => setFollowUpPrompt(e.target.value)}
                          onKeyDown={handleFollowUpKeyDown}
                          className="min-h-[56px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          rows={2}
                        />
                        {followUpImageUrl && (
                          <Badge variant="outline" className="text-xs gap-1 bg-background">
                            <ImagePlus className="w-3 h-3" /> {followUpImageName || 'New image'}
                            <button type="button" onClick={() => { setFollowUpImageFile(null); setFollowUpImageUrl(null); setFollowUpImageName(''); }} className="ml-1 hover:text-destructive">×</button>
                          </Badge>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input ref={followUpFileRef} type="file" accept="image/*" className="hidden" onChange={handleFollowUpImage} />
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1.5 rounded-lg"
                              onClick={() => followUpFileRef.current?.click()}
                            >
                              <ImagePlus className="w-3.5 h-3.5" /> Swap Image
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            className="rounded-lg gap-1.5"
                            onClick={handleFollowUp}
                            disabled={isAnalyzing || isGenerating || !hasFollowUpInput}
                          >
                            {isAnalyzing || isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
                            Regenerate
                          </Button>
                        </div>
                      </div>
                    </Card>
                  )}
                </>
              ) : (
                <div className="flex-1 rounded-2xl border border-dashed border-border/60 bg-muted/10 px-6 py-8 flex items-center justify-center">
                  <div className="text-center max-w-sm">
                    <Bot className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Upload a product image and a reference video, then press <strong>Generate</strong>. We'll study the hook, pacing, and composition to build a new ad around your product.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Import Tab */}
          <TabsContent value="import" className="flex-1 px-4 overflow-y-auto mt-4">
            <div className="max-w-3xl mx-auto space-y-6">
              <input
                ref={importVideoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleImportFileInput}
              />

              {!importVideoUrl ? (
                <div className="space-y-4">
                  {/* Paste URL row */}
                  <Card className="border-primary/20">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Link className="w-4 h-4 text-primary" />
                        <p className="text-sm font-medium text-foreground">Paste a YouTube Short, TikTok, or Reels link</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          type="url"
                          inputMode="url"
                          placeholder="https://youtube.com/shorts/..."
                          value={importUrlInput}
                          onChange={(e) => setImportUrlInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleImportFromUrl();
                            }
                          }}
                          disabled={isImportingFromUrl}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleImportFromUrl}
                          disabled={!importUrlInput.trim() || isImportingFromUrl}
                          className="gap-2"
                        >
                          {isImportingFromUrl ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
                          ) : (
                            <><Download className="w-4 h-4" /> Import</>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        If a platform blocks the download, save the video to your device and drag-and-drop it below.
                      </p>
                    </CardContent>
                  </Card>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">or upload a file</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setImportDragOver(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setImportDragOver(false); }}
                  onDrop={handleImportDrop}
                  onClick={() => importVideoInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-2xl p-12 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                    importDragOver
                      ? 'border-primary bg-primary/10 scale-[1.02]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  <div className={`p-5 rounded-full transition-colors ${importDragOver ? 'bg-primary/20' : 'bg-muted'}`}>
                    <Upload className={`w-10 h-10 transition-colors ${importDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-medium transition-colors ${importDragOver ? 'text-primary' : 'text-foreground'}`}>
                      {importDragOver ? 'Drop your video here' : 'Drag & drop a video'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">or click to browse • MP4, MOV, WebM</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI will analyze your video and suggest prompts for remixing
                  </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Video Preview */}
                  <Card>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Uploaded Video</p>
                        <Button variant="ghost" size="sm" onClick={resetImport} className="text-xs gap-1">
                          <X className="w-3 h-3" /> Remove
                        </Button>
                      </div>
                      <video
                        src={importVideoUrl}
                        controls
                        className="w-full rounded-lg max-h-[300px] bg-black"
                      />
                    </CardContent>
                  </Card>

                  {/* AI Analysis Status */}
                  {isImportAnalyzing && (
                    <Card className="border-primary/30">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">AI is analyzing your video...</p>
                          <p className="text-xs text-muted-foreground">Extracting frames and studying hook, pacing, and visual style</p>
                        </div>
                        <Loader2 className="w-5 h-5 animate-spin text-primary ml-auto" />
                      </CardContent>
                    </Card>
                  )}

                  {/* Extracted Frames */}
                  {importFrames.length > 0 && !isImportAnalyzing && (
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Extracted Key Frames</p>
                        <div className="grid grid-cols-6 gap-2">
                          {importFrames.map((frame, i) => (
                            <img key={i} src={frame} alt={`Frame ${i + 1}`} className="w-full aspect-video object-cover rounded-lg border border-border" />
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Analysis Summary */}
                  {importAnalysis && !isImportAnalyzing && (
                    <Card className="border-primary/20">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <p className="text-xs font-medium text-muted-foreground uppercase">AI Analysis</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          {importAnalysis.hook && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Hook</p>
                              <p className="text-foreground">{importAnalysis.hook.text || 'N/A'}</p>
                              <Badge variant="secondary" className="text-[10px]">{importAnalysis.hook.strength || 'unknown'}</Badge>
                            </div>
                          )}
                          {importAnalysis.messaging && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Core Topic</p>
                              <p className="text-foreground">{importAnalysis.messaging.coreTopic || 'N/A'}</p>
                            </div>
                          )}
                          {importAnalysis.pacing && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Pacing</p>
                              <p className="text-foreground">{importAnalysis.pacing.overall || 'N/A'}</p>
                            </div>
                          )}
                          {importAnalysis.overallScore !== undefined && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Performance Score</p>
                              <p className="text-foreground font-bold">{importAnalysis.overallScore}/100</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Metadata Form */}
                  {!isImportAnalyzing && (
                    <Card>
                      <CardContent className="p-4 space-y-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Video Details</p>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Name</label>
                          <Input
                            value={importCustomName}
                            onChange={(e) => setImportCustomName(e.target.value)}
                            placeholder="Give this video a name"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">Prompt / Description</label>
                          <Textarea
                            value={importSuggestedPrompt}
                            onChange={(e) => setImportSuggestedPrompt(e.target.value)}
                            placeholder="The prompt used to generate this video, or describe what it shows"
                            rows={3}
                          />
                          {importAnalysis && (
                            <p className="text-xs text-muted-foreground">✨ AI-suggested based on video analysis. Feel free to edit.</p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Model</label>
                            <Select value={importModel} onValueChange={setImportModel}>
                              <SelectTrigger><SelectValue placeholder="Select model used" /></SelectTrigger>
                              <SelectContent>
                                {MODEL_OPTIONS.map((m) => (
                                  <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Task / Job ID</label>
                            <Input
                              value={importTaskId}
                              onChange={(e) => setImportTaskId(e.target.value)}
                              placeholder="e.g. 3a45a1c7dd43..."
                            />
                          </div>
                        </div>

                        <Button
                          onClick={saveImportedVideo}
                          disabled={isImportSaving}
                          className="w-full gap-2"
                        >
                          {isImportSaving ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                          ) : (
                            <><Save className="w-4 h-4" /> Save to Library</>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="flex-1 px-4 overflow-y-auto mt-4">
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
                  <Sparkles className="w-3.5 h-3.5" /> Extract Clips (latest)
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
                  <p className="text-sm mt-1">Create your first video to see it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {historyProjects.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE).map((project) => (
                    <Card
                      key={project.id}
                      className="overflow-hidden cursor-pointer hover:border-primary/40 transition-colors group"
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="grid grid-cols-2 aspect-video">
                        {project.reference_video_url ? (
                          <video src={project.reference_video_url} className="w-full h-full object-cover" muted preload="metadata" />
                        ) : (
                          <div className="bg-muted flex items-center justify-center"><Video className="w-6 h-6 text-muted-foreground/40" /></div>
                        )}
                        {project.generated_video_url ? (
                          <video src={project.generated_video_url} className="w-full h-full object-cover" muted preload="metadata" />
                        ) : (
                          <div className="bg-muted flex items-center justify-center">
                            {project.status === 'generating' ? (
                              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                            ) : project.status === 'failed' ? (
                              <X className="w-5 h-5 text-red-500" />
                            ) : (
                              <Play className="w-6 h-6 text-muted-foreground/40" />
                            )}
                          </div>
                        )}
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
                        <p className="text-xs text-foreground line-clamp-2">{project.prompt || 'No prompt'}</p>
                        {project.generated_video_url && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1 flex-1"
                                onClick={(e) => { e.stopPropagation(); handleSendToChatcut(project); }}
                                title="Open in Chatcut AI for product overlay/replacement"
                              >
                                <Scissors className="w-3 h-3" /> Chatcut
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1 flex-1"
                                onClick={(e) => { e.stopPropagation(); handleRemixProject(project); }}
                                title="Remix this video"
                              >
                                <RefreshCw className="w-3 h-3" /> Remix
                              </Button>
                            </div>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-[11px] gap-1 w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFrameExtractor({
                                  url: project.generated_video_url!,
                                  projectId: project.id,
                                  label: project.custom_name || project.prompt?.slice(0, 40) || 'Video',
                                });
                              }}
                              title="Extract playable B-Roll clips to use in Chatcut AI"
                            >
                              <Sparkles className="w-3 h-3" /> Extract B-Roll Clips
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              {!isLoadingHistory && historyProjects.length > HISTORY_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-3 pt-2 pb-4">
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
        </Tabs>
      </div>
      <ProductPickerDialog
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        onSelect={handleProductPicked}
      />
      <FrameExtractorDialog
        open={!!frameExtractor}
        onOpenChange={(o) => !o && setFrameExtractor(null)}
        videoUrl={frameExtractor?.url || ''}
        projectId={frameExtractor?.projectId}
        projectLabel={frameExtractor?.label}
      />
    </Layout>
  );
};

export default VideoRepo;
