import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { CAMERA_ANGLES, CameraAngle, CAMERA_CATEGORIES } from '@/data/cameraAngles';
import { CreatorModeToggle } from '@/components/CreatorModeToggle';
import { useCreatorMode } from '@/hooks/useCreatorMode';
import { VideoPlayer } from '@/components/VideoPlayer';
import {
  Sparkles, User, Loader2, Wand2, Camera, Video, Download,
  Mic, Settings2, Film, ChevronDown, RefreshCw, Play
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  face_description: string | null;
  gender: string | null;
}

interface GeneratedScript {
  narration: string;
  visualDescription: string;
  cameraAngle: string;
  setting: string;
  mood: string;
}

interface VideoTask {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
}

const SETTINGS = [
  { id: 'modern-office', name: 'Modern Office', prompt: 'sleek modern office with floor-to-ceiling windows, city skyline view, minimalist desk, warm ambient lighting' },
  { id: 'studio', name: 'Professional Studio', prompt: 'professional broadcast studio, clean backdrop, soft studio lighting, teleprompter setup' },
  { id: 'outdoor-urban', name: 'Urban Rooftop', prompt: 'urban rooftop at golden hour, city skyline behind, warm sunset lighting, modern atmosphere' },
  { id: 'living-room', name: 'Cozy Living Room', prompt: 'warm cozy living room, bookshelf background, soft lamp lighting, comfortable and inviting' },
  { id: 'conference', name: 'Conference Stage', prompt: 'professional conference stage, dramatic spotlighting, dark audience area, keynote speaker setup' },
  { id: 'nature', name: 'Nature/Outdoors', prompt: 'beautiful outdoor natural setting, lush greenery, soft natural light, serene atmosphere' },
  { id: 'tech-lab', name: 'Tech Lab', prompt: 'futuristic tech lab with screens and displays, blue ambient lighting, innovation environment' },
  { id: 'white-cyc', name: 'White Cyclorama', prompt: 'clean white cyclorama studio, infinite white background, soft even lighting, professional product-shoot style' },
];

const MOODS = [
  { id: 'confident', name: 'Confident & Authoritative', prompt: 'confident, authoritative tone, strong presence' },
  { id: 'friendly', name: 'Warm & Friendly', prompt: 'warm, approachable, genuine smile, friendly demeanor' },
  { id: 'inspiring', name: 'Inspiring & Motivational', prompt: 'inspiring, passionate expression, motivational energy' },
  { id: 'professional', name: 'Professional & Polished', prompt: 'professional, polished, corporate-ready' },
  { id: 'casual', name: 'Casual & Relaxed', prompt: 'casual, relaxed, authentic vibe' },
  { id: 'urgent', name: 'Urgent & Compelling', prompt: 'urgent, compelling, leaning forward, intense focus' },
];

