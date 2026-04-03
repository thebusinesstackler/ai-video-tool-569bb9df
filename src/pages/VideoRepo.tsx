import React, { useState, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Send, ImagePlus, Video, Upload, Bot, User, Loader2, 
  Play, Download, Link2, ArrowUp
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

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const handleReferenceVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReferenceVideoName(file.name);
    setIsExtractingFrames(true);
    try {
      const frames = await extractVideoFrames(file, 6);
      setVideoFrames(frames);
      setReferenceVideoUrl(URL.createObjectURL(file));
    } catch {
      toast({ title: 'Could not extract frames from video', variant: 'destructive' });
    }
    setIsExtractingFrames(false);
  };

  const handleProductImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProductImageName(file.name);
    const url = await fileToDataUrl(file);
    if (url) setProductImageUrl(url);
  };

  const analyzeAndGenerate = async () => {
    if (!prompt.trim() && !referenceVideoUrl && !productImageUrl) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: prompt || 'Analyze this reference and generate a UGC ad video.',
      attachments: [
        ...(referenceVideoUrl ? [{ type: 'video' as const, url: referenceVideoUrl, name: referenceVideoName }] : []),
        ...(productImageUrl ? [{ type: 'image' as const, url: productImageUrl, name: productImageName }] : []),
      ],
    };
    setMessages(prev => [...prev, userMsg]);
    setPrompt('');
    setIsAnalyzing(true);
    scrollToBottom();

    try {
      // Build multimodal messages with video frames
      const contentParts: any[] = [];

      // Add video frames as images for visual analysis
      if (videoFrames.length > 0) {
        contentParts.push({ type: 'text', text: `I've extracted ${videoFrames.length} key frames from the reference video "${referenceVideoName}". Analyze these frames to understand the visual style, hook strategy, pacing, transitions, camera angles, and talent actions:` });
        for (const frame of videoFrames) {
          contentParts.push({ type: 'image_url', image_url: { url: frame } });
        }
      }

      // Add product image
      if (productImageUrl && !productImageUrl.startsWith('blob:')) {
        contentParts.push({ type: 'text', text: 'Here is the product image to feature in the ad:' });
        contentParts.push({ type: 'image_url', image_url: { url: productImageUrl } });
      }

      const systemPrompt = `You are a UGC ad video strategist and visual analyst. When given reference video frames, study them carefully: identify the hook technique (first 3 seconds), pacing rhythm, camera movements, talent actions, lighting style, text overlays, and transition patterns. Use these insights to craft a new video that captures the same energy and conversion potential.`;

      const analysisInstruction = `User request: "${userMsg.content}"

${videoFrames.length > 0 ? `Reference video: "${referenceVideoName}" — I've provided ${videoFrames.length} key frames above. Study them carefully.` : ''}
${productImageUrl ? `Product image provided above — incorporate this product naturally.` : ''}

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
          ]
        }
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
      setMessages(prev => [...prev, assistantMsg]);
      setIsAnalyzing(false);
      scrollToBottom();

      // Step 2: Extract video prompt and auto-generate
      const videoPromptMatch = analysisText.match(/```video-prompt\n([\s\S]*?)```/);
      if (videoPromptMatch) {
        const videoPrompt = videoPromptMatch[1].trim();
        setIsGenerating(true);

        const generatingMsg: ChatMessage = {
          id: `assistant-gen-${Date.now()}`,
          role: 'assistant',
          content: '🎬 Generating your UGC ad video with Sora-2... This may take a few minutes.',
        };
        setMessages(prev => [...prev, generatingMsg]);
        scrollToBottom();

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

          // Poll for completion
          let attempts = 0;
          const maxAttempts = 120;
          while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 5000));
            const job = await getWaveSpeedVideoJob(taskId);
            
            if (job.status === 'completed' && job.videoUrl) {
              const resultMsg: ChatMessage = {
                id: `result-${Date.now()}`,
                role: 'assistant',
                content: '✅ Your UGC ad video is ready! You can download it or use it directly.',
                videoResult: { url: job.videoUrl, status: 'completed' },
              };
              setMessages(prev => prev.filter(m => m.id !== generatingMsg.id).concat(resultMsg));
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
          setMessages(prev => prev.filter(m => m.id !== generatingMsg.id).concat(errorMsg));
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
      setMessages(prev => [...prev, errorMsg]);
      setIsAnalyzing(false);
      setIsGenerating(false);
    }
    scrollToBottom();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      analyzeAndGenerate();
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-6xl mx-auto">
        {/* Hero Header */}
        <div className="text-center py-8 px-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent mb-4">
            AI UGC Video Generator for UGC Ads That Convert
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
            Generate AI UGC-style video ads in minutes—no creators, no filming, no editing. Perfect for TikTok, Reels, and Meta Ads.
          </p>
        </div>

        {/* Chat + Input Area */}
        <div className="flex-1 flex flex-col items-center px-4 min-h-0">
          {/* Chat Messages */}
          {messages.length > 0 && (
            <ScrollArea className="flex-1 w-full max-w-3xl mb-4">
              <div className="space-y-4 py-4">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted'
                    }`}>
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
                {(isAnalyzing || isGenerating || isExtractingFrames) && (
                  <div className="flex gap-3 justify-start">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">
                        {isExtractingFrames ? 'Extracting video frames...' : isGenerating ? 'Generating video...' : 'Analyzing reference & crafting strategy...'}
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
          )}

          {/* Input Card */}
          <Card className="w-full max-w-3xl bg-card border border-border rounded-2xl overflow-hidden mb-6">
            {/* Tabs */}
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

            {/* Text Input */}
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

            {/* Attachments preview */}
            {(referenceVideoUrl || productImageUrl) && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap">
                {productImageUrl && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <ImagePlus className="w-3 h-3" /> {productImageName || 'Product'}
                    <button onClick={() => { setProductImageUrl(null); setProductImageName(''); }} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                )}
                {referenceVideoUrl && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Video className="w-3 h-3" /> {referenceVideoName || 'Reference'} ({videoFrames.length} frames)
                    <button onClick={() => { setReferenceVideoUrl(null); setReferenceVideoName(''); setVideoFrames([]); }} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                )}
              </div>
            )}

            {/* Bottom Bar */}
            <div className="flex items-center justify-between px-4 pb-3">
              <div className="flex items-center gap-2">
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

              <div className="flex items-center gap-2">
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
                  className="h-8 w-8 rounded-full"
                  onClick={analyzeAndGenerate}
                  disabled={isAnalyzing || isGenerating || (!prompt.trim() && !referenceVideoUrl && !productImageUrl)}
                >
                  <ArrowUp className="w-4 h-4" />
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
