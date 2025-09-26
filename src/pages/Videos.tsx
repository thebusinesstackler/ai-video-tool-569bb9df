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
  GridIcon,
  DollarSign,
  ImageIcon,
  VolumeIcon
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

const MODEL_COSTS = {
  'wan-2.2': 0.1,
  'wan-2.5-i2v': 0.5,
  'vidu': 0.3,
  'veo3': 0.4
};

const MODEL_NAMES = {
  'wan-2.2': 'Text-to-Video (WAN 2.2)',
  'wan-2.5-i2v': 'Image-to-Video (Alibaba WAN 2.5)',
  'vidu': 'VIDU Model', 
  'veo3': 'VEO3 Model'
};

const Videos = () => {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    script: '',
    modelType: 'wan-2.2' as keyof typeof MODEL_COSTS,
    aspectRatio: '16:9',
    duration: 60,
    characterId: 'none',
    lockSeed: false,
    customSeed: '',
    voice: 'alloy',
    segmentDuration: '5'
  });
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceAudio, setSourceAudio] = useState<File | null>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadProjects();
    loadCharacters();
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

      // Transform database data to match VideoProject interface
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

  const loadCharacters = async () => {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading characters:', error);
        return;
      }

      setCharacters(data || []);
    } catch (error) {
      console.error('Error loading characters:', error);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${path}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('project-files')
      .upload(fileName, file);

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('project-files')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const parseScriptIntoSegments = (script: string): VideoSegment[] => {
    const segments: VideoSegment[] = [];
    
    // Split the script into scene blocks
    const sceneBlocks = script.split(/(?=Scene \d+)/i).filter(block => block.trim());
    
    for (let i = 0; i < sceneBlocks.length; i++) {
      const block = sceneBlocks[i].trim();
      if (!block) continue;
      
      // Extract scene header
      const sceneHeaderMatch = block.match(/Scene (\d+) \(([^)]+)\)/i);
      if (!sceneHeaderMatch) continue;
      
      const [, sceneNum, timeRange] = sceneHeaderMatch;
      
      // Extract content sections
      const lines = block.split('\n').map(line => line.trim()).filter(line => line);
      
      let visuals = '';
      let dialogue = '';
      
      // Parse different sections
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        
        if (line.toLowerCase().startsWith('visuals:')) {
          visuals = line.replace(/^visuals:\s*/i, '');
          j++;
          while (j < lines.length && !lines[j].toLowerCase().match(/^(dialogue|content):/)) {
            visuals += '\n' + lines[j];
            j++;
          }
          j--; // Back up one since the loop will increment
        } else if (line.toLowerCase().startsWith('dialogue:') || line.toLowerCase().startsWith('content:')) {
          dialogue = line.replace(/^(dialogue|content):\s*/i, '');
          j++;
          while (j < lines.length && !lines[j].toLowerCase().match(/^visuals:/)) {
            dialogue += '\n' + lines[j];
            j++;
          }
          j--; // Back up one since the loop will increment
        }
      }
      
      // If no structured format found, treat the whole block as dialogue
      if (!visuals && !dialogue) {
        dialogue = block.replace(/Scene \d+ \([^)]+\):?\s*/i, '').trim();
      }
      
      const description = visuals.trim() || `Scene ${sceneNum} visuals`;
      const finalDialogue = dialogue.trim() || `Scene ${sceneNum} content`;
      
      segments.push({
        id: `segment-${Date.now()}-${i}`,
        sceneNumber: parseInt(sceneNum, 10),
        timeRange: timeRange,
        description: description,
        dialogue: finalDialogue,
        status: 'pending',
        progress: 0
      });
    }
    
    return segments;
  };

  const handleCreateVideo = async () => {
    if (!formData.title.trim() || !formData.script.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and script.",
        variant: "destructive"
      });
      return;
    }

    if (formData.modelType === 'wan-2.5-i2v' && !sourceImage) {
      toast({
        title: "Image Required",
        description: "The image-to-video model requires a source image.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Authentication required');

      let imageUrl = '';
      let audioUrl = '';

      // Upload files if provided
      if (sourceImage) {
        imageUrl = await uploadFile(sourceImage, 'images');
      }

      if (sourceAudio) {
        audioUrl = await uploadFile(sourceAudio, 'audio');
      }

      const segments = parseScriptIntoSegments(formData.script);
      
      if (segments.length === 0) {
        throw new Error('No valid scenes found in script. Please format your script with Scene headers like "Scene 1 (0:00-0:15):"');
      }

      // Create project in database with proper type casting
      const { data: newProject, error } = await supabase
        .from('projects')
        .insert({
          title: formData.title,
          script: formData.script,
          model_type: formData.modelType,
          segments: segments as any,
          aspect_ratio: formData.aspectRatio,
          total_duration: formData.duration,
          is_stitched: false,
          character_id: formData.characterId !== 'none' ? formData.characterId : null,
          voice_settings: { voice: formData.voice, audioUrl: audioUrl } as any,
          consistency_settings: { 
            lockSeed: formData.lockSeed,
            globalSeed: formData.lockSeed ? (parseInt(formData.customSeed) || Math.floor(Math.random() * 2147483647)) : undefined
          } as any,
          source_image_url: imageUrl || null,
          source_audio_url: audioUrl || null,
          user_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Transform and add to local state
      const transformedProject: VideoProject = {
        ...newProject,
        segments: segments
      };

      setProjects(prev => [transformedProject, ...prev]);

      // Create video segments
      for (const segment of segments) {
        try {
          const enhancedPrompt = `Scene ${segment.sceneNumber} (${segment.timeRange}):

Visual Description: ${segment.description}

Dialogue/Content: "${segment.dialogue}"

Create a cinematic video that captures both the visual elements and the message/dialogue described above. Focus on engaging cinematography that matches the scene's requirements.`.trim();

          const requestBody: any = {
            action: 'create',
            prompt: enhancedPrompt,
            aspectRatio: formData.aspectRatio as '16:9' | '9:16',
            model: formData.modelType,
            enableFallback: true,
            duration: parseInt(formData.segmentDuration)
          };

          if (formData.modelType === 'wan-2.5-i2v') {
            requestBody.imageUrls = [imageUrl];
            if (audioUrl) {
              requestBody.audioUrl = audioUrl;
            }
          }

          if (formData.lockSeed) {
            requestBody.seeds = parseInt(formData.customSeed) || Math.floor(Math.random() * 2147483647);
          }

          const { data, error } = await supabase.functions.invoke('wavespeed-video', {
            body: requestBody
          });

          if (error) {
            console.error(`API error for segment ${segment.id}:`, error);
            throw new Error(error.message || 'Failed to create video segment');
          }

          if (data?.taskId) {
            // Update segment with job ID in database
            const updatedSegments = segments.map(s => 
              s.id === segment.id 
                ? { ...s, jobId: data.taskId, status: 'processing' as const }
                : s
            );

            await supabase
              .from('projects')
              .update({ segments: updatedSegments as any })
              .eq('id', newProject.id);
            
            // Update local state
            setProjects(prev => prev.map(p => 
              p.id === newProject.id 
                ? { ...p, segments: updatedSegments }
                : p
            ));
            
            // Start polling for this segment
            setTimeout(() => {
              pollSegmentStatus(data.taskId, newProject.id, segment.id);
            }, 5000);
            
            console.log(`Video creation started for segment ${segment.sceneNumber}, taskId: ${data.taskId}`);
          }
        } catch (segmentError) {
          console.error(`Error creating segment ${segment.sceneNumber}:`, segmentError);
          
          toast({
            title: `Segment ${segment.sceneNumber} Failed`,
            description: segmentError instanceof Error ? segmentError.message : "Failed to create video segment",
            variant: "destructive"
          });
        }
      }
      
      setFormData({ 
        title: '', 
        script: '', 
        modelType: 'wan-2.2',
        aspectRatio: '16:9', 
        duration: 60, 
        characterId: 'none', 
        lockSeed: false, 
        customSeed: '',
        voice: 'alloy',
        segmentDuration: '5'
      });
      setSourceImage(null);
      setSourceAudio(null);
      
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
      const { data, error } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'status',
          taskId: taskId
        }
      });

      if (error) {
        console.error('Status check error:', error);
        setTimeout(() => pollSegmentStatus(taskId, projectId, segmentId), 10000);
        return;
      }

      console.log(`Status update for ${taskId}:`, data);

      // Update project in database and local state
      const project = projects.find(p => p.id === projectId);
      if (project) {
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

        await supabase
          .from('projects')
          .update({ segments: updatedSegments as any })
          .eq('id', projectId);
        
        // Update local state
        setProjects(prev => prev.map(p => 
          p.id === projectId 
            ? { ...p, segments: updatedSegments }
            : p
        ));
      }

      // Continue polling if still processing
      if (data.status === 'processing' || data.status === 'pending') {
        setTimeout(() => {
          pollSegmentStatus(taskId, projectId, segmentId);
        }, 5000);
      } else if (data.status === 'completed') {
        toast({
          title: "Segment Completed",
          description: `Video segment is ready!`,
        });
      } else if (data.status === 'failed') {
        toast({
          title: "Segment Failed", 
          description: data.error || "Video generation failed",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error polling status:', error);
      setTimeout(() => pollSegmentStatus(taskId, projectId, segmentId), 10000);
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

  const calculateEstimatedCost = () => {
    if (!formData.script) return 0;
    
    const segments = parseScriptIntoSegments(formData.script);
    const costPerSegment = MODEL_COSTS[formData.modelType] || 0.1;
    return segments.length * costPerSegment;
  };

  const estimatedCost = calculateEstimatedCost();

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCwIcon className="w-8 h-8 animate-spin" />
            <span className="ml-2">Loading projects...</span>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">AI Video Creator</h1>
          <p className="text-muted-foreground">Transform your scripts into professional videos with multiple AI models</p>
        </div>

        {/* Creation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlusIcon className="w-5 h-5" />
              Create New Video Project
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Project Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="My Amazing Video"
                  />
                </div>

                <div>
                  <Label htmlFor="modelType">AI Model</Label>
                  <Select value={formData.modelType} onValueChange={(value) => setFormData({...formData, modelType: value as keyof typeof MODEL_COSTS})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MODEL_NAMES).map(([value, name]) => (
                        <SelectItem key={value} value={value}>
                          {name} - ${MODEL_COSTS[value as keyof typeof MODEL_COSTS]}/segment
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.modelType === 'wan-2.5-i2v' && (
                  <>
                    <div>
                      <Label htmlFor="sourceImage" className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        Source Image (Required)
                      </Label>
                      <Input
                        id="sourceImage"
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSourceImage(e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      {sourceImage && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Selected: {sourceImage.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="sourceAudio" className="flex items-center gap-2">
                        <VolumeIcon className="w-4 h-4" />
                        Audio Track (Optional)
                      </Label>
                      <Input
                        id="sourceAudio"
                        type="file"
                        accept="audio/*"
                        onChange={(e) => setSourceAudio(e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                      {sourceAudio && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Selected: {sourceAudio.name}
                        </p>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="aspectRatio">Aspect Ratio</Label>
                  <Select value={formData.aspectRatio} onValueChange={(value) => setFormData({...formData, aspectRatio: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                      <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="segmentDuration">Segment Duration (seconds)</Label>
                  <Select value={formData.segmentDuration} onValueChange={(value) => setFormData({...formData, segmentDuration: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="15">15 seconds</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="script">Video Script</Label>
                  <Textarea
                    id="script"
                    value={formData.script}
                    onChange={(e) => setFormData({...formData, script: e.target.value})}
                    placeholder="Scene 1 (0:00–0:15):
Visuals: A confident woman in her 40s stands on a stage with a microphone...
Dialogue: Good evening everyone. Tonight, I want to share the power of clinical studies..."
                    rows={8}
                    className="font-mono text-sm"
                  />
                </div>

                {estimatedCost > 0 && (
                  <div className="p-3 bg-accent rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-accent-foreground" />
                      <span className="font-medium">Estimated Cost: ${estimatedCost.toFixed(2)}</span>
                      <span className="text-muted-foreground">
                        ({parseScriptIntoSegments(formData.script).length} segments × ${MODEL_COSTS[formData.modelType]})
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleCreateVideo}
              disabled={isCreating || !formData.title.trim() || !formData.script.trim()}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <RefreshCwIcon className="w-4 h-4 mr-2 animate-spin" />
                  Creating Video...
                </>
              ) : (
                <>
                  <VideoIcon className="w-4 h-4 mr-2" />
                  Create Video Project
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Projects List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GridIcon className="w-5 h-5" />
              Your Video Projects
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
                  
                  return (
                    <div key={project.id} className="p-4 border border-border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{project.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {MODEL_NAMES[project.model_type as keyof typeof MODEL_NAMES] || project.model_type} • {project.aspect_ratio} • {project.segments?.length || 0} segments • {new Date(project.created_at).toLocaleDateString()}
                          </p>
                        </div>
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
                          {(project.segments || []).map((segment) => (
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
                                  {segment.status === 'pending' ? '⏳ Queued' :
                                   segment.status === 'processing' ? '🎬 Generating' :
                                   segment.status === 'completed' ? '✅ Ready' :
                                   segment.status === 'failed' ? '❌ Failed' : segment.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {segment.dialogue}
                              </p>
                              {segment.status === 'processing' && (
                                <Progress value={segment.progress} className="w-full h-1" />
                              )}
                              {segment.outputUrl && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(segment.outputUrl, '_blank')}
                                  >
                                    <PlayIcon className="w-3 h-3 mr-1" />
                                    Play
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const a = document.createElement('a');
                                      a.href = segment.outputUrl!;
                                      a.download = `scene-${segment.sceneNumber}.mp4`;
                                      a.click();
                                    }}
                                  >
                                    <DownloadIcon className="w-3 h-3 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
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