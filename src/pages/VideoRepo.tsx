import React, { useEffect, useRef, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ImagePlus,
  Video,
  Bot,
  User,
  Loader2,
  Play,
  Download,
  ArrowUp,
} from 'lucide-react';
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

const VideoRepo = () => {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);

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

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
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
    if (referenceVideoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(referenceVideoUrl);
    }
    setReferenceVideoUrl(null);
    setReferenceVideoName('');
    setVideoFrames([]);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const clearProductImage = () => {
    setProductImageUrl(null);
    setProductImageName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleReferenceVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (referenceVideoUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(referenceVideoUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setReferenceVideoName(file.name);
    setReferenceVideoUrl(objectUrl);
    setVideoFrames([]);
    setIsExtractingFrames(true);

    try {
      const frames = await extractVideoFrames(file, 6);
      setVideoFrames(frames);
    } catch {
      URL.revokeObjectURL(objectUrl);
      setReferenceVideoUrl(null);
      setReferenceVideoName('');
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
    const url = await fileToDataUrl(file);
    if (url) {
      setProductImageUrl(url);
    }
    e.target.value = '';
  };

  const analyzeAndGenerate = async () => {
    if (isExtractingFrames) {
      toast({
        title: 'Reference video still processing',
        description: 'Please wait for frame extraction to finish before sending.',
      });
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt && !referenceVideoUrl && !productImageUrl) return;

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

      console.log('[VideoRepo] Sending analysis request with', contentParts.length, 'content parts,', videoFrames.length, 'frames');

      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentParts.length > 1 ? contentParts : analysisInstruction },
          ],
        },
      });

      console.log('[VideoRepo] AI response:', { aiData, aiError });

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
            ...(productImageUrl && !productImageUrl.startsWith('data:video') ? { imageUrls: [productImageUrl] } : {}),
          });

          let attempts = 0;
          const maxAttempts = 120;
          while (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 5000));
            const job = await getWaveSpeedVideoJob(taskId);

            if (job.status === 'completed' && job.videoUrl) {
              const resultMsg: ChatMessage = {
                id: `result-${Date.now()}`,
                role: 'assistant',
                content: '✅ Your UGC ad video is ready! You can download it or use it directly.',
                videoResult: { url: job.videoUrl, status: 'completed' },
              };
              setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id).concat(resultMsg));
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
          const errorMsg: ChatMessage = {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Video generation encountered an issue: ${genErr.message}. You can copy the video prompt above and try again.`,
          };
          setMessages((prev) => prev.filter((m) => m.id !== generatingMsg.id).concat(errorMsg));
        }
        setIsGenerating(false);
      }
    } catch (err: any) {
      console.error('[VideoRepo] Analysis error:', err);
      toast({ title: 'Analysis failed', description: err.message, variant: 'destructive' });
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `❌ ${err.message}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMsg]);
      setIsAnalyzing(false);
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      analyzeAndGenerate();
    }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)] max-w-6xl mx-auto flex-col overflow-hidden">
        <div className="text-center py-8 px-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-4">
            AI UGC Video Generator for UGC Ads That Convert
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Generate AI UGC-style video ads in minutes—no creators, no filming, no editing. Perfect for TikTok, Reels, and Meta Ads.
          </p>
        </div>

        <div className="flex-1 flex flex-col items-center px-4 min-h-0 overflow-hidden">
          {showConversation ? (
            <ScrollArea className="flex-1 w-full max-w-3xl mb-4 min-h-0 rounded-2xl border border-border/60 bg-background/20 px-4">
              <div className="space-y-4 py-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
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
                          <video
                            src={msg.videoResult.url}
                            controls
                            className="w-full rounded-lg max-h-[400px]"
                          />
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
            <div className="flex-1 w-full max-w-3xl mb-4 min-h-[220px] rounded-2xl border border-dashed border-border/60 bg-muted/20 px-6 py-8 text-center text-sm text-muted-foreground flex items-center justify-center">
              Upload a product image and a reference video, then press send. We’ll extract key frames, study the hook, pacing, and composition, and build a new ad around your product.
            </div>
          )}

          <Card className="w-full max-w-3xl bg-card border border-border rounded-2xl overflow-hidden mb-6">
            <div className="flex items-center gap-1 px-4 pt-3">
              <button
                onClick={() => setActiveTab('ad')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === 'ad'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Play className="w-3.5 h-3.5" /> Ad Video
              </button>
              <button
                onClick={() => setActiveTab('motion')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  activeTab === 'motion'
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Video className="w-3.5 h-3.5" /> Motion Video
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Beta</Badge>
              </button>
            </div>

            <div className="px-4 py-3">
              <Textarea
                placeholder="Upload your product image or reference video and describe your idea"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                className="border-0 bg-transparent resize-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/60 min-h-[40px] max-h-[120px] p-0"
                rows={1}
              />
            </div>

            {(referenceVideoUrl || productImageUrl || statusLabel) && (
              <div className="px-4 pb-2 space-y-2">
                {(referenceVideoUrl || productImageUrl) && (
                  <div className="flex gap-2 flex-wrap">
                    {productImageUrl && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <ImagePlus className="w-3 h-3" /> {productImageName || 'Product'}
                        <button type="button" onClick={clearProductImage} className="ml-1 hover:text-destructive">×</button>
                      </Badge>
                    )}
                    {referenceVideoUrl && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Video className="w-3 h-3" /> {referenceVideoName || 'Reference'} {videoFrames.length > 0 ? `(${videoFrames.length} frames)` : ''}
                        <button type="button" onClick={clearReferenceVideo} className="ml-1 hover:text-destructive">×</button>
                      </Badge>
                    )}
                  </div>
                )}

                {referenceVideoUrl && videoFrames.length > 0 && !statusLabel && (
                  <p className="text-xs text-muted-foreground">
                    We’ll analyze {videoFrames.length} key frames from your reference video to learn the hook, pacing, camera style, and product placement before generating your new ad.
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

            <div className="flex items-center justify-between px-4 pb-3 gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleProductImage} />
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleReferenceVideo} />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-3.5 h-3.5" /> Add Image & Link
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1.5 rounded-full"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Video className="w-3.5 h-3.5" /> Reference Video
                </Button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Select value={mode} onValueChange={(v: 'guided' | 'freeform') => setMode(v)}>
                  <SelectTrigger className="h-8 text-xs w-[130px] rounded-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guided">Guided Mode</SelectItem>
                    <SelectItem value="freeform">Freeform</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  aria-label="Send prompt"
                  className="h-8 w-8 rounded-full"
                  onClick={analyzeAndGenerate}
                  disabled={isAnalyzing || isGenerating || isExtractingFrames || !hasComposerInput}
                >
                  {statusLabel ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default VideoRepo;
