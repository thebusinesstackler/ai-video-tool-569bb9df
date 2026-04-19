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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { LogoUploadInline } from '@/components/LogoUploadInline';
import { getFriendlyError } from '@/lib/errorClassifier';

import type { AITwin } from '@/types/aiTwin';

interface GeneratedScript {
  narration: string;
  visualDescription: string;
  performanceDirection: string;
  cameraAngle: string;
  setting: string;
  mood: string;
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

const DURATION_OPTIONS = [
  { value: '30', label: '30 seconds' },
  { value: '60', label: '1 minute' },
  { value: '90', label: '1.5 minutes' },
  { value: '120', label: '2 minutes' },
  { value: '180', label: '3 minutes' },
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
  const [selectedDuration, setSelectedDuration] = useState('60');
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [twinPickerOpen, setTwinPickerOpen] = useState(false);
  
  // Video generation
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Preview step
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // AI Enhancement
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [suggestions, setSuggestions] = useState<{ title: string; enhanced: string }[]>([]);
  const [refineInput, setRefineInput] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [shirtLogoUrl, setShirtLogoUrl] = useState<string | null>(null);
  const scriptFromDraft = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { saveDraft, loadDraft, clearDraft } = useSpokespersonDraft();

  // Auto-estimate duration from word count
  useEffect(() => {
    if (!message.trim()) return;
    const words = message.trim().split(/\s+/).length;
    const estimatedSeconds = Math.round(words / 2.5);
    const closest = DURATION_OPTIONS.reduce((best, opt) => {
      const diff = Math.abs(parseInt(opt.value) - estimatedSeconds);
      return diff < Math.abs(parseInt(best.value) - estimatedSeconds) ? opt : best;
    });
    setSelectedDuration(closest.value);
  }, [message]);

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setSelectedTwinId(draft.selectedTwinId);
      setSelectedSetting(draft.selectedSetting || 'studio');
      setSelectedMood(draft.selectedMood || 'confident');
      setSelectedCameraAngle(draft.selectedCameraAngle || 'low-angle');
      setSelectedDuration(draft.selectedDuration || '60');
      if (draft.videoUrl) setVideoUrl(draft.videoUrl);
      if (draft.audioUrl) setAudioUrl(draft.audioUrl);
      setDraftRestored(true);
    }
  }, []);

  // Pick up handoff from Video Repo Pro
  useEffect(() => {
    const raw = sessionStorage.getItem('video-repo-to-spokesperson');
    if (!raw) return;
    sessionStorage.removeItem('video-repo-to-spokesperson');
    try {
      const data = JSON.parse(raw) as { script: string; duration: string; title: string };
      if (data.script) setMessage(data.script);
      if (data.duration) setSelectedDuration(data.duration);
    } catch (e) {
      console.error('Failed to parse spokesperson handoff', e);
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    saveDraft({
      message,
      selectedTwinId,
      selectedSetting,
      selectedMood,
      selectedCameraAngle,
      selectedDuration,
      generatedScript,
      videoUrl,
      audioUrl,
    });
  }, [message, selectedTwinId, selectedSetting, selectedMood, selectedCameraAngle, selectedDuration, generatedScript, videoUrl, audioUrl]);

  // Load twins
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('get_twins_summary', { _user_id: user.id });
        if (error) throw error;
        const mapped: AITwin[] = (data || []).map((t: any) => ({
          id: t.id,
          name: t.name,
          reference_images: t.first_image ? [t.first_image] : [],
          voice_cloning_key: t.voice_cloning_key,
          voice_sample_url: t.voice_sample_url,
          face_description: t.face_description,
          gender: t.gender,
          voice_engine: (t.voice_engine || 'speechify') as AITwin['voice_engine'],
          google_voice_id: t.google_voice_id,
        }));
        setTwins(mapped);
      } catch (err) {
        console.error('Failed to load twins:', err);
      } finally {
        setLoadingTwins(false);
      }
    };
    load();
  }, [user?.id]);

  // Lazy-load full reference images when a twin is selected
  useEffect(() => {
    if (!selectedTwinId || !user?.id) return;
    const twin = twins.find(t => t.id === selectedTwinId);
    if (twin && twin.reference_images.length <= 1) {
      (async () => {
        try {
          const { data } = await supabase
            .from('ai_twins')
            .select('reference_images')
            .eq('id', selectedTwinId)
            .eq('user_id', user.id)
            .single();
          if (data?.reference_images && data.reference_images.length > 1) {
            setTwins(prev => prev.map(t => 
              t.id === selectedTwinId ? { ...t, reference_images: data.reference_images! } : t
            ));
          }
        } catch {}
      })();
    }
  }, [selectedTwinId, user?.id]);

  const selectedTwin = twins.find(t => t.id === selectedTwinId);
  const selectedSettingData = SETTINGS.find(s => s.id === selectedSetting);
  const selectedMoodData = MOODS.find(m => m.id === selectedMood);
  const selectedAngle = CAMERA_ANGLES.find(a => a.id === selectedCameraAngle);

  // Build TTS body matching the twin's configured voice engine
  const buildTtsBody = (text: string, twin: AITwin) => {
    const body: Record<string, any> = { text, speakingRate: 0.92 };
    // Always pass gender so any fallback path picks the right voice family
    body.gender = twin.gender || 'male';

    // Route the cloning key to the correct provider field based on voice_engine
    if (twin.voice_cloning_key) {
      const engine = (twin.voice_engine || 'speechify').toLowerCase();
      if (engine === 'speechify') {
        body.speechifyVoiceId = twin.voice_cloning_key;
      } else {
        // google-cloud / wavespeed legacy clones
        body.voiceCloningKey = twin.voice_cloning_key;
      }
      return body;
    }

    // No clone — pick a gender-appropriate default OpenAI voice
    const isFemale = twin.gender?.toLowerCase() === 'female';
    body.voice = isFemale ? 'nova' : 'onyx';
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

  // Generate script — single narration block, no scene breakdown
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
      const dur = parseInt(selectedDuration);
      const wordTarget = Math.round(dur * 2.5);

      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are a scriptwriter AND performance director for talking-head spokesperson videos. Write a natural, conversational monologue AND a creative performance direction.

Target: ${dur} seconds (~${wordTarget} words).
Character: ${selectedTwin.face_description || selectedTwin.name}
Setting: ${selectedSettingData?.prompt || 'professional studio'}
Mood/Tone: ${selectedMoodData?.prompt || 'confident'}
Camera: ${selectedAngle?.promptModifier || 'slight low angle'}

SCRIPT Rules:
- Write naturally, as a real person talks on camera
- Short sentences (8-15 words). Vary length for rhythm
- Hook the viewer in the first sentence
- Build a natural arc: Hook → Context → Key Point → Call to Action
- End with a clear call to action
- NO stage directions, NO speaker labels, NO scene breakdowns
- This is ONE continuous monologue — no cuts, no B-roll directions

PERFORMANCE DIRECTION Rules:
Write a vivid, cinematic performance direction (80-120 words) that makes the video feel alive and not boring. Include:
- Camera movement (slow push-in, gentle orbit, subtle drift, handheld micro-shakes)
- Hand gestures and body language (counting on fingers, leaning forward for emphasis, open palm gestures, pointing at camera)
- Facial expressions at key moments (eyebrow raises, knowing smiles, intense eye contact, thoughtful pauses)
- Natural pauses and rhythm changes (beat after the hook, slow down for key point, speed up for excitement)
- Environmental interaction (adjusting collar, picking up product, shifting weight, turning slightly)
- Energy arc (start calm → build energy → peak at key message → warm close)

Return ONLY a JSON object:
{
  "narration": "The full script text...",
  "visualDescription": "Brief visual direction for the character portrait",
  "performanceDirection": "Cinematic performance direction describing camera movement, gestures, expressions, and energy..."
}`
            },
            {
              role: 'user',
              content: `Write a ${dur}-second spokesperson script delivering this message:\n\n${message}`
            }
          ]
        }
      });

      if (error) throw error;
      
      const content = data?.response
        || data?.choices?.[0]?.message?.content 
        || data?.content 
        || (typeof data === 'string' ? data : null)
        || data?.message?.content
        || data?.result;
      if (!content) {
        throw new Error('No content in AI response. Please try again.');
      }
      
      let parsed: GeneratedScript;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
      } catch {
        parsed = {
          narration: content.replace(/```[\s\S]*?```/g, '').trim(),
          visualDescription: `${selectedAngle?.promptModifier}. ${selectedTwin.face_description}. ${selectedSettingData?.prompt}`,
          performanceDirection: `Person speaking expressively to camera with natural hand gestures, gentle camera push-in, ${selectedMoodData?.prompt || 'confident'} energy throughout.`,
          cameraAngle: selectedCameraAngle,
          setting: selectedSetting,
          mood: selectedMood
        };
      }
      
      // Ensure fields
      parsed.cameraAngle = parsed.cameraAngle || selectedCameraAngle;
      parsed.setting = parsed.setting || selectedSetting;
      parsed.mood = parsed.mood || selectedMood;
      parsed.performanceDirection = parsed.performanceDirection || `Person speaking expressively to camera with natural hand gestures, gentle camera push-in, ${selectedMoodData?.prompt || 'confident'} energy throughout.`;

      setGeneratedScript(parsed);
      toast({ title: 'Script Generated!', description: 'Review and generate your spokesperson video.' });
    } catch (err: any) {
      console.error('Script generation error:', err);
      const friendly = getFriendlyError(err);
      toast({ title: friendly.title, description: friendly.description, variant: 'destructive' });
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // Helper: generate TTS and upload
  const generateAndUploadTTS = async (text: string, twin: AITwin, label: string): Promise<string> => {
    const { data: ttsData, error: ttsError } = await supabase.functions.invoke('text-to-speech', {
      body: buildTtsBody(text, twin)
    });
    if (ttsError) throw ttsError;
    if (!ttsData?.audioContent) throw new Error(`No audio generated for ${label}`);

    if (!user) return `data:audio/mp3;base64,${ttsData.audioContent}`;

    try {
      const bytes = Uint8Array.from(atob(ttsData.audioContent), c => c.charCodeAt(0));
      const fileName = `${user.id}/spokesperson/${Date.now()}-${label}.mp3`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('reels')
        .upload(fileName, bytes, { contentType: 'audio/mp3' });
      if (!uploadError && uploadData) {
        const { data: publicUrl } = supabase.storage.from('reels').getPublicUrl(fileName);
        return publicUrl.publicUrl;
      }
    } catch (e) { console.warn('Audio upload failed:', e); }
    return `data:audio/mp3;base64,${ttsData.audioContent}`;
  };

  // Helper: build logo instruction for image prompts
  const getLogoInstruction = () => shirtLogoUrl
    ? '\nCLOTHING: The person is wearing a t-shirt or polo with a visible company/brand logo on the chest area.'
    : '';

  // Helper: apply logo edit to a generated image using AI
  const applyLogoEdit = async (generatedImageUrl: string): Promise<string> => {
    if (!shirtLogoUrl || !generatedImageUrl) return generatedImageUrl;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

      const editResp = await fetch(`${SUPABASE_URL}/functions/v1/ai`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3.1-flash-image-preview',
          modalities: ['image', 'text'],
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: 'Place this logo onto the person\'s shirt/chest area in the portrait photo. Make it look naturally printed or embroidered on the fabric. Keep everything else identical — same person, same pose, same background, same lighting.' },
              { type: 'image_url', image_url: { url: shirtLogoUrl } },
              { type: 'image_url', image_url: { url: generatedImageUrl } }
            ]
          }]
        })
      });

      if (editResp.ok) {
        const editData = await editResp.json();
        const editedUrl = editData.imageUrl || editData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (editedUrl) return editedUrl;
      }
    } catch (e) {
      console.warn('Logo edit failed, using original:', e);
    }
    return generatedImageUrl;
  };

  // Helper: generate a character image
  const generateSceneImage = async (scenePrompt: string, twin: AITwin): Promise<string> => {
    const portraitImage = twin.reference_images[0];
    const imageMessages: any[] = [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: portraitImage } },
        { type: 'text', text: `This is the reference photo. Generate a NEW image of this EXACT same person.${getLogoInstruction()}\n\n${scenePrompt}` }
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

    if (!imageResponse.ok) return portraitImage;

    const imageData = await imageResponse.json();
    let imgUrl = imageData.imageUrl || imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imgUrl) return portraitImage;

    // Apply logo edit if logo is set
    if (shirtLogoUrl) {
      imgUrl = await applyLogoEdit(imgUrl);
    }

    // Upload base64 to storage
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
            return imgPublicUrl.publicUrl;
          }
        }
      } catch { /* fallback */ }
    }
    return imgUrl.startsWith('data:') ? portraitImage : imgUrl;
  };

  // Generate the full video — single continuous clip via avatar-omni-human-1.5
  const generateVideo = async () => {
    if (!generatedScript || !selectedTwin) return;
    
    setIsGenerating(true);
    setProgress(5);
    setVideoUrl(null);
    setAudioUrl(null);

    try {
      const setting = SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting));
      const mood = MOODS.find(m => m.id === (generatedScript.mood || selectedMood));

      // Step 1: Generate TTS from full narration
      setProgressStatus('Generating voiceover...');
      const ttsUrl = await generateAndUploadTTS(generatedScript.narration, selectedTwin, 'voiceover');
      setAudioUrl(ttsUrl);
      setProgress(25);

      // Step 2: Generate character portrait
      setProgressStatus('Creating character portrait...');
      const imgPrompt = `Photorealistic portrait of this EXACT person, half-body shot from waist up showing hands.
CHARACTER: ${selectedTwin.face_description || selectedTwin.name}
GENDER: ${selectedTwin.gender || 'unspecified'}
CAMERA: ${selectedAngle?.promptModifier || 'slight low angle'}, medium shot, natural framing
SETTING: ${setting?.prompt || 'professional studio'}, natural light
EXPRESSION: Mid-sentence speaking, ${mood?.prompt || 'confident'}, looking directly at camera, one hand slightly raised in a natural gesture
QUALITY: Ultra photorealistic, natural skin with pores, no retouching. NO text, NO watermarks.
IMPORTANT: Show arms and hands visible in the frame — not just a headshot.`;
      const sceneImg = await generateSceneImage(imgPrompt, selectedTwin);
      setProgress(45);

      // Step 3: Create single expressive video with infinitetalk-hd (cost-efficient lip-sync)
      setProgressStatus('Rendering expressive spokesperson video...');
      const { data: videoData, error: videoErr } = await supabase.functions.invoke('wavespeed-video', {
        body: {
          action: 'create',
          model: 'infinitetalk-hd',
          imageUrls: [sceneImg],
          audioUrl: ttsUrl,
          aspectRatio: '9:16',
        }
      });
      if (videoErr) throw videoErr;
      if (!videoData?.taskId) {
        const apiError = videoData?.error || 'No video task created';
        throw new Error(apiError.includes('credits') ? 'API credits exhausted. Please top up your account.' : apiError);
      }
      setProgress(55);

      // Step 4: Poll until done
      setProgressStatus('Rendering... (1-4 minutes)');
      let finalUrl: string | undefined;
      let attempts = 0;
      const maxAttempts = 150;
      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 3000));
        const { data: status } = await supabase.functions.invoke('wavespeed-video', {
          body: { action: 'status', taskId: videoData.taskId }
        });
        if (status?.status === 'completed' && status?.videoUrl) {
          finalUrl = status.videoUrl;
          break;
        }
        if (status?.status === 'failed') throw new Error(status?.error || 'Video failed');
        setProgress(55 + (attempts / maxAttempts) * 40);
      }
      if (!finalUrl) throw new Error('Video timed out');

      setVideoUrl(finalUrl);
      setProgress(100);
      setProgressStatus('Done! 🎬');
      toast({ title: '🎬 Video Ready!', description: 'Your spokesperson video is complete.' });

    } catch (err: any) {
      console.error('Video generation error:', err);
      const friendly = getFriendlyError(err);
      toast({ 
        title: friendly.title, 
        description: `${friendly.description} Your progress has been saved — you can retry.`, 
        variant: 'destructive' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate a preview image for the script
  const generatePreviewImage = async () => {
    if (!selectedTwin || !generatedScript) return;
    setIsGeneratingPreview(true);
    
    try {
      const setting = SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting));
      const mood = MOODS.find(m => m.id === (generatedScript.mood || selectedMood));

      const imagePrompt = `Photorealistic selfie of this EXACT person filmed on an iPhone front camera.
CHARACTER: ${selectedTwin.face_description || selectedTwin.name}
GENDER: ${selectedTwin.gender || 'unspecified'}
CAMERA: ${selectedAngle?.promptModifier || 'slight low angle'}, iPhone front-facing camera
SETTING: ${setting?.prompt || 'professional studio'}
EXPRESSION: ${mood?.prompt || 'confident'}, mid-sentence, natural speaking expression
QUALITY: Ultra photorealistic, natural skin, no retouching. NO text, NO watermarks.`;

      const img = await generateSceneImage(imagePrompt, selectedTwin);
      setPreviewImageUrl(img);
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
    await generateScript();
  };

  // After script generation, generate a preview image
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
    generateVideo();
    setPreviewImageUrl(null);
  };

  const resetAll = () => {
    setGeneratedScript(null);
    setVideoUrl(null);
    setAudioUrl(null);
    setProgress(0);
    setProgressStatus('');
    setMessage('');
    setPreviewImageUrl(null);
    clearDraft();
  };

  return (
    <Layout>
      <div className={cn("mx-auto space-y-6 pb-12", videoUrl ? "max-w-4xl" : "max-w-4xl")}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Film className="w-8 h-8 text-primary" />
              AI Spokesperson
            </h1>
            <p className="text-muted-foreground mt-1">
              Create continuous talking-head videos with your AI Twin
            </p>
          </div>
          <CreatorModeToggle mode={mode} onModeChange={setMode} />
        </div>

        {/* Progress Panel */}
        {(isGenerating || isGeneratingScript) && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
                  <Wand2 className="w-4 h-4 text-primary animate-pulse" />
                  <span className="text-xs font-semibold text-primary">Loop AI</span>
                </div>
                <span className="text-sm text-muted-foreground">{progressStatus}</span>
              </div>
              <Progress value={isGeneratingScript ? 10 : progress} className="h-2" />

              {/* Show narration during voiceover generation */}
              {progress >= 5 && progress < 30 && generatedScript && (
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

              {/* Show portrait generation stage */}
              {progress >= 30 && progress < 55 && (
                <div className="mt-4 space-y-3 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Camera className="w-4 h-4 text-primary" />
                    Creating character portrait...
                  </div>
                </div>
              )}

              {/* Show rendering stage */}
              {progress >= 55 && (
                <div className="mt-4 space-y-3 animate-in fade-in duration-500">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Film className="w-4 h-4 text-primary" />
                    Rendering continuous video with lip-sync...
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This creates a single uninterrupted talking-head clip. You can add B-roll later in ChatCut.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Video Result */}
        {videoUrl && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-primary" />
                Your Spokesperson Video
              </CardTitle>
              <CardDescription>
                One continuous talking-head clip. Add B-roll and captions in ChatCut.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <VideoPlayer videoUrl={videoUrl} title="AI Spokesperson" className="rounded-xl w-full max-w-xs mx-auto aspect-[9/16]" />
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" size="sm" asChild>
                  <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-1" /> Download
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={resetAll}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Create Another
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview Step */}
        {generatedScript && !videoUrl && !isGenerating && (previewImageUrl || isGeneratingPreview) && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-primary" />
                Preview — Review Before Generating Video
              </CardTitle>
              <CardDescription>
                Here's your script and character preview. Approve to start video generation.
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
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground">Generating preview...</p>
                      </div>
                    ) : previewImageUrl ? (
                      <img src={previewImageUrl} alt="Character preview" className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  {!isGeneratingPreview && previewImageUrl && (
                    <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={generatePreviewImage}>
                      <RefreshCw className="w-3 h-3 mr-1" /> Regenerate Preview
                    </Button>
                  )}
                </div>

                {/* Script Preview */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Mic className="w-4 h-4 text-primary" /> Script
                    </Label>
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-sm text-foreground leading-relaxed italic">
                        "{generatedScript.narration}"
                      </p>
                    </div>
                    </div>

                  {/* Performance Direction */}
                  {generatedScript.performanceDirection && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Film className="w-4 h-4 text-primary" /> Performance Direction
                      </Label>
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <p className="text-sm text-foreground leading-relaxed">
                          {generatedScript.performanceDirection}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Production settings summary */}
                  <div className="p-3 rounded-lg bg-muted/30 border border-border space-y-1 text-xs text-muted-foreground">
                    <p><span className="font-medium text-foreground">Setting:</span> {SETTINGS.find(s => s.id === (generatedScript.setting || selectedSetting))?.name}</p>
                    <p><span className="font-medium text-foreground">Mood:</span> {MOODS.find(m => m.id === (generatedScript.mood || selectedMood))?.name}</p>
                    <p><span className="font-medium text-foreground">Camera:</span> {CAMERA_ANGLES.find(a => a.id === (generatedScript.cameraAngle || selectedCameraAngle))?.name}</p>
                    <p><span className="font-medium text-foreground">Duration:</span> ~{selectedDuration}s</p>
                    <p><span className="font-medium text-foreground">Model:</span> Avatar Omni Human 1.5 (expressive)</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => { setGeneratedScript(null); setPreviewImageUrl(null); }}>
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

        {/* Saved script banner */}
        {isBeginner && !videoUrl && !isGenerating && !isGeneratingScript && generatedScript && !previewImageUrl && !isGeneratingPreview && (
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
                  <Button size="sm" variant="outline" onClick={resetAll}>Start Fresh</Button>
                  <Button size="sm" onClick={generateVideo} disabled={!selectedTwin}>
                    <Play className="w-3 h-3 mr-1" /> Retry Generation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ===== BEGINNER MODE ===== */}
        {isBeginner && !videoUrl && !isGenerating && !isGeneratingScript && !previewImageUrl && !isGeneratingPreview && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-8 pb-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-foreground">What message should your spokesperson deliver?</h2>
                <p className="text-muted-foreground">
                  {selectedTwin 
                    ? `"${selectedTwin.name}" will deliver your message as a continuous talking-head video.`
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

              {/* AI Enhance */}
              <div className="flex gap-2">
                <Button onClick={enhancePrompt} variant="outline" disabled={isEnhancing || !message.trim() || isGenerating} className="flex-1">
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
                <Button onClick={refineMessage} disabled={isRefining || !refineInput.trim() || !message.trim()} size="icon" variant="outline">
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

              {/* Duration */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Duration</Label>
                <Select value={selectedDuration} onValueChange={setSelectedDuration}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            <Collapsible open={!selectedTwinId || twinPickerOpen} onOpenChange={setTwinPickerOpen}>
              <Card className="bg-card border-border">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/5 transition-colors">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="flex items-center gap-2">
                        <User className="w-5 h-5 text-primary" />
                        {selectedTwin ? (
                          <span className="flex items-center gap-2">
                            {selectedTwin.reference_images?.[0] && (
                              <img src={selectedTwin.reference_images[0]} alt={selectedTwin.name} className="w-6 h-6 rounded-full object-cover" />
                            )}
                            {selectedTwin.name}
                          </span>
                        ) : 'Select Spokesperson'}
                      </span>
                      <ChevronDown className={`w-5 h-5 transition-transform ${(!selectedTwinId || twinPickerOpen) ? 'rotate-180' : ''}`} />
                    </CardTitle>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
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
                            onClick={() => { setSelectedTwinId(twin.id); setTwinPickerOpen(false); }}
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
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Message Input */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Mic className="w-5 h-5 text-primary" />
                  Message to Deliver
                </CardTitle>
                <CardDescription>What should your spokesperson say? This will be one continuous talking-head clip.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Textarea
                  placeholder="Enter the key message, product pitch, announcement, or talking points..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[120px] bg-background border-border"
                  disabled={isGenerating}
                />
                {message.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {message.trim().split(/\s+/).filter(Boolean).length} words · ~{Math.round(message.trim().split(/\s+/).filter(Boolean).length / 2.5)}s estimated duration → {selectedDuration}s
                  </p>
                )}
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
                          {DURATION_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Shirt Logo */}
                    <LogoUploadInline
                      logoUrl={shirtLogoUrl}
                      onLogoChange={setShirtLogoUrl}
                      description="Upload a logo to appear on your spokesperson's shirt in generated images."
                    />
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
