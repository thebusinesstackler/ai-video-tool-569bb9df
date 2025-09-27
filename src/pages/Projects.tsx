import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { VideoProcessingStatus } from '@/components/VideoProcessingStatus';
import { VideoPlayer } from '@/components/VideoPlayer';
import { 
  VideoIcon, 
  PlayIcon, 
  DownloadIcon, 
  RefreshCwIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  GridIcon,
  CalendarIcon,
  TrashIcon,
  ExternalLinkIcon,
  SquareStackIcon
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { stitchVideos } from '@/lib/videoStitch';
import { Progress } from '@/components/ui/progress';

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
  localVideoUrl?: string;
  error?: string;
}

interface VideoProject {
  id: string;
  title: string;
  script: string;
  model_type: string;
  segments: VideoSegment[];
  aspect_ratio: string;
  created_at: string;
  updated_at: string;
  total_duration: number;
  is_stitched: boolean;
  stitched_url?: string;
  character_id?: string;
  voice_settings: any;
  consistency_settings: any;
  source_image_url?: string;
  source_audio_url?: string;
  user_id: string;
}

const MODEL_NAMES = {
  'wan-2.2': 'Text-to-Video (WAN 2.2)',
  'wan-2.5-t2v': 'Enhanced Text-to-Video (WAN 2.5)',
  'wan-2.5-i2v': 'Image-to-Video (Alibaba WAN 2.5)',
  'wan-2.5-a2v': 'Audio-to-Video (Alibaba WAN 2.5)',
  'hunyuan-video': 'HunyuanVideo (Tencent)',
  'seedream-v4': 'Seedream V4 (Image-to-Video)',
  'vidu': 'VIDU (Multimodal)', 
  'veo3': 'VEO3 (Google)',
  'avatar-omni-human-1.5': 'Talking Avatar (ByteDance Omni Human 1.5)'
};

