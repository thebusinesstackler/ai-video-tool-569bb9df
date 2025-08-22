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
  PlusIcon,
  LinkIcon,
  GridIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface VideoSegment {
  id: string;
  sceneNumber: number;
  timeRange: string;
  description: string;
  dialogue: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  jobId?: string;
  outputUrl?: string;
}

interface VideoProject {
  id: string;
  title: string;
  script: string;
  segments: VideoSegment[];
  aspectRatio: string;
  createdAt: string;
  totalDuration: number;
  isStitched?: boolean;
  stitchedUrl?: string;
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

  const parseScriptIntoSegments = (script: string): VideoSegment[] => {
    const segments: VideoSegment[] = [];
    const sceneRegex = /Scene (\d+) \((\d+:\d+)–(\d+:\d+)\) — ([^]*?)(?=Scene \d+|\n[A-Z][^:]*:|$)/gi;
    
    let match;
    let sceneNumber = 1;
    
    while ((match = sceneRegex.exec(script)) !== null) {
      const [, sceneNum, startTime, endTime, content] = match;
      const lines = content.trim().split('\n');
      const description = lines[0] || '';
      const dialogue = lines.find(line => line.startsWith('Speaker:'))?.replace('Speaker:', '').trim() || '';
      
      segments.push({
        id: `${Date.now()}-${sceneNumber}`,
        sceneNumber: parseInt(sceneNum) || sceneNumber,
        timeRange: `${startTime}–${endTime}`,
        description: description,
        dialogue: dialogue,
        status: 'pending',
        progress: 0
      });
      
      sceneNumber++;
    }
    
    // Fallback: if no scenes found, create segments from paragraphs
    if (segments.length === 0) {
      const paragraphs = script.split('\n\n').filter(p => p.trim());
      paragraphs.forEach((paragraph, index) => {
        segments.push({
          id: `${Date.now()}-${index + 1}`,
          sceneNumber: index + 1,
          timeRange: `${index * 5}s–${(index + 1) * 5}s`,
          description: `Segment ${index + 1}`,
          dialogue: paragraph.trim(),
          status: 'pending',
          progress: 0
        });
      });
    }
    
    return segments;
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
      const segments = parseScriptIntoSegments(formData.script);
      
      const newProject: VideoProject = {
        id: Date.now().toString(),
        title: formData.title,
        script: formData.script,
        segments: segments,
        aspectRatio: formData.aspectRatio,
        createdAt: new Date().toISOString(),
        totalDuration: formData.duration
      };

      const updatedProjects = [newProject, ...projects];
      saveProjects(updatedProjects);
      
      // Create videos for each segment
      for (const segment of segments) {
        try {
          const { data, error } = await supabase.functions.invoke('kie-video', {
            body: {
              prompt: `Scene: ${segment.description}. Dialogue: "${segment.dialogue}". Create a video showing: ${segment.description}`,
              aspectRatio: formData.aspectRatio as '16:9' | '9:16',
              model: 'veo3',
              enableFallback: true
            }
          });

          if (!error && data?.taskId) {
            // Update segment with job ID
            setProjects(prev => prev.map(p => 
              p.id === newProject.id 
                ? {
                    ...p,
                    segments: p.segments.map(s => 
                      s.id === segment.id 
                        ? { ...s, jobId: data.taskId, status: 'processing' }
                        : s
                    )
                  }
                : p
            ));
            
            // Start polling for this segment
            pollSegmentStatus(data.taskId, newProject.id, segment.id);
          }
        } catch (segmentError) {
          console.error(`Error creating segment ${segment.id}:`, segmentError);
          // Mark segment as failed
          setProjects(prev => prev.map(p => 
            p.id === newProject.id 
              ? {
                  ...p,
                  segments: p.segments.map(s => 
                    s.id === segment.id 
                      ? { ...s, status: 'failed' }
                      : s
                  )
                }
              : p
          ));
        }
      }
      
      setFormData({ title: '', script: '', aspectRatio: '16:9', style: 'default', duration: 60 });
      
      toast({
        title: "Video Creation Started",
        description: `Creating ${segments.length} video segments. This may take several minutes.`,
      });
      
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

  const pollSegmentStatus = async (taskId: string, projectId: string, segmentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(`kie-video?action=status&taskId=${taskId}`);

      if (error) {
        console.error('Status check error:', error);
        return;
      }

      const job = data;
      
      setProjects(prev => prev.map(p => 
        p.id === projectId 
          ? {
              ...p,
              segments: p.segments.map(s => 
                s.id === segmentId 
                  ? { ...s, status: job.status, progress: job.progress || 0, outputUrl: job.videoUrl }
                  : s
              )
            }
          : p
      ));

      if (job.status === 'processing' || job.status === 'pending') {
        setTimeout(() => pollSegmentStatus(taskId, projectId, segmentId), 5000);
      } else if (job.status === 'completed') {
        // Check if all segments are completed
        setProjects(prev => {
          const project = prev.find(p => p.id === projectId);
          if (project) {
            const allCompleted = project.segments.every(s => 
              s.id === segmentId ? job.status === 'completed' : s.status === 'completed'
            );
            if (allCompleted) {
              toast({
                title: "All Video Segments Ready",
                description: "All segments have been generated. You can now review and stitch them together!",
              });
            }
          }
          return prev;
        });
      } else if (job.status === 'failed') {
        toast({
          title: "Segment Failed",
          description: `Video segment generation failed.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  const getProjectStatus = (project: VideoProject) => {
    if (project.segments.length === 0) return 'pending';
    
    const statuses = project.segments.map(s => s.status);
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.some(s => s === 'failed')) return 'failed';
    if (statuses.some(s => s === 'processing')) return 'processing';
    return 'pending';
  };

  const getProjectProgress = (project: VideoProject) => {
    if (project.segments.length === 0) return 0;
    const totalProgress = project.segments.reduce((sum, s) => sum + s.progress, 0);
    return Math.round(totalProgress / project.segments.length);
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
                {projects.map((project) => {
                  const projectStatus = getProjectStatus(project);
                  const projectProgress = getProjectProgress(project);
                  const allCompleted = project.segments.every(s => s.status === 'completed');
                  
                  return (
                    <div key={project.id} className="p-4 border border-border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{project.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {project.aspectRatio} • {project.segments.length} segments • {new Date(project.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={
                            projectStatus === 'completed' ? 'default' :
                            projectStatus === 'processing' ? 'secondary' :
                            projectStatus === 'failed' ? 'destructive' : 'outline'
                          }>
                            {projectStatus === 'completed' && <CheckCircleIcon className="w-3 h-3 mr-1" />}
                            {projectStatus === 'processing' && <RefreshCwIcon className="w-3 h-3 mr-1 animate-spin" />}
                            {projectStatus === 'failed' && <XCircleIcon className="w-3 h-3 mr-1" />}
                            {projectStatus === 'pending' && <ClockIcon className="w-3 h-3 mr-1" />}
                            {projectStatus}
                          </Badge>
                        </div>
                      </div>

                      {projectStatus === 'processing' && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Overall Progress</span>
                            <span className="text-foreground">{projectProgress}%</span>
                          </div>
                          <Progress value={projectProgress} className="w-full" />
                        </div>
                      )}

                      {/* Segments Grid */}
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                          <GridIcon className="w-4 h-4" />
                          Video Segments
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {project.segments.map((segment) => (
                            <div key={segment.id} className="p-3 bg-muted/50 rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Scene {segment.sceneNumber}</span>
                                <Badge 
                                  variant={
                                    segment.status === 'completed' ? 'default' :
                                    segment.status === 'processing' ? 'secondary' :
                                    segment.status === 'failed' ? 'destructive' : 'outline'
                                  }
                                >
                                  {segment.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{segment.timeRange}</p>
                              <p className="text-xs">{segment.dialogue}</p>
                              
                              {segment.status === 'processing' && (
                                <Progress value={segment.progress} className="w-full h-1" />
                              )}
                              
                              {segment.status === 'completed' && segment.outputUrl && (
                                <div className="flex gap-1">
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={segment.outputUrl} target="_blank" rel="noopener noreferrer">
                                      <PlayIcon className="w-3 h-3 mr-1" />
                                      Watch
                                    </a>
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stitching Options */}
                      {allCompleted && !project.isStitched && (
                        <div className="border-t border-border pt-3">
                          <div className="flex items-center gap-2">
                            <Button variant="outline" className="flex-1">
                              <LinkIcon className="w-4 h-4 mr-2" />
                              Stitch Videos Together
                            </Button>
                            <Button variant="outline">Review All</Button>
                          </div>
                        </div>
                      )}

                      {project.isStitched && project.stitchedUrl && (
                        <div className="border-t border-border pt-3">
                          <p className="text-sm text-muted-foreground mb-2">Final stitched video:</p>
                          <div className="flex gap-2">
                            <Button variant="outline" asChild>
                              <a href={project.stitchedUrl} target="_blank" rel="noopener noreferrer">
                                <PlayIcon className="w-4 h-4 mr-2" />
                                Watch Final Video
                              </a>
                            </Button>
                            <Button variant="outline" asChild>
                              <a href={project.stitchedUrl} download>
                                <DownloadIcon className="w-4 h-4 mr-2" />
                                Download
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Videos;