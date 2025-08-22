import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  VideoIcon, 
  PlayIcon, 
  DownloadIcon, 
  RefreshCwIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VideoProject {
  id: string;
  title: string;
  script: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  jobId?: string;
  outputUrl?: string;
  aspectRatio: string;
  createdAt: string;
}

const Videos = () => {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    script: '',
    aspectRatio: '16:9',
    style: 'default',
    duration: 60
  });
  const { toast } = useToast();

  useEffect(() => {
    // API is always configured since we use server-side keys
    setApiConfigured(true);
    loadProjects();
  }, []);

  const loadProjects = () => {
    const stored = localStorage.getItem('kie_video_projects');
    if (stored) {
      setProjects(JSON.parse(stored));
    }
  };

  const saveProjects = (newProjects: VideoProject[]) => {
    localStorage.setItem('kie_video_projects', JSON.stringify(newProjects));
    setProjects(newProjects);
  };

  const handleCreateVideo = async () => {
    if (!formData.script.trim() || !formData.title.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and script.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('kie-video', {
        body: {
          prompt: `Create a video based on this script: ${formData.script}`,
          aspectRatio: formData.aspectRatio as '16:9' | '9:16',
          model: 'veo3',
          enableFallback: true
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to create video');
      }

      if (!data || !data.taskId) {
        throw new Error('No task ID received from the server');
      }

      const taskId = data.taskId;

      const newProject: VideoProject = {
        id: Date.now().toString(),
        title: formData.title,
        script: formData.script,
        status: 'pending',
        progress: 0,
        jobId: taskId,
        aspectRatio: formData.aspectRatio,
        createdAt: new Date().toISOString()
      };

      const updatedProjects = [newProject, ...projects];
      saveProjects(updatedProjects);
      
      setFormData({ title: '', script: '', aspectRatio: '16:9', style: 'default', duration: 60 });
      
      toast({
        title: "Video Creation Started",
        description: "Your video is being generated. This may take a few minutes.",
      });

      // Start polling for updates
      pollVideoStatus(taskId, newProject.id);
      
    } catch (error) {
      console.error('Video creation error:', error);
      toast({
        title: "Creation Failed",
        description: error instanceof Error ? error.message : "Failed to create video.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const pollVideoStatus = async (taskId: string, projectId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(`kie-video?action=status&taskId=${taskId}`);

      if (error) {
        console.error('Status check error:', error);
        return;
      }

      const job = data;
      
      setProjects(prev => prev.map(p => 
        p.id === projectId 
          ? { ...p, status: job.status, progress: job.progress || 0, outputUrl: job.videoUrl }
          : p
      ));

      if (job.status === 'processing' || job.status === 'pending') {
        setTimeout(() => pollVideoStatus(taskId, projectId), 5000);
      } else if (job.status === 'completed') {
        toast({
          title: "Video Ready",
          description: "Your video has been generated successfully!",
        });
      } else if (job.status === 'failed') {
        toast({
          title: "Video Failed",
          description: "Video generation failed. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  // API keys are now handled server-side, no configuration needed

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Video Production</h1>
          <p className="text-muted-foreground">
            Create AI-powered videos from your scripts using Kie.ai technology.
          </p>
        </div>

        {/* Create New Video */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <PlusIcon className="w-5 h-5 text-primary" />
              Create New Video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Project Title</Label>
                <Input
                  placeholder="My Amazing Video"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Aspect Ratio</Label>
                <Select value={formData.aspectRatio} onValueChange={(value) => setFormData(prev => ({ ...prev, aspectRatio: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                    <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Script</Label>
              <Textarea
                placeholder="Enter your video script here..."
                value={formData.script}
                onChange={(e) => setFormData(prev => ({ ...prev, script: e.target.value }))}
                className="min-h-[120px]"
              />
            </div>

            <Button 
              onClick={handleCreateVideo} 
              disabled={isCreating}
              className="w-full"
              variant="hero"
            >
              {isCreating ? (
                <>
                  <RefreshCwIcon className="w-4 h-4 animate-spin" />
                  Creating Video...
                </>
              ) : (
                <>
                  <VideoIcon className="w-4 h-4" />
                  Create Video
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Projects List */}
        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <VideoIcon className="w-5 h-5 text-primary" />
              Video Projects
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <VideoIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No video projects yet. Create your first video above!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div key={project.id} className="p-4 border border-border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-foreground">{project.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {project.aspectRatio} • {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          project.status === 'completed' ? 'default' :
                          project.status === 'processing' ? 'secondary' :
                          project.status === 'failed' ? 'destructive' : 'outline'
                        }>
                          {project.status === 'completed' && <CheckCircleIcon className="w-3 h-3 mr-1" />}
                          {project.status === 'processing' && <RefreshCwIcon className="w-3 h-3 mr-1 animate-spin" />}
                          {project.status === 'failed' && <XCircleIcon className="w-3 h-3 mr-1" />}
                          {project.status === 'pending' && <ClockIcon className="w-3 h-3 mr-1" />}
                          {project.status}
                        </Badge>
                      </div>
                    </div>

                    {project.status === 'processing' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="text-foreground">{project.progress}%</span>
                        </div>
                        <Progress value={project.progress} className="w-full" />
                      </div>
                    )}

                    {project.status === 'completed' && project.outputUrl && (
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={project.outputUrl} target="_blank" rel="noopener noreferrer">
                            <PlayIcon className="w-4 h-4 mr-2" />
                            Watch Video
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={project.outputUrl} download>
                            <DownloadIcon className="w-4 h-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Videos;