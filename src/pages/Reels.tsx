import React, { useState, useRef } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { createReelVideo, downloadVideo } from '@/lib/reelVideoCreator';
import { 
  Sparkles, 
  FileText, 
  Mic, 
  Video, 
  Download,
  Loader2,
  RefreshCw,
  Captions
} from 'lucide-react';

interface Scene {
  sceneNumber: number;
  narration: string;
  visualDescription: string;
  duration: number;
}

interface GeneratedScene {
  sceneNumber: number;
  text: string;
  imageUrl: string | null;
  startTime: number;
  endTime: number;
}

interface ReelProject {
  topic: string;
  scenes: Scene[];
  voiceovers: { sceneNumber: number; audioUrl: string }[];
  videoUrl: string | null;
  videoBlobUrl: string | null;
  generatedScenes: GeneratedScene[];
  status: 'idle' | 'generating-script' | 'generating-voiceover' | 'generating-video' | 'rendering-video' | 'complete';
}

const VOICE_OPTIONS = [
  { value: 'alloy', label: 'Alloy (Neutral)' },
  { value: 'echo', label: 'Echo (Male)' },
  { value: 'fable', label: 'Fable (British)' },
  { value: 'onyx', label: 'Onyx (Deep Male)' },
  { value: 'nova', label: 'Nova (Female)' },
  { value: 'shimmer', label: 'Shimmer (Soft Female)' },
];

