import React, { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { downloadVideo } from '@/lib/reelVideoCreator';
import { stitchVideosWithAudio } from '@/lib/videoStitch';
import { TemplateSelector } from '@/components/TemplateSelector';
import { 
  Sparkles, 
  FileText, 
  Mic, 
  MicOff,
  Video, 
  Download,
  Loader2,
  RefreshCw,
  Captions,
  History,
  Trash2,
  Play,
  ChevronDown,
  Palette
} from 'lucide-react';

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

interface Scene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  duration: number;
  isIntro?: boolean;
  isOutro?: boolean;
  templateId?: string;
}

interface GeneratedScene {
  sceneNumber: number;
  text: string;
  imageUrl: string | null;
  savedImageUrl?: string | null;
  startTime: number;
  endTime: number;
}

interface VideoClip {
  sceneNumber: number;
  videoUrl: string;
}

interface ReelProject {
  topic: string;
  scenes: Scene[];
  voiceovers: { sceneNumber: number; audioUrl: string }[];
  videoUrl: string | null;
  videoBlobUrl: string | null;
  generatedScenes: GeneratedScene[];
  videoClips: VideoClip[];
  status: 'idle' | 'generating-script' | 'generating-video' | 'rendering-video' | 'complete';
}

interface SavedReel {
  id: string;
  topic: string;
  video_url: string | null;
  thumbnail_url: string | null;
  scenes: GeneratedScene[];
  total_duration: number;
  created_at: string;
}

const DURATION_OPTIONS = [
  { value: '15', label: '15 seconds', sceneCount: 2 },
  { value: '30', label: '30 seconds', sceneCount: 3 },
  { value: '45', label: '45 seconds', sceneCount: 4 },
  { value: '60', label: '60 seconds', sceneCount: 5 },
];

