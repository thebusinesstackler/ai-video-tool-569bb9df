import React, { useState, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  RefreshCw, Upload, Link2, Sparkles, Video, Download,
  Eye, Wand2, Zap, Target, Clock, Film, Type, Volume2,
  TrendingUp, Palette, SplitSquareVertical, Loader2, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface VideoAnalysis {
  hook: { text: string; type: string; strength: string };
  messaging: { coreTopic: string; keyPromise: string; emotionalAngle: string };
  scriptStructure: { sections: { name: string; duration: string; purpose: string }[] };
  sceneSequence: { scenes: { description: string; visualStyle: string; duration: string }[] };
  pacing: { overall: string; hookSpeed: string; buildUp: string; climax: string };
  visualStyle: { aesthetic: string; colorPalette: string; transitions: string };
  captions: { style: string; placement: string; animation: string };
  cta: { text: string; type: string; placement: string };
  creativeDirection: { whyItWorks: string[]; winningFormula: string };
  overallScore: number;
}

interface RepurposedScript {
  title: string;
  scenes: {
    sceneNumber: number;
    narration: string;
    visualDirection: string;
    duration: string;
    improvement: string;
  }[];
  improvements: string[];
  estimatedDuration: string;
}

const PLATFORMS = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram-reels', label: 'Instagram Reels' },
  { value: 'youtube-shorts', label: 'YouTube Shorts' },
  { value: 'paid-social', label: 'Paid Social Ads' },
];

