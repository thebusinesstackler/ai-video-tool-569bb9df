import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  Sparkles,
  RefreshCw,
  Star,
  Pencil,
  RotateCcw,
  Check,
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

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { type: 'image' | 'video'; url: string; name?: string }[];
  videoResult?: { url: string; status: string };
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
  const [mainTab, setMainTab] = useState<'create' | 'history' | 'calendar'>('create');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStitching, setIsStitching] = useState(false);
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
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');

  // AI Script Director chat state
  const [hasAnalysis, setHasAnalysis] = useState(false);
  const [latestAnalysisText, setLatestAnalysisText] = useState('');
  const [persistentVideoUrl, setPersistentVideoUrl] = useState<string | null>(null);
  const [persistentImageUrl, setPersistentImageUrl] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isChatting, setIsChatting] = useState(false);

  const hasComposerInput = Boolean(prompt.trim() || referenceVideoUrl || productImageUrl);
  const showConversation = messages.length > 0 || isAnalyzing || isGenerating || isStitching || isExtractingFrames || isChatting;
  const statusLabel = isExtractingFrames
    ? 'Extracting key frames from your reference video...'
    : isAnalyzing
      ? 'Researching the reference video and writing your multi-segment script...'
      : isStitching
        ? 'Stitching segments into a seamless 30-second video...'
        : isGenerating
          ? generationProgress || 'Generating video segments with Sora 2...'
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
      const { data, error } = await supabase
        .from('video_repo_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHistoryProjects((data as VideoRepoProject[]) || []);
    } catch (err: any) {
      console.error('Error fetching history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user]);

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  const toggleFavorite = async (project: VideoRepoProject, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const remakeWithEdits = (project: VideoRepoProject, e: React.MouseEvent) => {
    e.stopPropagation();
    setMainTab('create');
    if (project.reference_video_url) {
      setReferenceVideoUrl(project.reference_video_url);
      setReferenceVideoName('Previous reference');
    }
    if (project.product_image_url) {
      setProductImageUrl(project.product_image_url);
      setProductImageName('Previous product');
    }
    setPrompt(project.prompt?.replace(/^\[PRO\]\s*/, '') || '');
    toast({ title: 'Project loaded', description: 'Edit your prompt and hit send to remake.' });
  };

  useEffect(() => {
    if (user) fetchHistory();
  }, [user, fetchHistory]);

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
      if (!data?.videoUrl) throw new Error(data?.error || 'No video returned');

      if (referenceVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(referenceVideoUrl);
      setReferenceVideoUrl(data.videoUrl);
      try {
        const hostname = new URL(trimmed).hostname.replace('www.', '');
        setReferenceVideoName(`${hostname} import`);
      } catch { setReferenceVideoName('URL import'); }
      setReferenceVideoFile(null);
      setUrlInput('');
      setVideoFrames([]);

      setIsExtractingFrames(true);
      try {
        const videoResp = await fetch(data.videoUrl);
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
    return /```video-prompt-1\n/.test(text) && /```video-prompt-2\n/.test(text);
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
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'File upload failed', description: err.message, variant: 'destructive' });
    }

    setPersistentVideoUrl(pVideoUrl);
    setPersistentImageUrl(pImageUrl);

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
      const systemPrompt = `You are an AI Script Director for UGC ad videos. You help filmmakers craft and refine scripts for FULL 30-SECOND videos in ${formatLabel} format. You split ads into exactly TWO segments that will be generated separately and stitched together seamlessly.

Your personality: Warm, experienced, collaborative. You speak like a veteran ad creative director. You welcome feedback and iterate on scripts.

CRITICAL RULES:
- The total ad is 30 seconds, split into Segment 1 (~15s) and Segment 2 (~15s)
- Format: ${formatLabel} — frame all shots accordingly
- Segment 2 MUST visually continue from where Segment 1 ends — same character, same environment, continuous action
- Each segment prompt must be 80-150 words with full cinematic detail
- Include explicit transition instructions: Segment 1's final frame should set up Segment 2's opening frame
- You MUST also provide a narration script that will be read as voiceover over the full 30-second video
- ALWAYS include the video-prompt-1, video-prompt-2, and narration code blocks in your response so the user can generate when ready`;

      const analysisInstruction = `User request: "${userMsg.content}"

${videoFrames.length > 0 ? `Reference video: "${referenceVideoName}" — I've provided ${videoFrames.length} key frames above. Study them carefully.` : ''}
${productImageUrl ? 'Product image provided above — incorporate this product naturally.' : ''}

Provide:
1. **Reference Analysis**: What you observed in the reference frames — hook type, pacing, camera style, talent energy, visual effects
2. **Hook Strategy**: How the first 3 seconds will stop the scroll
3. **Full 30-Second Script**: Scene-by-scene breakdown covering 0-30 seconds
4. **Segment Breakdown**: How the 30s ad splits into two ~15s segments with seamless continuity
5. **Product Integration**: How and when the product appears naturally
6. **CTA Strategy**: Closing technique for maximum conversion

Then provide TWO video prompt blocks — one per segment:

\`\`\`video-prompt-1
[Segment 1: 0-15 seconds. Detailed video generation prompt — 80-150 words covering environment, character, action, camera, lighting, product placement, pacing. This segment covers the HOOK and PROBLEM/SETUP. End with a specific visual that Segment 2 will continue from.]
\`\`\`

\`\`\`video-prompt-2
[Segment 2: 15-30 seconds. Detailed video generation prompt — 80-150 words. This segment starts EXACTLY where Segment 1 ends — same character, same environment, continuous motion. Covers the SOLUTION/PRODUCT SHOWCASE and CTA. Include the closing action and call-to-action.]
\`\`\`

And finally, provide the voiceover narration script:

\`\`\`narration
[The full voiceover script for the 30-second ad. 60-90 words. Conversational, punchy, direct. Should complement the visuals without describing them literally.]
\`\`\`

After providing the script, let the user know they can give feedback to refine it, or hit "Generate Video" when they're happy with it.`;

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
      const systemPrompt = `You are an AI Script Director for UGC ad videos. You're in a collaborative session helping refine a 30-second ${formatLabel} ad script.

RULES:
- Listen to user feedback and revise the script accordingly
- ALWAYS include updated video-prompt-1, video-prompt-2, and narration code blocks when you make script changes
- Keep segment timing at ~15s each (total 30s)
- Maintain continuity between segments
- Be collaborative, warm, and constructive
- If the user asks questions about the script, answer helpfully
- Each segment prompt must be 80-150 words with full cinematic detail`;

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

    // Extract TWO video prompts
    const prompt1Match = analysisText.match(/```video-prompt-1\n([\s\S]*?)```/);
    const prompt2Match = analysisText.match(/```video-prompt-2\n([\s\S]*?)```/);

    if (!prompt1Match || !prompt2Match) {
      toast({ title: 'No video prompts found', description: 'Ask the AI to include video-prompt blocks.', variant: 'destructive' });
      return;
    }

    let videoPrompt1 = prompt1Match[1].trim();
    let videoPrompt2 = prompt2Match[1].trim();

    // --- AI Script Pacing Agent ---
    try {
      setGenerationProgress('AI Agent reviewing script pacing...');
      const narrationMatch = analysisText.match(/```narration\n([\s\S]*?)```/);
      const fullNarration = narrationMatch ? narrationMatch[1].trim() : '';

      const { data: pacingData, error: pacingError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a script pacing QA agent. Your job is to ensure video generation prompts and narrations fit within Sora-2's timing constraints.

RULES:
- Speaking rate is ~2.5 words/second
- Each segment is ~15 seconds (max 20s), so each segment narration should be 30-50 words MAX
- Video prompts should be 80-150 words with full cinematic detail
- Sentences must end cleanly — no trailing articles, prepositions, or mid-thought cutoffs
- If a segment's narration is too long, trim or redistribute words between segments
- If prompts reference actions that would take longer than 15-20s, simplify them

RESPOND IN EXACTLY THIS FORMAT (no extra text):
\`\`\`video-prompt-1
[corrected segment 1 prompt]
\`\`\`

\`\`\`video-prompt-2
[corrected segment 2 prompt]
\`\`\`

\`\`\`narration-1
[segment 1 narration — 30-50 words max]
\`\`\`

\`\`\`narration-2
[segment 2 narration — 30-50 words max]
\`\`\`

If everything is already fine, return them unchanged.`
            },
            {
              role: 'user',
              content: `Review these for pacing issues:

VIDEO PROMPT 1:
${videoPrompt1}

VIDEO PROMPT 2:
${videoPrompt2}

FULL NARRATION:
${fullNarration}

Check word counts vs 15s segment duration (~2.5 words/sec = 37 words ideal per segment). Fix any issues.`
            }
          ],
        },
      });

      if (!pacingError && pacingData?.response) {
        const reviewed = pacingData.response;
        const rp1 = reviewed.match(/```video-prompt-1\n([\s\S]*?)```/);
        const rp2 = reviewed.match(/```video-prompt-2\n([\s\S]*?)```/);
        if (rp1 && rp2) {
          videoPrompt1 = rp1[1].trim();
          videoPrompt2 = rp2[1].trim();
          console.log('[VideoRepoPro] AI Pacing Agent revised prompts');
        }
      }
    } catch (pacingErr) {
      console.warn('[VideoRepoPro] Pacing review failed, using original prompts:', pacingErr);
    }

    if (projectId) {
      await supabase.from('video_repo_projects').update({
        video_prompt: `SEGMENT 1:\n${videoPrompt1}\n\nSEGMENT 2:\n${videoPrompt2}`,
      }).eq('id', projectId);
    }

    setIsGenerating(true);

    const generatingMsg: ChatMessage = {
      id: `assistant-gen-${Date.now()}`,
      role: 'assistant',
      content: '🎬 Generating TWO video segments with Sora-2 in parallel... Each segment is up to 20 seconds. They will be stitched into a seamless 30-second video.',
    };
    setMessages((prev) => [...prev, generatingMsg]);

    let segment1Url: string | null = null;
    let segment2Url: string | null = null;

    try {
      setGenerationProgress('Starting Segment 1 & 2 generation...');

      const [taskId1, taskId2] = await Promise.all([
        createWaveSpeedVideo({
          prompt: videoPrompt1,
          model: 'sora-2',
          aspectRatio,
          duration: 20,
          userId: user?.id,
          source: 'video-repo-pro',
          ...(persistentImageUrl ? { imageUrls: [persistentImageUrl] } : {}),
        }),
        createWaveSpeedVideo({
          prompt: videoPrompt2,
          model: 'sora-2',
          aspectRatio,
          duration: 20,
          userId: user?.id,
          source: 'video-repo-pro',
          ...(persistentImageUrl ? { imageUrls: [persistentImageUrl] } : {}),
        }),
      ]);

      let attempts = 0;
      const maxAttempts = 150;

      while (attempts < maxAttempts && (!segment1Url || !segment2Url)) {
        await new Promise((r) => setTimeout(r, 5000));

        const [job1, job2] = await Promise.all([
          segment1Url ? Promise.resolve(null) : getWaveSpeedVideoJob(taskId1),
          segment2Url ? Promise.resolve(null) : getWaveSpeedVideoJob(taskId2),
        ]);

        if (job1?.status === 'completed' && job1.videoUrl) {
          segment1Url = job1.videoUrl;
          setGenerationProgress(segment2Url ? 'Both segments ready!' : 'Segment 1 ready ✓ — waiting for Segment 2...');
        }
        if (job1?.status === 'failed') throw new Error(`Segment 1 failed: ${job1.error || 'Unknown error'}`);

        if (job2?.status === 'completed' && job2.videoUrl) {
          segment2Url = job2.videoUrl;
          setGenerationProgress(segment1Url ? 'Both segments ready!' : 'Segment 2 ready ✓ — waiting for Segment 1...');
        }
        if (job2?.status === 'failed') throw new Error(`Segment 2 failed: ${job2.error || 'Unknown error'}`);

        if (!segment1Url && !segment2Url) {
          setGenerationProgress(`Generating both segments... (${Math.round((attempts / maxAttempts) * 100)}%)`);
        }

        attempts++;
      }

      if (!segment1Url || !segment2Url) {
        throw new Error('Video generation timed out. One or both segments did not complete.');
      }

      setIsGenerating(false);
      setIsStitching(true);
      setGenerationProgress('Stitching segments into one seamless video...');

      if (projectId) {
        await supabase.from('video_repo_projects').update({ status: 'stitching' as any }).eq('id', projectId);
      }

      setGenerationProgress('Downloading clips for analysis...');
      const blobUrls: string[] = [];
      const segmentUrls = [segment1Url, segment2Url];

      for (let i = 0; i < segmentUrls.length; i++) {
        const segUrl = segmentUrls[i];
        setGenerationProgress(`Downloading clip ${i + 1}...`);
        const resp = await fetch(segUrl);
        if (!resp.ok) throw new Error(`Failed to download segment ${i + 1}: ${resp.status}`);
        let blob = await resp.blob();

        try {
          setGenerationProgress(`Analyzing clip ${i + 1} audio for clean ending...`);
          const tempUrl = await uploadBlobToStorage(blob, 'temp-analysis', 'mp4');

          const { data: trimData, error: trimError } = await supabase.functions.invoke('analyze-audio-trim', {
            body: { videoUrl: tempUrl },
          });

          if (trimError) {
            console.warn(`[VideoRepoPro] Audio analysis failed for clip ${i + 1}:`, trimError);
          } else if (trimData?.hasCutoff && trimData.trimTimestamp > 0) {
            setGenerationProgress(`Trimming clip ${i + 1} to clean ending at ${trimData.trimTimestamp.toFixed(1)}s...`);
            console.log(`[VideoRepoPro] Clip ${i + 1}: trimming to ${trimData.trimTimestamp}s — ${trimData.reason}`);
            const trimmedBlob = await trimVideoToTimestamp(blob, trimData.trimTimestamp, (pct) => {
              setGenerationProgress(`Trimming clip ${i + 1}... ${pct}%`);
            });
            blob = trimmedBlob;

            try {
              const originalDuration = 20;
              const lostSeconds = originalDuration - trimData.trimTimestamp;
              if (lostSeconds >= 3) {
                setGenerationProgress(`Extending clip ${i + 1} by ${Math.round(lostSeconds)}s to recover trimmed content...`);
                const trimmedUrl = await uploadBlobToStorage(blob, 'trimmed-for-extend', 'mp4');

                const { data: extendResult, error: extendError } = await supabase.functions.invoke('wavespeed-video', {
                  body: {
                    action: 'create',
                    model: 'alibaba/wan-2.5/video-extend',
                    videoUrl: trimmedUrl,
                    prompt: 'Continue the scene naturally — same character, same environment, smooth cinematic motion. Maintain the same speaking style and energy.',
                    duration: Math.min(10, Math.round(lostSeconds)),
                  },
                });

                if (!extendError && extendResult?.taskId) {
                  let extendAttempts = 0;
                  const maxExtendAttempts = 60;
                  while (extendAttempts < maxExtendAttempts) {
                    await new Promise(r => setTimeout(r, 5000));
                    const extJob = await getWaveSpeedVideoJob(extendResult.taskId);
                    if (extJob.status === 'completed' && extJob.videoUrl) {
                      setGenerationProgress(`Clip ${i + 1} extended successfully ✓`);
                      const extResp = await fetch(extJob.videoUrl);
                      if (extResp.ok) {
                        blob = await extResp.blob();
                        console.log(`[VideoRepoPro] Clip ${i + 1}: extended by ${Math.round(lostSeconds)}s`);
                      }
                      break;
                    }
                    if (extJob.status === 'failed') {
                      console.warn(`[VideoRepoPro] Video extend failed for clip ${i + 1}:`, extJob.error);
                      break;
                    }
                    extendAttempts++;
                    setGenerationProgress(`Extending clip ${i + 1}... (${Math.round((extendAttempts / maxExtendAttempts) * 100)}%)`);
                  }
                }
              } else {
                console.log(`[VideoRepoPro] Clip ${i + 1}: only lost ${lostSeconds.toFixed(1)}s — too short to extend`);
              }
            } catch (extendErr) {
              console.warn(`[VideoRepoPro] Video extend failed for clip ${i + 1}, using trimmed version:`, extendErr);
            }
          } else {
            console.log(`[VideoRepoPro] Clip ${i + 1}: audio ends cleanly — no trim needed`);
          }
        } catch (trimErr) {
          console.warn(`[VideoRepoPro] Audio trim step failed for clip ${i + 1}, using original:`, trimErr);
        }

        blobUrls.push(URL.createObjectURL(blob));
      }

      const stitchedBlob = await stitchVideosWithAudio({
        videoUrls: blobUrls,
        embeddedAudioIndices: [0, 1],
        audioUrls: [],
        onProgress: (pct) => setGenerationProgress(`Stitching... ${pct}%`),
      });

      blobUrls.forEach(u => URL.revokeObjectURL(u));

      const finalVideoUrl = await uploadBlobToStorage(stitchedBlob, 'stitched');

      if (projectId) {
        await supabase.from('video_repo_projects').update({
          generated_video_url: finalVideoUrl,
          status: 'completed',
        }).eq('id', projectId);
      }

      if (user) {
        await supabase.from('generated_images').insert({
          user_id: user.id,
          image_url: finalVideoUrl,
          prompt: `[PRO 30s] ${videoPrompt1.substring(0, 100)}...`,
          source: 'video-repo-pro',
          reference_image_url: persistentImageUrl,
        });
      }

      const resultMsg: ChatMessage = {
        id: `result-${Date.now()}`,
        role: 'assistant',
        content: '✅ Your full 30-second UGC ad video is ready! Two segments have been stitched into one seamless video.',
        videoResult: { url: finalVideoUrl, status: 'completed' },
      };
      setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id).concat(resultMsg));
      fetchHistory();
    } catch (genErr: any) {
      if (projectId) {
        await supabase.from('video_repo_projects').update({ status: 'failed' }).eq('id', projectId);
      }

      const segmentLinks: string[] = [];
      if (segment1Url) segmentLinks.push(segment1Url);
      if (segment2Url) segmentLinks.push(segment2Url);

      let errorContent = `⚠️ Video stitching failed: ${genErr.message}\n\n`;
      if (segmentLinks.length > 0) {
        errorContent += `Your individual segments were generated successfully. You can download them separately and combine them in any video editor:\n`;
        segmentLinks.forEach((url, idx) => {
          errorContent += `\n- [Download Segment ${idx + 1}](${url})`;
        });
      } else {
        errorContent += 'You can retry or copy the video prompts above and try again.';
      }

      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
        retryable: true,
      };
      setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id).concat(errorMsg));
    }
    setIsGenerating(false);
    setIsStitching(false);
    setGenerationProgress('');
    fetchHistory();
  };

  const handleSubmit = () => {
    if (hasAnalysis && prompt.trim()) {
      handleFollowUp();
    } else {
      analyzeReference();
    }
  };

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
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setSelectedProject(null)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">{selectedProject.custom_name || 'Project Details'}</h2>
              <p className="text-xs text-muted-foreground">
                {new Date(selectedProject.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={(e) => toggleFavorite(selectedProject, e)}>
              <Star className={`w-5 h-5 ${selectedProject.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={(e) => remakeWithEdits(selectedProject, e)}>
              <RotateCcw className="w-3.5 h-3.5" /> Remake with Edits
            </Button>
            <Badge variant="outline" className={`${statusColors[selectedProject.status] || ''}`}>
              {selectedProject.status}
            </Badge>
          </div>

          {selectedProject.prompt && (
            <Card><CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Prompt</p>
              <p className="text-sm text-foreground">{selectedProject.prompt}</p>
            </CardContent></Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card><CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-3">Reference Video</p>
              {selectedProject.reference_video_url ? (
                <video src={selectedProject.reference_video_url} controls className="w-full rounded-lg aspect-[9/16] object-cover bg-black" />
              ) : (
                <div className="aspect-[9/16] rounded-lg bg-muted flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">No reference video</p>
                </div>
              )}
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-3">Generated Video (30s Stitched)</p>
              {selectedProject.generated_video_url ? (
                <div className="space-y-2">
                  <video src={selectedProject.generated_video_url} controls className="w-full rounded-lg aspect-[9/16] object-cover bg-black" />
                  <Button size="sm" variant="secondary" asChild>
                    <a href={selectedProject.generated_video_url} download target="_blank" rel="noopener noreferrer">
                      <Download className="w-3 h-3 mr-1" /> Download
                    </a>
                  </Button>
                </div>
              ) : (
                <div className="aspect-[9/16] rounded-lg bg-muted flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    {selectedProject.status === 'generating' || selectedProject.status === 'stitching' ? 'Still processing...' : selectedProject.status === 'failed' ? 'Generation failed' : 'No generated video'}
                  </p>
                </div>
              )}
            </CardContent></Card>
          </div>

          {selectedProject.product_image_url && (
            <Card><CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Product Image</p>
              <img src={selectedProject.product_image_url} alt="Product" className="w-32 h-32 object-cover rounded-lg" />
            </CardContent></Card>
          )}

          {selectedProject.analysis_text && (
            <Card><CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">AI Analysis</p>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{selectedProject.analysis_text}</ReactMarkdown>
              </div>
            </CardContent></Card>
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
            Full 30s UGC ads — two segments stitched seamlessly.
          </p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'create' | 'history' | 'calendar')} className="flex-1 flex flex-col min-h-0">
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
                  className="min-h-[60px] md:min-h-[88px] rounded-xl md:rounded-2xl border border-border bg-background px-3 md:px-4 py-2 md:py-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  rows={2}
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
                        We'll analyze {videoFrames.length} key frames to learn the hook, pacing, and style — then generate a full 30-second ad split into two seamless segments.
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
                    <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as '9:16' | '16:9')}>
                      <SelectTrigger className="h-8 w-[110px] text-xs rounded-full bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="9:16">📱 9:16</SelectItem>
                        <SelectItem value="16:9">🖥️ 16:9</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      aria-label="Send prompt"
                      className="h-8 w-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 ml-auto"
                      onClick={handleSubmit}
                      disabled={isAnalyzing || isGenerating || isStitching || isExtractingFrames || isChatting || (!hasComposerInput && !prompt.trim())}
                    >
                      {statusLabel ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                    </Button>
                  </div>
              </div>
            </Card>

            {showConversation ? (
              <>
                <ScrollArea className="w-full max-w-3xl mb-4 min-h-[280px] rounded-2xl border border-border/60 bg-background/20 px-4">
                  <div className="space-y-4 py-4">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                          <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-orange-500" />
                          </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
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
                {/* Generate Video CTA */}
                {hasAnalysis && !isGenerating && !isStitching && (
                  <div className="w-full max-w-3xl mb-4">
                    <Button
                      onClick={generateFromScript}
                      className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 shadow-lg"
                      disabled={isAnalyzing || isChatting}
                    >
                      <Sparkles className="w-5 h-5" />
                      Generate Video from Script
                    </Button>
                    <p className="text-xs text-muted-foreground text-center mt-1.5">
                      Happy with the script? Hit generate. Want changes? Type feedback above.
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="history" className="flex-1 px-4 mt-4 pb-24">
            <div className="max-w-4xl mx-auto space-y-4">
              {isLoadingHistory ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : historyProjects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No projects yet</p>
                  <p className="text-sm mt-1">Create your first 30-second video to see it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {historyProjects.map((project) => (
                    <Card
                      key={project.id}
                      className={`overflow-hidden cursor-pointer hover:border-orange-500/40 transition-colors group ${project.is_favorite ? 'ring-1 ring-amber-400/50' : ''}`}
                      onClick={() => setSelectedProject(project)}
                    >
                      <div className="grid grid-cols-2 aspect-[4/3] relative">
                        {project.reference_video_url ? (
                          <video src={project.reference_video_url} className="w-full h-full object-cover" muted preload="metadata" />
                        ) : (
                          <div className="bg-muted flex items-center justify-center"><Video className="w-6 h-6 text-muted-foreground/40" /></div>
                        )}
                        {project.generated_video_url ? (
                          <video src={project.generated_video_url} className="w-full h-full object-cover" muted preload="metadata" />
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
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="flex-1 min-h-0 overflow-y-auto mt-2">
            <ContentCalendarTab projects={historyProjects} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default VideoRepoPro;