const Reels = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [topic, setTopic] = useState('');
  const [selectedDuration, setSelectedDuration] = useState('30');
  const [project, setProject] = useState<ReelProject>({
    topic: '',
    scenes: [],
    voiceovers: [],
    videoUrl: null,
    videoBlobUrl: null,
    generatedScenes: [],
    videoClips: [],
    status: 'idle'
  });
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [savedReels, setSavedReels] = useState<SavedReel[]>([]);
  const [loadingReels, setLoadingReels] = useState(true);
  const [activeTab, setActiveTab] = useState('create');
  const [isListening, setIsListening] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [selectedClipIndex, setSelectedClipIndex] = useState<number>(0);
  
  // Template state
  const [selectedIntro, setSelectedIntro] = useState('none');
  const [selectedOutro, setSelectedOutro] = useState('none');
  const [introText, setIntroText] = useState('');
  const [outroText, setOutroText] = useState('');
  const [templateSectionOpen, setTemplateSectionOpen] = useState(false);
  
  const videoBlobRef = useRef<Blob | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  // Speech recognition setup
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser. Try Chrome.",
        variant: "destructive"
      });
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setTopic(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  // Fetch saved reels on mount
  useEffect(() => {
    if (user) {
      fetchSavedReels();
    }
  }, [user]);

  const fetchSavedReels = async () => {
    if (!user) return;
    
    setLoadingReels(true);
    try {
      const { data, error } = await supabase
        .from('reels')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Cast the data to our SavedReel type
      const reels: SavedReel[] = (data || []).map(item => ({
        id: item.id,
        topic: item.topic,
        video_url: item.video_url,
        thumbnail_url: item.thumbnail_url,
        scenes: item.scenes as unknown as GeneratedScene[],
        total_duration: item.total_duration ?? 0,
        created_at: item.created_at
      }));
      
      setSavedReels(reels);
    } catch (error) {
      console.error('Error fetching reels:', error);
    } finally {
      setLoadingReels(false);
    }
  };

  const deleteReel = async (reelId: string, videoUrl: string | null) => {
    if (!user) return;

    try {
      // Delete from storage if video exists
      if (videoUrl) {
        const path = videoUrl.split('/reels/')[1];
        if (path) {
          await supabase.storage.from('reels').remove([path]);
        }
      }

      // Delete from database
      const { error } = await supabase
        .from('reels')
        .delete()
        .eq('id', reelId);

      if (error) throw error;

      toast({
        title: "Reel Deleted",
        description: "The reel has been removed from your library."
      });

      setSavedReels(prev => prev.filter(r => r.id !== reelId));
    } catch (error: any) {
      console.error('Error deleting reel:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete reel.",
        variant: "destructive"
      });
    }
  };

  const generateScripts = async () => {
    if (!topic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a topic for your reel.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setProject(prev => ({ ...prev, status: 'generating-script', topic }));
    setProgress(10);

    const durationOption = DURATION_OPTIONS.find(d => d.value === selectedDuration);
    const sceneCount = durationOption?.sceneCount || 3;
    const targetDuration = parseInt(selectedDuration);

    try {
      const { data, error } = await supabase.functions.invoke('generate-reel-script', {
        body: { 
          topic, 
          sceneCount, 
          targetDuration,
          introConfig: selectedIntro !== 'none' ? {
            introTemplate: selectedIntro,
            introText: introText
          } : undefined,
          outroConfig: selectedOutro !== 'none' ? {
            outroTemplate: selectedOutro,
            outroText: outroText
          } : undefined
        }
      });

      if (error) throw error;

      setProject(prev => ({
        ...prev,
        scenes: data.scenes,
        status: 'idle'
      }));
      setProgress(25);

      toast({
        title: "Scripts Generated",
        description: `${sceneCount} scene scripts have been created for your ${selectedDuration}s reel.`
      });
    } catch (error: any) {
      console.error('Script generation error:', error);
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate scripts.",
        variant: "destructive"
      });
      setProject(prev => ({ ...prev, status: 'idle' }));
    } finally {
      setIsGenerating(false);
    }
  };

  const generateVideo = async () => {
    if (project.scenes.length === 0) {
      toast({
        title: "Missing Scripts",
        description: "Please generate scripts first.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setVideoError(null);
    setProject(prev => ({ ...prev, status: 'generating-video' }));
    setProgress(5);
    setProgressStatus('Generating voiceovers...');

    try {
      // Step 1: Generate voiceovers for each scene using Google Cloud TTS
      const voiceovers: { sceneNumber: number; audioUrl: string }[] = [];
      
      for (const scene of project.scenes) {
        try {
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
            body: { text: scene.narration, voice: 'alloy' }
          });
          
          if (ttsError) {
            console.error('TTS error for scene', scene.sceneNumber, ':', ttsError);
            continue;
          }
          
          if (ttsData?.audioContent) {
            voiceovers.push({
              sceneNumber: scene.sceneNumber,
              audioUrl: `data:audio/mp3;base64,${ttsData.audioContent}`
            });
            console.log('Generated voiceover for scene', scene.sceneNumber);
          }
        } catch (ttsErr) {
          console.error('TTS generation failed for scene', scene.sceneNumber, ':', ttsErr);
        }
      }
      
      setProgress(15);
      setProgressStatus(`Generated ${voiceovers.length}/${project.scenes.length} voiceovers. Creating images...`);
      
      // Step 2: Generate scene images and start video tasks via backend
      const { data, error } = await supabase.functions.invoke('generate-reel-video', {
        body: { 
          scenes: project.scenes,
          topic: project.topic,
          addCaptions: true,
          useWaveSpeed: true
        }
      });

      if (error) throw error;

      const generatedScenes = data.scenes || [];
      const videoTasks = data.videoTasks || [];
      const scenesWithImages = generatedScenes.filter((s: GeneratedScene) => s.imageUrl);
      
      if (scenesWithImages.length === 0) {
        throw new Error('No scene images were generated');
      }

      setProject(prev => ({
        ...prev,
        generatedScenes,
        voiceovers,
      }));
      setProgress(30);

      // Step 3: If we have video tasks, poll for completion
      if (videoTasks.length > 0) {
        setProject(prev => ({ ...prev, status: 'rendering-video' }));
        setProgressStatus(`Generating ${videoTasks.length} video clips with WaveSpeed...`);

        const completedVideos: { sceneNumber: number; videoUrl: string }[] = [];
        const maxPollingTime = 300000; // 5 minutes max
        const pollInterval = 5000; // 5 seconds between polls
        const startTime = Date.now();

        while (completedVideos.length < videoTasks.length) {
          if (Date.now() - startTime > maxPollingTime) {
            throw new Error('Video generation timed out. Please try again.');
          }

          for (const task of videoTasks) {
            // Skip if already completed
            if (completedVideos.find(v => v.sceneNumber === task.sceneNumber)) continue;

            try {
              const { data: statusData, error: statusError } = await supabase.functions.invoke('wavespeed-video', {
                body: { action: 'status', taskId: task.taskId }
              });

              if (statusError) {
                console.error('Status check error:', statusError);
                continue;
              }

              console.log(`Task ${task.taskId} status:`, statusData);

              if (statusData.status === 'completed' && statusData.videoUrl) {
                completedVideos.push({
                  sceneNumber: task.sceneNumber,
                  videoUrl: statusData.videoUrl
                });
                setProgressStatus(`Generated ${completedVideos.length}/${videoTasks.length} video clips...`);
              } else if (statusData.status === 'failed') {
                throw new Error(`Video generation failed for scene ${task.sceneNumber}: ${statusData.error || 'Unknown error'}`);
              }
            } catch (pollError) {
              console.error('Polling error:', pollError);
            }
          }

          const progressPercent = 30 + Math.round((completedVideos.length / videoTasks.length) * 40);
          setProgress(progressPercent);

          if (completedVideos.length < videoTasks.length) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
        }

        // Step 4: All videos completed - stitch them together with audio
        const sortedVideos = completedVideos.sort((a, b) => a.sceneNumber - b.sceneNumber);
        const sortedAudios = voiceovers.sort((a, b) => a.sceneNumber - b.sceneNumber);
        
        setProgress(75);
        setProgressStatus('Stitching video clips with voiceover...');
        
        try {
          const videoUrls = sortedVideos.map(v => v.videoUrl);
          const audioUrls = sortedAudios.map(a => a.audioUrl);
          
          console.log('Stitching', videoUrls.length, 'videos with', audioUrls.length, 'audio tracks');
          
          const finalBlob = await stitchVideosWithAudio({
            videoUrls,
            audioUrls,
            onProgress: (p) => setProgress(75 + Math.round(p * 0.2))
          });
          
          // Create blob URL for playback
          const blobUrl = URL.createObjectURL(finalBlob);
          videoBlobRef.current = finalBlob;
          
          setProject(prev => ({
            ...prev,
            videoUrl: blobUrl,
            videoBlobUrl: blobUrl,
            generatedScenes,
            voiceovers,
            videoClips: sortedVideos,
            status: 'complete'
          }));

          // Auto-save to library
          setProgress(95);
          setProgressStatus('Saving to library...');

          if (user) {
            try {
              // Upload the final video to storage
              const fileName = `${user.id}/${Date.now()}-reel.mp4`;
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('reels')
                .upload(fileName, finalBlob, { contentType: 'video/mp4' });
              
              let savedVideoUrl = blobUrl;
              if (!uploadError && uploadData) {
                const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                savedVideoUrl = publicUrl.publicUrl;
              }
              
              const thumbnailUrl = generatedScenes[0]?.imageUrl || null;
              const totalDuration = project.scenes.reduce((acc, s) => acc + s.duration, 0);

              await supabase.from('reels').insert([{
                user_id: user.id,
                topic: project.topic,
                video_url: savedVideoUrl,
                thumbnail_url: thumbnailUrl,
                scenes: generatedScenes as unknown as any,
                total_duration: totalDuration
              }]);

              fetchSavedReels();
            } catch (saveError) {
              console.error('Auto-save failed:', saveError);
            }
          }

          setProgress(100);
          setProgressStatus('Complete!');

          toast({
            title: "Video Generated!",
            description: `Created ${sortedVideos.length}-scene video with voiceover and saved to library!`
          });
          
        } catch (stitchError: any) {
          console.error('Stitching failed:', stitchError);
          
          // Fallback: store all video clips so user can view them individually
          if (sortedVideos.length > 0) {
            setProject(prev => ({
              ...prev,
              videoUrl: sortedVideos[0]?.videoUrl,
              videoBlobUrl: sortedVideos[0]?.videoUrl,
              generatedScenes,
              voiceovers,
              videoClips: sortedVideos,
              status: 'complete'
            }));

            // Still save to library with the first video URL
            if (user) {
              try {
                const thumbnailUrl = generatedScenes[0]?.imageUrl || null;
                const totalDuration = project.scenes.reduce((acc, s) => acc + s.duration, 0);

                await supabase.from('reels').insert([{
                  user_id: user.id,
                  topic: project.topic,
                  video_url: sortedVideos[0]?.videoUrl,
                  thumbnail_url: thumbnailUrl,
                  scenes: generatedScenes as unknown as any,
                  total_duration: totalDuration
                }]);
                fetchSavedReels();
              } catch (saveError) {
                console.error('Auto-save failed:', saveError);
              }
            }
            
            setProgress(100);
            setProgressStatus('Complete (individual clips)');
            
            toast({
              title: "Videos Generated",
              description: `Generated ${sortedVideos.length} video clips. Browser stitching unavailable - use clip navigation below.`,
            });
          } else {
            throw stitchError;
          }
        }
      } else {
        // Fallback: No video tasks, just show images
        setProject(prev => ({
          ...prev,
          generatedScenes,
          voiceovers,
          status: 'complete'
        }));
        setProgress(100);
        setProgressStatus('Images generated (no video tasks created)');

        toast({
          title: "Images Generated",
          description: "Scene images created. Video generation unavailable.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('Video generation error:', error);
      const errorMessage = error.message || "Failed to generate video.";
      setVideoError(errorMessage);
      toast({
        title: "Video Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
      setProject(prev => ({ ...prev, status: 'idle' }));
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAll = async () => {
    await generateScripts();
    if (project.scenes.length > 0) {
      await generateVideo();
    }
  };

  const resetProject = () => {
    // Cleanup blob URL
    if (project.videoBlobUrl) {
      URL.revokeObjectURL(project.videoBlobUrl);
    }
    videoBlobRef.current = null;
    
    setProject({
      topic: '',
      scenes: [],
      voiceovers: [],
      videoUrl: null,
      videoBlobUrl: null,
      generatedScenes: [],
      videoClips: [],
      status: 'idle'
    });
    setSelectedClipIndex(0);
    setTopic('');
    setProgress(0);
    setProgressStatus('');
    setVideoError(null);
    // Reset templates
    setSelectedIntro('none');
    setSelectedOutro('none');
    setIntroText('');
    setOutroText('');
  };

  const handleDownloadVideo = async () => {
    if (videoBlobRef.current) {
      downloadVideo(videoBlobRef.current, `reel-${project.topic.slice(0, 20).replace(/\s+/g, '-')}.mp4`);
    } else if (project.videoBlobUrl && project.videoBlobUrl.startsWith('http')) {
      // Download from URL (WaveSpeed)
      try {
        const response = await fetch(project.videoBlobUrl);
        const blob = await response.blob();
        downloadVideo(blob, `reel-${project.topic.slice(0, 20).replace(/\s+/g, '-')}.mp4`);
      } catch (error) {
        console.error('Download error:', error);
        // Fallback: open in new tab
        window.open(project.videoBlobUrl, '_blank');
      }
    }
  };

  const updateSceneNarration = (sceneNumber: number, narration: string) => {
    setProject(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene =>
        scene.sceneNumber === sceneNumber ? { ...scene, narration } : scene
      )
    }));
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text">Reels & Stories</h1>
            <p className="text-muted-foreground mt-1">
              Create engaging short-form videos with AI-generated scripts and captions
            </p>
          </div>
          {project.scenes.length > 0 && (
            <Button variant="outline" onClick={resetProject}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="create" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Video className="w-4 h-4 mr-2" />
              Create Reel
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="w-4 h-4 mr-2" />
              My Reels ({savedReels.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            {/* Progress Bar */}
            {isGenerating && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {project.status === 'generating-script' && 'Generating scripts...'}
                        {project.status === 'generating-video' && 'Generating scene images...'}
                        {project.status === 'rendering-video' && (progressStatus || 'Rendering video with captions...')}
                      </span>
                      <span className="text-primary font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error with Retry Button */}
            {videoError && !isGenerating && (
              <Card className="bg-destructive/10 border-destructive/50">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-destructive font-medium">Video generation failed</p>
                      <p className="text-sm text-muted-foreground mt-1">{videoError}</p>
                    </div>
                    <Button 
                      onClick={() => {
                        setVideoError(null);
                        generateVideo();
                      }}
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Input Section */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Create Your Reel
                </CardTitle>
                <CardDescription>
                  Choose a duration and enter a topic to generate scene scripts with captions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic / Idea</Label>
                  <div className="relative">
                    <Textarea
                      id="topic"
                      placeholder="E.g., 5 productivity tips for remote workers, How to make the perfect coffee, Travel hacks for budget trips..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="min-h-[100px] bg-background border-border pr-12"
                      disabled={isGenerating}
                    />
                    <Button
                      type="button"
                      variant={isListening ? "destructive" : "secondary"}
                      size="icon"
                      className="absolute right-2 top-2"
                      onClick={isListening ? stopListening : startListening}
                      disabled={isGenerating}
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </Button>
                    {isListening && (
                      <span className="absolute right-14 top-3 text-xs text-destructive animate-pulse">
                        Listening...
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Video Duration</Label>
                    <Select value={selectedDuration} onValueChange={setSelectedDuration} disabled={isGenerating}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label} ({option.sceneCount} scenes)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-end">
                    <Button 
                      onClick={generateScripts}
                      disabled={isGenerating || !topic.trim()}
                      className="w-full bg-gradient-primary hover:opacity-90"
                    >
                      {isGenerating && project.status === 'generating-script' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 mr-2" />
                      )}
                      Generate Scripts
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Intro/Outro Templates */}
            <Collapsible open={templateSectionOpen} onOpenChange={setTemplateSectionOpen}>
              <Card className="bg-card border-border">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-5 h-5 text-primary" />
                        Intro & Outro Templates
                        {(selectedIntro !== 'none' || selectedOutro !== 'none') && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            {[selectedIntro !== 'none' && 'Intro', selectedOutro !== 'none' && 'Outro'].filter(Boolean).join(' + ')}
                          </span>
                        )}
                      </div>
                      <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${templateSectionOpen ? 'rotate-180' : ''}`} />
                    </CardTitle>
                    <CardDescription>
                      Add professional intro and outro screens to your reel
                    </CardDescription>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <TemplateSelector
                      selectedIntro={selectedIntro}
                      selectedOutro={selectedOutro}
                      introText={introText}
                      outroText={outroText}
                      onIntroChange={setSelectedIntro}
                      onOutroChange={setSelectedOutro}
                      onIntroTextChange={setIntroText}
                      onOutroTextChange={setOutroText}
                      disabled={isGenerating}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Generated Scenes */}
            {project.scenes.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Scene Scripts
                  </CardTitle>
                  <CardDescription>
                    Review and edit your scene scripts before generating the video
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {project.scenes.map((scene) => (
                      <Card key={scene.sceneNumber} className={`bg-background border-border ${scene.isIntro || scene.isOutro ? 'ring-2 ring-primary/30' : ''}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              scene.isIntro ? 'bg-green-500/20 text-green-500' : 
                              scene.isOutro ? 'bg-orange-500/20 text-orange-500' : 
                              'bg-primary/20 text-primary'
                            }`}>
                              {scene.isIntro ? 'I' : scene.isOutro ? 'O' : scene.sceneNumber}
                            </span>
                            {scene.isIntro ? 'Intro' : scene.isOutro ? 'Outro' : `Scene ${scene.sceneNumber}`}
                            {(scene.isIntro || scene.isOutro) && (
                              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Template</span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              ~{scene.duration}s
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Narration (Caption)</Label>
                            <Textarea
                              value={scene.narration}
                              onChange={(e) => updateSceneNarration(scene.sceneNumber, e.target.value)}
                              className="mt-1 text-sm min-h-[80px] bg-card border-border"
                              disabled={isGenerating}
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Visual Description</Label>
                            <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                              {scene.visualDescription}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={generateVideo}
                      disabled={isGenerating}
                      className="flex-1 bg-gradient-primary hover:opacity-90"
                    >
                      {isGenerating && (project.status === 'generating-video' || project.status === 'rendering-video') ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Video className="w-4 h-4 mr-2" />
                      )}
                      Generate Video with Captions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Final Video / Generated Scenes */}
            {(project.videoBlobUrl || project.generatedScenes.length > 0) && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Captions className="w-5 h-5 text-primary" />
                    {project.videoBlobUrl ? 'Your TikTok Reel is Ready!' : 'Your Reel is Ready!'}
                  </CardTitle>
                  <CardDescription>
                    {project.videoBlobUrl 
                      ? 'MP4 video with burned-in captions ready for TikTok/Instagram'
                      : `${project.generatedScenes.length} scene images with captions`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Video player - show rendered video first if available */}
                  {project.videoBlobUrl && (
                    <div className="space-y-4">
                      <div className="aspect-[9/16] max-w-sm mx-auto bg-black rounded-lg overflow-hidden shadow-xl">
                        <video
                          src={project.videoClips.length > 1 ? project.videoClips[selectedClipIndex]?.videoUrl : project.videoBlobUrl}
                          controls
                          className="w-full h-full object-contain"
                          playsInline
                          key={selectedClipIndex}
                        />
                      </div>
                      
                      {/* Clip navigation when multiple clips */}
                      {project.videoClips.length > 1 && (
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedClipIndex(Math.max(0, selectedClipIndex - 1))}
                              disabled={selectedClipIndex === 0}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-muted-foreground px-3">
                              Clip {selectedClipIndex + 1} of {project.videoClips.length}
                            </span>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedClipIndex(Math.min(project.videoClips.length - 1, selectedClipIndex + 1))}
                              disabled={selectedClipIndex === project.videoClips.length - 1}
                            >
                              Next
                            </Button>
                          </div>
                          
                          {/* Clip thumbnails */}
                          <div className="flex gap-2 overflow-x-auto max-w-full pb-2">
                            {project.videoClips.map((clip, index) => (
                              <button
                                key={clip.sceneNumber}
                                onClick={() => setSelectedClipIndex(index)}
                                className={`flex-shrink-0 w-16 h-28 rounded-md overflow-hidden border-2 transition-all ${
                                  index === selectedClipIndex 
                                    ? 'border-primary ring-2 ring-primary/30' 
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                {project.generatedScenes[index]?.imageUrl ? (
                                  <img 
                                    src={project.generatedScenes[index].imageUrl} 
                                    alt={`Scene ${clip.sceneNumber}`}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-muted flex items-center justify-center">
                                    <Play className="w-4 h-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs text-white text-center py-0.5">
                                  {clip.sceneNumber}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scene Images Gallery - show only if no video */}
                  {!project.videoBlobUrl && project.generatedScenes.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {project.generatedScenes.map((scene) => (
                        <div key={scene.sceneNumber} className="relative group">
                          <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden">
                            {scene.imageUrl ? (
                              <img
                                src={scene.imageUrl}
                                alt={`Scene ${scene.sceneNumber}`}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                No image
                              </div>
                            )}
                            {/* Caption overlay */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                              <p className="text-white text-xs line-clamp-3">{scene.text}</p>
                            </div>
                            {/* Scene number badge */}
                            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                              {scene.sceneNumber}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-center gap-3">
                    {project.videoBlobUrl && (
                      <Button 
                        onClick={handleDownloadVideo}
                        className="bg-gradient-primary hover:opacity-90"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download for TikTok
                      </Button>
                    )}
                    <Button onClick={resetProject} variant="outline">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Create Another
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {loadingReels ? (
              <Card className="bg-card border-border">
                <CardContent className="pt-6 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : savedReels.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="pt-6 text-center">
                  <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No Saved Reels</h3>
                  <p className="text-muted-foreground mb-4">
                    Create and save your first reel to see it here.
                  </p>
                  <Button onClick={() => setActiveTab('create')}>
                    <Video className="w-4 h-4 mr-2" />
                    Create a Reel
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedReels.map((reel) => (
                  <Card key={reel.id} className="bg-card border-border overflow-hidden">
                    <div className="aspect-[9/16] bg-black relative">
                      {reel.video_url ? (
                        <video
                          src={reel.video_url}
                          className="w-full h-full object-contain"
                          controls
                          playsInline
                        />
                      ) : reel.thumbnail_url ? (
                        <img
                          src={reel.thumbnail_url}
                          alt={reel.topic}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Video className="w-12 h-12" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4">
                        <p className="text-white text-sm font-medium line-clamp-2">{reel.topic}</p>
                        <p className="text-white/70 text-xs mt-1">
                          {new Date(reel.created_at).toLocaleDateString()} • {reel.total_duration}s
                        </p>
                      </div>
                    </div>
                    <CardContent className="pt-4">
                      <div className="flex gap-2">
                        {reel.video_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = reel.video_url!;
                              link.download = `reel-${reel.topic.slice(0, 20)}.mp4`;
                              link.click();
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteReel(reel.id, reel.video_url)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reels;
