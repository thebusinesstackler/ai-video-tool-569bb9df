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
import { AudioGenerator } from '@/components/AudioGenerator';
import { VideoProcessingStatus } from '@/components/VideoProcessingStatus';
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
  VolumeIcon,
  WandIcon,
  TrashIcon,
  RotateCcwIcon,
  StopCircleIcon,
  AlertTriangleIcon,
  SparklesIcon,
  Loader2,
  Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLocation } from 'react-router-dom';

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

const MODEL_COSTS = {
  'wan-2.2': 0.1,
  'wan-2.5-t2v': 0.2,
  'wan-2.5-i2v': 0.5,
  'wan-2.5-a2v': 0.3,
  'hunyuan-video': 0.25,
  'seedream-v4': 0.4,
  'vidu': 0.3,
  'veo3': 0.4,
  'avatar-omni-human-1.5': 0.15, // Per-second pricing
  'infinitetalk': 0.25, // Per-second pricing for lip sync
  'wan-animate': 0.20, // Per-second pricing for WAN Animate
  'video-face-swap': 0.05 // Per-5-second pricing for driving video
};

const MODEL_NAMES = {
  'wan-2.2': 'Text-to-Video (WAN 2.2)',
  'wan-2.5-t2v': 'Enhanced Text-to-Video (WAN 2.5)',
  'wan-2.5-i2v': 'Image-to-Video (Alibaba WAN 2.5) - Requires Image + Prompt',
  'wan-2.5-a2v': 'Audio-to-Video (Alibaba WAN 2.5)',
  'hunyuan-video': 'HunyuanVideo (Tencent) - Prompt Based',
  'seedream-v4': 'Seedream V4 (Image-to-Video) - Requires Image + Prompt',
  'vidu': 'VIDU (Multimodal) - Prompt Based', 
  'veo3': 'VEO3 (Google) - Prompt Based',
  'avatar-omni-human-1.5': '🎤 Talking Avatar with Lip Sync (ByteDance)',
  'infinitetalk': '🗣️ InfiniteTalk - AI Voiceover + Lip Sync',
  'wan-animate': '🎬 WAN Animate - Character Animation with Lip Sync',
  'video-face-swap': '🎭 Video Face Swap - Upload Driving Video + Face'
};