const Reels = () => {
  const { toast } = useToast();
  const [topic, setTopic] = useState('');
  const [selectedVoice, setSelectedVoice] = useState('nova');
  const [project, setProject] = useState<ReelProject>({
    topic: '',
    scenes: [],
    voiceovers: [],
    videoUrl: null,
    videoBlobUrl: null,
    generatedScenes: [],
    status: 'idle'
  });
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const videoBlobRef = useRef<Blob | null>(null);

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

    try {
      const { data, error } = await supabase.functions.invoke('generate-reel-script', {
        body: { topic, sceneCount: 4 }
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
        description: "4 scene scripts have been created for your reel."
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

  const generateVoiceovers = async () => {
    if (project.scenes.length === 0) {
      toast({
        title: "No Scripts",
        description: "Please generate scripts first.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setProject(prev => ({ ...prev, status: 'generating-voiceover' }));
    setProgress(30);

    try {
      const voiceovers: { sceneNumber: number; audioUrl: string }[] = [];

      for (let i = 0; i < project.scenes.length; i++) {
        const scene = project.scenes[i];
        setProgress(30 + ((i + 1) / project.scenes.length) * 30);

        const { data, error } = await supabase.functions.invoke('generate-reel-voiceover', {
          body: { 
            text: scene.narration,
            voice: selectedVoice,
            sceneNumber: scene.sceneNumber
          }
        });

        if (error) throw error;

        voiceovers.push({
          sceneNumber: scene.sceneNumber,
          audioUrl: data.audioUrl
        });
      }

      setProject(prev => ({
        ...prev,
        voiceovers,
        status: 'idle'
      }));
      setProgress(60);

      toast({
        title: "Voiceovers Generated",
        description: "All scene voiceovers have been created."
      });
    } catch (error: any) {
      console.error('Voiceover generation error:', error);
      toast({
        title: "Voiceover Failed",
        description: error.message || "Failed to generate voiceovers.",
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
    setProject(prev => ({ ...prev, status: 'generating-video' }));
    setProgress(30);
    setProgressStatus('Generating scene images...');

    try {
      // Step 1: Generate scene images via backend
      const { data, error } = await supabase.functions.invoke('generate-reel-video', {
        body: { 
          scenes: project.scenes,
          voiceovers: project.voiceovers,
          topic: project.topic,
          addCaptions: true
        }
      });

      if (error) throw error;

      const generatedScenes = data.scenes || [];
      const scenesWithImages = generatedScenes.filter((s: GeneratedScene) => s.imageUrl);
      
      if (scenesWithImages.length === 0) {
        throw new Error('No scene images were generated');
      }

      setProject(prev => ({
        ...prev,
        generatedScenes,
      }));
      setProgress(50);
      
      // Step 2: Create video with burned-in captions using FFmpeg
      setProject(prev => ({ ...prev, status: 'rendering-video' }));
      setProgressStatus('Rendering video with captions...');
      
      const sceneInputs = scenesWithImages.map((scene: GeneratedScene, index: number) => ({
        sceneNumber: scene.sceneNumber,
        imageUrl: scene.imageUrl!,
        caption: scene.text,
        duration: project.scenes[index]?.duration || 4
      }));

      const videoBlob = await createReelVideo({
        scenes: sceneInputs,
        width: 1080,
        height: 1920,
        onProgress: (percent, status) => {
          setProgress(50 + Math.round(percent * 0.5));
          setProgressStatus(status);
        }
      });

      // Store blob reference and create URL
      videoBlobRef.current = videoBlob;
      const videoBlobUrl = URL.createObjectURL(videoBlob);

      setProject(prev => ({
        ...prev,
        videoBlobUrl,
        status: 'complete'
      }));
      setProgress(100);
      setProgressStatus('Complete!');

      toast({
        title: "TikTok Reel Ready!",
        description: `Created ${scenesWithImages.length}-scene video with burned-in captions. Ready to download!`
      });
    } catch (error: any) {
      console.error('Video generation error:', error);
      toast({
        title: "Video Generation Failed",
        description: error.message || "Failed to generate video.",
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
      await generateVoiceovers();
      if (project.voiceovers.length > 0) {
        await generateVideo();
      }
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
      status: 'idle'
    });
    setTopic('');
    setProgress(0);
    setProgressStatus('');
  };

  const handleDownloadVideo = () => {
    if (videoBlobRef.current) {
      downloadVideo(videoBlobRef.current, `reel-${project.topic.slice(0, 20).replace(/\s+/g, '-')}.mp4`);
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
              Create engaging short-form videos with AI-generated scripts, voiceovers, and captions
            </p>
          </div>
          {project.scenes.length > 0 && (
            <Button variant="outline" onClick={resetProject}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Start Over
            </Button>
          )}
        </div>

        <Tabs defaultValue="reels" className="space-y-6">
          <TabsList className="bg-card border border-border">
            <TabsTrigger value="reels" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Video className="w-4 h-4 mr-2" />
              Reels
            </TabsTrigger>
            <TabsTrigger value="stories" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground" disabled>
              <Sparkles className="w-4 h-4 mr-2" />
              Stories (Coming Soon)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reels" className="space-y-6">
            {/* Progress Bar */}
            {isGenerating && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {project.status === 'generating-script' && 'Generating scripts...'}
                        {project.status === 'generating-voiceover' && 'Creating voiceovers...'}
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

            {/* Input Section */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Create Your Reel
                </CardTitle>
                <CardDescription>
                  Enter a topic and we'll generate 4 scenes with scripts, voiceovers, and captions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic / Idea</Label>
                  <Textarea
                    id="topic"
                    placeholder="E.g., 5 productivity tips for remote workers, How to make the perfect coffee, Travel hacks for budget trips..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="min-h-[100px] bg-background border-border"
                    disabled={isGenerating}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isGenerating}>
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOICE_OPTIONS.map(voice => (
                          <SelectItem key={voice.value} value={voice.value}>
                            {voice.label}
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
                      Generate 4 Scene Scripts
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Generated Scenes */}
            {project.scenes.length > 0 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Scene Scripts
                  </CardTitle>
                  <CardDescription>
                    Review and edit your 4 scene scripts before generating voiceovers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {project.scenes.map((scene) => (
                      <Card key={scene.sceneNumber} className="bg-background border-border">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                              {scene.sceneNumber}
                            </span>
                            Scene {scene.sceneNumber}
                            <span className="text-xs text-muted-foreground ml-auto">
                              ~{scene.duration}s
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">Narration (Voiceover)</Label>
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
                          {project.voiceovers.find(v => v.sceneNumber === scene.sceneNumber) && (
                            <div className="flex items-center gap-2 pt-2">
                              <Mic className="w-4 h-4 text-green-500" />
                              <span className="text-xs text-green-500">Voiceover ready</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={generateVoiceovers}
                      disabled={isGenerating}
                      variant="secondary"
                      className="flex-1"
                    >
                      {isGenerating && project.status === 'generating-voiceover' ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Mic className="w-4 h-4 mr-2" />
                      )}
                      Generate Voiceovers
                    </Button>
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
                      Generate TikTok Video
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
                    <div className="aspect-[9/16] max-w-sm mx-auto bg-black rounded-lg overflow-hidden shadow-xl">
                      <video
                        src={project.videoBlobUrl}
                        controls
                        className="w-full h-full object-contain"
                        playsInline
                      />
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

          <TabsContent value="stories">
            <Card className="bg-card border-border">
              <CardContent className="pt-6 text-center">
                <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Stories Coming Soon</h3>
                <p className="text-muted-foreground">
                  Create vertical story content with transitions and effects.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reels;
