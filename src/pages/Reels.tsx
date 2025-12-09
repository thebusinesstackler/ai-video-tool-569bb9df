import React, { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';
import { downloadVideo } from '@/lib/reelVideoCreator';
import { stitchVideosWithAudio } from '@/lib/videoStitch';
import { useCreatomate } from '@/hooks/useCreatomate';
import { getAudioDuration } from '@/lib/audioUtils';
import { TemplateSelector } from '@/components/TemplateSelector';
import { VideoPlayerWithOverlay } from '@/components/VideoPlayerWithOverlay';
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
  Palette,
  Cloud,
  Monitor,
  Layers,
  User,
  Upload,
  X
} from 'lucide-react';
import { Input } from '@/components/ui/input';

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
  videoUrl?: string | null;
  startTime: number;
  endTime: number;
  isIntro?: boolean;
  isOutro?: boolean;
}

interface VideoClip {
  sceneNumber: number;
  videoUrl: string;
}

interface ReelProject {
  topic: string;
  scenes: Scene[];
  voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[];
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
  
  // Server-side stitching with Creatomate
  const [useServerStitching, setUseServerStitching] = useState(true);
  const [isManualStitching, setIsManualStitching] = useState(false);
  const { stitchWithCreatomate, isStitching: isCreatomateStitching, progress: creatomateProgress, status: creatomateStatus } = useCreatomate();
  
  // Lip sync mode
  const [enableLipSync, setEnableLipSync] = useState(false);
  const [lipSyncModel, setLipSyncModel] = useState<'infinitetalk' | 'avatar-omni-human-1.5' | 'wan-animate'>('infinitetalk');
  const [portraitImage, setPortraitImage] = useState<string | null>(null);
  const [portraitPreview, setPortraitPreview] = useState<string | null>(null);
  // Voice selection for TTS
  const [selectedVoice, setSelectedVoice] = useState<'nova' | 'alloy' | 'echo' | 'fable' | 'onyx' | 'shimmer'>('nova');
  const portraitInputRef = useRef<HTMLInputElement>(null);
  
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

