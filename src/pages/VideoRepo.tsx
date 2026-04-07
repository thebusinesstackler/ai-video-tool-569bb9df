import React, { useEffect, useRef, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/hooks/use-toast';
import { createWaveSpeedVideo, getWaveSpeedVideoJob } from '@/lib/wavespeed';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: { type: 'image' | 'video'; url: string; name?: string }[];
  videoResult?: { url: string; status: string };
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
  const [mainTab, setMainTab] = useState<'create' | 'history'>('create');
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isDownloadingUrl, setIsDownloadingUrl] = useState(false);

  // History state
  const [historyProjects, setHistoryProjects] = useState<VideoRepoProject[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedProject, setSelectedProject] = useState<VideoRepoProject | null>(null);

  const hasComposerInput = Boolean(prompt.trim() || referenceVideoUrl || productImageUrl);
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
      if (!data?.videoUrl) throw new Error(data?.error || 'No video returned');

      // Set as reference video
      if (referenceVideoUrl?.startsWith('blob:')) URL.revokeObjectURL(referenceVideoUrl);
      setReferenceVideoUrl(data.videoUrl);
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
    if (!trimmedPrompt && !referenceVideoUrl && !productImageUrl) return;

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
        else projectId = insertedRow.id;
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

      const systemPrompt = `You are a UGC ad video strategist and visual analyst. When given reference video frames, study them carefully: identify the hook technique (first 3 seconds), pacing rhythm, camera movements, talent actions, lighting style, text overlays, and transition patterns. Use these insights to craft a new video that captures the same energy and conversion potential.`;

      const analysisInstruction = `User request: "${userMsg.content}"

${videoFrames.length > 0 ? `Reference video: "${referenceVideoName}" — I've provided ${videoFrames.length} key frames above. Study them carefully.` : ''}
${productImageUrl ? 'Product image provided above — incorporate this product naturally.' : ''}

Provide:
1. **Reference Analysis**: What you observed in the reference frames — hook type, pacing, camera style, talent energy, visual effects
2. **Hook Strategy**: How the first 3 seconds will stop the scroll (based on what works in the reference)
3. **Scene-by-Scene Script**: A 15-30 second UGC-style script with specific visual directions inspired by the reference
4. **Product Integration**: How and when the product appears naturally
5. **CTA Strategy**: Closing technique for maximum conversion

Then provide a final **VIDEO PROMPT** block:

\`\`\`video-prompt
[Your detailed video generation prompt — 80-150 words covering environment, character, action, camera, lighting, product placement, pacing. Incorporate the visual style from the reference.]
\`\`\``;

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

        try {
          const taskId = await createWaveSpeedVideo({
            prompt: videoPrompt,
            model: 'sora-2',
            aspectRatio: '9:16',
            duration: 10,
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
              // Update DB with generated video
              if (projectId) {
                await supabase.from('video_repo_projects').update({
                  generated_video_url: job.videoUrl,
                  status: 'completed',
                }).eq('id', projectId);
              }

              // Save to generated_images for gallery integration
              if (user) {
                await supabase.from('generated_images').insert({
                  user_id: user.id,
                  image_url: job.videoUrl,
                  prompt: videoPrompt,
                  source: 'video-repo',
                  reference_image_url: persistentImageUrl,
                });
              }

              const resultMsg: ChatMessage = {
                id: `result-${Date.now()}`,
                role: 'assistant',
                content: '✅ Your UGC ad video is ready! You can download it or use it directly.',
                videoResult: { url: job.videoUrl, status: 'completed' },
              };
              setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id).concat(resultMsg));
              fetchHistory();
              break;
            }
            if (job.status === 'failed') {
              throw new Error(job.error || 'Video generation failed');
            }
            attempts++;
          }

          if (attempts >= maxAttempts) {
            throw new Error('Video generation timed out. Check your video queue for updates.');
          }
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
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] max-w-6xl mx-auto flex-col overflow-hidden">
        <div className="text-center py-6 px-4">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-2">
            AI UGC Video Generator
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
            Generate AI UGC-style video ads in minutes — no creators, no filming, no editing.
          </p>
        </div>

        <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'create' | 'history')} className="flex-1 flex flex-col min-h-0">
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
            </TabsList>
          </div>

          <TabsContent value="create" className="flex-1 flex flex-col items-center px-4 min-h-0 overflow-y-auto mt-4">
            {/* Composer Card */}
            <Card className="w-full max-w-3xl bg-card/95 border-2 border-primary/30 shadow-card rounded-3xl overflow-hidden mb-4 backdrop-blur-sm">
              <div className="flex items-center gap-1 px-4 pt-3 border-b border-border/60 bg-muted/30">
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

              <div className="px-4 py-3 border-b border-border/50 bg-background/70">
                <div className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">Prompt</div>
                <Textarea
                  placeholder="Upload your product image or reference video and describe your idea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[88px] rounded-2xl border border-border bg-background px-4 py-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring"
                  rows={3}
                />
              </div>

              <div className="px-4 py-3 space-y-3 bg-background/60">
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-[0.18em]">Uploads</div>

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
                        We'll analyze {videoFrames.length} key frames from your reference video to learn the hook, pacing, camera style, and product placement before generating your new ad.
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

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductImage} />
                    <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleReferenceVideo} />
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-full bg-background" onClick={() => fileInputRef.current?.click()}>
                      <ImagePlus className="w-3.5 h-3.5" /> Add Image & Link
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-full bg-background" onClick={() => videoInputRef.current?.click()}>
                      <Video className="w-3.5 h-3.5" /> Reference Video
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <div className="relative">
                        <Link className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        <Input
                          type="url"
                          placeholder="Paste TikTok or YouTube URL"
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleUrlImport(); } }}
                          className="h-8 text-xs rounded-full pl-8 pr-2 w-[200px] md:w-[240px] bg-background"
                          disabled={isDownloadingUrl}
                        />
                      </div>
                      {urlInput.trim() && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs rounded-full gap-1"
                          onClick={handleUrlImport}
                          disabled={isDownloadingUrl}
                        >
                          {isDownloadingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          {isDownloadingUrl ? 'Importing...' : 'Import'}
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-between md:justify-end">
                    <Select value={mode} onValueChange={(v: 'guided' | 'freeform') => setMode(v)}>
                      <SelectTrigger className="h-8 text-xs w-[130px] rounded-full bg-background"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guided">Guided Mode</SelectItem>
                        <SelectItem value="freeform">Freeform</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      aria-label="Send prompt"
                      className="h-9 w-9 rounded-full"
                      onClick={analyzeAndGenerate}
                      disabled={isAnalyzing || isGenerating || isExtractingFrames || !hasComposerInput}
                    >
                      {statusLabel ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Conversation area */}
            {showConversation ? (
              <ScrollArea className="w-full max-w-3xl mb-6 min-h-[280px] rounded-2xl border border-border/60 bg-background/20 px-4">
                <div className="space-y-4 py-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary" />
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
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
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
            ) : (
              <div className="w-full max-w-3xl mb-6 min-h-[220px] rounded-2xl border border-dashed border-border/80 bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground flex items-center justify-center shadow-card">
                Upload a product image and a reference video, then press send. We'll extract key frames, study the hook, pacing, and composition, and build a new ad around your product.
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="flex-1 px-4 overflow-y-auto mt-4">
            <div className="max-w-4xl mx-auto space-y-4">
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
                  {historyProjects.map((project) => (
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default VideoRepo;