const MODEL_DURATIONS = {
  'wan-2.2': [5, 8], // Limited by API
  'wan-2.5-t2v': [5, 8, 10], // Supports 10 seconds
  'wan-2.5-i2v': [5, 8, 10], // Supports 10 seconds
  'wan-2.5-a2v': [5, 8, 10], // Supports 10 seconds
  'hunyuan-video': [5, 8], // Conservative default
  'seedream-v4': [5, 8], // Conservative default
  'vidu': [5, 8], // Conservative default
  'veo3': [5, 8], // Conservative default
  'avatar-omni-human-1.5': [5, 8, 10], // Lip sync model
  'infinitetalk': [5, 8, 10, 15], // Extended durations for conversations
  'wan-animate': [5, 8, 10], // Character animation
  'video-face-swap': [5, 10, 15, 30, 60] // Supports longer videos up to 10 minutes
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
  const [showAudioGenerator, setShowAudioGenerator] = useState(false);
  const [scriptSegments, setScriptSegments] = useState<any[]>([]);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isCreatingMultipleVideos, setIsCreatingMultipleVideos] = useState(false);
  const { toast } = useToast();
  const location = useLocation();

  // Get available durations for the selected model
  const getAvailableDurations = (modelType: keyof typeof MODEL_COSTS): number[] => {
    return MODEL_DURATIONS[modelType] || [5, 8];
  };

  // Handle model change and adjust duration if necessary
  const handleModelChange = (newModel: keyof typeof MODEL_COSTS) => {
    const availableDurations = getAvailableDurations(newModel);
    const currentDuration = parseInt(formData.segmentDuration);
    
    // If current duration is not available for the new model, select the first available duration
    const newDuration = availableDurations.includes(currentDuration) 
      ? formData.segmentDuration 
      : availableDurations[0].toString();
    
    setFormData({
      ...formData,
      modelType: newModel,
      segmentDuration: newDuration
    });
  };
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [sourceAudio, setSourceAudio] = useState<File | null>(null);
  const [characters, setCharacters] = useState<any[]>([]);
  const [sourceVideo, setSourceVideo] = useState<File | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [segmentCountdowns, setSegmentCountdowns] = useState<{[key: string]: number}>({});
  const [savedScripts, setSavedScripts] = useState<any[]>([]);
  const [selectedScript, setSelectedScript] = useState<string>('');

  useEffect(() => {
    loadProjects();
    loadCharacters();
    loadSavedScripts();
  }, []);

  // Countdown timer for pending segments
  useEffect(() => {
    const interval = setInterval(() => {
      setSegmentCountdowns(prev => {
        const updated = { ...prev };
        let hasChanges = false;
        
        projects.forEach(project => {
          project.segments?.forEach(segment => {
            if (segment.status === 'pending') {
              // Estimate 2-5 minutes processing time per segment
              const createdTime = new Date(project.created_at).getTime();
              const now = Date.now();
              const elapsedMinutes = (now - createdTime) / (1000 * 60);
              const estimatedWaitTime = Math.max(0, 3 - elapsedMinutes); // 3 minute average wait
              const remainingSeconds = Math.floor(estimatedWaitTime * 60);
              
              if (remainingSeconds !== prev[segment.id]) {
                updated[segment.id] = remainingSeconds;
                hasChanges = true;
              }
            } else if (prev[segment.id] !== undefined) {
              delete updated[segment.id];
              hasChanges = true;
            }
          });
        });
        
        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [projects]);

  // Load project data into form when editing
  const loadProjectIntoForm = (project: VideoProject) => {
    setFormData({
      title: project.title,
      script: project.script,
      modelType: project.model_type as keyof typeof MODEL_COSTS,
      aspectRatio: project.aspect_ratio,
      duration: project.total_duration,
      characterId: project.character_id || 'none',
      lockSeed: project.consistency_settings?.lockSeed || false,
      customSeed: project.consistency_settings?.customSeed || '',
      voice: project.voice_settings?.voice || 'alloy',
      segmentDuration: project.segments?.[0]?.timeRange?.includes('0:10') ? '10' : 
                       project.segments?.[0]?.timeRange?.includes('0:08') ? '8' : '5'
    });
    
    // Set source files if they exist
    if (project.source_image_url) {
      // Note: We can't recreate File objects from URLs, but we can show the URL exists
      console.log('Project has source image:', project.source_image_url);
    }
    if (project.source_audio_url) {
      console.log('Project has source audio:', project.source_audio_url);
    }
  };

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

  const loadSavedScripts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading scripts:', error);
        return;
      }

      setSavedScripts(data || []);
    } catch (error) {
      console.error('Error loading scripts:', error);
    }
  };

  const handleLoadScript = (scriptId: string) => {
    const script = savedScripts.find(s => s.id === scriptId);
    if (!script) return;

    setFormData(prev => ({
      ...prev,
      title: script.title,
      script: script.content,
      duration: script.duration || 60
    }));

    // Load segments if available
    if (script.segments && Array.isArray(script.segments) && script.segments.length > 0) {
      setScriptSegments(script.segments);
      setCurrentSegmentIndex(0);
      
      toast({
        title: "Script Loaded",
        description: `Loaded "${script.title}" with ${script.segments.length} segments.`,
      });
    } else {
      toast({
        title: "Script Loaded",
        description: `Loaded "${script.title}".`,
      });
    }
  };

  // Handle incoming script data from script generator
  useEffect(() => {
    if (location.state?.scriptData) {
      const { segments, params, audioUrl } = location.state.scriptData;
      setScriptSegments(segments);
      setCurrentSegmentIndex(0);
      
      // Pre-fill form with first segment
      if (segments.length > 0) {
        setFormData(prev => ({
          ...prev,
          title: `${params.topic} - Segment 1`,
          script: segments[0].script,
          voice: 'alloy' // Default voice
        }));
      }
      
      toast({
        title: "Script Loaded",
        description: `Ready to create ${segments.length} video segments.`,
      });
    }
  }, [location.state]);

  const handleGenerateAllSegments = async () => {
    if (scriptSegments.length === 0 || isCreatingMultipleVideos) return;
    
    setIsCreatingMultipleVideos(true);
    
    try {
      for (let i = currentSegmentIndex; i < scriptSegments.length; i++) {
        const segment = scriptSegments[i];
        
        // Create a project for this segment
        const segmentTitle = `${formData.title.split(' - Segment')[0]} - Segment ${i + 1}`;
        
        // Update form data for this segment
        setFormData(prev => ({
          ...prev,
          title: segmentTitle,
          script: segment.script
        }));
        
        // Create the video with the updated form data
        await handleCreateVideo();
        
        toast({
          title: `Segment ${i + 1} Created`,
          description: `Processing segment ${i + 1} of ${scriptSegments.length}`,
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Reset everything
      setScriptSegments([]);
      setCurrentSegmentIndex(0);
      setFormData(prev => ({
        ...prev,
        title: '',
        script: ''
      }));
      
      loadProjects();
      
      toast({
        title: "All Segments Created",
        description: "All video segments have been created successfully.",
      });
    } catch (error) {
      console.error('Error generating all segments:', error);
      toast({
        title: "Error",
        description: "Failed to generate all segments.",
        variant: "destructive"
      });
    } finally {
      setIsCreatingMultipleVideos(false);
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
    
    // Split the script into scene blocks - more flexible patterns
    let sceneBlocks = script.split(/(?=Scene \d+)/i).filter(block => block.trim());
    
    // If no "Scene X" format found, try alternative patterns
    if (sceneBlocks.length <= 1) {
      // Try splitting by numbers followed by periods or colons
      sceneBlocks = script.split(/(?=^\d+[\.\:]\s)/m).filter(block => block.trim());
    }
    
    // If still no blocks found, treat the entire script as one scene
    if (sceneBlocks.length <= 1 && script.trim()) {
      sceneBlocks = [script.trim()];
    }
    
    for (let i = 0; i < sceneBlocks.length; i++) {
      const block = sceneBlocks[i].trim();
      if (!block) continue;
      
      // Extract scene header - more flexible patterns
      let sceneHeaderMatch = block.match(/Scene (\d+) \(([^)]+)\)/i);
      
      // Try alternative patterns
      if (!sceneHeaderMatch) {
        sceneHeaderMatch = block.match(/Scene (\d+)[\:\-\s]*(.{0,20})/i);
      }
      if (!sceneHeaderMatch) {
        sceneHeaderMatch = block.match(/(\d+)[\.\:\)\-\s]+(.{0,20})/);
      }
      
      // If no pattern found, create a default scene
      if (!sceneHeaderMatch) {
        sceneHeaderMatch = [`Scene ${i + 1}`, `${i + 1}`, `0:${String(i * 15).padStart(2, '0')}-0:${String((i + 1) * 15).padStart(2, '0')}`];
      }
      
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
        // Remove various scene header patterns from the beginning
        dialogue = block
          .replace(/^Scene \d+ \([^)]+\):?\s*/i, '')
          .replace(/^Scene \d+[\:\-\s]*/i, '')
          .replace(/^\d+[\.\:\)\-\s]+/i, '')
          .trim();
      }
      
      // Clean up the dialogue/description to remove timestamps and formatting
      const cleanDialogue = (dialogue.trim() || block.trim() || `Scene ${i + 1} content`)
        .replace(/\(\d+:\d+[-–—]\d+:\d+\)/g, '') // Remove (0:00-0:10) patterns
        .replace(/\d+:\d+[-–—]\d+:\d+/g, '') // Remove 0:00-0:10 patterns
        .replace(/[-–—]{2,}/g, '') // Remove long dashes
        .replace(/Scene \d+\s*[\(\[]?[^\)\]]*[\)\]]?\s*:?\s*/gi, '') // Remove Scene X markers
        .replace(/^\s*\d+[\.\:\)\-]\s*/gm, '') // Remove leading numbers with punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      const sceneNumber = parseInt(sceneNum, 10) || (i + 1);
      const description = visuals.trim() || `Scene ${sceneNumber} visuals`;
      
      segments.push({
        id: `segment-${Date.now()}-${i}`,
        sceneNumber: sceneNumber,
        timeRange: timeRange,
        description: description,
        dialogue: cleanDialogue,
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

    // Enhanced validation for all models
    const needsImageValidation = ['wan-2.5-i2v', 'seedream-v4', 'avatar-omni-human-1.5', 'infinitetalk', 'wan-animate', 'video-face-swap'].includes(formData.modelType);
    const needsAudioValidation = ['avatar-omni-human-1.5', 'wan-2.5-a2v', 'infinitetalk', 'wan-animate'].includes(formData.modelType);
    const needsVideoValidation = ['video-face-swap'].includes(formData.modelType);
    const supportsImageValidation = ['wan-2.5-i2v', 'seedream-v4', 'hunyuan-video', 'vidu', 'veo3', 'avatar-omni-human-1.5', 'infinitetalk', 'wan-animate', 'video-face-swap'].includes(formData.modelType);
    const supportsAudioValidation = ['avatar-omni-human-1.5', 'wan-2.5-a2v', 'wan-2.5-i2v', 'infinitetalk', 'wan-animate'].includes(formData.modelType);

    if (needsVideoValidation && !sourceVideo) {
      toast({
        title: "Driving Video Required",
        description: `The ${MODEL_NAMES[formData.modelType]} model requires a driving video.`,
        variant: "destructive"
      });
      return;
    }

    if (needsImageValidation && !sourceImage && (!selectedCharacter || selectedCharacter === 'upload-new')) {
      toast({
        title: "Image Required",
        description: `The ${MODEL_NAMES[formData.modelType]} model requires a source image or character selection.`,
        variant: "destructive"
      });
      return;
    }

    if (needsAudioValidation && !sourceAudio) {
      toast({
        title: "Image Required",
        description: `The ${MODEL_NAMES[formData.modelType]} model requires a source image.`,
        variant: "destructive"
      });
      return;
    }

    if (needsAudio && !sourceAudio) {
      const modelName = MODEL_NAMES[formData.modelType];
      toast({
        title: "Audio Required", 
        description: formData.modelType === 'avatar-omni-human-1.5' 
          ? "The Avatar Omni Human model requires audio to animate the avatar's speech."
          : `The ${modelName} model requires audio input.`,
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
        throw new Error(`No valid scenes found in script. Please format your script with one of these formats:

Format 1: Scene 1 (0:00-0:15): [description]
Format 2: Scene 1: [description]  
Format 3: 1. [description]
Format 4: 1: [description]

Or simply write your content and it will be treated as one scene.`);
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

          console.log('Creating video segment:', {
            model: formData.modelType,
            prompt: enhancedPrompt,
            aspectRatio: formData.aspectRatio,
            duration: parseInt(formData.segmentDuration),
            imageUrl: imageUrl || 'none',
            audioUrl: audioUrl || 'none'
          });

          if (formData.modelType === 'wan-2.5-i2v' || formData.modelType === 'avatar-omni-human-1.5') {
            if (imageUrl) {
              requestBody.imageUrls = [imageUrl];
            }
            if (audioUrl) {
              requestBody.audioUrl = audioUrl;
            }
          } else if (formData.modelType === 'wan-2.5-a2v') {
            if (audioUrl) {
              requestBody.audioUrl = audioUrl;
            }
          } else if (formData.modelType === 'infinitetalk' || formData.modelType === 'wan-animate') {
            // Both InfiniteTalk and WAN Animate require image and audio
            if (imageUrl) {
              requestBody.imageUrls = [imageUrl];
            }
            if (audioUrl) {
              requestBody.audioUrl = audioUrl;
            }
          } else if (formData.modelType === 'video-face-swap') {
            // Video Face Swap requires both video and face image
            if (imageUrl) {
              requestBody.imageUrls = [imageUrl];
            }
            // Note: Video URL handling will be added when video upload is implemented
          } else if (['hunyuan-video', 'vidu', 'veo3', 'seedream-v4'].includes(formData.modelType)) {
            if (selectedCharacter && selectedCharacter !== 'upload-new') {
              // Use character image
              const character = characters.find(c => c.id === selectedCharacter);
              if (character?.reference_images?.[0]) {
                requestBody.imageUrls = [character.reference_images[0]];
              }
            } else if (imageUrl) {
              requestBody.imageUrls = [imageUrl];
            }
          }

          if (formData.lockSeed) {
            requestBody.seeds = parseInt(formData.customSeed) || Math.floor(Math.random() * 2147483647);
          }

          console.log('Sending request to wavespeed-video:', requestBody);

          // Create signed URLs for private storage files if needed
          if (requestBody.imageUrls && requestBody.imageUrls.length > 0) {
            const signedImageUrls = [];
            for (const imageUrl of requestBody.imageUrls) {
              if (imageUrl.includes('supabase.co') && imageUrl.includes('project-files')) {
                try {
                  // Extract the file path from the URL
                  const urlParts = imageUrl.split('/storage/v1/object/public/project-files/');
                  if (urlParts.length > 1) {
                    const filePath = urlParts[1];
                    const { data: signedData, error: signedError } = await supabase.storage
                      .from('project-files')
                      .createSignedUrl(filePath, 7200); // 2 hours expiry
                    
                    if (signedError) throw signedError;
                    signedImageUrls.push(signedData.signedUrl);
                  } else {
                    signedImageUrls.push(imageUrl);
                  }
                } catch (error) {
                  console.error('Error creating signed image URL:', error);
                  signedImageUrls.push(imageUrl);
                }
              } else {
                signedImageUrls.push(imageUrl);
              }
            }
            requestBody.imageUrls = signedImageUrls;
          }

          // Create signed URL for audio if needed
          if (requestBody.audioUrl && requestBody.audioUrl.includes('supabase.co') && requestBody.audioUrl.includes('project-files')) {
            try {
              const urlParts = requestBody.audioUrl.split('/storage/v1/object/public/project-files/');
              if (urlParts.length > 1) {
                const filePath = urlParts[1];
                const { data: signedData, error: signedError } = await supabase.storage
                  .from('project-files')
                  .createSignedUrl(filePath, 7200); // 2 hours expiry
                
                if (signedError) throw signedError;
                requestBody.audioUrl = signedData.signedUrl;
              }
            } catch (error) {
              console.error('Error creating signed audio URL:', error);
            }
          }

          console.log('Sending request to wavespeed-video with signed URLs:', requestBody);

          const { data, error } = await supabase.functions.invoke('wavespeed-video', {
            body: requestBody
          });

          console.log('Wavespeed response:', { data, error });

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
      setSourceVideo(null);
      
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

      // Get fresh project data to avoid stale closure issues
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

      // Continue polling if still processing
      if (data.status === 'processing' || data.status === 'pending') {
        setTimeout(() => {
          pollSegmentStatus(taskId, projectId, segmentId);
        }, 5000);
      } else if (data.status === 'completed') {
        // Download and store the video locally when completed
        if (data.videoUrl) {
          downloadAndStoreVideo(data.videoUrl, projectId, segmentId);
        }
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
    const costPerUnit = MODEL_COSTS[formData.modelType] || 0.1;
    
    if (formData.modelType === 'avatar-omni-human-1.5') {
      // Per-second pricing for avatar model
      const totalDuration = segments.length * parseInt(formData.segmentDuration || '5');
      return totalDuration * costPerUnit;
    } else {
      // Per-segment pricing for other models
      return segments.length * costPerUnit;
    }
  };

  const handleRefreshSegment = (segmentId: string) => {
    // Find the project and segment
    for (const project of projects) {
      const segment = project.segments.find(s => s.id === segmentId);
      if (segment?.jobId) {
        pollSegmentStatus(segment.jobId, project.id, segmentId);
        break;
      }
    }
  };

  const downloadAndStoreVideo = async (videoUrl: string, projectId: string, segmentId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Download the video from external URL
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error('Failed to download video');
      
      const videoBlob = await response.blob();
      // Use user ID as the first folder level for RLS policy matching
      const fileName = `${user.id}/videos/${projectId}/${segmentId}-${Date.now()}.mp4`;
      
      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(fileName, videoBlob, {
          contentType: 'video/mp4',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get the public URL (we'll create signed URLs when needed for viewing)
      const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName);

      // Update the project with local storage URL
      setProjects(prev => {
        const updatedProjects = prev.map(project => {
          if (project.id === projectId) {
            const updatedSegments = project.segments.map(segment => 
              segment.id === segmentId 
                ? { ...segment, localVideoUrl: publicUrl }
                : segment
            );
            
            // Update database
            supabase
              .from('projects')
              .update({ segments: updatedSegments as any })
              .eq('id', projectId);
            
            return { ...project, segments: updatedSegments };
          }
          return project;
        });
        return updatedProjects;
      });

      toast({
        title: "Video Stored Locally",
        description: "Video has been saved to your storage and is ready for viewing!",
      });

      console.log('Video stored locally:', publicUrl);
    } catch (error) {
      console.error('Error storing video locally:', error);
      toast({
        title: "Storage Failed",
        description: "Failed to store video locally, but external URL is still available.",
        variant: "destructive"
      });
    }
  };

  const handlePlayVideo = (url: string) => {
    // Check if it's a local storage URL, if so create signed URL for access
    if (url.includes('supabase')) {
      // Create signed URL for private bucket access
      supabase.storage
        .from('project-files')
        .createSignedUrl(url.split('/').slice(-3).join('/'), 3600) // 1 hour expiry
        .then(({ data }) => {
          if (data?.signedUrl) {
            window.open(data.signedUrl, '_blank');
          } else {
            window.open(url, '_blank');
          }
        });
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDownloadVideo = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  const handleResetSegment = async (projectId: string, segmentId: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const updatedSegments = project.segments.map(s => 
        s.id === segmentId 
          ? { ...s, status: 'pending' as const, progress: 0, jobId: undefined, outputUrl: undefined, error: undefined }
          : s
      );

      await supabase
        .from('projects')
        .update({ segments: updatedSegments as any })
        .eq('id', projectId);
      
      setProjects(prev => prev.map(p => 
        p.id === projectId 
          ? { ...p, segments: updatedSegments }
          : p
      ));

      toast({
        title: "Segment Reset",
        description: "Video segment has been reset and can be retried.",
      });
    } catch (error) {
      console.error('Error resetting segment:', error);
      toast({
        title: "Reset Failed",
        description: "Failed to reset the segment.",
        variant: "destructive"
      });
    }
  };

  const handleRetryFailedSegments = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const failedSegments = project.segments.filter(s => s.status === 'failed' || s.status === 'pending');
    
    for (const segment of failedSegments) {
      await handleResetSegment(projectId, segment.id);
    }

    toast({
      title: "Segments Reset",
      description: `${failedSegments.length} segments have been reset for retry.`,
    });
  };

  const handleCleanupStuckSegments = async () => {
    const stuckProjects = projects.filter(project => {
      const hasStuck = project.segments.some(segment => {
        const updatedAt = new Date(project.updated_at);
        const now = new Date();
        const timeDiff = now.getTime() - updatedAt.getTime();
        const minutes = timeDiff / (1000 * 60);
        
        return (segment.status === 'pending' || segment.status === 'processing') && minutes > 10;
      });
      return hasStuck;
    });

    for (const project of stuckProjects) {
      const updatedSegments = project.segments.map(segment => {
        const updatedAt = new Date(project.updated_at);
        const now = new Date();
        const timeDiff = now.getTime() - updatedAt.getTime();
        const minutes = timeDiff / (1000 * 60);
        
        if ((segment.status === 'pending' || segment.status === 'processing') && minutes > 10) {
          return { ...segment, status: 'failed' as const, error: 'Timeout: Segment stuck for too long' };
        }
        return segment;
      });

      await supabase
        .from('projects')
        .update({ segments: updatedSegments as any })
        .eq('id', project.id);
      
      setProjects(prev => prev.map(p => 
        p.id === project.id 
          ? { ...p, segments: updatedSegments }
          : p
      ));
    }

    if (stuckProjects.length > 0) {
      toast({
        title: "Cleanup Complete",
        description: `${stuckProjects.length} stuck projects have been cleaned up.`,
      });
    } else {
      toast({
        title: "No Stuck Segments",
        description: "No segments found that are stuck or timed out.",
      });
    }
  };

  const formatCountdown = (seconds: number): string => {
    if (seconds <= 0) return "Starting soon...";
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `~${minutes}m ${remainingSeconds}s remaining`;
    } else {
      return `~${remainingSeconds}s remaining`;
    }
  };

  const estimatedCost = calculateEstimatedCost();

  // Model capability helpers
  const supportsImage = formData.modelType === 'wan-2.5-i2v' || 
                       formData.modelType === 'avatar-omni-human-1.5' || 
                       formData.modelType === 'seedream-v4' ||
                       formData.modelType === 'hunyuan-video' ||
                       formData.modelType === 'vidu' ||
                       formData.modelType === 'veo3' ||
                       formData.modelType === 'infinitetalk' ||
                       formData.modelType === 'wan-animate' ||
                       formData.modelType === 'video-face-swap';
  
  const needsImage = formData.modelType === 'wan-2.5-i2v' || 
                    formData.modelType === 'avatar-omni-human-1.5' || 
                    formData.modelType === 'seedream-v4' ||
                    formData.modelType === 'infinitetalk' ||
                    formData.modelType === 'wan-animate' ||
                    formData.modelType === 'video-face-swap';
  
  const supportsAudio = formData.modelType === 'wan-2.5-a2v' || 
                       formData.modelType === 'avatar-omni-human-1.5' ||
                       formData.modelType === 'wan-2.5-i2v' ||
                       formData.modelType === 'infinitetalk' ||
                       formData.modelType === 'wan-animate';
  
  const needsAudio = formData.modelType === 'avatar-omni-human-1.5' || 
                    formData.modelType === 'wan-2.5-a2v' ||
                    formData.modelType === 'infinitetalk' ||
                    formData.modelType === 'wan-animate';

  const supportsVideo = formData.modelType === 'video-face-swap';
  const needsVideo = formData.modelType === 'video-face-swap';
  
  const hasLipSync = formData.modelType === 'avatar-omni-human-1.5' ||
                    formData.modelType === 'infinitetalk' ||
                    formData.modelType === 'wan-animate';

  // Determine if this model uses prompts vs scripts
  const usesPrompt = formData.modelType === 'wan-2.5-i2v' || 
                     formData.modelType === 'seedream-v4' ||
                     formData.modelType === 'hunyuan-video' ||
                     formData.modelType === 'vidu' ||
                     formData.modelType === 'veo3';
                     
  const scriptFieldLabel = usesPrompt ? "Prompt" : "Video Script";
  const scriptPlaceholder = usesPrompt 
    ? `A confident woman in her 40s stands on a stage with a microphone. The background shows a large LED screen with abstract visuals. She smiles and begins speaking to the audience: "Good evening everyone. Tonight, I want to share three powerful lessons about leadership and innovation." Her lip movements match her voice, and she uses expressive hand gestures while speaking.`
    : `Scene 1 (0:00–0:15):
Visuals: A confident woman in her 40s stands on a stage with a microphone...
Dialogue: Good evening everyone. Tonight, I want to share the power of clinical studies...`;

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
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusIcon className="w-5 h-5" />
                {formData.title ? `Edit: ${formData.title}` : 'Create New Video Project'}
              </div>
              {formData.title && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
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
                    setSourceVideo(null);
                  }}
                >
                  New Project
                </Button>
              )}
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

                {savedScripts.length > 0 && (
                  <div>
                    <Label htmlFor="savedScript">Load Saved Script</Label>
                    <Select value={selectedScript} onValueChange={(value) => {
                      setSelectedScript(value);
                      if (value) {
                        handleLoadScript(value);
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a saved script..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {savedScripts.map((script) => (
                          <SelectItem key={script.id} value={script.id}>
                            <div className="flex items-center gap-2">
                              <SparklesIcon className="w-4 h-4 text-primary" />
                              <div>
                                <div className="font-medium">{script.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  {script.duration}s • {script.style} • {new Date(script.created_at).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label htmlFor="modelType">AI Model</Label>
                  <Select value={formData.modelType} onValueChange={(value) => handleModelChange(value as keyof typeof MODEL_COSTS)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MODEL_NAMES).map(([value, name]) => (
                        <SelectItem key={value} value={value}>
                          {name} - ${MODEL_COSTS[value as keyof typeof MODEL_COSTS]}/{['avatar-omni-human-1.5', 'infinitetalk', 'wan-animate'].includes(value) ? 'second' : value === 'video-face-swap' ? '5-second' : 'segment'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasLipSync && (
                    <p className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1">
                      🎤 This model generates voiceover with synchronized lip movements
                    </p>
                  )}
                  {needsVideo && (
                    <p className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded mt-1">
                      🎭 Upload a driving video + face image to create face-swapped content
                    </p>
                  )}
                </div>

                {/* Character Selection - Show when model needs images */}
                {needsImage && characters.length > 0 && (
                  <div>
                    <Label htmlFor="character">Use Character Image</Label>
                    <Select value={selectedCharacter} onValueChange={(value) => {
                      setSelectedCharacter(value);
                      if (value && value !== 'upload-new') {
                        const character = characters.find(c => c.id === value);
                        if (character?.reference_images?.[0]) {
                          // Convert character image URL to a File-like object for consistency
                          const imageUrl = character.reference_images[0];
                          setFormData(prev => ({...prev, characterId: value}));
                          // Clear any previously uploaded file since we're using character image
                          setSourceImage(null);
                        }
                      } else if (value === 'upload-new') {
                        setFormData(prev => ({...prev, characterId: ''}));
                      }
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a character or upload new image" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upload-new">
                          📁 Upload New Image
                        </SelectItem>
                        {characters.map((character) => (
                          <SelectItem key={character.id} value={character.id}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">👤</span>
                              <div>
                                <div className="font-medium">{character.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {character.reference_images?.length || 0} images available
                                </div>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCharacter && selectedCharacter !== 'upload-new' && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                        ✅ Using character image from {characters.find(c => c.id === selectedCharacter)?.name}
                      </div>
                    )}
                  </div>
                )}

                {/* Audio Generator Integration */}
                {(supportsAudio || showAudioGenerator) && (
                  <div className="col-span-full">
                    <div className="flex items-center justify-between mb-4">
                      <Label>Audio Generation</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAudioGenerator(!showAudioGenerator)}
                      >
                        <WandIcon className="w-4 h-4 mr-2" />
                        {showAudioGenerator ? 'Hide' : 'Show'} Audio Generator
                      </Button>
                    </div>
                    {showAudioGenerator && (
                      <AudioGenerator
                        onAudioGenerated={(url, file) => {
                          setSourceAudio(file);
                          // Auto-hide the generator after successful generation
                          setShowAudioGenerator(false);
                          toast({
                            title: "Audio Generated & Applied",
                            description: `Generated audio "${file.name}" has been automatically applied to your project.`,
                          });
                        }}
                        text={formData.script}
                        voice={formData.voice}
                        disabled={isCreating}
                      />
                    )}
                  </div>
                )}

                {/* Dynamic file uploads based on model capabilities */}
                {(supportsImage && (needsImage || sourceImage) && (selectedCharacter === 'upload-new' || !selectedCharacter || characters.length === 0)) && (
                  <div className="col-span-full">
                    <Label htmlFor="sourceImage" className="flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Source Image {needsImage ? '(Required)' : '(Optional)'}
                    </Label>
                    {needsImage && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {formData.modelType === 'avatar-omni-human-1.5' 
                          ? 'Upload a clear portrait photo for the talking avatar' 
                          : formData.modelType === 'infinitetalk' || formData.modelType === 'wan-animate'
                          ? 'Upload a character portrait for lip sync animation'
                          : formData.modelType === 'video-face-swap'
                          ? 'Upload the face image you want to swap into the driving video'
                          : formData.modelType === 'seedream-v4'
                          ? 'Upload a reference image to enhance the video generation'
                          : 'Upload an image to convert into video'
                        }
                      </p>
                    )}
                    <Input
                      id="sourceImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        setSourceImage(e.target.files?.[0] || null);
                        // Clear character selection when uploading new image
                        setSelectedCharacter('upload-new');
                        setFormData(prev => ({...prev, characterId: ''}));
                      }}
                      className="cursor-pointer"
                    />
                    {sourceImage && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {sourceImage.name}
                      </p>
                    )}
                  </div>
                )}

                {(supportsAudio && (needsAudio || sourceAudio)) && (
                  <div className="col-span-full">
                    <Label htmlFor="sourceAudio" className="flex items-center gap-2">
                      <VolumeIcon className="w-4 h-4" />
                      Source Audio {needsAudio ? '(Required)' : '(Optional)'}
                      {sourceAudio && <Badge variant="secondary" className="ml-2">Auto-filled</Badge>}
                    </Label>
                    {needsAudio && (
                      <p className="text-xs text-muted-foreground mb-2">
                        {formData.modelType === 'avatar-omni-human-1.5' 
                          ? 'Upload speech audio to animate the avatar\'s lip movements' 
                          : formData.modelType === 'infinitetalk' || formData.modelType === 'wan-animate'
                          ? 'Upload speech audio for AI voiceover with perfect lip synchronization'
                          : 'Upload audio to generate video synchronized with the sound'
                        }
                      </p>
                    )}
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
                )}

                {(formData.modelType === 'wan-2.5-i2v' || formData.modelType === 'avatar-omni-human-1.5') && (
                  <>
                    <div>
                      <Label htmlFor="sourceImage" className="flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" />
                        {formData.modelType === 'avatar-omni-human-1.5' ? 'Portrait Image (Required)' : 'Source Image (Required)'}
                      </Label>
                      {formData.modelType === 'avatar-omni-human-1.5' && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Upload a clear portrait/headshot image for creating a talking avatar
                        </p>
                      )}
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
                        {formData.modelType === 'avatar-omni-human-1.5' ? 'Audio Track (Required)' : 'Audio Track (Optional)'}
                       </Label>
                         {hasLipSync && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Upload speech audio to animate with perfect lip synchronization
                          </p>
                        )}
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
                      {getAvailableDurations(formData.modelType).map((duration) => (
                        <SelectItem key={duration} value={duration.toString()}>
                          {duration} seconds
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.modelType === 'wan-2.2' 
                      ? 'WAN 2.2 is limited to 5 and 8 seconds' 
                      : getAvailableDurations(formData.modelType).includes(10) 
                        ? 'This model supports up to 10 seconds'
                        : 'Available durations for this model'
                    }
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Script Segments Info */}
                {scriptSegments.length > 0 && (
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <SparklesIcon className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Script Segments</span>
                      </div>
                      <Badge variant="secondary">
                        {currentSegmentIndex + 1} of {scriptSegments.length}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      Creating video segments from your generated script.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleGenerateAllSegments}
                        disabled={isCreatingMultipleVideos}
                        size="sm"
                        variant="secondary"
                      >
                        {isCreatingMultipleVideos ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            Creating All...
                          </>
                        ) : (
                          <>
                            <Zap className="w-3 h-3 mr-1" />
                            Generate All Segments
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <Label htmlFor="script">{scriptFieldLabel}</Label>
                  {usesPrompt && (
                    <p className="text-xs text-muted-foreground mb-2">
                      Describe the video scene you want to generate in detail. Focus on visuals, actions, and dialogue.
                    </p>
                  )}
                  <Textarea
                    id="script"
                    value={formData.script}
                    onChange={(e) => setFormData({...formData, script: e.target.value})}
                    placeholder={scriptPlaceholder}
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
                        {['avatar-omni-human-1.5', 'infinitetalk', 'wan-animate'].includes(formData.modelType) ? (
                          `(${parseScriptIntoSegments(formData.script).length * parseInt(formData.segmentDuration || '5')} seconds × $${MODEL_COSTS[formData.modelType]})`
                        ) : formData.modelType === 'video-face-swap' ? (
                          `(${parseScriptIntoSegments(formData.script).length * Math.ceil(parseInt(formData.segmentDuration || '5') / 5)} units × $${MODEL_COSTS[formData.modelType]} per 5s)`
                        ) : (
                          `(${parseScriptIntoSegments(formData.script).length} segments × $${MODEL_COSTS[formData.modelType]})`
                        )}
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
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GridIcon className="w-5 h-5" />
                Your Video Projects
              </CardTitle>
              {projects.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCleanupStuckSegments}
                  className="flex items-center gap-2"
                >
                  <AlertTriangleIcon className="w-4 h-4" />
                  Cleanup Stuck Segments
                </Button>
              )}
            </div>
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
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => loadProjectIntoForm(project)}
                          >
                            Edit
                          </Button>
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
                         <div className="flex items-center gap-1">
                           {(projectStatus === 'failed' || projectStatus === 'pending') && (
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleRetryFailedSegments(project.id)}
                               className="flex items-center gap-1"
                             >
                               <RotateCcwIcon className="w-3 h-3" />
                               Retry
                             </Button>
                           )}
                           <Button
                             variant="outline"
                             size="sm"
                             onClick={() => handleDeleteProject(project.id)}
                             className="flex items-center gap-1 text-red-600 hover:text-red-700"
                           >
                             <TrashIcon className="w-3 h-3" />
                             Delete
                           </Button>
                         </div>
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
                               {segment.status === 'pending' && segmentCountdowns[segment.id] !== undefined && (
                                 <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                   ⏱️ {formatCountdown(segmentCountdowns[segment.id])}
                                 </div>
                               )}
                              <div className="flex gap-2 flex-wrap">
                                {segment.outputUrl && (
                                  <>
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
                                  </>
                                )}
                                {(segment.status === 'failed' || segment.status === 'pending') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleResetSegment(project.id, segment.id)}
                                    className="text-orange-600 hover:text-orange-700"
                                  >
                                    <RotateCcwIcon className="w-3 h-3 mr-1" />
                                    Reset
                                  </Button>
                                )}
                                {(segment.status === 'processing' || segment.status === 'pending') && segment.jobId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleRefreshSegment(segment.id)}
                                    className="text-blue-600 hover:text-blue-700"
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