const VideoRepurposer = () => {
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('url');
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState('');
  const [platform, setPlatform] = useState('tiktok');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isRepurposing, setIsRepurposing] = useState(false);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [repurposedScript, setRepurposedScript] = useState<RepurposedScript | null>(null);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File too large. Max 100MB.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('Please sign in'); return; }

    const ext = file.name.split('.').pop();
    const path = `${user.id}/repurpose/${Date.now()}.${ext}`;

    toast.info('Uploading video...');
    const { error } = await supabase.storage.from('reels').upload(path, file);
    if (error) { toast.error('Upload failed'); return; }

    const { data: urlData } = supabase.storage.from('reels').getPublicUrl(path);
    setUploadedVideoUrl(urlData.publicUrl);
    toast.success('Video uploaded');
  };

  const getVideoSource = () => inputMode === 'upload' ? uploadedVideoUrl : videoUrl;

  // Extract frames from a video URL (client-side)
  const extractVideoFrames = async (sourceUrl: string, count = 6): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.src = sourceUrl;

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
            resolve(frames);
          }
        };

        video.onseeked = captureFrame;
        video.currentTime = timestamps[0];
      };

      video.onerror = () => {
        reject(new Error('Failed to load video for frame extraction'));
      };
    });
  };

  // Download a YouTube/social URL to get a playable video URL
  // Uses the same robust multi-layered strategy as Video Repo Pro:
  // 1. Server-side download via edge function
  // 2. Client-side direct fetch
  // 3. Client-side MediaRecorder + captureStream() fallback (bypasses CORS)
  const downloadVideoFromUrl = async (url: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke('download-video-url', {
      body: { url },
    });
    if (error) throw new Error('Failed to download video');
    if (data?.error) throw new Error(data.error);

    // If server successfully downloaded & stored it, use that URL directly
    if (data?.videoUrl) {
      return data.videoUrl;
    }

    // Handle client-side download fallback (same as VideoRepoPro)
    if (data?.clientDownload && data?.downloadUrl && data?.signedUploadUrl) {
      toast.info('Browser is downloading the video directly...');

      const videoBlob = await new Promise<Blob>((resolve, reject) => {
        // First try direct fetch
        fetch(data.downloadUrl)
          .then(resp => {
            if (!resp.ok) throw new Error('fetch failed');
            return resp.blob();
          })
          .then(blob => {
            if (blob.size < 1000) throw new Error('Downloaded file too small');
            resolve(blob);
          })
          .catch(() => {
            // Fallback: use video element + MediaRecorder captureStream
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.crossOrigin = 'anonymous';
            video.src = data.downloadUrl;

            video.onerror = () => {
              // Last resort: try without crossOrigin
              video.removeAttribute('crossorigin');
              video.src = '';
              video.src = data.downloadUrl;
              video.onerror = () => reject(new Error(
                'Could not download this video. Please download it to your device first, then use the Upload tab.'
              ));
              video.onloadeddata = () => {
                try {
                  const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
                  if (!stream) throw new Error('captureStream not supported');
                  const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                  const chunks: Blob[] = [];
                  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                  recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
                  recorder.start();
                  video.play();
                  video.onended = () => recorder.stop();
                  setTimeout(() => { try { recorder.stop(); } catch {} }, 120000);
                } catch {
                  reject(new Error('Could not capture video. Please download it manually and upload.'));
                }
              };
            };

            video.onloadeddata = () => {
              try {
                const stream = (video as any).captureStream?.() || (video as any).mozCaptureStream?.();
                if (!stream) throw new Error('captureStream not supported');
                const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
                const chunks: Blob[] = [];
                recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
                recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
                recorder.start();
                video.play();
                video.onended = () => recorder.stop();
                setTimeout(() => { try { recorder.stop(); } catch {} }, 120000);
              } catch {
                reject(new Error('Could not capture video. Please download it manually and upload.'));
              }
            };

            video.load();
          });
      });

      if (videoBlob.size > 100 * 1024 * 1024) throw new Error('Video is too large (max 100MB)');

      // Upload to storage via signed URL
      const uploadResp = await fetch(data.signedUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': videoBlob.type || 'video/mp4' },
        body: videoBlob,
      });
      if (!uploadResp.ok) throw new Error(`Upload returned ${uploadResp.status}`);
      toast.success('Video downloaded and stored successfully');
      return data.publicUrl;
    }

    throw new Error('No video URL returned from download service');
  };

  const isYouTubeOrSocialUrl = (url: string) => {
    return /youtube\.com|youtu\.be|tiktok\.com|instagram\.com/i.test(url);
  };

  const handleAnalyze = async () => {
    const source = getVideoSource();
    if (!source) { toast.error('Provide a video URL or upload a file'); return; }

    setIsAnalyzing(true);
    setAnalysis(null);
    setRepurposedScript(null);
    setAnalyzeProgress(5);

    const progressInterval = setInterval(() => {
      setAnalyzeProgress(prev => Math.min(prev + 3, 90));
    }, 2000);

    try {
      let analyzeUrl = source;

      // Step 1: If it's a social media URL, download it first
      if (isYouTubeOrSocialUrl(source)) {
        toast.info('Downloading video from URL...');
        setAnalyzeProgress(10);
        analyzeUrl = await downloadVideoFromUrl(source);
        toast.success('Video downloaded, extracting frames & transcribing...');
      }

      setAnalyzeProgress(25);

      // Step 2: Extract frames and transcribe audio in parallel
      let frames: string[] = [];
      let transcript = '';

      // Try frame extraction
      try {
        frames = await extractVideoFrames(analyzeUrl, 6);
        console.log(`Extracted ${frames.length} frames successfully`);
      } catch (frameErr: any) {
        console.warn('Frame extraction failed:', frameErr?.message);
        toast.warning('Could not extract video frames — trying transcript only...');
      }

      // Try transcription (use the original social URL if analyzeUrl might be empty storage)
      try {
        const transcriptResult = await supabase.functions.invoke('transcribe-video', { 
          body: { videoUrl: analyzeUrl } 
        });
        transcript = transcriptResult.data?.text || '';
        if (transcript) {
          console.log('Transcript extracted, length:', transcript.length);
        }
      } catch (transcribeErr: any) {
        console.warn('Transcription failed:', transcribeErr?.message);
      }

      // CRITICAL: If we have neither frames nor transcript, abort — don't let AI hallucinate
      if (frames.length === 0 && !transcript) {
        throw new Error(
          'Could not extract frames or audio from this video. The video may not be downloadable. ' +
          'Try uploading the video file directly instead of using a URL.'
        );
      }

      setAnalyzeProgress(60);
      toast.info(`Extracted ${frames.length} frames${transcript ? ' + transcript' : ''}. Running AI analysis...`);

      // Step 3: Send frames + transcript to AI for real analysis
      const { data, error } = await supabase.functions.invoke('analyze-repurpose-video', {
        body: {
          action: 'analyze',
          videoUrl: source,
          platform,
          frames,
          transcript,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      setAnalyzeProgress(100);
      toast.success('Video analyzed with real frames & audio — the AI found the winning formula');
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      setTimeout(() => setAnalyzeProgress(0), 1000);
    }
  };

  const handleRepurpose = async () => {
    if (!analysis) { toast.error('Analyze the video first'); return; }

    setIsRepurposing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-repurpose-video', {
        body: {
          action: 'repurpose',
          videoUrl: getVideoSource(),
          platform,
          analysis,
          additionalNotes,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setRepurposedScript(data.script);
      toast.success('Repurposed script generated!');
    } catch (err: any) {
      toast.error(err.message || 'Repurpose failed');
    } finally {
      setIsRepurposing(false);
    }
  };

  const handleSendToReels = () => {
    if (!repurposedScript) return;
    const scriptText = repurposedScript.scenes
      .map(s => `Scene ${s.sceneNumber}: ${s.narration}\n[Visual: ${s.visualDirection}]`)
      .join('\n\n');
    
    sessionStorage.setItem('repurposed-script', JSON.stringify({
      topic: repurposedScript.title,
      script: scriptText,
      scenes: repurposedScript.scenes,
    }));
    window.location.href = '/reels';
    toast.success('Script sent to Reels editor');
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
            <RefreshCw className="w-8 h-8 text-primary" />
            AI Video Repurposer
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload a winning video — the AI breaks down why it works, then generates a fresh, improved version.
          </p>
        </div>

        {/* Input Section */}
        <Card className="border-primary/20">
          <CardContent className="p-6 space-y-4">
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as 'upload' | 'url')}>
              <TabsList className="grid grid-cols-2 w-64">
                <TabsTrigger value="url" className="gap-2"><Link2 className="w-4 h-4" /> Paste URL</TabsTrigger>
                <TabsTrigger value="upload" className="gap-2"><Upload className="w-4 h-4" /> Upload</TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="mt-4">
                <Input
                  placeholder="Paste YouTube, TikTok, or Instagram URL..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="text-base"
                />
              </TabsContent>

              <TabsContent value="upload" className="mt-4">
                <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                >
                  {uploadedVideoUrl ? (
                    <div className="space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
                      <p className="text-sm text-muted-foreground">Video uploaded. Click to replace.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-sm text-muted-foreground">Click to upload a video (max 100MB)</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex items-center gap-4">
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Target Platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button onClick={handleAnalyze} disabled={isAnalyzing} className="gap-2">
                {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                {isAnalyzing ? 'Analyzing...' : 'Analyze Video'}
              </Button>
            </div>

            {isAnalyzing && (
              <div className="space-y-1">
                <Progress value={analyzeProgress} className="h-2" />
                <p className="text-xs text-muted-foreground">AI is studying the video structure, pacing, hooks, and creative direction...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysis && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" /> Video Breakdown
              </h2>
              <Badge variant="outline" className="text-primary border-primary/30">
                Score: {analysis.overallScore}/100
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Hook */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Hook</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium">{analysis.hook.text}</p>
                  <p className="text-muted-foreground">Type: {analysis.hook.type} • Strength: {analysis.hook.strength}</p>
                </CardContent>
              </Card>

              {/* Messaging */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Messaging</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Topic:</span> {analysis.messaging.coreTopic}</p>
                  <p><span className="text-muted-foreground">Promise:</span> {analysis.messaging.keyPromise}</p>
                  <p><span className="text-muted-foreground">Emotion:</span> {analysis.messaging.emotionalAngle}</p>
                </CardContent>
              </Card>

              {/* Pacing */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Pacing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Overall:</span> {analysis.pacing.overall}</p>
                  <p><span className="text-muted-foreground">Hook Speed:</span> {analysis.pacing.hookSpeed}</p>
                  <p><span className="text-muted-foreground">Build-up:</span> {analysis.pacing.buildUp}</p>
                </CardContent>
              </Card>

              {/* Visual Style */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /> Visual Style</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Aesthetic:</span> {analysis.visualStyle.aesthetic}</p>
                  <p><span className="text-muted-foreground">Colors:</span> {analysis.visualStyle.colorPalette}</p>
                  <p><span className="text-muted-foreground">Transitions:</span> {analysis.visualStyle.transitions}</p>
                </CardContent>
              </Card>

              {/* Captions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Type className="w-4 h-4 text-primary" /> Captions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Style:</span> {analysis.captions.style}</p>
                  <p><span className="text-muted-foreground">Placement:</span> {analysis.captions.placement}</p>
                  <p><span className="text-muted-foreground">Animation:</span> {analysis.captions.animation}</p>
                </CardContent>
              </Card>

              {/* CTA */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> CTA</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="font-medium">{analysis.cta.text}</p>
                  <p className="text-muted-foreground">Type: {analysis.cta.type} • {analysis.cta.placement}</p>
                </CardContent>
              </Card>
            </div>

            {/* Scene Sequence */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Film className="w-4 h-4 text-primary" /> Scene Sequence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.sceneSequence.scenes.map((scene, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                      <Badge variant="secondary" className="shrink-0 mt-0.5">{i + 1}</Badge>
                      <div className="text-sm">
                        <p>{scene.description}</p>
                        <p className="text-muted-foreground text-xs">{scene.visualStyle} • {scene.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Why It Works */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Why This Video Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm font-medium">{analysis.creativeDirection.winningFormula}</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {analysis.creativeDirection.whyItWorks.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Separator />

            {/* Repurpose Controls */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" /> Generate Repurposed Version
                </h3>
                <Textarea
                  placeholder="Optional notes: e.g. 'Make it more energetic', 'Focus on the product benefits', 'Change the CTA to a discount offer'..."
                  value={additionalNotes}
                  onChange={(e) => setAdditionalNotes(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleRepurpose} disabled={isRepurposing} className="gap-2">
                  {isRepurposing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {isRepurposing ? 'Generating...' : 'Repurpose Video'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Repurposed Script */}
        {repurposedScript && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" /> Repurposed Script: {repurposedScript.title}
              </h2>
              <Badge variant="outline">{repurposedScript.estimatedDuration}</Badge>
            </div>

            {/* Improvements */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-2">Key Improvements:</p>
                <div className="flex flex-wrap gap-2">
                  {repurposedScript.improvements.map((imp, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{imp}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Scenes */}
            <div className="space-y-3">
              {repurposedScript.scenes.map((scene) => (
                <Card key={scene.sceneNumber}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Badge className="shrink-0 mt-1">Scene {scene.sceneNumber}</Badge>
                      <div className="space-y-2 flex-1">
                        <p className="text-sm font-medium">{scene.narration}</p>
                        <p className="text-xs text-muted-foreground">[Visual: {scene.visualDirection}]</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {scene.duration}</span>
                          <span className="text-primary">↑ {scene.improvement}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button onClick={handleSendToReels} className="gap-2">
                <Play className="w-4 h-4" /> Send to Reels Editor
              </Button>
              <Button variant="outline" onClick={handleRepurpose} disabled={isRepurposing} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Regenerate
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default VideoRepurposer;
