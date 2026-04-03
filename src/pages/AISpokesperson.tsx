import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useSpokespersonDraft } from '@/hooks/useSpokespersonDraft';
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
  Mic, Settings2, Film, ChevronDown, RefreshCw, Play, 
  Lightbulb, MessageCircle, Send, Check, Bot, Copy, ArrowRight
} from 'lucide-react';
import { VideoEditorPanel } from '@/components/VideoEditorPanel';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';

import type { AITwin } from '@/types/aiTwin';

interface SceneDirection {
  type: 'speaking' | 'broll' | 'transition';
  description: string;
  cameraAngle: string;
  duration: number;
  sfx?: string;
  music?: string;
  narrationSegment?: string;
}

interface GeneratedScript {
  narration: string;
  visualDescription: string;
  cameraAngle: string;
  setting: string;
  mood: string;
  scenes?: SceneDirection[];
  musicSuggestion?: string;
  sfxCues?: string[];
}

interface VideoTask {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
}

interface SceneShot {
  id: string;
  imageUrl: string;
  angleLabel: string;
  prompt: string;
  selected: boolean;
  type: 'speaking' | 'broll' | 'transition';
  sfx?: string;
  music?: string;
  narrationSegment?: string;
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
  const [selectedQuality, setSelectedQuality] = useState<'standard' | 'nano-banana' | 'kling-pro'>('standard');
  
  // Multi-scene shots (Kling 3.0 flow)
  const [sceneShots, setSceneShots] = useState<SceneShot[]>([]);
  const [isGeneratingShots, setIsGeneratingShots] = useState(false);
  const [showSceneGallery, setShowSceneGallery] = useState(false);
  const [isAddingShot, setIsAddingShot] = useState(false);
  
