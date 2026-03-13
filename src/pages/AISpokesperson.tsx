import React, { useState, useEffect, useCallback } from 'react';
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
  Lightbulb, MessageCircle, Send, Check, Bot
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  face_description: string | null;
  gender: string | null;
}

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
  
  // AI Enhancement
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; enhanced: string }[]>([]);
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // Load twins
  useEffect(() => {
    if (!user?.id) return;
    
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('ai_twins')
          .select('id, name, reference_images, voice_cloning_key, face_description, gender')
          .eq('user_id', user.id)
          .order('name');
        
        if (error) throw error;
        const validTwins = (data || []).filter(t => t.reference_images && t.reference_images.length > 0);
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

  // Enhance prompt with AI suggestions
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
    if (!message.trim() || !selectedTwin) return;
    
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
- Add BREATHING ROOM: use em dashes (—) for natural pauses between thoughts
- Use ellipses (...) for dramatic pauses or trailing thoughts
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
        body: {
          text: generatedScript.narration,
          voice: selectedTwin.voice_cloning_key ? undefined : 'en-US-Journey-D',
          clonedVoiceUrl: selectedTwin.voice_cloning_key || undefined,
          speakingRate: 0.92
        }
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
EXPRESSION: ${mood?.prompt || 'confident, direct engagement'}, closed mouth, natural micro-expression — as if mid-thought, genuine and human
BODY LANGUAGE: Natural posture, slight lean or gesture that conveys ${mood?.prompt || 'confidence'}, hands visible if waist-up shot

LIGHTING: Hollywood-grade 3-point setup — warm tungsten key light (3200K) at 45° creating gentle shadow modeling, large soft fill from opposite side, crisp rim/hair light separating subject from background. Subtle practical lights in background for depth
COLOR SCIENCE: Shot on ARRI LogC, graded with rich skin tones, teal-orange color harmony in shadows/highlights, subtle film grain

COMPOSITION: Vertical 9:16 format, rule of thirds with dynamic negative space, environmental storytelling in background
QUALITY: Ultra photorealistic, 8K, Vogue/GQ editorial quality, professional color grading with lifted blacks

CRITICAL: NO text, NO captions, NO watermarks, NO logos. Person has CLOSED MOUTH — NOT speaking. Must look like a real photograph, NOT AI-generated.`;

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
          model: selectedQuality === 'nano-banana' ? 'google/nano-banana-2/edit' : 'google/gemini-3.1-flash-image-preview',
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
      const videoModel = selectedQuality === 'kling-pro' ? 'kling-v3.0-pro' : 'infinitetalk';
      const videoPromptText = `Cinematic spokesperson video — ${angle?.promptModifier || 'professional medium shot'}. ${mood?.prompt || 'confident and engaging presence'}. Smooth, natural lip-sync delivery with subtle head movements and micro-expressions. Gentle camera drift and shallow depth of field shift throughout. ${setting?.prompt || 'Professional studio setting'}. Premium broadcast quality — warm cinematic lighting, film grain, rich color grading. NO jump cuts, NO sudden transitions — one continuous smooth take. Natural breathing pauses and conversational rhythm.`;
      
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
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
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
      : `${mood?.prompt || 'confident'}, closed mouth, contemplative micro-expression, natural and candid — NOT posed`;

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
        model: selectedQuality === 'nano-banana' ? 'google/nano-banana-2/edit' : 'google/gemini-3.1-flash-image-preview',
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
        body: {
          text: generatedScript.narration,
          voice: selectedTwin.voice_cloning_key ? undefined : 'en-US-Journey-D',
          clonedVoiceUrl: selectedTwin.voice_cloning_key || undefined,
          speakingRate: 0.92
        }
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

      // Step 2: Generate video
      const mood = MOODS.find(m => m.id === (generatedScript.mood || selectedMood));
      const setting = SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting));
      const videoPromptText = `Cinematic spokesperson video — ${shot.angleLabel}. ${mood?.prompt || 'confident'}. Smooth, natural lip-sync delivery with subtle head movements. ${setting?.prompt || 'Professional studio'}. Premium broadcast quality. NO jump cuts — one continuous smooth take.`;

      const { data: videoData, error: videoError } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'kling-v3.0-pro',
          imageUrls: [shot.imageUrl],
          audioUrl: storageAudioUrl.startsWith('http') ? storageAudioUrl : undefined,
          prompt: videoPromptText,
          aspectRatio: '9:16',
          duration: parseInt(selectedDuration)
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
      toast({ title: 'Generation Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
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
    
    // Generate script then video
    await generateScript();
  };

  // Auto-start video after script generation in beginner mode (NOT for kling-pro)
  useEffect(() => {
    if (isBeginner && generatedScript && !isGenerating && !videoUrl) {
      if (selectedQuality === 'kling-pro') {
        // For Kling: generate multiple shots instead of auto-starting video
        generateMultipleShots();
      } else {
        generateVideo();
      }
    }
  }, [generatedScript, isBeginner]);

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
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
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

        {/* Progress Bar */}
        {(isGenerating || isGeneratingScript) && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                  <Wand2 className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-xs font-semibold text-primary">Loop AI</span>
                </div>
                <span className="text-sm text-muted-foreground">{progressStatus}</span>
              </div>
              <Progress value={isGeneratingScript ? 10 : progress} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* Video Result */}
        {videoUrl && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Your Spokesperson Video
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="aspect-[9/16] max-h-[500px] mx-auto bg-black rounded-lg overflow-hidden flex items-center justify-center">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={() => window.open(videoUrl, '_blank')}>
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button variant="outline" onClick={resetAll}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== KLING 3.0 SCENE GALLERY ===== */}
        {showSceneGallery && !videoUrl && !isGenerating && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Scene Shots — Choose Your Angle
              </CardTitle>
              <CardDescription>
                {isGeneratingShots 
                  ? 'Generating multiple camera angles...' 
                  : 'Select a shot to create your video, or add more angles.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shot Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sceneShots.map((shot) => (
                  <div
                    key={shot.id}
                    className="relative group rounded-lg border border-border overflow-hidden bg-card hover:border-primary/50 transition-all"
                  >
                    <div className="aspect-[9/16] bg-muted">
                      <img
                        src={shot.imageUrl}
                        alt={shot.angleLabel}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 space-y-2">
                      <Badge variant="secondary" className="text-[10px]">{shot.angleLabel}</Badge>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => generateVideoFromShot(shot)}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Create Video
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Loading placeholders */}
                {isGeneratingShots && sceneShots.length < 3 && (
                  Array.from({ length: 3 - sceneShots.length }).map((_, i) => (
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
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">Add another angle:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'Wide Establishing Shot',
                      'Extreme Close-Up',
                      'Dutch Angle',
                      'High Angle',
                      'Profile Side View',
                      'Bird\'s Eye View'
                    ]
                      .filter(a => !sceneShots.some(s => s.angleLabel === a))
                      .map(angle => (
                        <Button
                          key={angle}
                          variant="outline"
                          size="sm"
                          disabled={isAddingShot}
                          onClick={() => addCustomShot(angle)}
                        >
                          {isAddingShot ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Camera className="w-3 h-3 mr-1" />}
                          {angle}
                        </Button>
                      ))}
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

        {/* ===== BEGINNER MODE ===== */}
        {isBeginner && !videoUrl && !isGenerating && !isGeneratingScript && !showSceneGallery && (
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
                  className="flex-1"
                  size="lg"
                >
                  {isGeneratingScript ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating Script...</>
                  ) : (
                    <><Sparkles className="w-4 h-4 mr-2" />Generate Script</>
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