const Projects = () => {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stitchingProgress, setStitchingProgress] = useState<{[key: string]: number}>({});
  const [isStitching, setIsStitching] = useState<{[key: string]: boolean}>({});
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to view your projects.",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading projects:', error);
        toast({
          title: "Error Loading Projects",
          description: "Failed to load your video projects.",
          variant: "destructive"
        });
        return;
      }

      const transformedProjects: VideoProject[] = (data || []).map((project: any) => ({
        ...project,
        segments: Array.isArray(project.segments) ? project.segments as VideoSegment[] : []
      }));

      setProjects(transformedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProjectStatus = (project: VideoProject): 'pending' | 'processing' | 'completed' | 'failed' => {
    if (!project.segments || project.segments.length === 0) return 'pending';
    
    const statuses = project.segments.map(s => s.status);
    
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.some(s => s === 'processing')) return 'processing';
    if (statuses.some(s => s === 'failed')) return 'failed';
    
    return 'pending';
  };

  const getProjectProgress = (project: VideoProject): number => {
    if (!project.segments || project.segments.length === 0) return 0;
    
    const totalProgress = project.segments.reduce((sum, segment) => sum + segment.progress, 0);
    return Math.round(totalProgress / project.segments.length);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-600" />;
      case 'processing':
        return <RefreshCwIcon className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleRefreshSegment = (segmentId: string) => {
    // Find the project and segment and poll status
    for (const project of projects) {
      const segment = project.segments.find(s => s.id === segmentId);
      if (segment?.jobId) {
        pollSegmentStatus(segment.jobId, project.id, segmentId);
        break;
      }
    }
  };

  const pollSegmentStatus = async (taskId: string, projectId: string, segmentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'status',
          taskId: taskId
        }
      });

      if (error) {
        console.error('Status check error:', error);
        return;
      }

      setProjects(prev => {
        const project = prev.find(p => p.id === projectId);
        if (!project) return prev;

        const updatedSegments = project.segments.map(s => 
          s.id === segmentId 
            ? { 
                ...s, 
                status: data.status as 'pending' | 'processing' | 'completed' | 'failed', 
                progress: data.progress || 0, 
                outputUrl: data.videoUrl 
              }
            : s
        );

        // Update database
        supabase
          .from('projects')
          .update({ segments: updatedSegments as any })
          .eq('id', projectId)
          .then(({ error }) => {
            if (error) console.error('Database update error:', error);
          });
        
        return prev.map(p => 
          p.id === projectId 
            ? { ...p, segments: updatedSegments }
            : p
        );
      });

      if (data.status === 'completed') {
        toast({
          title: "Segment Completed",
          description: `Video segment is ready!`,
        });
      }
    } catch (error) {
      console.error('Error polling status:', error);
    }
  };

  const handlePlayVideo = async (url: string, title: string = 'Video') => {
    // If it's a local storage URL, create signed URL for access
    if (url.includes('supabase.co') && url.includes('project-files')) {
      try {
        const pathParts = url.split('/').slice(-3);
        const filePath = pathParts.join('/');
        
        const { data, error } = await supabase.storage
          .from('project-files')
          .createSignedUrl(filePath, 3600); // 1 hour expiry

        if (error) throw error;
        
        if (data?.signedUrl) {
          // Open video player modal with signed URL
          return data.signedUrl;
        }
      } catch (error) {
        console.error('Error creating signed URL:', error);
      }
    }
    
    // For external URLs or if signed URL creation failed, open in new tab
    window.open(url, '_blank');
    return url;
  };

  const handleDownloadVideo = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStitchVideo = async (project: VideoProject) => {
    if (!project.segments || project.segments.length === 0) return;
    
    const completedSegments = project.segments
      .filter(s => s.status === 'completed' && s.outputUrl)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);
    
    if (completedSegments.length === 0) {
      toast({
        title: "No Completed Segments",
        description: "There are no completed video segments to stitch together.",
        variant: "destructive"
      });
      return;
    }

    if (completedSegments.length < project.segments.length) {
      toast({
        title: "Incomplete Project",
        description: `Only ${completedSegments.length} of ${project.segments.length} segments are completed.`,
        variant: "destructive"
      });
      return;
    }

    try {
      setIsStitching(prev => ({ ...prev, [project.id]: true }));
      setStitchingProgress(prev => ({ ...prev, [project.id]: 0 }));

      toast({
        title: "Stitching Started",
        description: "Combining video segments into final video...",
      });

      const videoUrls = completedSegments.map(s => s.outputUrl!);
      
      const stitchedBlob = await stitchVideos(videoUrls, (progress) => {
        setStitchingProgress(prev => ({ ...prev, [project.id]: progress }));
      });

      // Upload stitched video to Supabase storage
      const fileName = `stitched/${project.id}_final_video.mp4`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(fileName, stitchedBlob, {
          contentType: 'video/mp4',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName);

      // Update project with stitched video URL
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          is_stitched: true,
          stitched_url: urlData.publicUrl
        })
        .eq('id', project.id);

      if (updateError) throw updateError;

      // Update local state
      setProjects(prev => prev.map(p => 
        p.id === project.id 
          ? { ...p, is_stitched: true, stitched_url: urlData.publicUrl }
          : p
      ));

      toast({
        title: "Video Stitched Successfully",
        description: "Your complete video is ready for download!",
      });

      // Automatically download the stitched video
      handleDownloadVideo(urlData.publicUrl, `${project.title}_complete.mp4`);

    } catch (error) {
      console.error('Error stitching video:', error);
      toast({
        title: "Stitching Failed",
        description: error instanceof Error ? error.message : "Failed to stitch video segments.",
        variant: "destructive"
      });
    } finally {
      setIsStitching(prev => ({ ...prev, [project.id]: false }));
      setStitchingProgress(prev => ({ ...prev, [project.id]: 0 }));
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      setProjects(prev => prev.filter(p => p.id !== projectId));
      
      toast({
        title: "Project Deleted",
        description: "Video project has been removed.",
      });
    } catch (error) {
      console.error('Error deleting project:', error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the project.",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-6 py-8 ml-64">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-2">Video Projects</h1>
            <p className="text-muted-foreground">
              Manage and view all your generated video projects
            </p>
          </div>
          <Link to="/videos">
            <Button className="gap-2">
              <PlusIcon className="w-4 h-4" />
              Create New Project
            </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Projects</p>
                  <p className="text-2xl font-bold">{projects.length}</p>
                </div>
                <GridIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {projects.filter(p => getProjectStatus(p) === 'completed').length}
                  </p>
                </div>
                <CheckCircleIcon className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Processing</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {projects.filter(p => getProjectStatus(p) === 'processing').length}
                  </p>
                </div>
                <RefreshCwIcon className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Segments</p>
                  <p className="text-2xl font-bold">
                    {projects.reduce((sum, p) => sum + (p.segments?.length || 0), 0)}
                  </p>
                </div>
                <VideoIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects List */}
        {projects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <VideoIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Projects Yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first video project to get started
              </p>
              <Link to="/videos">
                <Button className="gap-2">
                  <PlusIcon className="w-4 h-4" />
                  Create Your First Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {projects.map((project) => {
              const status = getProjectStatus(project);
              const progress = getProjectProgress(project);

              return (
                <Card key={project.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-3">
                          {getStatusIcon(status)}
                          <span>{project.title}</span>
                          <Badge className={getStatusColor(status)}>
                            {status.toUpperCase()}
                          </Badge>
                        </CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-4 h-4" />
                            {formatDate(project.created_at)}
                          </span>
                          <span>
                            Model: {MODEL_NAMES[project.model_type as keyof typeof MODEL_NAMES] || project.model_type}
                          </span>
                          <span>
                            Aspect Ratio: {project.aspect_ratio}
                          </span>
                          <span>
                            {project.segments?.length || 0} segments
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Stitch Video Button */}
                        {status === 'completed' && !project.is_stitched && (
                          <Button
                            onClick={() => handleStitchVideo(project)}
                            disabled={isStitching[project.id]}
                            className="gap-2"
                            size="sm"
                          >
                            <SquareStackIcon className="w-4 h-4" />
                            {isStitching[project.id] ? 'Stitching...' : 'Stitch Video'}
                          </Button>
                        )}
                        
                        {/* Download Stitched Video */}
                        {project.is_stitched && project.stitched_url && (
                          <Button
                            onClick={() => handleDownloadVideo(project.stitched_url!, `${project.title}_complete.mp4`)}
                            className="gap-2"
                            size="sm"
                            variant="outline"
                          >
                            <DownloadIcon className="w-4 h-4" />
                            Download Complete Video
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteProject(project.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Stitching Progress */}
                    {isStitching[project.id] && (
                      <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            Stitching video segments...
                          </span>
                          <span className="text-sm text-blue-600 dark:text-blue-400">
                            {stitchingProgress[project.id] || 0}%
                          </span>
                        </div>
                        <Progress value={stitchingProgress[project.id] || 0} className="h-2" />
                      </div>
                    )}

                    {/* Stitched Video Complete */}
                    {project.is_stitched && (
                      <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircleIcon className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-300">
                              Complete video ready!
                            </span>
                          </div>
                          <Button
                            onClick={() => project.stitched_url && handlePlayVideo(project.stitched_url, `${project.title} - Complete Video`)}
                            size="sm"
                            variant="outline"
                            className="gap-1"
                          >
                            <PlayIcon className="w-3 h-3" />
                            Play Complete Video
                          </Button>
                        </div>
                      </div>
                    )}

                    {project.segments && project.segments.length > 0 ? (
                      <VideoProcessingStatus
                        segments={project.segments}
                        onRefreshSegment={handleRefreshSegment}
                        onPlayVideo={handlePlayVideo}
                        onDownloadVideo={handleDownloadVideo}
                      />
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No video segments found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Projects;