  // Preview step
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // Caption overlay
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionText, setCaptionText] = useState('');
  
  // Continuation scenes
  const [continuationVideos, setContinuationVideos] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoRefB = useRef<HTMLVideoElement>(null);
  
  // A/B Comparison
  interface VersionSettings { mood: string; setting: string; cameraAngle: string; voiceLabel: string; }
  const [versionA, setVersionA] = useState<{ url: string; settings: VersionSettings } | null>(null);
  const [versionB, setVersionB] = useState<{ url: string; settings: VersionSettings } | null>(null);
  const [isGeneratingB, setIsGeneratingB] = useState(false);
  const [progressB, setProgressB] = useState(0);
  const [progressStatusB, setProgressStatusB] = useState('');
  const [showBSettings, setShowBSettings] = useState(false);
  const [bMood, setBMood] = useState('friendly');
  const [bSetting, setBSetting] = useState('modern-office');
  const [bCameraAngle, setBCameraAngle] = useState('medium-close');
  const [showComparison, setShowComparison] = useState(false);
  // AI Enhancement
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; enhanced: string }[]>([]);
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const scriptFromDraft = useRef(false);

  const { saveDraft, loadDraft, clearDraft } = useSpokespersonDraft();

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setMessage(draft.message || '');
      setSelectedTwinId(draft.selectedTwinId);
      setSelectedSetting(draft.selectedSetting || 'studio');
      setSelectedMood(draft.selectedMood || 'confident');
      setSelectedCameraAngle(draft.selectedCameraAngle || 'low-angle');
      setSelectedDuration(draft.selectedDuration || '15');
      setSelectedQuality(draft.selectedQuality || 'standard');
      if (draft.generatedScript) {
        scriptFromDraft.current = true;
        setGeneratedScript(draft.generatedScript);
      }
      if (draft.sceneShots?.length > 0) {
        setSceneShots(draft.sceneShots.filter((s: any) => s.imageUrl));
        setShowSceneGallery(draft.showSceneGallery || false);
      }
      if (draft.videoUrl) setVideoUrl(draft.videoUrl);
      if (draft.audioUrl) setAudioUrl(draft.audioUrl);
      setDraftRestored(true);
    }
  }, []);

  // Auto-save draft on state changes (debounced via hook)
  useEffect(() => {
    saveDraft({
      message,
      selectedTwinId,
      selectedSetting,
      selectedMood,
      selectedCameraAngle,
      selectedDuration,
      selectedQuality,
      generatedScript,
      sceneShots,
      showSceneGallery,
      videoUrl,
      audioUrl,
    });
  }, [message, selectedTwinId, selectedSetting, selectedMood, selectedCameraAngle, selectedDuration, selectedQuality, generatedScript, videoUrl, audioUrl]);

  // Load twins
  useEffect(() => {
    if (!user?.id) return;
    
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_twins')
          .select('id, name, reference_images, voice_cloning_key, face_description, gender, voice_engine, google_voice_id')
          .eq('user_id', user.id)
          .order('name');
        
        if (error) throw error;
        const validTwins = (data || []).filter(t => t.reference_images && t.reference_images.length > 0)
          .map(t => ({ ...t, voice_engine: t.voice_engine as AITwin['voice_engine'] }));
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

  // Build TTS body matching the twin's configured voice engine
  const buildTtsBody = (text: string, twin: AITwin) => {
    const body: Record<string, any> = { text, speakingRate: 0.92 };

    // Priority 1: Cloned voice (Speechify)
    if (twin.voice_cloning_key) {
      body.voiceCloningKey = twin.voice_cloning_key;
      return body;
    }

    // Priority 2: Gender-matched WaveSpeed fallback
    const isFemale = twin.gender?.toLowerCase() === 'female';
    body.voice = isFemale ? 'English_compelling_lady1' : 'English_magnetic_voiced_man';
    body.gender = twin.gender || 'male';
    return body;
  };

  const enhancePrompt = async () => {
    if (!message.trim()) return;
    setIsEnhancing(true);
    setSuggestions([]);
    setShowSuggestions(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a creative strategist for spokesperson videos. Given a user's message idea, generate 3 enhanced variations that strengthen the story, hook, and delivery.

Return ONLY a JSON array of objects:
[
  { "title": "Short label (3-5 words)", "enhanced": "The full enhanced message prompt" }
]

Each variation should:
- Keep the core message but make it more compelling
- Add emotional hooks, specific details, or storytelling angles
- Vary in tone: one more emotional, one more data-driven, one more story-driven
- Be 2-4 sentences, written as what the spokesperson should convey (not the literal script)`
            },
            { role: 'user', content: `Enhance this spokesperson message idea:\n\n"${message}"` }
          ]
        }
      });

      if (error) throw error;
      
      const content = data?.response || data?.choices?.[0]?.message?.content || data?.content || (typeof data === 'string' ? data : '');
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setSuggestions(parsed);
      }
    } catch (err) {
      console.error('Enhance error:', err);
      toast({ title: 'Enhancement failed', description: 'Try again or proceed with your original message.', variant: 'destructive' });
    } finally {
      setIsEnhancing(false);
    }
  };

  // Refine message via chat
  const refineMessage = async () => {
    if (!refineInput.trim() || !message.trim()) return;
    setIsRefining(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are helping refine a spokesperson video message. The user will tell you how to change their current message. Return ONLY the updated message text, nothing else. Keep it as a prompt/brief (not a literal script).`
            },
            { role: 'user', content: `Current message:\n"${message}"\n\nUser wants to:\n"${refineInput}"\n\nReturn the refined message:` }
          ]
        }
      });

      if (error) throw error;
      
      const content = data?.response || data?.choices?.[0]?.message?.content || data?.content || (typeof data === 'string' ? data : '');
      if (content) {
        setMessage(content.replace(/^["']|["']$/g, '').trim());
        setRefineInput('');
        toast({ title: 'Message refined!', description: 'Your message has been updated.' });
      }
    } catch (err) {
      console.error('Refine error:', err);
      toast({ title: 'Refinement failed', variant: 'destructive' });
    } finally {
      setIsRefining(false);
    }
  };

  // Generate script
  const generateScript = async () => {
    if (!message.trim()) {
      toast({ title: "Message Required", description: "Please enter a message for your spokesperson.", variant: "destructive" });
      return;
    }
    if (!selectedTwin) {
      toast({ title: "AI Twin Required", description: "Please select an AI Twin first. Create one in the AI Twin page if you haven't yet.", variant: "destructive" });
      return;
    }
    
    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are an elite spokesperson scriptwriter AND creative director who plans professional video shoots with cinematic scene breakdowns.

The spokesperson is: ${selectedTwin.face_description || selectedTwin.name}
Setting: ${selectedSettingData?.prompt || 'professional studio'}
Mood/Tone: ${selectedMoodData?.prompt || 'confident'}
Camera Angle: ${selectedAngle?.promptModifier || 'eye level'}
Target Duration: ${selectedDuration} seconds (~${Math.round(parseInt(selectedDuration) * 2.0)} words)

SCRIPTWRITING RULES:
- Write naturally and conversationally — the way a real human talks on camera
- Use SHORT sentences (8-15 words max). Vary sentence length for rhythm
- Use commas for natural pauses between thoughts. Use periods for full stops
- Front-load the hook — the first sentence must grab attention instantly
- Front-load the hook — the first sentence must grab attention instantly
- Build a natural arc: Hook → Context → Key Point → Call to Action

SCENE DIRECTION (CRITICAL):
Think like a commercial director. Break the video into 3-5 scenes that alternate between:
- "speaking" — character talks directly to camera with lip-sync (the main delivery)
- "broll" — cinematic cutaway shots of the character NOT speaking (contemplative, in motion, atmospheric). These add production value and breathing room
- "transition" — dynamic movement shots connecting scenes

For each scene, suggest:
- Sound effects (sfx) if appropriate: footsteps, ambient office sounds, city atmosphere, nature sounds, typing, coffee shop ambience, etc.
- Background music style if it enhances the mood: "subtle corporate piano", "upbeat indie acoustic", "cinematic orchestral swell", "lo-fi ambient", etc.

NOT every shot needs the character speaking. Mix in B-roll and atmospheric moments to create a professional, polished video — like a real commercial.

Return ONLY a JSON object:
{
  "narration": "The full script to be spoken aloud (speaking parts only)...",
  "visualDescription": "Overall visual direction...",
  "cameraAngle": "${selectedCameraAngle}",
  "setting": "${selectedSetting}",
  "mood": "${selectedMood}",
  "musicSuggestion": "Overall music style recommendation for the video",
  "sfxCues": ["ambient office hum", "keyboard typing", "coffee cup clink"],
  "scenes": [
    {
      "type": "speaking",
      "description": "Medium close-up, direct to camera, delivering the hook",
      "cameraAngle": "Medium close-up, eye level",
      "duration": 5,
      "narrationSegment": "The first part of dialogue for this scene...",
      "sfx": "subtle room tone",
      "music": "soft piano intro building"
    },
    {
      "type": "broll",
      "description": "Wide shot of character walking through the setting, contemplative",
      "cameraAngle": "Wide establishing shot, slow dolly",
      "duration": 3,
      "sfx": "footsteps on floor, ambient atmosphere",
      "music": "continues building"
    },
    {
      "type": "speaking",
      "description": "Low angle hero shot, delivering the key message",
      "cameraAngle": "Low angle, slight push in",
      "duration": 5,
      "narrationSegment": "The next dialogue segment...",
      "music": "music swells subtly"
    }
  ]
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
      
      // Handle multiple response formats from AI gateway
      const content = data?.response
        || data?.choices?.[0]?.message?.content 
        || data?.content 
        || (typeof data === 'string' ? data : null)
        || data?.message?.content
        || data?.result;
      if (!content) {
        console.error('AI response shape:', JSON.stringify(data).substring(0, 500));
        throw new Error('No content in AI response. Please try again.');
      }
      
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
        body: buildTtsBody(generatedScript.narration, selectedTwin)
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

      const imagePrompt = `Generate a PREMIUM cinematic portrait of this EXACT person for a professional spokesperson video. The image must look like a still frame from a high-end commercial — NOT a posed headshot.

CHARACTER: ${selectedTwin.face_description || selectedTwin.name}
GENDER: ${selectedTwin.gender || 'unspecified'}

CAMERA: ${angle?.promptModifier || 'low angle shot'}, shot on RED V-RAPTOR 8K, Cooke S7/i 85mm lens at f/1.4, ultra shallow depth of field with natural bokeh
CAMERA FEEL: Slight off-center framing for cinematic tension — NOT perfectly centered. Subject placed at golden ratio intersection point
SETTING: ${setting?.prompt || 'professional studio'}, atmospheric haze, environmental depth layers (foreground blur element, subject, layered background)
EXPRESSION: ${mood?.prompt || 'confident, direct engagement'}, natural micro-expression — as if mid-thought, genuine and human
BODY LANGUAGE: Natural posture, slight lean or gesture that conveys ${mood?.prompt || 'confidence'}, hands visible if waist-up shot

LIGHTING: Hollywood-grade 3-point setup — warm tungsten key light (3200K) at 45° creating gentle shadow modeling, large soft fill from opposite side, crisp rim/hair light separating subject from background. Subtle practical lights in background for depth
COLOR SCIENCE: Shot on ARRI LogC, graded with rich skin tones, teal-orange color harmony in shadows/highlights, subtle film grain

COMPOSITION: Vertical 9:16 format, rule of thirds with dynamic negative space, environmental storytelling in background
QUALITY: Ultra photorealistic, 8K, Vogue/GQ editorial quality, professional color grading with lifted blacks

CRITICAL: NO text, NO captions, NO watermarks, NO logos. Must look like a real photograph, NOT AI-generated.`;

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
        // Use unified imageUrl first, fallback to legacy choices path
        const imgUrl = imageData.imageUrl || imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
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
      // ALWAYS use infinitetalk for lip-sync speaking shots — Kling is image-to-video only (no audio sync)
      const videoModel = 'infinitetalk';
      const sfxHints = generatedScript.sfxCues?.join(', ') || '';
      const musicHint = generatedScript.musicSuggestion || '';
      const videoPromptText = `Cinematic spokesperson video — ${angle?.promptModifier || 'professional medium shot'}. ${mood?.prompt || 'confident and engaging presence'}. NATURAL LIP-SYNC: Character speaks with fluid, natural mouth movements synchronized to audio. Subtle eyebrow raises, natural blinks, gentle head tilts between sentences. Micro-expressions of genuine emotion and engagement. Natural breathing pauses — NOT robotic or mechanical delivery. Gentle camera drift and shallow depth of field shift throughout. ${setting?.prompt || 'Professional studio setting'}. ${sfxHints ? `Ambient sound atmosphere: ${sfxHints}.` : ''} ${musicHint ? `Background music energy: ${musicHint}.` : ''} Premium broadcast quality — warm cinematic lighting, film grain, rich color grading. NO jump cuts, NO sudden transitions — one continuous smooth take.`;
      
      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: videoModel,
          imageUrls: [generatedImageUrl],
          audioUrl: storageAudioUrl.startsWith('http') ? storageAudioUrl : undefined,
          prompt: videoPromptText,
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
              // Post-process with Wan 2.7 Video Edit for enhanced quality
              setProgress(85);
              setProgressStatus('Loop AI: Enhancing video with Wan 2.7...');
              
              try {
                const enhancePrompt = `Enhance cinematic quality: improve lighting consistency, smooth color grading, add subtle film grain, ensure natural skin tones and professional broadcast quality. Preserve all lip-sync and motion exactly as-is. ${mood?.prompt || 'Professional, polished look'}. ${setting?.prompt || 'Studio environment'}.`;
                
                const { data: enhanceData, error: enhanceError } = await supabase.functions.invoke('wavespeed-video', {
                  body: {
                    action: 'create',
                    model: 'alibaba/wan-2.7/video-edit',
                    videoUrl: statusData.videoUrl,
                    prompt: enhancePrompt,
                    imageUrls: generatedImageUrl ? [generatedImageUrl] : undefined,
                    duration: 0 // match input duration
                  }
                });

                if (!enhanceError && enhanceData?.taskId) {
                  setProgressStatus('Loop AI: Rendering enhanced version (1-2 min)...');
                  let enhanceAttempts = 0;
                  const maxEnhanceAttempts = 80;
                  
                  while (enhanceAttempts < maxEnhanceAttempts) {
                    enhanceAttempts++;
                    await new Promise(r => setTimeout(r, 3000));
                    const { data: enhStatus } = await supabase.functions.invoke('wavespeed-video', {
                      body: { action: 'status', taskId: enhanceData.taskId }
                    });
                    
                    if (enhStatus?.status === 'completed' && enhStatus?.videoUrl) {
                      setVideoUrl(enhStatus.videoUrl);
                      setVideoTask({ taskId: enhanceData.taskId, status: 'completed', videoUrl: enhStatus.videoUrl });
                      setProgress(100);
                      setProgressStatus('Enhanced video ready! 🎬✨');
                      toast({ title: '🎬✨ Enhanced Video Ready!', description: 'Your AI spokesperson video has been enhanced with Wan 2.7.' });
                      return;
                    } else if (enhStatus?.status === 'failed') {
                      console.warn('Wan 2.7 enhancement failed, using original video');
                      break;
                    }
                    const enhPct = Math.min(85 + (enhanceAttempts / maxEnhanceAttempts) * 14, 99);
                    setProgress(enhPct);
                  }
                }
              } catch (enhErr) {
                console.warn('Wan 2.7 enhancement error, using original:', enhErr);
              }
              
              // Fallback: use original infinitetalk video
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
      toast({ 
        title: 'Generation Failed', 
        description: `${err.message}. Your progress has been saved — you can retry.`, 
        variant: 'destructive' 
      });
      // Keep script + scene shots so user can retry
      if (generatedScript && selectedQuality === 'kling-pro') {
        setShowSceneGallery(true);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate a single scene shot image
  const generateSingleShot = async (angleLabel: string, anglePrompt: string, shotType: 'speaking' | 'broll' | 'transition' = 'speaking', sfx?: string, music?: string, narrationSegment?: string): Promise<SceneShot | null> => {
    if (!selectedTwin || !generatedScript) return null;
    
    const portraitImage = selectedTwin.reference_images[0];
    const setting = SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting));
    const mood = MOODS.find(m => m.id === (generatedScript.mood || selectedMood));

    const expressionGuide = shotType === 'speaking' 
      ? `${mood?.prompt || 'confident'}, mouth slightly open as if mid-sentence, natural speaking expression, engaged eye contact`
      : `${mood?.prompt || 'confident'}, contemplative micro-expression, natural and candid`;

    const motionGuide = shotType === 'broll'
      ? 'Cinematic B-roll feel — character in motion or natural activity, environmental storytelling, atmospheric depth'
      : shotType === 'transition'
      ? 'Dynamic transition moment — character turning, walking, or shifting position, motion blur elements'
      : 'Direct-to-camera spokesperson framing, professional broadcast composition';

    const imagePrompt = `Generate a PREMIUM cinematic ${shotType === 'broll' ? 'B-roll' : 'portrait'} of this EXACT person for a professional video.

CHARACTER: ${selectedTwin.face_description || selectedTwin.name}
GENDER: ${selectedTwin.gender || 'unspecified'}
CAMERA: ${anglePrompt}, shot on RED V-RAPTOR 8K, Cooke S7/i 85mm lens at f/1.4
SETTING: ${setting?.prompt || 'professional studio'}
EXPRESSION: ${expressionGuide}
MOTION FEEL: ${motionGuide}
LIGHTING: Hollywood-grade 3-point setup, warm tungsten key light at 45°, soft fill, crisp rim light
${sfx ? `ATMOSPHERE: Scene should evoke the sound of: ${sfx}` : ''}
${music ? `MOOD/ENERGY: Visual energy should match this music style: ${music}` : ''}
QUALITY: Ultra photorealistic, 8K, editorial quality. NO text, NO watermarks.`;

    const imageMessages = [{
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

    if (!imageResponse.ok) return null;

    const imageData = await imageResponse.json();
    const imgUrl = imageData.imageUrl || imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imgUrl) return null;

    // Upload base64 to storage
    let finalUrl = imgUrl;
    if (imgUrl.startsWith('data:') && user) {
      try {
        const matches = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const imgBytes = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0));
          const imgFileName = `${user.id}/spokesperson/${Date.now()}-${angleLabel.replace(/\s+/g, '-').toLowerCase()}.png`;
          const { data: imgUpload, error: imgUploadErr } = await supabase.storage
            .from('reels')
            .upload(imgFileName, imgBytes, { contentType: matches[1], upsert: true });
          if (!imgUploadErr && imgUpload) {
            const { data: imgPublicUrl } = supabase.storage.from('reels').getPublicUrl(imgFileName);
            finalUrl = imgPublicUrl.publicUrl;
          }
        }
      } catch { /* fallback */ }
    }

    return {
      id: crypto.randomUUID(),
      imageUrl: finalUrl,
      angleLabel,
      prompt: imagePrompt,
      selected: true,
      type: shotType,
      sfx,
      music,
      narrationSegment
    };
  };

  // Generate multiple scene shots for Kling 3.0 flow — uses AI scene directions
  const generateMultipleShots = async () => {
    if (!selectedTwin || !generatedScript) return;
    
    setIsGeneratingShots(true);
    setShowSceneGallery(true);
    setSceneShots([]);

    // Use AI-generated scene directions if available, otherwise use defaults
    const aiScenes = generatedScript.scenes && generatedScript.scenes.length > 0
      ? generatedScript.scenes
      : [
          { type: 'speaking' as const, description: 'Medium close-up, direct to camera, delivering the hook', cameraAngle: 'Medium close-up shot, eye level', duration: 5, sfx: 'subtle room tone' },
          { type: 'broll' as const, description: 'Wide cinematic B-roll, character in contemplation', cameraAngle: 'Wide establishing shot, slow dolly', duration: 3, sfx: 'ambient atmosphere', music: 'soft instrumental' },
          { type: 'speaking' as const, description: 'Low angle hero shot, delivering key message', cameraAngle: 'Low angle shot looking up, powerful', duration: 5 },
        ];

    const results: SceneShot[] = [];
    for (const scene of aiScenes) {
      try {
        const shot = await generateSingleShot(
          `${scene.type === 'speaking' ? '🎤' : scene.type === 'broll' ? '🎬' : '🔄'} ${scene.description.substring(0, 30)}...`,
          scene.cameraAngle,
          scene.type as 'speaking' | 'broll' | 'transition',
          scene.sfx,
          scene.music,
          scene.narrationSegment
        );
        if (shot) {
          results.push(shot);
          setSceneShots([...results]);
        }
      } catch (err) {
        console.warn('Shot generation failed:', err);
      }
    }

    setIsGeneratingShots(false);
    if (results.length > 0) {
      toast({ title: `${results.length} shots generated!`, description: 'Select your favorite or add more angles.' });
    }
  };

  // Add an additional custom shot
  const addCustomShot = async (customAngle: string, shotType: 'speaking' | 'broll' = 'broll') => {
    setIsAddingShot(true);
    try {
      const shot = await generateSingleShot(
        `${shotType === 'speaking' ? '🎤' : '🎬'} ${customAngle}`,
        `${customAngle} camera angle, cinematic composition, professional lighting`,
        shotType
      );
      if (shot) {
        setSceneShots(prev => [...prev, shot]);
        toast({ title: 'New shot added!' });
      }
    } catch (err) {
      console.warn('Custom shot failed:', err);
    } finally {
      setIsAddingShot(false);
    }
  };

  // Generate video from a selected shot (Kling flow)
  const generateVideoFromShot = async (shot: SceneShot) => {
    if (!generatedScript || !selectedTwin) return;
    
    setIsGenerating(true);
    setProgress(5);
    setProgressStatus('Loop AI: Generating voiceover...');
    setVideoUrl(null);
    setShowSceneGallery(false);

    try {
      // Step 1: Generate voiceover
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: buildTtsBody(generatedScript.narration, selectedTwin)
      });

      if (ttsError) throw ttsError;
      if (!ttsData?.audioContent) throw new Error('No audio generated');

      // Upload audio
      let storageAudioUrl = `data:audio/mp3;base64,${ttsData.audioContent}`;
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
      setProgress(40);
      setProgressStatus('Loop AI: Creating lip-sync video with Kling 3.0...');

      // Step 2: Generate video — different prompt for speaking vs broll shots
      const mood = MOODS.find(m => m.id === (generatedScript.mood || selectedMood));
      const setting = SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting));
      
      const isSpeakingShot = shot.type === 'speaking';
      const sfxNote = shot.sfx ? `Ambient sound design: ${shot.sfx}.` : '';
      const musicNote = shot.music ? `Background music energy: ${shot.music}.` : '';
      
      const videoPromptText = isSpeakingShot
        ? `Cinematic spokesperson video — ${shot.angleLabel}. ${mood?.prompt || 'confident'}. NATURAL LIP-SYNC: Character speaks directly to camera with fluid mouth movements, subtle eyebrow raises, natural blinks, and gentle head tilts. Breathing pauses between sentences. Micro-expressions of genuine emotion. ${sfxNote} ${musicNote} ${setting?.prompt || 'Professional studio'}. Premium broadcast quality — warm cinematic lighting, shallow depth of field. Gentle camera drift. NO jump cuts — one continuous smooth take.`
        : `Cinematic B-roll — ${shot.angleLabel}. ${mood?.prompt || 'contemplative'}. Character in a natural, candid moment. Subtle movements: turning head, adjusting posture, walking, or gazing thoughtfully. ${sfxNote} ${musicNote} ${setting?.prompt || 'Professional studio'}. Rich atmospheric cinematography — slow camera movement, volumetric lighting, environmental storytelling. Film grain, shallow depth of field, editorial quality.`;

      // Use infinitetalk for speaking shots (lip-sync with audio), kling-v3.0-pro for B-roll (visual quality)
      const shotModel = isSpeakingShot ? 'infinitetalk' : 'kling-v3.0-pro';
      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: shotModel,
          imageUrls: [shot.imageUrl],
          audioUrl: isSpeakingShot && storageAudioUrl.startsWith('http') ? storageAudioUrl : undefined,
          prompt: videoPromptText,
          aspectRatio: '9:16',
          duration: isSpeakingShot ? parseInt(selectedDuration) : Math.min(5, parseInt(selectedDuration))
        }
      });

      if (videoError) throw videoError;
      if (!videoData?.taskId) throw new Error('No video task created');

      setVideoTask({ taskId: videoData.taskId, status: 'processing' });
      setProgress(50);
      setProgressStatus('Loop AI: Rendering Kling 3.0 video (2-5 minutes)...');

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 150;
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 3000));
        try {
          const { data: statusData } = await supabase.functions.invoke('wavespeed-video', {
            body: { action: 'status', taskId: videoData.taskId }
          });
          if (statusData?.status === 'completed' && statusData?.videoUrl) {
            // Post-process with Wan 2.7 Video Edit
            setProgress(80);
            setProgressStatus('Loop AI: Enhancing with Wan 2.7...');
            
            try {
              const mood = MOODS.find(m => m.id === (generatedScript?.mood || selectedMood));
              const setting = SETTINGS.find(s => s.id === (generatedScript?.setting || selectedSetting));
              const enhPrompt = `Enhance cinematic quality: improve lighting, smooth color grading, add film grain, natural skin tones, broadcast quality. Preserve all lip-sync and motion. ${mood?.prompt || ''}. ${setting?.prompt || ''}.`;
              
              const { data: enhData, error: enhErr } = await supabase.functions.invoke('wavespeed-video', {
                body: {
                  action: 'create',
                  model: 'alibaba/wan-2.7/video-edit',
                  videoUrl: statusData.videoUrl,
                  prompt: enhPrompt,
                  imageUrls: shot.imageUrl ? [shot.imageUrl] : undefined,
                  duration: 0
                }
              });

              if (!enhErr && enhData?.taskId) {
                setProgressStatus('Loop AI: Rendering enhanced version (1-2 min)...');
                let enhAttempts = 0;
                while (enhAttempts < 80) {
                  enhAttempts++;
                  await new Promise(r => setTimeout(r, 3000));
                  const { data: eStatus } = await supabase.functions.invoke('wavespeed-video', {
                    body: { action: 'status', taskId: enhData.taskId }
                  });
                  if (eStatus?.status === 'completed' && eStatus?.videoUrl) {
                    setVideoUrl(eStatus.videoUrl);
                    setVideoTask({ taskId: enhData.taskId, status: 'completed', videoUrl: eStatus.videoUrl });
                    setProgress(100);
                    setProgressStatus('Enhanced video ready! 🎬✨');
                    toast({ title: '🎬✨ Enhanced Video Ready!', description: 'Your video has been enhanced with Wan 2.7.' });
                    return;
                  } else if (eStatus?.status === 'failed') {
                    console.warn('Wan 2.7 enhancement failed, using original');
                    break;
                  }
                  setProgress(Math.min(80 + (enhAttempts / 80) * 19, 99));
                }
              }
            } catch (enhErr) {
              console.warn('Wan 2.7 enhancement error, using original:', enhErr);
            }
            
            // Fallback: use original video
            setVideoUrl(statusData.videoUrl);
            setVideoTask({ taskId: videoData.taskId, status: 'completed', videoUrl: statusData.videoUrl });
            setProgress(100);
            setProgressStatus('Video ready! 🎬');
            toast({ title: '🎬 Video Ready!', description: 'Your Kling 3.0 Pro video has been generated.' });
            return;
          } else if (statusData?.status === 'failed') {
            throw new Error(statusData?.error || 'Video generation failed');
          }
          setProgress(Math.min(50 + (attempts / maxAttempts) * 45, 95));
        } catch (pollErr) {
          console.warn('Poll error:', pollErr);
        }
      }
      throw new Error('Video generation timed out');
    } catch (err: any) {
      console.error('Video generation error:', err);
      toast({ 
        title: 'Generation Failed', 
        description: `${err.message}. Your progress has been saved — you can retry from the scene gallery.`, 
        variant: 'destructive' 
      });
      // Restore scene gallery so user can retry
      setShowSceneGallery(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate a preview image for the script (without starting video generation)
  const generatePreviewImage = async () => {
    if (!selectedTwin || !generatedScript) return;
    setIsGeneratingPreview(true);
    
    try {
      const portraitImage = selectedTwin.reference_images[0];
      const angle = CAMERA_ANGLES.find(a => a.id === (generatedScript.cameraAngle || selectedCameraAngle));
      const setting = SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting));
      const mood = MOODS.find(m => m.id === (generatedScript.mood || selectedMood));

      const imagePrompt = `Generate a PREMIUM cinematic portrait of this EXACT person for a professional spokesperson video.

CHARACTER: ${selectedTwin.face_description || selectedTwin.name}
GENDER: ${selectedTwin.gender || 'unspecified'}
CAMERA: ${angle?.promptModifier || 'low angle shot'}, shot on RED V-RAPTOR 8K, Cooke S7/i 85mm lens at f/1.4
SETTING: ${setting?.prompt || 'professional studio'}
EXPRESSION: ${mood?.prompt || 'confident, direct engagement'}, natural micro-expression
LIGHTING: Hollywood-grade 3-point setup, warm tungsten key light at 45°, soft fill, crisp rim light
QUALITY: Ultra photorealistic, 8K, editorial quality. NO text, NO watermarks.`;

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

      if (imageResponse.ok) {
        const imageData = await imageResponse.json();
        const imgUrl = imageData.imageUrl || imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (imgUrl) {
          // Upload base64 to storage
          if (imgUrl.startsWith('data:') && user) {
            try {
              const matches = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
              if (matches) {
                const imgBytes = Uint8Array.from(atob(matches[2]), c => c.charCodeAt(0));
                const imgFileName = `${user.id}/spokesperson/${Date.now()}-preview.png`;
                const { data: imgUpload, error: imgUploadErr } = await supabase.storage
                  .from('reels')
                  .upload(imgFileName, imgBytes, { contentType: matches[1], upsert: true });
                if (!imgUploadErr && imgUpload) {
                  const { data: imgPublicUrl } = supabase.storage.from('reels').getPublicUrl(imgFileName);
                  setPreviewImageUrl(imgPublicUrl.publicUrl);
                } else {
                  setPreviewImageUrl(imgUrl);
                }
              }
            } catch { setPreviewImageUrl(imgUrl); }
          } else {
            setPreviewImageUrl(imgUrl);
          }
        } else {
          // Use reference image as fallback
          setPreviewImageUrl(portraitImage);
        }
      } else {
        setPreviewImageUrl(portraitImage);
      }
    } catch (err) {
      console.warn('Preview image generation failed:', err);
      if (selectedTwin.reference_images?.[0]) {
        setPreviewImageUrl(selectedTwin.reference_images[0]);
      }
    } finally {
      setIsGeneratingPreview(false);
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
    
    // Generate script only — preview will be shown after
    await generateScript();
  };

  // After script generation, generate a preview image (NOT auto-start video)
  useEffect(() => {
    if (scriptFromDraft.current) {
      scriptFromDraft.current = false;
      return;
    }
    if (generatedScript && !isGenerating && !videoUrl && !previewImageUrl && !isGeneratingPreview) {
      generatePreviewImage();
    }
  }, [generatedScript]);

  const handleApproveAndGenerate = () => {
    if (selectedQuality === 'kling-pro') {
      generateMultipleShots();
    } else {
      generateVideo();
    }
    // Clear preview so it doesn't show again
    setPreviewImageUrl(null);
  };

  const resetAll = () => {
    setGeneratedScript(null);
    setVideoUrl(null);
    setVideoTask(null);
    setAudioUrl(null);
    setProgress(0);
    setProgressStatus('');
    setMessage('');
    setSceneShots([]);
    setShowSceneGallery(false);
    setVersionA(null);
    setVersionB(null);
    setShowComparison(false);
    setShowBSettings(false);
    setPreviewImageUrl(null);
    clearDraft();
  };

  // Save version A when first video is generated
  const saveAsVersionA = useCallback(() => {
    if (videoUrl && !versionA) {
      const voiceLabel = selectedTwin?.voice_cloning_key ? 'Cloned Voice'
        : selectedTwin?.gender === 'female' ? 'WaveSpeed (Female)' : 'WaveSpeed (Male)';
      setVersionA({
        url: videoUrl,
        settings: {
          mood: MOODS.find(m => m.id === selectedMood)?.name || selectedMood,
          setting: SETTINGS.find(s => s.id === selectedSetting)?.name || selectedSetting,
          cameraAngle: CAMERA_ANGLES.find(a => a.id === selectedCameraAngle)?.name || selectedCameraAngle,
          voiceLabel,
        }
      });
    }
  }, [videoUrl, versionA, selectedTwin, selectedMood, selectedSetting, selectedCameraAngle]);

  useEffect(() => { saveAsVersionA(); }, [saveAsVersionA]);

  // Generate Version B with different settings
  const generateVersionB = async () => {
    if (!generatedScript || !selectedTwin || !user) return;
    
    setIsGeneratingB(true);
    setProgressB(5);
    setProgressStatusB('Loop AI: Generating Version B voiceover...');
    setShowBSettings(false);

    try {
      // Step 1: Generate voiceover with same twin voice
      const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
        body: buildTtsBody(generatedScript.narration, selectedTwin)
      });

      if (ttsError) throw ttsError;
      if (!ttsData?.audioContent) throw new Error('No audio generated');

      setProgressB(20);
      setProgressStatusB('Loop AI: Generating Version B character image...');

      // Upload audio
      let uploadedAudioUrl = '';
      try {
        const bytes = Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0));
        const fileName = `${user.id}/spokesperson/${Date.now()}-vb-voiceover.mp3`;
        const { data: uploadData } = await supabase.storage.from('reels').upload(fileName, bytes, { contentType: 'audio/mpeg' });
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('reels').getPublicUrl(uploadData.path);
          uploadedAudioUrl = urlData.publicUrl;
        }
      } catch {}

      // Step 2: Generate character image with B settings
      const bMoodData = MOODS.find(m => m.id === bMood);
      const bSettingData = SETTINGS.find(s => s.id === bSetting);
      const bAngle = CAMERA_ANGLES.find(a => a.id === bCameraAngle);

      const imagePrompt = `Professional portrait of ${selectedTwin.face_description || 'a professional person'}, ${bAngle?.promptModifier || 'medium close-up'}, ${bMoodData?.prompt || 'friendly demeanor'}, ${bSettingData?.prompt || 'modern office'}, photorealistic, 4K cinematic`;

      const messages = selectedTwin.reference_images?.[0]
        ? [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: selectedTwin.reference_images[0] } },
            { type: 'text', text: `Generate an image of this exact person: ${imagePrompt}` }
          ]}]
        : [{ role: 'user', content: imagePrompt }];

      setProgressB(35);

      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai', {
        body: { messages, model: 'google/gemini-2.5-flash-image', modalities: ['text', 'image'] }
      });

      if (aiError) throw aiError;
      const characterImageUrl = aiData?.imageUrl;
      if (!characterImageUrl) throw new Error('No character image generated for Version B');

      setProgressB(55);
      setProgressStatusB('Loop AI: Creating Version B video...');

      // Step 3: Generate lip-sync video
      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk',
          imageUrls: [characterImageUrl],
          audioUrl: uploadedAudioUrl || `data:audio/mp3;base64,${ttsData.audioContent}`,
        }
      });

      if (videoError) throw videoError;
      const taskId = videoData?.taskId;
      if (!taskId) throw new Error('No task ID returned');

      setProgressB(65);
      setProgressStatusB('Loop AI: Rendering Version B lip-sync...');

      // Step 4: Poll for completion
      let attempts = 0;
      const maxAttempts = 60;
      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        attempts++;
        setProgressB(65 + Math.min(30, attempts));

        const { data: statusData } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId }
        });

        if (statusData?.status === 'completed' && statusData?.videoUrl) {
          const voiceLabel = selectedTwin.voice_cloning_key ? 'Cloned Voice'
            : selectedTwin.voice_engine === 'google-cloud' ? `Google (${selectedTwin.google_voice_id || 'default'})`
            : selectedTwin.gender === 'female' ? 'WaveSpeed (Female)' : 'WaveSpeed (Male)';

          setVersionB({
            url: statusData.videoUrl,
            settings: {
              mood: bMoodData?.name || bMood,
              setting: bSettingData?.name || bSetting,
              cameraAngle: bAngle?.name || bCameraAngle,
              voiceLabel,
            }
          });
          setShowComparison(true);
          setProgressB(100);
          setProgressStatusB('Version B ready!');
          toast({ title: 'Version B Ready!', description: 'Compare both versions side by side.' });
          break;
        }

        if (statusData?.status === 'failed') {
          throw new Error('Version B video generation failed');
        }
      }

      if (attempts >= maxAttempts) throw new Error('Version B generation timed out');

    } catch (err: any) {
      console.error('Version B generation error:', err);
      toast({ title: 'Version B Failed', description: err.message || 'Could not generate Version B.', variant: 'destructive' });
    } finally {
      setIsGeneratingB(false);
    }
  };

  const pickVersion = (version: 'A' | 'B') => {
    const picked = version === 'A' ? versionA : versionB;
    if (picked) {
      setVideoUrl(picked.url);
    }
    setShowComparison(false);
    setVersionB(null);
    setShowBSettings(false);
    toast({ title: `Version ${version} Selected`, description: `Using Version ${version} as your final video.` });
  };

  // Toggle shot selection for editor panel
  const toggleShotSelection = (shotId: string) => {
    setSceneShots(prev => prev.map(s => s.id === shotId ? { ...s, selected: !s.selected } : s));
  };

  // AI edit status for real-time feedback in editor panel
  const [editStatus, setEditStatus] = useState<{
    active: boolean;
    instruction: string;
    stage: 'interpreting' | 'generating-image' | 'done' | 'error';
    stageLabel: string;
    shotSpec?: { angleLabel: string; type: string; sfx?: string; music?: string };
  }>({ active: false, instruction: '', stage: 'interpreting', stageLabel: '' });

  // AI edit request from editor panel — interprets instruction and generates appropriate shot/action
  const handleAiEditRequest = async (instruction: string) => {
    if (!selectedTwin || !generatedScript) {
      toast({ title: 'Not Ready', description: 'Generate a video first before using AI Edit.', variant: 'destructive' });
      return;
    }

    setEditStatus({ active: true, instruction, stage: 'interpreting', stageLabel: '🧠 AI Director is interpreting your request...' });

    try {
      // Ask AI to classify the action type
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a video director AI. Classify the user's edit request and return a JSON object.

Action types:
1. "add-shot" — new camera angle, B-roll, slide, or cutaway
2. "continue-scene" — extend the video with MORE narration/script (e.g. "add more talking", "continue", "add another point")
3. "add-captions" — add captions/subtitles to the video
4. "style-edit" — visual tweaks like color grading

Return ONLY this JSON:
{
  "action": "add-shot" | "continue-scene" | "add-captions" | "style-edit",
  "angleLabel": "Short label (add-shot only)",
  "cameraAngle": "Camera description (add-shot only)",
  "type": "speaking" or "broll" (add-shot only),
  "sfx": "suggested SFX or null",
  "music": "suggested music or null",
  "continuationScript": "New narration text the spokesperson should say next (continue-scene only, 2-4 sentences)",
  "captionStyle": "karaoke" | "typewriter" | "spotlight" (add-captions only)
}

Current video context:
- Spokesperson: ${selectedTwin.face_description || selectedTwin.name}
- Setting: ${SETTINGS.find(s => s.id === selectedSetting)?.prompt || 'professional studio'}
- Mood: ${MOODS.find(m => m.id === selectedMood)?.prompt || 'confident'}
- Original narration: ${generatedScript.narration.substring(0, 200)}
- Existing shots: ${sceneShots.map(s => s.angleLabel).join(', ')}

Return ONLY the JSON object.`
            },
            { role: 'user', content: instruction }
          ]
        }
      });

      if (error) throw error;

      const content = data?.response || data?.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      let spec: any = null;
      if (jsonMatch) spec = JSON.parse(jsonMatch[0]);

      const action = spec?.action || 'add-shot';

      // === ADD CAPTIONS ===
      if (action === 'add-captions') {
        setEditStatus({ active: true, instruction, stage: 'generating-image', stageLabel: '📝 Adding captions to your video...' });
        setCaptionsEnabled(true);
        setCaptionText(generatedScript.narration);
        toast({ title: '📝 Captions Added', description: 'Captions are now overlaid on your video.' });
        setEditStatus(prev => ({ ...prev, active: false, stage: 'done', stageLabel: '✅ Captions enabled!' }));
        return;
      }

      // === CONTINUE SCENE ===
      if (action === 'continue-scene') {
        const continuationText = spec?.continuationScript || instruction;
        setEditStatus({
          active: true, instruction, stage: 'generating-image',
          stageLabel: '🎬 Capturing last frame & preparing continuation...',
          shotSpec: { angleLabel: 'Scene Continuation', type: 'speaking' },
        });

        // Capture last frame from current video
        let lastFrameUrl = '';
        if (videoRef.current) {
          try {
            const video = videoRef.current;
            video.currentTime = Math.max(0, video.duration - 0.1);
            await new Promise(r => setTimeout(r, 600));
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 720;
            canvas.height = video.videoHeight || 1280;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(video, 0, 0);
              lastFrameUrl = canvas.toDataURL('image/jpeg', 0.9);
            }
          } catch (e) {
            console.warn('Canvas capture failed (tainted), using fallback:', e);
          }
        }
        if (!lastFrameUrl && sceneShots.length > 0) {
          lastFrameUrl = sceneShots[sceneShots.length - 1].imageUrl;
        }

        // Generate voiceover for continuation
        setEditStatus(prev => ({ ...prev, stageLabel: '🎤 Generating continuation voiceover...' }));
        const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
          body: buildTtsBody(continuationText, selectedTwin)
        });
        if (ttsError) throw ttsError;

        let contAudioUrl = '';
        if (ttsData?.audioContent && user) {
          try {
            const bytes = Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0));
            const fileName = `${user.id}/spokesperson/${Date.now()}-continuation.mp3`;
            const { error: uploadError } = await supabase.storage.from('reels').upload(fileName, bytes, { contentType: 'audio/mp3' });
            if (!uploadError) {
              const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
              contAudioUrl = publicUrl.publicUrl;
            }
          } catch (e) { console.warn('Audio upload failed:', e); }
        }

        // Generate continuation video using infinitetalk with last frame
        setEditStatus(prev => ({ ...prev, stageLabel: '🎥 Rendering continuation video (2-5 min)...' }));
        const estDuration = Math.min(15, Math.max(5, Math.ceil(continuationText.split(' ').length / 2.5)));
        const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
          body: {
            action: 'create',
            model: 'infinitetalk',
            imageUrls: [lastFrameUrl || sceneShots[0]?.imageUrl],
            audioUrl: contAudioUrl || undefined,
            prompt: `Cinematic continuation — spokesperson continues speaking naturally. Same setting, same lighting, seamless transition. Natural lip-sync. ${SETTINGS.find(s => s.id === selectedSetting)?.prompt || 'Professional studio'}.`,
            aspectRatio: '9:16',
            duration: estDuration
          }
        });
        if (videoError) throw videoError;
        if (!videoData?.taskId) throw new Error('No continuation task created');

        // Poll for completion
        let attempts = 0;
        while (attempts < 150) {
          attempts++;
          await new Promise(r => setTimeout(r, 3000));
          try {
            const { data: statusData } = await supabase.functions.invoke('wavespeed-video', {
              body: { action: 'status', taskId: videoData.taskId }
            });
            if (statusData?.status === 'completed' && statusData?.videoUrl) {
              setContinuationVideos(prev => [...prev, statusData.videoUrl]);
              setGeneratedScript(prev => prev ? { ...prev, narration: prev.narration + '\n\n' + continuationText } : prev);
              toast({ title: '🎬 Continuation Ready!', description: 'Your scene has been extended with new narration.' });
              setEditStatus(prev => ({ ...prev, active: false, stage: 'done', stageLabel: '✅ Continuation added!' }));
              return;
            }
            if (statusData?.status === 'failed') throw new Error('Continuation generation failed');
          } catch (pollErr) { console.warn('Poll error:', pollErr); }
          setEditStatus(prev => ({ ...prev, stageLabel: `🎥 Rendering continuation... (${Math.min(95, Math.round(attempts / 150 * 100))}%)` }));
        }
        throw new Error('Continuation timed out');
      }

      // === DEFAULT: ADD SHOT ===
      const shotLabel = spec?.angleLabel || instruction.substring(0, 30);
      const shotType = spec?.type === 'speaking' ? 'speaking' : 'broll' as const;
      setEditStatus({
        active: true, instruction, stage: 'generating-image',
        stageLabel: `📸 Generating ${shotType === 'speaking' ? 'speaking' : 'B-roll'} shot...`,
        shotSpec: spec ? { angleLabel: spec.angleLabel, type: spec.type, sfx: spec.sfx, music: spec.music } : { angleLabel: shotLabel, type: shotType },
      });
      await addCustomShot(shotLabel, shotType);
      setEditStatus(prev => ({ ...prev, active: false, stage: 'done', stageLabel: '✅ Shot added!' }));
    } catch (err: any) {
      console.warn('AI edit request failed:', err);
      toast({ title: 'Edit Failed', description: err.message || 'Could not process your edit.', variant: 'destructive' });
      setEditStatus(prev => ({ ...prev, active: false, stage: 'error', stageLabel: '❌ Edit failed' }));
    }
  };

  return (
    <Layout>
      <div className={cn("mx-auto space-y-6 pb-12", videoUrl ? "max-w-6xl" : "max-w-4xl")}>
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

        {/* Progress Panel — Rich contextual info during generation */}
        {(isGenerating || isGeneratingScript) && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
            <CardContent className="pt-6 space-y-4">
              {/* Progress header */}
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                  <Wand2 className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-xs font-semibold text-primary">Loop AI</span>
                </div>
                <span className="text-sm text-muted-foreground">{progressStatus}</span>
              </div>
              <Progress value={isGeneratingScript ? 10 : progress} className="h-2" />

              {/* Stage: Generating Voiceover — show the narration script */}
              {progress >= 5 && progress < 25 && generatedScript && (
                <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border space-y-2 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Mic className="w-4 h-4 text-primary" />
                    Your spokesperson will say:
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                    "{generatedScript.narration}"
                  </p>
                </div>
              )}

              {/* Stage: Generating Character Image — show image placeholders */}
              {progress >= 25 && progress < 50 && (
                <div className="mt-4 space-y-3 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Camera className="w-4 h-4 text-primary" />
                    Generating your character shot...
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="aspect-[9/16] rounded-lg bg-muted/60 border border-border overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 animate-pulse" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
                          <User className="w-6 h-6" />
                          <span className="text-[10px]">{i === 1 ? 'Main Shot' : i === 2 ? 'Angle B' : 'Angle C'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {generatedScript && (
                    <p className="text-xs text-muted-foreground">
                      Setting: {SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting))?.name} · 
                      Mood: {MOODS.find(m => m.id === (generatedScript.mood || selectedMood))?.name}
                    </p>
                  )}
                </div>
              )}

              {/* Stage: Rendering Video — show scene breakdown */}
              {progress >= 50 && generatedScript && (
                <div className="mt-4 space-y-3 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Film className="w-4 h-4 text-primary" />
                    Video scene breakdown
                  </div>
                  
                  {/* Scene timeline cards */}
                  <div className="space-y-2">
                    {(generatedScript.scenes && generatedScript.scenes.length > 0
                      ? generatedScript.scenes
                      : [{ type: 'speaking', description: 'Direct to camera delivery', cameraAngle: selectedAngle?.name || 'Medium shot', duration: parseInt(selectedDuration), narrationSegment: generatedScript.narration }]
                    ).map((scene: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-background/60 border border-border">
                        <div className={cn(
                          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                          scene.type === 'speaking' ? 'bg-primary/15 text-primary' : 'bg-accent/50 text-accent-foreground'
                        )}>
                          {scene.type === 'speaking' ? '🎤' : '🎬'}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground capitalize">{scene.type}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {scene.duration || 5}s
                            </Badge>
                            {scene.sfx && (
                              <span className="text-[10px] text-muted-foreground">🔊 {scene.sfx}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{scene.description || scene.cameraAngle}</p>
                          {scene.narrationSegment && (
                            <p className="text-xs text-foreground/70 italic line-clamp-2">"{scene.narrationSegment}"</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total duration */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                    <span>Total duration: ~{selectedDuration}s</span>
                    {generatedScript.musicSuggestion && (
                      <span>🎵 {generatedScript.musicSuggestion}</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ===== A/B COMPARISON VIEW ===== */}
        {showComparison && versionA && versionB && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-primary" />
                Compare Versions — Pick Your Favorite
              </CardTitle>
              <CardDescription>Both versions use the same script but different production settings.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Version A */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground">Version A</Badge>
                  </div>
                  <div className="aspect-[9/16] max-h-[400px] mx-auto rounded-lg overflow-hidden bg-muted">
                    <video ref={videoRef} src={versionA.url} controls playsInline className="w-full h-full object-contain" />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground">Mood:</span> {versionA.settings.mood}</p>
                    <p><span className="font-medium text-foreground">Setting:</span> {versionA.settings.setting}</p>
                    <p><span className="font-medium text-foreground">Camera:</span> {versionA.settings.cameraAngle}</p>
                    <p><span className="font-medium text-foreground">Voice:</span> {versionA.settings.voiceLabel}</p>
                  </div>
                  <Button className="w-full" onClick={() => pickVersion('A')}>
                    <Check className="w-4 h-4 mr-2" />
                    Pick Version A
                  </Button>
                </div>

                {/* Version B */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Version B</Badge>
                  </div>
                  <div className="aspect-[9/16] max-h-[400px] mx-auto rounded-lg overflow-hidden bg-muted">
                    <video ref={videoRefB} src={versionB.url} controls playsInline className="w-full h-full object-contain" />
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground">Mood:</span> {versionB.settings.mood}</p>
                    <p><span className="font-medium text-foreground">Setting:</span> {versionB.settings.setting}</p>
                    <p><span className="font-medium text-foreground">Camera:</span> {versionB.settings.cameraAngle}</p>
                    <p><span className="font-medium text-foreground">Voice:</span> {versionB.settings.voiceLabel}</p>
                  </div>
                  <Button className="w-full" variant="secondary" onClick={() => pickVersion('B')}>
                    <Check className="w-4 h-4 mr-2" />
                    Pick Version B
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== VERSION B GENERATION PROGRESS ===== */}
        {isGeneratingB && (
          <Card className="border-accent/30">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 rounded-full">
                  <Loader2 className="w-4 h-4 text-accent-foreground animate-spin" />
                  <span className="text-xs font-semibold text-accent-foreground">Generating Version B</span>
                </div>
                <span className="text-sm text-muted-foreground">{progressStatusB}</span>
              </div>
              <Progress value={progressB} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Video Result — Side-by-side with AI Editor */}
        {videoUrl && !showComparison && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
            {/* Left: Video Player */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary" />
                  Your Spokesperson Video
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-[9/16] max-h-[500px] mx-auto bg-muted rounded-lg overflow-hidden flex items-center justify-center relative">
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    autoPlay
                    playsInline
                    crossOrigin="anonymous"
                    className="w-full h-full object-contain"
                  />
                  {captionsEnabled && captionText && (
                    <div className="absolute bottom-12 left-2 right-2 pointer-events-none">
                      <div className="bg-background/80 backdrop-blur-sm rounded-lg px-3 py-2 text-center">
                        <p className="text-sm font-semibold text-foreground drop-shadow-lg leading-snug">
                          {captionText.substring(0, 100)}...
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Continuation videos */}
                {continuationVideos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      🎬 Scene Continuations ({continuationVideos.length})
                    </p>
                    {continuationVideos.map((url, idx) => (
                      <div key={idx} className="aspect-[9/16] max-h-[300px] mx-auto bg-muted rounded-lg overflow-hidden">
                        <video src={url} controls playsInline className="w-full h-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button variant="outline" onClick={() => window.open(videoUrl, '_blank')}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                  {!isGeneratingB && !versionB && (
                    <Button variant="outline" onClick={() => setShowBSettings(true)}>
                      <Copy className="w-4 h-4 mr-2" />
                      Generate Version B
                    </Button>
                  )}
                  {versionB && !showComparison && (
                    <Button variant="outline" onClick={() => setShowComparison(true)}>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Compare Versions
                    </Button>
                  )}
                  <Button variant="outline" onClick={resetAll}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Create Another
                  </Button>
                </div>

                {/* Version B Settings Panel */}
                {showBSettings && !isGeneratingB && (
                  <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Settings2 className="w-4 h-4" />
                      Version B Settings
                    </h4>
                    <p className="text-xs text-muted-foreground">Same script, different production style. Tweak these settings and generate.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Mood</Label>
                        <Select value={bMood} onValueChange={setBMood}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {MOODS.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Setting</Label>
                        <Select value={bSetting} onValueChange={setBSetting}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SETTINGS.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Camera Angle</Label>
                        <Select value={bCameraAngle} onValueChange={setBCameraAngle}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CAMERA_ANGLES.slice(0, 15).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={generateVersionB} className="flex-1">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Version B
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowBSettings(false)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right: AI Editor Panel */}
            <div className="h-[640px]">
              <VideoEditorPanel
                sceneShots={sceneShots}
                onGenerateShot={addCustomShot}
                onSelectShot={toggleShotSelection}
                onCreateVideoFromShot={generateVideoFromShot}
                isAddingShot={isAddingShot}
                isGeneratingShots={isGeneratingShots}
                musicSuggestion={generatedScript?.musicSuggestion}
                onAiEditRequest={handleAiEditRequest}
                editStatus={editStatus}
              />
            </div>
          </div>
        )}

        {/* ===== KLING 3.0 SCENE GALLERY ===== */}
        {showSceneGallery && !videoUrl && !isGenerating && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Scene Shots — Your Video Breakdown
              </CardTitle>
              <CardDescription>
                {isGeneratingShots 
                  ? 'AI is creating your scene breakdown with speaking shots, B-roll, and transitions...' 
                  : `${sceneShots.filter(s => s.type === 'speaking').length} speaking shots, ${sceneShots.filter(s => s.type !== 'speaking').length} B-roll/transitions. Pick any shot to create its video.`}
              </CardDescription>
              {generatedScript?.musicSuggestion && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <span>🎵</span>
                  <span>Suggested music: {generatedScript.musicSuggestion}</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shot Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sceneShots.map((shot) => (
                  <div
                    key={shot.id}
                    className={`relative group rounded-lg border overflow-hidden bg-card transition-all ${
                      shot.type === 'speaking' ? 'border-primary/30 hover:border-primary' : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <div className="aspect-[9/16] bg-muted relative">
                      <img
                        src={shot.imageUrl}
                        alt={shot.angleLabel}
                        className="w-full h-full object-cover"
                      />
                      {/* Shot type overlay badge */}
                      <div className="absolute top-2 left-2">
                        <Badge 
                          variant={shot.type === 'speaking' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {shot.type === 'speaking' ? '🎤 Lip-Sync' : shot.type === 'broll' ? '🎬 B-Roll' : '🔄 Transition'}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-2 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground line-clamp-2">{shot.angleLabel}</p>
                      {/* SFX/Music indicators */}
                      <div className="flex flex-wrap gap-1">
                        {shot.sfx && (
                          <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded">🔊 {shot.sfx.substring(0, 20)}</span>
                        )}
                        {shot.music && (
                          <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded">🎵 {shot.music.substring(0, 20)}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => generateVideoFromShot(shot)}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        {shot.type === 'speaking' ? 'Create Lip-Sync' : 'Create B-Roll'}
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Loading placeholders */}
                {isGeneratingShots && sceneShots.length < 5 && (
                  Array.from({ length: Math.min(3, 5 - sceneShots.length) }).map((_, i) => (
                    <div key={`loading-${i}`} className="rounded-lg border border-border bg-muted animate-pulse">
                      <div className="aspect-[9/16] flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                      </div>
                      <div className="p-2">
                        <div className="h-4 bg-muted-foreground/10 rounded w-2/3" />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add More Shots */}
              {!isGeneratingShots && sceneShots.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">Add more scenes:</p>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">🎤 Speaking shots (with lip-sync):</p>
                    <div className="flex flex-wrap gap-2">
                      {['Close-Up Direct', 'Low Angle Power', 'Over Shoulder Intimate']
                        .filter(a => !sceneShots.some(s => s.angleLabel.includes(a)))
                        .map(angle => (
                          <Button key={angle} variant="outline" size="sm" disabled={isAddingShot}
                            onClick={() => addCustomShot(angle, 'speaking')}>
                            {isAddingShot ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Mic className="w-3 h-3 mr-1" />}
                            {angle}
                          </Button>
                        ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">🎬 B-roll shots (cinematic, no talking):</p>
                    <div className="flex flex-wrap gap-2">
                      {['Wide Establishing', 'Walking Away', 'Contemplative Profile', 'Hands Detail', 'Environment Pan']
                        .filter(a => !sceneShots.some(s => s.angleLabel.includes(a)))
                        .map(angle => (
                          <Button key={angle} variant="outline" size="sm" disabled={isAddingShot}
                            onClick={() => addCustomShot(angle, 'broll')}>
                            {isAddingShot ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Film className="w-3 h-3 mr-1" />}
                            {angle}
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setShowSceneGallery(false); setSceneShots([]); }}>
                  ← Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== PREVIEW STEP — Script + Image before video generation ===== */}
        {generatedScript && !videoUrl && !isGenerating && !showSceneGallery && (previewImageUrl || isGeneratingPreview) && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Preview — Review Before Generating Video
              </CardTitle>
              <CardDescription>
                Here's your script and character preview. Approve to start video generation, or go back to edit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Preview Image */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Character Preview</Label>
                  <div className="aspect-[9/16] max-h-[400px] mx-auto rounded-lg overflow-hidden bg-muted border border-border relative">
                    {isGeneratingPreview ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="relative">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                        <p className="text-sm text-muted-foreground">Generating preview...</p>
                      </div>
                    ) : previewImageUrl ? (
                      <img src={previewImageUrl} alt="Character preview" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  {!isGeneratingPreview && previewImageUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs text-muted-foreground"
                      onClick={generatePreviewImage}
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Regenerate Preview
                    </Button>
                  )}
                </div>

                {/* Script Preview */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Mic className="w-4 h-4 text-primary" />
                      Script
                    </Label>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm text-foreground leading-relaxed italic">
                        "{generatedScript.narration}"
                      </p>
                    </div>
                  </div>

                  {/* Scene breakdown */}
                  {generatedScript.scenes && generatedScript.scenes.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Film className="w-4 h-4 text-primary" />
                        Scene Breakdown
                      </Label>
                      <div className="space-y-1.5">
                        {generatedScript.scenes.map((scene: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-2 rounded bg-background/60 border border-border text-xs">
                            <span>{scene.type === 'speaking' ? '🎤' : '🎬'}</span>
                            <span className="font-medium capitalize">{scene.type}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{scene.duration || 5}s</Badge>
                            <span className="text-muted-foreground truncate flex-1">{scene.description}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Production settings summary */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1 text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground">Setting:</span> {SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting))?.name}</p>
                    <p><span className="font-medium text-foreground">Mood:</span> {MOODS.find(m => m.id === (generatedScript.mood || selectedMood))?.name}</p>
                    <p><span className="font-medium text-foreground">Camera:</span> {CAMERA_ANGLES.find(a => a.id === (generatedScript.cameraAngle || selectedCameraAngle))?.name}</p>
                    <p><span className="font-medium text-foreground">Duration:</span> ~{selectedDuration}s</p>
                    {generatedScript.musicSuggestion && (
                      <p><span className="font-medium text-foreground">Music:</span> {generatedScript.musicSuggestion}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  onClick={() => { setGeneratedScript(null); setPreviewImageUrl(null); }}
                >
                  ← Edit Message
                </Button>
                <Button
                  onClick={handleApproveAndGenerate}
                  disabled={isGeneratingPreview || !selectedTwin}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 px-8"
                  size="lg"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Approve & Generate Video ✨
                </Button>
              </div>
            </CardContent>
          </Card>
        )}


        {isBeginner && !videoUrl && !isGenerating && !isGeneratingScript && !showSceneGallery && generatedScript && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium text-foreground">You have a saved script ready</p>
                    <p className="text-xs text-muted-foreground">Pick up where you left off or start fresh.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={resetAll}
                  >
                    Start Fresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (selectedQuality === 'kling-pro') {
                        generateMultipleShots();
                      } else {
                        generateVideo();
                      }
                    }}
                    disabled={!selectedTwin}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Retry Generation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== BEGINNER MODE ===== */}
        {isBeginner && !videoUrl && !isGenerating && !isGeneratingScript && !showSceneGallery && !previewImageUrl && !isGeneratingPreview && (
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
                onChange={(e) => { setMessage(e.target.value); setShowSuggestions(false); setSuggestions([]); }}
                className="min-h-[120px] bg-background border-border resize-none text-base"
                disabled={isGenerating || isGeneratingScript}
              />

              {/* AI Enhance + Refine Row */}
              <div className="flex gap-2">
                <Button
                  onClick={enhancePrompt}
                  variant="outline"
                  disabled={isEnhancing || !message.trim() || isGenerating}
                  className="flex-1"
                >
                  {isEnhancing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enhancing...</>
                  ) : (
                    <><Lightbulb className="w-4 h-4 mr-2" />Enhance with AI</>
                  )}
                </Button>
              </div>

              {/* AI Refine Chat */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask AI to change something... e.g. 'Make it more emotional' or 'Add urgency'"
                  value={refineInput}
                  onChange={(e) => setRefineInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); refineMessage(); } }}
                  disabled={isRefining || !message.trim()}
                  className="flex-1"
                />
                <Button
                  onClick={refineMessage}
                  disabled={isRefining || !refineInput.trim() || !message.trim()}
                  size="icon"
                  variant="outline"
                >
                  {isRefining ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>

              {/* AI Suggestions */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Bot className="w-4 h-4 text-primary" />
                    Loop AI suggests these stronger angles:
                  </p>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => { setMessage(s.enhanced); setShowSuggestions(false); setSuggestions([]); toast({ title: `Applied: ${s.title}` }); }}
                      className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{s.title}</Badge>
                        <Check className="w-3.5 h-3.5 text-muted-foreground ml-auto" />
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{s.enhanced}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* Video Quality Selector */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Video Quality</Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedQuality('standard')}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      selectedQuality === 'standard'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <Video className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-xs font-semibold">Standard</p>
                    <p className="text-[10px] text-muted-foreground">InfiniteTalk</p>
                  </button>
                  <button
                    onClick={() => setSelectedQuality('nano-banana')}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      selectedQuality === 'nano-banana'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <Sparkles className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-xs font-semibold">Nano Banana 2</p>
                    <p className="text-[10px] text-muted-foreground">Enhanced image</p>
                  </button>
                  <button
                    onClick={() => setSelectedQuality('kling-pro')}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      selectedQuality === 'kling-pro'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <Film className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs font-semibold">Kling 3.0 Pro</p>
                    <p className="text-[10px] text-muted-foreground">Premium video</p>
                  </button>
                </div>
              </div>

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
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:bg-primary/50 disabled:text-primary-foreground/80 font-semibold text-base shadow-lg shadow-primary/25"
                  size="lg"
                >
                  {isGeneratingScript ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Generating Script...</>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-2" />Generate Script</>
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