  // Handle portrait image upload for lip sync
  const handlePortraitUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive"
      });
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target?.result as string;
      setPortraitPreview(base64Image);
      
      // Upload to storage for a persistent URL
      if (user) {
        try {
          const base64Data = base64Image.split(',')[1];
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const fileName = `${user.id}/portraits/${Date.now()}-portrait.${file.type.split('/')[1]}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('reels')
            .upload(fileName, bytes, { contentType: file.type });
          
          if (!uploadError && uploadData) {
            const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
            setPortraitImage(publicUrl.publicUrl);
            console.log('Uploaded portrait to storage:', publicUrl.publicUrl);
          } else {
            // Fall back to base64
            setPortraitImage(base64Image);
          }
        } catch (err) {
          console.warn('Portrait upload failed, using base64:', err);
          setPortraitImage(base64Image);
        }
      } else {
        setPortraitImage(base64Image);
      }
    };
    reader.readAsDataURL(file);
  };

  const removePortrait = () => {
    setPortraitImage(null);
    setPortraitPreview(null);
    if (portraitInputRef.current) {
      portraitInputRef.current.value = '';
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
    
    
    // Always generate voiceovers - lip sync models require audio input
    const voiceovers: { sceneNumber: number; audioUrl: string; storageUrl?: string; duration: number }[] = [];

    try {
      setProgressStatus('Generating voiceovers...');
      
      // Step 1: Generate voiceovers for each scene using OpenAI TTS and get actual durations
      for (const scene of project.scenes) {
        // Skip silent CTA scenes (no narration needed)
        if ((scene as any).isSilentCTA || !scene.narration?.trim()) {
          console.log(`Scene ${scene.sceneNumber} is silent CTA - skipping voiceover`);
          // Add a placeholder with the scene's duration for timing
          voiceovers.push({
            sceneNumber: scene.sceneNumber,
            audioUrl: '', // No audio
            duration: scene.duration || 2
          });
          continue;
        }
        
        try {
          const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
            body: { text: scene.narration, voice: enableLipSync ? selectedVoice : 'alloy' }
          });
          
          if (ttsError) {
            console.error('TTS error for scene', scene.sceneNumber, ':', ttsError);
            continue;
          }
          
          if (ttsData?.audioContent) {
            const audioUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
            
            // Get actual audio duration
            const actualDuration = await getAudioDuration(audioUrl);
            console.log(`Scene ${scene.sceneNumber} voiceover actual duration: ${actualDuration}s`);
            
            // Upload individual voiceover to storage for persistence
            let storageUrl: string | undefined;
            if (user) {
              try {
                const base64Data = ttsData.audioContent;
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                
                const fileName = `${user.id}/voiceovers/${Date.now()}-scene-${scene.sceneNumber}.mp3`;
                const { data: uploadData, error: uploadError } = await supabase.storage
                  .from('reels')
                  .upload(fileName, bytes, { contentType: 'audio/mp3' });
                
                if (!uploadError && uploadData) {
                  const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
                  storageUrl = publicUrl.publicUrl;
                  console.log('Uploaded voiceover to storage:', storageUrl);
                }
              } catch (uploadErr) {
                console.warn('Voiceover upload failed:', uploadErr);
              }
            }
            
            voiceovers.push({
              sceneNumber: scene.sceneNumber,
              audioUrl,
              storageUrl,
              duration: actualDuration
            });
          }
        } catch (ttsErr) {
          console.error('TTS generation failed for scene', scene.sceneNumber, ':', ttsErr);
        }
      }
      
      setProgress(15);
      setProgressStatus(`Generated ${voiceovers.length}/${project.scenes.length} voiceovers. Creating images...`);
      
      // Step 2: Generate scene images and start video tasks via backend
      // Pass actual audio durations so WaveSpeed generates correct length videos
      const scenesWithAudioDurations = project.scenes.map(scene => {
        const voiceover = voiceovers.find(v => v.sceneNumber === scene.sceneNumber);
        return {
          ...scene,
          audioDuration: voiceover?.duration // Pass actual voiceover duration
        };
      });
      
      const { data, error } = await supabase.functions.invoke('generate-reel-video', {
        body: { 
          scenes: scenesWithAudioDurations,
          topic: project.topic,
          addCaptions: true,
          useWaveSpeed: true,
          // Lip sync configuration
          enableLipSync,
          lipSyncModel: enableLipSync ? lipSyncModel : undefined,
          portraitImage: enableLipSync ? portraitImage : undefined,
          voice: enableLipSync ? selectedVoice : 'nova',
          // Pass voiceover storage URLs for lip sync
          voiceovers: enableLipSync ? voiceovers.map(v => ({
            sceneNumber: v.sceneNumber,
            audioUrl: v.storageUrl || v.audioUrl,
            duration: v.duration
          })) : undefined
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
        
        // Choose stitching method
        if (useServerStitching) {
          // Use Creatomate for server-side stitching
          setProgressStatus('Uploading voiceovers and merging audio...');
          
          // Step 4a: Upload and merge voiceover audio for Creatomate
          let mergedAudioUrl: string | undefined;
          
          // Filter out empty/silent audio segments before merging
          const audioSegmentsToMerge = sortedAudios
            .filter(a => a.audioUrl && a.audioUrl.trim() !== '')
            .map(a => ({
              audioUrl: a.audioUrl,
              duration: a.duration,
              sceneNumber: a.sceneNumber
            }));
          
          if (audioSegmentsToMerge.length === 0) {
            console.log('No audio segments to merge, skipping audio merge');
          } else {
            try {
              const { data: mergeData, error: mergeError } = await supabase.functions.invoke('merge-audio', {
                body: {
                  segments: audioSegmentsToMerge,
                  userId: user?.id || 'anonymous'
                }
              });
            
              if (!mergeError && mergeData?.audioUrl) {
                mergedAudioUrl = mergeData.audioUrl;
                console.log('Merged audio URL:', mergedAudioUrl);
              } else {
                console.warn('Audio merge failed, proceeding without audio:', mergeError);
              }
            } catch (mergeErr) {
              console.warn('Audio merge error, proceeding without audio:', mergeErr);
            }
          }
          
          setProgressStatus('Rendering with Creatomate (server-side)...');
          
          // Build clips with actual audio durations
          const clips = sortedVideos.map((v, idx) => {
            const audioDuration = sortedAudios[idx]?.duration;
            return {
              url: v.videoUrl,
              duration: project.scenes[idx]?.duration || 5,
              audioDuration: audioDuration, // Actual voiceover duration
              caption: project.scenes[idx]?.narration || ''
            };
          });
          
          const result = await stitchWithCreatomate({
            clips,
            audioUrl: mergedAudioUrl,
            transition: 'fade',
            captionStyle: 'bottom'
          });
          
          if (result.success && result.videoUrl) {
            setProject(prev => ({
              ...prev,
              videoUrl: result.videoUrl!,
              videoBlobUrl: result.videoUrl!,
              generatedScenes,
              voiceovers: sortedAudios,
              videoClips: sortedVideos,
              status: 'complete'
            }));

            // Auto-save to library
            setProgress(95);
            setProgressStatus('Saving to library...');

            if (user) {
              try {
                const thumbnailUrl = generatedScenes[0]?.imageUrl || null;
                // Use actual audio durations for total duration
                const totalDuration = sortedAudios.reduce((acc, a) => acc + a.duration, 0);

                // Build complete scene data with all URLs (image, video, audio)
                const scenesWithAllAssets = generatedScenes.map((scene) => {
                  const video = sortedVideos.find(v => v.sceneNumber === scene.sceneNumber);
                  const audio = sortedAudios.find(a => a.sceneNumber === scene.sceneNumber);
                  return {
                    ...scene,
                    videoUrl: video?.videoUrl || null,
                    audioUrl: audio?.storageUrl || null, // Use storage URL for persistence
                    audioDuration: audio?.duration || null
                  };
                });

                await supabase.from('reels').insert([{
                  user_id: user.id,
                  topic: project.topic,
                  video_url: result.videoUrl,
                  audio_url: mergedAudioUrl || null, // Save merged voiceover URL
                  thumbnail_url: thumbnailUrl,
                  scenes: scenesWithAllAssets as unknown as any,
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
              description: `Created ${sortedVideos.length}-scene video with synced audio and saved to library!`
            });
          } else {
            throw new Error(result.error || 'Creatomate rendering failed');
          }
        } else {
          // Use client-side FFmpeg stitching
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
              voiceovers: sortedAudios,
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
                const totalDuration = sortedAudios.reduce((acc, a) => acc + a.duration, 0);

                // Build complete scene data with all URLs
                const scenesWithAllAssets = generatedScenes.map((scene) => {
                  const video = sortedVideos.find(v => v.sceneNumber === scene.sceneNumber);
                  const audio = sortedAudios.find(a => a.sceneNumber === scene.sceneNumber);
                  return {
                    ...scene,
                    videoUrl: video?.videoUrl || null,
                    audioUrl: audio?.storageUrl || null,
                    audioDuration: audio?.duration || null
                  };
                });

                await supabase.from('reels').insert([{
                  user_id: user.id,
                  topic: project.topic,
                  video_url: savedVideoUrl,
                  thumbnail_url: thumbnailUrl,
                  scenes: scenesWithAllAssets as unknown as any,
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
                voiceovers: sortedAudios,
                videoClips: sortedVideos,
                status: 'complete'
              }));

              // Still save to library with all URLs
              if (user) {
                try {
                  const thumbnailUrl = generatedScenes[0]?.imageUrl || null;
                  const totalDuration = sortedAudios.reduce((acc, a) => acc + a.duration, 0);

                  // Build complete scene data with all URLs
                  const scenesWithAllAssets = generatedScenes.map((scene) => {
                    const video = sortedVideos.find(v => v.sceneNumber === scene.sceneNumber);
                    const audio = sortedAudios.find(a => a.sceneNumber === scene.sceneNumber);
                    return {
                      ...scene,
                      videoUrl: video?.videoUrl || null,
                      audioUrl: audio?.storageUrl || null,
                      audioDuration: audio?.duration || null
                    };
                  });

                  await supabase.from('reels').insert([{
                    user_id: user.id,
                    topic: project.topic,
                    video_url: sortedVideos[0]?.videoUrl,
                    thumbnail_url: thumbnailUrl,
                    scenes: scenesWithAllAssets as unknown as any,
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
        }
      } else {
        // Fallback: No video tasks, just show images
        setProject(prev => ({
          ...prev,
          generatedScenes,
          voiceovers: voiceovers.map(v => ({ ...v, duration: v.duration || 5 })),
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

  // Manual stitch videos together
  const stitchVideos = async () => {
    if (project.videoClips.length < 2) {
      toast({
        title: "Nothing to Stitch",
        description: "Need at least 2 video clips to stitch together.",
        variant: "destructive"
      });
      return;
    }

    setIsManualStitching(true);
    setProgress(10);
    setProgressStatus('Preparing to stitch videos...');

    try {
      const sortedVideos = [...project.videoClips].sort((a, b) => a.sceneNumber - b.sceneNumber);
      const sortedAudios = [...project.voiceovers].sort((a, b) => a.sceneNumber - b.sceneNumber);

      // Merge all audio URLs
      const audioUrls = sortedAudios.map(a => a.audioUrl);
      let mergedAudioUrl = audioUrls[0];

      if (audioUrls.length > 1) {
        setProgressStatus('Merging audio tracks...');
        setProgress(20);
        
        try {
          const mergeResponse = await supabase.functions.invoke('merge-audio', {
            body: { audioUrls }
          });
          if (mergeResponse.data?.audioUrl) {
            mergedAudioUrl = mergeResponse.data.audioUrl;
          }
        } catch (e) {
          console.log('Audio merge failed, using first audio');
        }
      }

      setProgressStatus('Stitching video clips...');
      setProgress(40);

      if (useServerStitching) {
        // Use Creatomate for server-side stitching
        const clips = sortedVideos.map((clip, index) => {
          const audio = sortedAudios.find(a => a.sceneNumber === clip.sceneNumber);
          const scene = project.generatedScenes.find(s => s.sceneNumber === clip.sceneNumber);
          return {
            url: clip.videoUrl,
            duration: audio?.duration || 5,
            caption: scene?.text || '',
            audioDuration: audio?.duration
          };
        });

        const result = await stitchWithCreatomate({
          clips,
          audioUrl: mergedAudioUrl,
          transition: 'fade',
          captionStyle: 'bottom'
        });

        if (result.success && result.videoUrl) {
          // Save to storage
          let savedVideoUrl = result.videoUrl;
          if (user) {
            try {
              const videoResponse = await fetch(result.videoUrl);
              const videoBlob = await videoResponse.blob();
              const fileName = `videos/${Date.now()}-stitched.mp4`;
              
              await supabase.storage.from('reels').upload(fileName, videoBlob, {
                contentType: 'video/mp4',
                upsert: true
              });
              
              const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
              savedVideoUrl = publicUrl.publicUrl;
            } catch (e) {
              console.error('Failed to save stitched video:', e);
            }
          }

          setProject(prev => ({
            ...prev,
            videoBlobUrl: savedVideoUrl,
            videoClips: [], // Clear clips since we have stitched video
            status: 'complete'
          }));

          toast({
            title: "Videos Stitched!",
            description: "All clips merged into one final video."
          });
        } else {
          throw new Error(result.error || 'Stitching failed');
        }
      } else {
        // Use browser-based stitching with ffmpeg
        const videoUrls = sortedVideos.map(v => v.videoUrl);
        
        const stitchedBlob = await stitchVideosWithAudio({
          videoUrls,
          audioUrls: [mergedAudioUrl],
          onProgress: (percent) => {
            setProgress(40 + percent * 0.5);
            setProgressStatus(`Stitching: ${Math.round(percent)}%`);
          }
        });

        videoBlobRef.current = stitchedBlob;
        const blobUrl = URL.createObjectURL(stitchedBlob);

        setProject(prev => ({
          ...prev,
          videoBlobUrl: blobUrl,
          videoClips: [],
          status: 'complete'
        }));

        toast({
          title: "Videos Stitched!",
          description: "All clips merged into one final video."
        });
      }

      setProgress(100);
      setProgressStatus('Complete!');

    } catch (error: any) {
      console.error('Stitch error:', error);
      toast({
        title: "Stitch Failed",
        description: error.message || "Failed to stitch videos together.",
        variant: "destructive"
      });
    } finally {
      setIsManualStitching(false);
    }
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
            {(isGenerating || isCreatomateStitching) && (
              <Card className="bg-card border-border">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        {isCreatomateStitching ? (
                          <>
                            <Cloud className="w-4 h-4 text-primary" />
                            {creatomateStatus || 'Rendering with Creatomate...'}
                          </>
                        ) : (
                          <>
                            {project.status === 'generating-script' && 'Generating scripts...'}
                            {project.status === 'generating-video' && 'Generating scene images...'}
                            {project.status === 'rendering-video' && (progressStatus || 'Rendering video with captions...')}
                          </>
                        )}
                      </span>
                      <span className="text-primary font-medium">
                        {isCreatomateStitching ? creatomateProgress : progress}%
                      </span>
                    </div>
                    <Progress value={isCreatomateStitching ? creatomateProgress : progress} className="h-2" />
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      Rendering Mode
                      {useServerStitching ? (
                        <Cloud className="w-4 h-4 text-primary" />
                      ) : (
                        <Monitor className="w-4 h-4 text-muted-foreground" />
                      )}
                    </Label>
                    <div className="flex items-center gap-3 h-10 px-3 rounded-md border border-border bg-background">
                      <span className={`text-sm ${!useServerStitching ? 'text-foreground' : 'text-muted-foreground'}`}>Browser</span>
                      <Switch
                        checked={useServerStitching}
                        onCheckedChange={setUseServerStitching}
                        disabled={isGenerating}
                      />
                      <span className={`text-sm ${useServerStitching ? 'text-foreground' : 'text-muted-foreground'}`}>Server</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {useServerStitching 
                        ? 'Creatomate: Reliable, with captions baked in' 
                        : 'FFmpeg in browser: Free, but may timeout'}
                    </p>
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

            {/* Lip Sync Mode */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Lip Sync Mode
                    {enableLipSync && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        Enabled
                      </span>
                    )}
                  </div>
                  <Switch
                    checked={enableLipSync}
                    onCheckedChange={setEnableLipSync}
                    disabled={isGenerating}
                  />
                </CardTitle>
                <CardDescription>
                  Create talking head videos with synchronized lip movements
                </CardDescription>
              </CardHeader>
              {enableLipSync && (
                <CardContent className="space-y-4 pt-0">
                  {/* Portrait Upload */}
                  <div className="space-y-2">
                    <Label>Character Portrait</Label>
                    {portraitPreview ? (
                      <div className="relative inline-block">
                        <img 
                          src={portraitPreview} 
                          alt="Portrait preview" 
                          className="w-32 h-32 object-cover rounded-lg border border-border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 w-6 h-6"
                          onClick={removePortrait}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <div 
                        className="w-32 h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => portraitInputRef.current?.click()}
                      >
                        <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                        <span className="text-xs text-muted-foreground">Upload Portrait</span>
                      </div>
                    )}
                    <Input
                      ref={portraitInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePortraitUpload}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload a front-facing portrait for best lip sync results
                    </p>
                  </div>

                  {/* Model Selection */}
                  <div className="space-y-2">
                    <Label>Lip Sync Model</Label>
                    <Select 
                      value={lipSyncModel} 
                      onValueChange={(v) => setLipSyncModel(v as typeof lipSyncModel)}
                      disabled={isGenerating}
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="infinitetalk">
                          InfiniteTalk (Recommended)
                        </SelectItem>
                        <SelectItem value="avatar-omni-human-1.5">
                          Avatar Omni Human 1.5
                        </SelectItem>
                        <SelectItem value="wan-animate">
                          WAN Animate (Character)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {lipSyncModel === 'infinitetalk' && 'Best for realistic talking head videos with native voice'}
                      {lipSyncModel === 'avatar-omni-human-1.5' && 'Full body avatar animation with native speech'}
                      {lipSyncModel === 'wan-animate' && 'Animated character with lip sync (requires audio)'}
                    </p>
                  </div>
                  {/* Voice Selection for Lip Sync */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Voice Style</Label>
                    <Select value={selectedVoice} onValueChange={(v) => setSelectedVoice(v as typeof selectedVoice)} disabled={isGenerating}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nova">Nova (Female, Warm)</SelectItem>
                        <SelectItem value="alloy">Alloy (Neutral)</SelectItem>
                        <SelectItem value="echo">Echo (Male)</SelectItem>
                        <SelectItem value="fable">Fable (British)</SelectItem>
                        <SelectItem value="onyx">Onyx (Male, Deep)</SelectItem>
                        <SelectItem value="shimmer">Shimmer (Female, Expressive)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Voice will be used for the talking head animation
                    </p>
                  </div>
                </CardContent>
              )}
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
                  {/* Total duration summary */}
                  {project.voiceovers.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <div className="flex items-center gap-2">
                        <Mic className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium">Total Voiceover Duration</span>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {project.voiceovers.reduce((acc, v) => acc + v.duration, 0).toFixed(1)}s
                      </span>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {project.scenes.map((scene) => {
                      const voiceover = project.voiceovers.find(v => v.sceneNumber === scene.sceneNumber);
                      const actualDuration = voiceover?.duration;
                      
                      return (
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
                              <div className="ml-auto flex items-center gap-1.5">
                                {actualDuration ? (
                                  actualDuration > 8 ? (
                                    <span className="text-xs font-medium text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full flex items-center gap-1" title="Audio exceeds 8s video limit - will carry over to next clip">
                                      <Mic className="w-3 h-3" />
                                      {actualDuration.toFixed(1)}s ⚠️
                                    </span>
                                  ) : (
                                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                      <Mic className="w-3 h-3" />
                                      {actualDuration.toFixed(1)}s
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground">
                                    ~{scene.duration}s
                                  </span>
                                )}
                              </div>
                            </CardTitle>
                            {actualDuration && actualDuration > 8 && (
                              <p className="text-xs text-orange-500 mt-1">
                                ⚠️ Audio ({actualDuration.toFixed(1)}s) exceeds 8s video limit. Consider shortening.
                              </p>
                            )}
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div>
                              <Label className="text-xs text-muted-foreground flex items-center gap-2">
                                Narration (Caption)
                                <span className="text-muted-foreground/70">
                                  {scene.narration.split(/\s+/).filter(w => w).length} words
                                </span>
                              </Label>
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
                      );
                    })}
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
                  {/* Video player - use overlay component for multiple clips with audio sync */}
                  {project.videoBlobUrl && (
                    <div className="space-y-4">
                      {project.videoClips.length > 1 ? (
                        /* Multiple clips - use VideoPlayerWithOverlay for text overlay and audio sync */
                        <VideoPlayerWithOverlay
                          scenes={project.generatedScenes}
                          voiceovers={project.voiceovers}
                          videoClips={project.videoClips}
                          onClipChange={setSelectedClipIndex}
                        />
                      ) : (
                        /* Single stitched video - use regular video player */
                        <div className="aspect-[9/16] max-w-sm mx-auto bg-black rounded-lg overflow-hidden shadow-xl">
                          <video
                            src={project.videoBlobUrl}
                            controls
                            className="w-full h-full object-contain"
                            playsInline
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Scene Images/Videos Gallery - show only if no stitched video */}
                  {!project.videoBlobUrl && project.generatedScenes.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {project.generatedScenes.map((scene) => (
                        <div key={scene.sceneNumber} className="relative group">
                          <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden">
                            {scene.videoUrl ? (
                              <VideoPlayer
                                videoUrl={scene.videoUrl}
                                title={`Scene ${scene.sceneNumber}`}
                                trigger={
                                  <div className="relative cursor-pointer w-full h-full">
                                    {scene.imageUrl ? (
                                      <img
                                        src={scene.imageUrl}
                                        alt={`Scene ${scene.sceneNumber}`}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                        Video
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Play className="w-10 h-10 text-white drop-shadow-lg" />
                                    </div>
                                  </div>
                                }
                              />
                            ) : scene.imageUrl ? (
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
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pointer-events-none">
                              <p className="text-white text-xs line-clamp-3">{scene.text}</p>
                            </div>
                            {/* Scene number badge */}
                            <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold pointer-events-none">
                              {scene.sceneNumber}
                            </div>
                            {/* Video indicator */}
                            {scene.videoUrl && (
                              <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded pointer-events-none">
                                <Video className="w-3 h-3" />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-center gap-3">
                    {/* Stitch button - show when we have multiple clips */}
                    {project.videoClips.length > 1 && (
                      <Button 
                        onClick={stitchVideos}
                        disabled={isManualStitching || isCreatomateStitching}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90"
                      >
                        {isManualStitching || isCreatomateStitching ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Layers className="w-4 h-4 mr-2" />
                        )}
                        Stitch All Clips Together
                      </Button>
                    )}
                    {project.videoBlobUrl && project.videoClips.length === 0 && (
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
                {savedReels.map((reel) => {
                  // Get video clips from scenes
                  const videoClips = reel.scenes?.filter(s => s.videoUrl) || [];
                  const hasMultipleClips = videoClips.length > 1;
                  
                  return (
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
                            {new Date(reel.created_at).toLocaleDateString()} • {reel.total_duration}s • {reel.scenes?.length || 0} scenes
                          </p>
                        </div>
                        {hasMultipleClips && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                            {videoClips.length} clips
                          </div>
                        )}
                      </div>
                      
                      {/* Scene clips grid */}
                      {hasMultipleClips && (
                        <div className="p-3 border-t border-border">
                          <p className="text-xs text-muted-foreground mb-2">Individual Clips:</p>
                          <div className="grid grid-cols-5 gap-1">
                            {reel.scenes?.map((scene, idx) => (
                              <VideoPlayer
                                key={idx}
                                videoUrl={scene.videoUrl || ''}
                                title={`Scene ${idx + 1}`}
                                trigger={
                                  <button
                                    className="aspect-square rounded overflow-hidden bg-muted relative group cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={!scene.videoUrl}
                                  >
                                    {scene.imageUrl ? (
                                      <img src={scene.imageUrl} alt={`Scene ${idx + 1}`} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-xs">{idx + 1}</div>
                                    )}
                                    {scene.videoUrl && (
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Play className="w-3 h-3 text-white" />
                                      </div>
                                    )}
                                  </button>
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
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
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Reels;