const AISpokesperson = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { mode, setMode, isAdvanced, isBeginner } = useCreatorMode();
  
  // Twin selection
  const [twins, setTwins] = useState<AITwin[]>([]);
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const [loadingTwins, setLoadingTwins] = useState(true);
  
  // Script
  const [message, setMessage] = useState('');
  const [generatedScript, setGeneratedScript] = useState<GeneratedScript | null>(null);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  
  // Settings
  const [selectedSetting, setSelectedSetting] = useState('studio');
  const [selectedMood, setSelectedMood] = useState('confident');
  const [selectedCameraAngle, setSelectedCameraAngle] = useState('low-angle');
  const [selectedDuration, setSelectedDuration] = useState('15');
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  
  // Video generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoTask, setVideoTask] = useState<VideoTask | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Load twins
  useEffect(() => {
    if (!user?.id) return;
    
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_twins')
          .select('id, name, reference_images, voice_cloning_key, face_description, gender')
          .eq('user_id', user.id)
          .order('name');
        
        if (error) throw error;
        const validTwins = (data || []).filter(t => t.reference_images && t.reference_images.length > 0);
        setTwins(validTwins);
        
        // Auto-select first twin
        if (validTwins.length > 0 && !selectedTwinId) {
          setSelectedTwinId(validTwins[0].id);
        }
      } catch (err) {
        console.error('Failed to load twins:', err);
      } finally {
        setLoadingTwins(false);
      }
    };
    load();
  }, [user?.id]);

  const selectedTwin = twins.find(t => t.id === selectedTwinId);
  const selectedSettingData = SETTINGS.find(s => s.id === selectedSetting);
  const selectedMoodData = MOODS.find(m => m.id === selectedMood);
  const selectedAngle = CAMERA_ANGLES.find(a => a.id === selectedCameraAngle);

  // Generate script
  const generateScript = async () => {
    if (!message.trim() || !selectedTwin) return;
    
    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a professional spokesperson scriptwriter. Write a compelling delivery script for a video spokesperson.

The spokesperson is: ${selectedTwin.face_description || selectedTwin.name}
Setting: ${selectedSettingData?.prompt || 'professional studio'}
Mood/Tone: ${selectedMoodData?.prompt || 'confident'}
Camera Angle: ${selectedAngle?.promptModifier || 'eye level'}
Target Duration: ${selectedDuration} seconds (~${Math.round(parseInt(selectedDuration) * 2.5)} words)

RULES:
- Write ONLY the exact words to be spoken aloud
- NO stage directions, NO parentheticals, NO descriptions
- Write naturally and conversationally
- End sentences with ... or — NEVER with periods (prevents TTS artifacts)
- The tone should match the mood specified
- Make it compelling and engaging

Return ONLY a JSON object:
{
  "narration": "The exact script to be spoken...",
  "visualDescription": "CAMERA: ${selectedAngle?.promptModifier || 'eye level'}. SUBJECT: ${selectedTwin.face_description || 'professional person'}, ${selectedMoodData?.prompt || 'confident expression'}. SETTING: ${selectedSettingData?.prompt || 'studio'}. LIGHTING: Professional cinematic lighting.",
  "cameraAngle": "${selectedCameraAngle}",
  "setting": "${selectedSetting}",
  "mood": "${selectedMood}"
}`
            },
            {
              role: 'user',
              content: `Write a ${selectedDuration}-second spokesperson script delivering this message:\n\n${message}`
            }
          ]
        }
      });

      if (error) throw error;
      
      const content = data?.choices?.[0]?.message?.content || data?.content;
      if (!content) throw new Error('No content in response');
      
      // Parse JSON
      let parsed: GeneratedScript;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        parsed = {
          narration: content.replace(/```[\s\S]*?```/g, '').trim(),
          visualDescription: `${selectedAngle?.promptModifier}. ${selectedTwin.face_description}. ${selectedSettingData?.prompt}`,
          cameraAngle: selectedCameraAngle,
          setting: selectedSetting,
          mood: selectedMood
        };
      }
      
      setGeneratedScript(parsed);
      toast({ title: 'Script Generated!', description: 'Review and generate your spokesperson video.' });
    } catch (err: any) {
      console.error('Script generation error:', err);
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Generate the full video
  const generateVideo = async () => {
    if (!generatedScript || !selectedTwin) return;
    
    setIsGenerating(true);
    setProgress(5);
    setProgressStatus('Loop AI: Generating voiceover...');
    setVideoUrl(null);

    try {
      // Step 1: Generate voiceover
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: {
          text: generatedScript.narration,
          voice: selectedTwin.voice_cloning_key ? undefined : 'en-US-Journey-D',
          clonedVoiceUrl: selectedTwin.voice_cloning_key || undefined
        }
      });

      if (ttsError) throw ttsError;
      if (!ttsData?.audioContent) throw new Error('No audio generated');

      const audioDataUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
      
      // Upload audio to storage
      let storageAudioUrl = audioDataUrl;
      if (user) {
        try {
          const bytes = Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0));
          const fileName = `${user.id}/spokesperson/${Date.now()}-voiceover.mp3`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reels')
            .upload(fileName, bytes, { contentType: 'audio/mp3' });
          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
            storageAudioUrl = publicUrl.publicUrl;
          }
        } catch (uploadErr) {
          console.warn('Audio upload failed:', uploadErr);
        }
      }
      
      setAudioUrl(storageAudioUrl);
      setProgress(25);
      setProgressStatus('Loop AI: Generating character image...');

      // Step 2: Generate the spokesperson image
      const portraitImage = selectedTwin.reference_images[0];
      const angle = CAMERA_ANGLES.find(a => a.id === (generatedScript.cameraAngle || selectedCameraAngle));
      const setting = SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting));
      const mood = MOODS.find(m => m.id === (generatedScript.mood || selectedMood));

      const imagePrompt = `Generate a PREMIUM cinematic portrait of this EXACT person for a professional spokesperson video.

CHARACTER: ${selectedTwin.face_description || selectedTwin.name}
GENDER: ${selectedTwin.gender || 'unspecified'}

CAMERA: ${angle?.promptModifier || 'low angle shot'}, shot on RED V-RAPTOR, shallow depth of field f/1.4
SETTING: ${setting?.prompt || 'professional studio'}
EXPRESSION: ${mood?.prompt || 'confident, direct engagement'}, closed mouth, natural confident expression
LIGHTING: Professional 3-point cinematic lighting, warm key light, subtle rim light, soft fill

COMPOSITION: Vertical 9:16 format, rule of thirds, subject positioned for impact
QUALITY: Ultra photorealistic, 8K, magazine/commercial quality, professional color grading

CRITICAL: NO text, NO captions, NO watermarks. Person has CLOSED MOUTH - NOT speaking.`;

      // Build multimodal message with reference
      const imageMessages: any[] = [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: portraitImage } },
          { type: 'text', text: `This is the reference photo. Generate a NEW image of this EXACT same person.\n\n${imagePrompt}` }
        ]
      }];

      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      const imageResponse = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: imageMessages,
          model: 'google/gemini-3.1-flash-image-preview',
          modalities: ['image', 'text']
        })
      });

      let generatedImageUrl = portraitImage; // Fallback to reference
      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        const imgUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imgUrl) {
          // Upload to storage
          if (imgUrl.startsWith('data:') && user) {
            try {
              const matches = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                const imgBytes = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0));
                const imgFileName = `${user.id}/spokesperson/${Date.now()}-scene.png`;
                const { data: imgUpload, error: imgUploadErr } = await supabase.storage
                  .from('reels')
                  .upload(imgFileName, imgBytes, { contentType: matches[1], upsert: true });
                if (!imgUploadErr && imgUpload) {
                  const { data: imgPublicUrl } = supabase.storage.from('reels').getPublicUrl(imgFileName);
                  generatedImageUrl = imgPublicUrl.publicUrl;
                }
              }
            } catch { /* fallback */ }
          } else {
            generatedImageUrl = imgUrl;
          }
        }
      }

      setProgress(50);
      setProgressStatus('Loop AI: Creating lip-sync video...');

      // Step 3: Generate video with lip sync
      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk',
          imageUrls: [generatedImageUrl],
          audioUrl: storageAudioUrl.startsWith('http') ? storageAudioUrl : undefined,
          prompt: `${angle?.promptModifier || 'professional spokesperson'}. ${mood?.prompt || 'confident'}. Premium cinematic quality.`,
          aspectRatio: '9:16',
          duration: parseInt(selectedDuration)
        }
      });

      if (videoError) throw videoError;
      if (!videoData?.taskId) throw new Error('No video task created');

      setVideoTask({ taskId: videoData.taskId, status: 'processing' });
      setProgress(60);
      setProgressStatus('Loop AI: Rendering video (this takes 1-3 minutes)...');

      // Step 4: Poll for completion
      let attempts = 0;
      const maxAttempts = 120;
      
      const poll = async () => {
        while (attempts < maxAttempts) {
          attempts++;
          await new Promise(r => setTimeout(r, 3000));
          
          try {
            const { data: statusData } = await supabase.functions.invoke('wavespeed-video', {
              body: { action: 'status', taskId: videoData.taskId }
            });

            if (statusData?.status === 'completed' && statusData?.videoUrl) {
              setVideoUrl(statusData.videoUrl);
              setVideoTask({ taskId: videoData.taskId, status: 'completed', videoUrl: statusData.videoUrl });
              setProgress(100);
              setProgressStatus('Video ready! 🎬');
              toast({ title: '🎬 Video Ready!', description: 'Your AI spokesperson video has been generated.' });
              return;
            } else if (statusData?.status === 'failed') {
              throw new Error(statusData?.error || 'Video generation failed');
            }
            
            // Update progress
            const pctDone = Math.min(60 + (attempts / maxAttempts) * 35, 95);
            setProgress(pctDone);
          } catch (pollErr) {
            console.warn('Poll error:', pollErr);
          }
        }
        throw new Error('Video generation timed out');
      };

      await poll();
    } catch (err: any) {
      console.error('Video generation error:', err);
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBeginnerGenerate = async () => {
    if (!message.trim()) {
      toast({ title: 'Message Required', description: 'Enter the message you want delivered.', variant: 'destructive' });
      return;
    }
    if (!selectedTwin) {
      toast({ title: 'No AI Twin', description: 'Create an AI Twin first to use as your spokesperson.', variant: 'destructive' });
      return;
    }
    
    // Generate script then video
    await generateScript();
  };

  // Auto-start video after script generation in beginner mode
  useEffect(() => {
    if (isBeginner && generatedScript && !isGenerating && !videoUrl) {
      generateVideo();
    }
  }, [generatedScript, isBeginner]);

  const resetAll = () => {
    setGeneratedScript(null);
    setVideoUrl(null);
    setVideoTask(null);
    setAudioUrl(null);
    setProgress(0);
    setProgressStatus('');
    setMessage('');
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Film className="w-8 h-8 text-primary" />
              AI Spokesperson
            </h1>
            <p className="text-muted-foreground mt-1">
              Create professional spokesperson videos with your AI Twin
            </p>
          </div>
          <CreatorModeToggle mode={mode} onModeChange={setMode} />
        </div>

        {/* Progress Bar */}
        {(isGenerating || isGeneratingScript) && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                  <Wand2 className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-xs font-semibold text-primary">Loop AI</span>
                </div>
                <span className="text-sm text-muted-foreground">{progressStatus}</span>
              </div>
              <Progress value={isGeneratingScript ? 10 : progress} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Video Result */}
        {videoUrl && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Your Spokesperson Video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-[9/16] max-h-[500px] mx-auto bg-black rounded-lg overflow-hidden">
                <VideoPlayer src={videoUrl} />
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => window.open(videoUrl, '_blank')}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={resetAll}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== BEGINNER MODE ===== */}
        {isBeginner && !videoUrl && !isGenerating && !isGeneratingScript && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-8 pb-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">What message should your spokesperson deliver?</h2>
                <p className="text-muted-foreground">
                  {selectedTwin 
                    ? `"${selectedTwin.name}" will deliver your message as a professional video.`
                    : 'Select an AI Twin to be your spokesperson.'}
                </p>
              </div>

              {/* Twin Selector */}
              {twins.length > 0 && (
                <div className="flex items-center justify-center gap-3">
                  <Label className="text-sm">Spokesperson:</Label>
                  <Select value={selectedTwinId || ''} onValueChange={setSelectedTwinId}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select Twin..." />
                    </SelectTrigger>
                    <SelectContent>
                      {twins.map(twin => (
                        <SelectItem key={twin.id} value={twin.id}>
                          <div className="flex items-center gap-2">
                            {twin.reference_images?.[0] && (
                              <img src={twin.reference_images[0]} className="w-6 h-6 rounded-full object-cover" alt="" />
                            )}
                            <span>{twin.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {twins.length === 0 && !loadingTwins && (
                <div className="text-center text-muted-foreground text-sm">
                  No AI Twins found. <a href="/ai-twin" className="text-primary underline">Create one first</a>.
                </div>
              )}

              <Textarea
                placeholder="E.g., Introduce our new product launch, explain our company values, deliver a keynote summary..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[120px] bg-background border-border resize-none text-base"
                disabled={isGenerating || isGeneratingScript}
              />

              <Button
                onClick={handleBeginnerGenerate}
                disabled={isGenerating || isGeneratingScript || !message.trim() || !selectedTwinId}
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                size="lg"
              >
                <Wand2 className="w-5 h-5 mr-2" />
                Generate Spokesperson Video ✨
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ===== ADVANCED MODE ===== */}
        {isAdvanced && !videoUrl && (
          <div className="space-y-4">
            {/* Twin Selection */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <User className="w-5 h-5 text-primary" />
                  Select Spokesperson
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingTwins ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading twins...
                  </div>
                ) : twins.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    No AI Twins found. <a href="/ai-twin" className="text-primary underline">Create one first</a>.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {twins.map(twin => (
                      <button
                        key={twin.id}
                        onClick={() => setSelectedTwinId(twin.id)}
                        className={`p-3 rounded-lg border transition-all text-left ${
                          selectedTwinId === twin.id
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                            : 'border-border bg-card hover:border-primary/50'
                        }`}
                      >
                        {twin.reference_images?.[0] ? (
                          <img src={twin.reference_images[0]} alt={twin.name} className="w-full aspect-square object-cover rounded-md mb-2" />
                        ) : (
                          <div className="w-full aspect-square bg-muted rounded-md mb-2 flex items-center justify-center">
                            <User className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <p className="text-sm font-medium truncate">{twin.name}</p>
                        <div className="flex gap-1 mt-1">
                          {twin.voice_cloning_key && <Badge variant="secondary" className="text-[10px]">Voice</Badge>}
                          <Badge variant="outline" className="text-[10px]">{twin.reference_images?.length || 0} imgs</Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Message Input */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mic className="w-5 h-5 text-primary" />
                  Message to Deliver
                </CardTitle>
                <CardDescription>What should your spokesperson say?</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Enter the key message, product pitch, announcement, or talking points..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[120px] bg-background border-border"
                  disabled={isGenerating}
                />
              </CardContent>
            </Card>

            {/* Scene Settings */}
            <Collapsible open={settingsExpanded} onOpenChange={setSettingsExpanded}>
              <Card className="bg-card border-border">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-primary" />
                        Scene Settings
                      </span>
                      <ChevronDown className={`w-5 h-5 transition-transform ${settingsExpanded ? 'rotate-180' : ''}`} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-4">
                    {/* Setting */}
                    <div className="space-y-2">
                      <Label>Background Setting</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {SETTINGS.map(s => (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSetting(s.id)}
                            className={`p-2 rounded-lg border text-xs text-center transition-all ${
                              selectedSetting === s.id
                                ? 'border-primary bg-primary/10 text-foreground font-medium'
                                : 'border-border text-muted-foreground hover:border-primary/50'
                            }`}
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Camera Angle */}
                    <div className="space-y-2">
                      <Label>Camera Angle</Label>
                      <Select value={selectedCameraAngle} onValueChange={setSelectedCameraAngle}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAMERA_ANGLES.filter(a => ['static', 'framing', 'character'].includes(a.category)).map(angle => (
                            <SelectItem key={angle.id} value={angle.id}>
                              <div className="flex flex-col">
                                <span>{angle.name}</span>
                                <span className="text-xs text-muted-foreground">{angle.description}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Mood */}
                    <div className="space-y-2">
                      <Label>Tone & Mood</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {MOODS.map(m => (
                          <button
                            key={m.id}
                            onClick={() => setSelectedMood(m.id)}
                            className={`p-2 rounded-lg border text-xs text-center transition-all ${
                              selectedMood === m.id
                                ? 'border-primary bg-primary/10 text-foreground font-medium'
                                : 'border-border text-muted-foreground hover:border-primary/50'
                            }`}
                          >
                            {m.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                      <Label>Duration</Label>
                      <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 seconds</SelectItem>
                          <SelectItem value="15">15 seconds</SelectItem>
                          <SelectItem value="30">30 seconds</SelectItem>
                          <SelectItem value="45">45 seconds</SelectItem>
                          <SelectItem value="60">60 seconds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Generated Script */}
            {generatedScript && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Generated Script
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={generatedScript.narration}
                    onChange={(e) => setGeneratedScript({ ...generatedScript, narration: e.target.value })}
                    className="min-h-[100px] bg-background border-border"
                  />
                  <div className="flex gap-2">
                    <Button onClick={generateScript} variant="outline" disabled={isGeneratingScript}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Regenerate Script
                    </Button>
                    <Button onClick={generateVideo} disabled={isGenerating}>
                      <Play className="w-4 h-4 mr-2" />
                      Generate Video
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Generate Buttons */}
            {!generatedScript && (
              <div className="flex gap-2">
                <Button
                  onClick={generateScript}
                  disabled={isGeneratingScript || !message.trim() || !selectedTwinId}
                  className="flex-1"
                  size="lg"
                >
                  {isGeneratingScript ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Script...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />Generate Script</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AISpokesperson;
