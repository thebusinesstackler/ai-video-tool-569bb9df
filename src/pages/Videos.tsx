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
  GridIcon,
  InfoIcon,
  Dices
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { stitchVideos as stitchVideosLib } from '@/lib/videoStitch';

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
  stitchedSegments?: string[];
  characterId?: string;
  voiceSettings?: {
    voice: string;
    audioUrl?: string;
  };
  consistencySettings?: {
    lockSeed?: boolean;
    globalSeed?: number;
    referenceImageUrls?: string[];
    styleConsistency?: 'high' | 'medium' | 'low';
  };
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
    duration: 60,
    characterId: 'none',
    lockSeed: false,
    customSeed: '',
    styleConsistency: 'high' as 'high' | 'medium' | 'low',
    voice: 'alloy',
    segmentDuration: '15' as '15' | '30' | 'custom',
    customSegmentDuration: 15
  });
  const [characters, setCharacters] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // API is always configured since we use server-side keys
    setApiConfigured(true);
    loadProjects();
    loadCharacters();
  }, []);

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

      // Transform database data to component format
      const transformedCharacters = (data || []).map((char: any) => ({
        id: char.id,
        name: char.name,
        description: char.description || '',
        appearanceImage: char.appearance_image || '',
        voiceType: char.voice_type || 'professional-female',
        kieVoiceId: char.kie_voice_id || '',
        personality: char.personality || 'professional',
      }));

      setCharacters(transformedCharacters);
    } catch (error) {
      console.error('Error loading characters:', error);
    }
  };

  useEffect(() => {
    // Resume polling for pending/processing segments on page load
    projects.forEach(project => {
      project.segments?.forEach(segment => {
        if ((segment.status === 'pending' || segment.status === 'processing') && segment.jobId) {
          pollSegmentStatus(segment.jobId, project.id, segment.id);
        }
      });
    });
  }, [projects.length]); // Only run when projects are first loaded

  const loadProjects = () => {
    const stored = localStorage.getItem('kie_video_projects');
    if (stored) {
      const parsedProjects = JSON.parse(stored);
      // Migrate old projects to new structure
      const migratedProjects = parsedProjects.map((project: any) => {
        if (!project.segments) {
          // This is an old project, convert it to new structure
          return {
            ...project,
            segments: project.status ? [{
              id: `${project.id}-segment-1`,
              sceneNumber: 1,
              timeRange: '0:00–0:15',
              description: 'Legacy video',
              dialogue: project.script || '',
              status: project.status,
              progress: project.progress || 0,
              jobId: project.jobId,
              outputUrl: project.outputUrl
            }] : [],
            totalDuration: 15
          };
        }
        return project;
      });
      setProjects(migratedProjects);
    }
  };

  const saveProjects = async (newProjects: VideoProject[]) => {
    setProjects(newProjects);
    // Database updates are handled individually by each operation
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
      let toneMotion = '';
      let dialogue = '';
      
      // Parse different sections
      for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        
        if (line.toLowerCase().startsWith('visuals:')) {
          // Collect all visuals content (may span multiple lines)
          visuals = line.replace(/^visuals:\s*/i, '');
          j++;
          while (j < lines.length && !lines[j].match(/^(tone|line):/i)) {
            visuals += ' ' + lines[j];
            j++;
          }
          j--; // Back up one since the loop will increment
        } else if (line.toLowerCase().startsWith('tone')) {
          // Collect tone & motion content
          toneMotion = line.replace(/^tone[^:]*:\s*/i, '');
          j++;
          while (j < lines.length && !lines[j].match(/^line:/i)) {
            toneMotion += ' ' + lines[j];
            j++;
          }
          j--; // Back up one since the loop will increment
        } else if (line.toLowerCase().startsWith('line:')) {
          // Collect dialogue content
          dialogue = line.replace(/^line:\s*/i, '');
          j++;
          while (j < lines.length && !lines[j].match(/^(scene|visuals|tone|line):/i)) {
            dialogue += ' ' + lines[j];
            j++;
          }
          j--; // Back up one since the loop will increment
        }
      }
      
      // Clean up dialogue (remove quotes)
      dialogue = dialogue.replace(/^["']|["']$/g, '').trim();
      
      segments.push({
        id: `${Date.now()}-${i}`,
        sceneNumber: parseInt(sceneNum) || (i + 1),
        timeRange: timeRange,
        description: visuals.trim() || `Scene ${sceneNum}`,
        dialogue: dialogue.trim() || toneMotion.trim(),
        status: 'pending',
        progress: 0
      });
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
      // Use custom seed if provided, otherwise generate random seed when lock is enabled
      const globalSeed = formData.lockSeed 
        ? (formData.customSeed ? parseInt(formData.customSeed) : Math.floor(Math.random() * 90000) + 10000)
        : undefined;
      
      // Generate consistent voice audio for all segments
      const fullScript = segments.map(s => s.dialogue).join(' ');
      let consistentAudioUrl: string | undefined;
      
      try {
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('openai-tts', {
          body: {
            text: fullScript,
            voice: formData.voice,
            model: 'eleven_multilingual_v2'
          }
        });

        if (ttsError) {
          console.warn('TTS generation failed, proceeding without voice:', ttsError);
        } else {
          // Create audio URL from base64
          const audioBlob = new Blob([Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
          consistentAudioUrl = URL.createObjectURL(audioBlob);
        }
      } catch (voiceError) {
        console.warn('Voice generation failed, proceeding without audio:', voiceError);
      }
      
      const newProject: VideoProject = {
        id: Date.now().toString(),
        title: formData.title,
        script: formData.script,
        segments: segments,
        aspectRatio: formData.aspectRatio,
        createdAt: new Date().toISOString(),
        totalDuration: formData.duration,
        characterId: formData.characterId === 'none' ? undefined : formData.characterId,
        voiceSettings: consistentAudioUrl ? {
          voice: formData.voice,
          audioUrl: consistentAudioUrl
        } : undefined,
        consistencySettings: {
          lockSeed: formData.lockSeed,
          globalSeed: globalSeed,
          referenceImageUrls: formData.characterId && formData.characterId !== 'none'
            ? (characters.find(c => c.id === formData.characterId)?.appearanceImage 
              ? [characters.find(c => c.id === formData.characterId)!.appearanceImage] 
              : [])
            : [],
          styleConsistency: formData.styleConsistency
        }
      };

      const updatedProjects = [newProject, ...projects];
      saveProjects(updatedProjects);
      
      // Create videos for each segment with delays to avoid overwhelming the API
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // Add delay between requests (except for the first one)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        try {
          // Get selected character for consistency
          const selectedCharacter = newProject.characterId 
            ? characters.find(c => c.id === newProject.characterId)
            : null;

          // Prepare reference images from character
          const referenceImageUrls = selectedCharacter?.appearanceImage 
            ? [selectedCharacter.appearanceImage] 
            : [];

          // Create enhanced prompt with character bible and consistency rules
          const characterBible = selectedCharacter ? `
CHARACTER BIBLE:
- Name: ${selectedCharacter.name}
- Appearance: ${selectedCharacter.description || 'As shown in reference image'}
- Personality: ${selectedCharacter.personality}
- Voice Style: ${selectedCharacter.voiceType}
${selectedCharacter.description ? `- Background: ${selectedCharacter.description}` : ''}

CONSISTENCY RULES:
- Keep the character's appearance identical across all scenes
- Maintain consistent lighting and visual style
- Use the same character model and features throughout
- Ensure facial features, hair, clothing style remain constant
- Apply consistent cinematographic style
${selectedCharacter.appearanceImage ? '- Use the provided reference image to maintain character appearance' : ''}

` : '';

          const enhancedPrompt = `${characterBible}Scene ${segment.sceneNumber} (${segment.timeRange}):

Visual Description: ${segment.description}

Dialogue/Content: "${segment.dialogue}"

${selectedCharacter ? `Featured Character: ${selectedCharacter.name} - ${selectedCharacter.description || 'As shown in reference image'}` : ''}

Create a cinematic video that captures both the visual elements and the message/dialogue described above. ${selectedCharacter ? 'Ensure the character appears consistently as described in the character bible above.' : ''} Focus on engaging cinematography that matches the scene's requirements.`.trim();

          console.log(`Creating video for segment ${segment.sceneNumber}:`, enhancedPrompt);

          const { data, error } = await supabase.functions.invoke('wavespeed-video', {
            body: {
              action: 'create',
              prompt: enhancedPrompt,
              aspectRatio: formData.aspectRatio as '16:9' | '9:16',
              model: 'wan-2.2',
              enableFallback: true,
              seeds: newProject.consistencySettings?.lockSeed ? newProject.consistencySettings.globalSeed : undefined,
              imageUrls: referenceImageUrls,
              characterId: newProject.characterId
            }
          });

          if (error) {
            console.error(`API error for segment ${segment.id}:`, error);
            throw new Error(error.message || 'Failed to create video');
          }

          if (data?.taskId) {
            // Update segment with job ID and persist to localStorage
            const updatedProjects = [...projects];
            const projectIndex = updatedProjects.findIndex(p => p.id === newProject.id);
            if (projectIndex !== -1) {
              updatedProjects[projectIndex] = {
                ...updatedProjects[projectIndex],
                segments: updatedProjects[projectIndex].segments.map(s => 
                  s.id === segment.id 
                    ? { ...s, jobId: data.taskId, status: 'processing' as const }
                    : s
                )
              };
              saveProjects(updatedProjects);
              setProjects(updatedProjects);
            }
            
            // Start polling for this segment
            setTimeout(() => {
              pollSegmentStatus(data.taskId, newProject.id, segment.id);
            }, 5000); // Start polling after 5 seconds
            
            console.log(`Video creation started for segment ${segment.sceneNumber}, taskId: ${data.taskId}`);
          } else {
            throw new Error('No taskId returned from video creation');
          }
        } catch (segmentError) {
          console.error(`Error creating segment ${segment.sceneNumber}:`, segmentError);
          
          // Mark segment as failed and persist
          const updatedProjects = [...projects];
          const projectIndex = updatedProjects.findIndex(p => p.id === newProject.id);
          if (projectIndex !== -1) {
            updatedProjects[projectIndex] = {
              ...updatedProjects[projectIndex],
              segments: updatedProjects[projectIndex].segments.map(s => 
                s.id === segment.id 
                  ? { ...s, status: 'failed' as const }
                  : s
              )
            };
            saveProjects(updatedProjects);
            setProjects(updatedProjects);
          }
          
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
        aspectRatio: '16:9', 
        style: 'default', 
        duration: 60, 
        characterId: 'none', 
        lockSeed: false, 
        customSeed: '',
        styleConsistency: 'high',
        voice: 'alloy',
        segmentDuration: '15' as '15' | '30' | 'custom',
        customSegmentDuration: 15
      });
      
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
        // Retry after longer delay on error
        setTimeout(() => pollSegmentStatus(taskId, projectId, segmentId), 10000);
        return;
      }

      const job = data;
      console.log(`Status update for ${taskId}:`, job);
      
      // Update project and persist to localStorage
      setProjects(prev => {
        const updated = prev.map(p => 
          p.id === projectId 
            ? {
                ...p,
                segments: p.segments.map(s => 
                  s.id === segmentId 
                    ? { 
                        ...s, 
                        status: job.status as 'pending' | 'processing' | 'completed' | 'failed', 
                        progress: job.progress || 0, 
                        outputUrl: job.videoUrl 
                      }
                    : s
                )
              }
            : p
        );
        
        // Persist the updated projects
        localStorage.setItem('kie_video_projects', JSON.stringify(updated));
        return updated;
      });

      if (job.status === 'processing' || job.status === 'pending') {
        // Continue polling with exponential backoff
        const delay = job.status === 'pending' ? 10000 : 5000;
        setTimeout(() => pollSegmentStatus(taskId, projectId, segmentId), delay);
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
            } else {
              toast({
                title: "Video Segment Ready",
                description: `Scene ${project.segments.find(s => s.id === segmentId)?.sceneNumber} has been completed successfully!`,
              });
            }
          }
          return prev;
        });
      } else if (job.status === 'failed') {
        toast({
          title: "Video Segment Failed",
          description: job.error || "Video generation failed. You can try refreshing or retrying the segment.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Polling error:', error);
      // Retry after delay on polling error
      setTimeout(() => pollSegmentStatus(taskId, projectId, segmentId), 15000);
    }
  };

  const getProjectStatus = (project: VideoProject): string => {
    if (!project.segments || project.segments.length === 0) return 'pending';
    
    const statuses = project.segments.map(s => s.status);
    
    if (statuses.every(s => s === 'completed')) return 'completed';
    if (statuses.some(s => s === 'failed')) return 'failed';
    if (statuses.some(s => s === 'processing')) return 'processing';
    return 'pending';
  };

  const getProjectProgress = (project: VideoProject): number => {
    if (!project.segments || project.segments.length === 0) return 0;
    
    const totalProgress = project.segments.reduce((sum, segment) => {
      if (segment.status === 'completed') return sum + 100;
      if (segment.status === 'processing') return sum + (segment.progress || 0);
      return sum;
    }, 0);
    
    return Math.round(totalProgress / project.segments.length);
  };

  const refreshSegmentStatus = async (project: VideoProject, segment: VideoSegment) => {
    if (!segment.jobId) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('kie-video', {
        body: {
          action: 'status',
          taskId: segment.jobId
        }
      });

      if (error) {
        toast({
          title: "Status Check Failed",
          description: error.message || "Failed to check segment status",
          variant: "destructive"
        });
        return;
      }

      // Update the segment status
      setProjects(prev => {
        const updated = prev.map(p => 
          p.id === project.id 
            ? {
                ...p,
                segments: p.segments.map(s => 
                  s.id === segment.id 
                    ? { 
                        ...s, 
                        status: data.status as 'pending' | 'processing' | 'completed' | 'failed', 
                        progress: data.progress || 0, 
                        outputUrl: data.videoUrl 
                      }
                    : s
                )
              }
            : p
        );
        
        // Persist the updated projects
        localStorage.setItem('kie_video_projects', JSON.stringify(updated));
        return updated;
      });

      toast({
        title: "Status Updated",
        description: `Scene ${segment.sceneNumber} status: ${data.status}`,
      });

      // Resume polling if still processing
      if (data.status === 'processing' || data.status === 'pending') {
        setTimeout(() => {
          pollSegmentStatus(segment.jobId!, project.id, segment.id);
        }, 5000);
      }
    } catch (error) {
      console.error('Error refreshing segment status:', error);
      toast({
        title: "Status Check Failed",
        description: "Failed to refresh segment status",
        variant: "destructive"
      });
    }
  };

  const refreshAllSegments = async (project: VideoProject) => {
    const segmentsWithJobs = project.segments.filter(s => s.jobId);
    
    for (const segment of segmentsWithJobs) {
      await refreshSegmentStatus(project, segment);
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const retryFailedSegments = async (project: VideoProject) => {
    const failedSegments = project.segments.filter(s => s.status === 'failed');
    
    if (failedSegments.length === 0) {
      toast({
        title: "No Failed Segments",
        description: "All segments are either completed or in progress.",
      });
      return;
    }

    setIsCreating(true);
    
    for (const segment of failedSegments) {
      try {
        // Get selected character for consistency
        const selectedCharacter = project.characterId 
          ? characters.find(c => c.id === project.characterId)
          : null;

        // Prepare reference images from character
        const referenceImageUrls = selectedCharacter?.appearanceImage 
          ? [selectedCharacter.appearanceImage] 
          : [];

        // Create enhanced prompt with character bible and consistency rules
        const characterBible = selectedCharacter ? `
CHARACTER BIBLE:
- Name: ${selectedCharacter.name}
- Appearance: ${selectedCharacter.description || 'As shown in reference image'}
- Personality: ${selectedCharacter.personality}
- Voice Style: ${selectedCharacter.voiceType}
${selectedCharacter.description ? `- Background: ${selectedCharacter.description}` : ''}

CONSISTENCY RULES:
- Keep the character's appearance identical across all scenes
- Maintain consistent lighting and visual style
- Use the same character model and features throughout
- Ensure facial features, hair, clothing style remain constant
- Apply consistent cinematographic style
${selectedCharacter.appearanceImage ? '- Use the provided reference image to maintain character appearance' : ''}

` : '';

        const enhancedPrompt = `${characterBible}Scene ${segment.sceneNumber} (${segment.timeRange}):

Visual Description: ${segment.description}

Dialogue/Content: "${segment.dialogue}"

${selectedCharacter ? `Featured Character: ${selectedCharacter.name} - ${selectedCharacter.description || 'As shown in reference image'}` : ''}

Create a cinematic video that captures both the visual elements and the message/dialogue described above. ${selectedCharacter ? 'Ensure the character appears consistently as described in the character bible above.' : ''} Focus on engaging cinematography that matches the scene's requirements.`.trim();

        const { data, error } = await supabase.functions.invoke('kie-video', {
          body: {
            action: 'create',
            prompt: enhancedPrompt,
            aspectRatio: project.aspectRatio as '16:9' | '9:16',
            model: 'veo3',
            enableFallback: true,
            seeds: project.consistencySettings?.lockSeed ? project.consistencySettings.globalSeed : undefined,
            referenceImageUrls: referenceImageUrls,
            characterId: project.characterId
          }
        });

        if (error) {
          console.error(`API error for segment ${segment.id}:`, error);
          throw new Error(error.message || 'Failed to retry video segment');
        }

        if (data?.taskId) {
          setProjects(prev => prev.map(p => 
            p.id === project.id 
              ? {
                  ...p,
                  segments: p.segments.map(s => 
                    s.id === segment.id 
                      ? { ...s, jobId: data.taskId, status: 'processing' as const }
                      : s
                  )
                }
              : p
          ));
          
          setTimeout(() => {
            pollSegmentStatus(data.taskId, project.id, segment.id);
          }, 5000);
        }
      } catch (segmentError) {
        console.error(`Error retrying segment ${segment.sceneNumber}:`, segmentError);
        toast({
          title: `Retry Failed: Scene ${segment.sceneNumber}`,
          description: segmentError instanceof Error ? segmentError.message : "Failed to retry video segment",
          variant: "destructive"
        });
      }
    }
    
    setIsCreating(false);
  };

  const stitchVideos = async (project: VideoProject) => {
    if (!project.segments || project.segments.length === 0) return;
    
    const completedSegments = project.segments
      .filter(s => s.status === 'completed' && s.outputUrl)
      .sort((a, b) => a.sceneNumber - b.sceneNumber);
    
    if (completedSegments.length < 2) {
      toast({
        title: "Need Multiple Segments",
        description: "Please wait until at least two segments are completed to stitch.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    toast({ 
      title: 'Stitching Started', 
      description: `Combining ${completedSegments.length} segments into a single video...` 
    });
    
    try {
      const urls = completedSegments.map(s => s.outputUrl!) as string[];
      console.log('Stitching videos in order:', urls);
      
      const blob = await stitchVideosLib(urls, (progress) => {
        console.log('Stitch progress:', progress, '%');
        // You could add progress UI here if needed
      });

      console.log('Stitching completed, creating object URL...');
      const objectUrl = URL.createObjectURL(blob);
      console.log('Object URL created:', objectUrl);

      // Update project with final stitched URL
      const stitchedProject: VideoProject = {
        ...project,
        isStitched: true,
        stitchedUrl: objectUrl,
        stitchedSegments: urls
      };

      setProjects(prev => prev.map(p => (p.id === project.id ? stitchedProject : p)));

      // Persist to localStorage (note: objectUrl won't survive page reloads)
      const updatedProjects = projects.map(p => (p.id === project.id ? stitchedProject : p));
      localStorage.setItem('kie_video_projects', JSON.stringify(updatedProjects));

      toast({ 
        title: 'Videos Successfully Stitched!', 
        description: `Combined ${completedSegments.length} segments into one video. Click "Watch Final Video" to view the result.` 
      });
      
    } catch (error) {
      console.error('Video stitching error:', error);
      toast({
        title: 'Stitching Failed',
        description: error instanceof Error ? error.message : 'Failed to stitch videos together.',
        variant: 'destructive'
      });
    } finally {
      setIsCreating(false);
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

            {/* Character Selection */}
            <div className="space-y-2">
              <Label>Character (Optional)</Label>
              <Select value={formData.characterId} onValueChange={(value) => setFormData(prev => ({ ...prev, characterId: value === 'none' ? '' : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a character for consistency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Character</SelectItem>
                  {characters.map(character => (
                    <SelectItem key={character.id} value={character.id}>
                      {character.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {characters.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Visit the Characters page to create AI avatars for consistent video generation.
                </p>
              )}
            </div>

            {/* Consistency Controls */}
            {formData.characterId && formData.characterId !== 'none' && (
              <div className="space-y-4 p-3 border border-border rounded-lg bg-muted/30">
                <h4 className="text-sm font-medium text-foreground">Consistency Controls</h4>
                
                <TooltipProvider>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Lock Seed</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <InfoIcon className="w-4 h-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="max-w-xs space-y-2">
                            <p className="font-medium">Lock Seed ensures visual consistency</p>
                            <p className="text-xs">When enabled with a character image, all video segments will use the same random seed and reference image, creating consistent visual style and character appearance across scenes.</p>
                            <p className="text-xs font-medium">Turn ON when: You want identical character appearance</p>
                            <p className="text-xs font-medium">Turn OFF when: You want more visual variety</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.lockSeed}
                      onChange={(e) => setFormData(prev => ({ ...prev, lockSeed: e.target.checked }))}
                      className="rounded"
                    />
                  </div>
                </TooltipProvider>

                {formData.lockSeed && (
                  <div className="space-y-2 p-2 bg-background/50 rounded border border-border/50">
                    <div className="flex items-center gap-2">
                      <Dices className="w-4 h-4 text-primary" />
                      <Label className="text-sm">Seed Value (Optional)</Label>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Auto-generated if empty"
                        value={formData.customSeed}
                        onChange={(e) => setFormData(prev => ({ ...prev, customSeed: e.target.value }))}
                        className="flex-1"
                        min="10000"
                        max="99999"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          customSeed: (Math.floor(Math.random() * 90000) + 10000).toString() 
                        }))}
                      >
                        <Dices className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Same seed = identical visual style. Leave empty for auto-generation.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Style Consistency</Label>
                  <Select value={formData.styleConsistency} onValueChange={(value) => setFormData(prev => ({ ...prev, styleConsistency: value as 'high' | 'medium' | 'low' }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High (Strictest matching)</SelectItem>
                      <SelectItem value="medium">Medium (Balanced)</SelectItem>
                      <SelectItem value="low">Low (More variation)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Segment Duration Controls */}
            <div className="space-y-4 p-3 border border-border rounded-lg bg-muted/30">
              <h4 className="text-sm font-medium text-foreground">Segment Duration Settings</h4>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Segment Length</Label>
                  <Select 
                    value={formData.segmentDuration} 
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      segmentDuration: value as '15' | '30' | 'custom' 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 seconds (Quick clips)</SelectItem>
                      <SelectItem value="30">30 seconds (Standard clips)</SelectItem>
                      <SelectItem value="custom">Custom duration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.segmentDuration === 'custom' && (
                  <div className="space-y-2">
                    <Label>Custom Duration (seconds)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={formData.customSegmentDuration}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          customSegmentDuration: Math.max(5, Math.min(120, parseInt(e.target.value) || 15))
                        }))}
                        min="5"
                        max="120"
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">seconds (5-120s)</span>
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• <strong>15 seconds:</strong> Perfect for social media, quick attention-grabbing content</p>
                  <p>• <strong>30 seconds:</strong> Ideal for detailed explanations and storytelling</p>
                  <p>• <strong>Custom:</strong> Set your own duration based on content requirements</p>
                </div>
              </div>
            </div>

            {/* Voice Selection */}
            <div className="space-y-2">
              <Label>Voice for Narration</Label>
              <Select value={formData.voice} onValueChange={(value) => setFormData(prev => ({ ...prev, voice: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alloy">Alloy (Balanced, neutral)</SelectItem>
                  <SelectItem value="echo">Echo (Male, clear)</SelectItem>
                  <SelectItem value="fable">Fable (British, warm)</SelectItem>
                  <SelectItem value="onyx">Onyx (Male, deep)</SelectItem>
                  <SelectItem value="nova">Nova (Female, energetic)</SelectItem>
                  <SelectItem value="shimmer">Shimmer (Female, soft)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This voice will be used consistently across all video segments
              </p>
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
                  const allCompleted = project.segments && project.segments.every(s => s.status === 'completed');
                  
                  return (
                    <div key={project.id} className="p-4 border border-border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-foreground">{project.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {project.aspectRatio} • {project.segments?.length || 0} segments • {new Date(project.createdAt).toLocaleDateString()}
                            {project.consistencySettings?.lockSeed && (
                              <span className="ml-2">
                                • Seed: {project.consistencySettings.globalSeed}
                              </span>
                            )}
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
                            {(projectStatus === 'processing' || projectStatus === 'pending') && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => refreshAllSegments(project)}
                              >
                                <RefreshCwIcon className="w-3 h-3 mr-1" />
                                Refresh All
                              </Button>
                            )}
                            {projectStatus === 'failed' && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => retryFailedSegments(project)}
                                disabled={isCreating}
                              >
                                <RefreshCwIcon className="w-3 h-3 mr-1" />
                                Retry Failed
                              </Button>
                            )}
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
                                  {segment.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">{segment.timeRange}</p>
                              <p className="text-xs">{segment.dialogue}</p>
                              
                              {segment.status === 'processing' && (
                                <Progress value={segment.progress} className="w-full h-1" />
                              )}
                              
                              <div className="flex gap-1">
                                {segment.status === 'completed' && segment.outputUrl && (
                                  <Button variant="outline" size="sm" asChild>
                                    <a href={segment.outputUrl} target="_blank" rel="noopener noreferrer">
                                      <PlayIcon className="w-3 h-3 mr-1" />
                                      Watch
                                    </a>
                                  </Button>
                                )}
                                
                                {segment.jobId && (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={() => refreshSegmentStatus(project, segment)}
                                  >
                                    <RefreshCwIcon className="w-3 h-3 mr-1" />
                                    Refresh
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stitching Options */}
                      {allCompleted && !project.isStitched && (
                        <div className="border-t border-border pt-3">
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => stitchVideos(project)}
                              disabled={isCreating}
                            >
                              <LinkIcon className="w-4 h-4 mr-2" />
                              {isCreating ? 'Stitching...' : 'Stitch Videos Together'}
                            </Button>
                            <Button variant="outline">Review All</Button>
                          </div>
                        </div>
                      )}

                      {/* Final Stitched Video */}
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

                      {project.isStitched && project.stitchedSegments && (
                        <div className="border-t border-border pt-3">
                          <p className="text-sm text-muted-foreground mb-2">Stitched video segments:</p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            {project.stitchedSegments.map((url, index) => (
                              <Button key={index} variant="outline" size="sm" asChild>
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                  <PlayIcon className="w-3 h-3 mr-1" />
                                  Segment {index + 1}
                                </a>
                              </Button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" asChild>
                              <a href={project.stitchedSegments[0]} target="_blank" rel="noopener noreferrer">
                                <PlayIcon className="w-4 h-4 mr-2" />
                                Play First Segment
                              </a>
                            </Button>
                            <Button 
                              variant="outline"
                              onClick={() => {
                                // Open all segments in new tabs for sequential viewing
                                project.stitchedSegments?.forEach((url, index) => {
                                  setTimeout(() => window.open(url, '_blank'), index * 500);
                                });
                              }}
                            >
                              <GridIcon className="w-4 h-4 mr-2" />
                              Play All
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