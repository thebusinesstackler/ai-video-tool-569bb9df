import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Sparkles, Loader2, Send, RefreshCw, Check, ChevronRight,
  Volume2, Pause, Camera, Save, X, MessageSquare, User, Image as ImageIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

const VOICE_TYPE_MAP: Record<string, string> = {
  'professional-female': 'English_compelling_lady1',
  'professional-male': 'lecture_man',
  'casual-female': 'English_radiant_girl',
  'casual-male': 'Casual_Guy',
  'energetic-female': 'English_radiant_girl',
  'energetic-male': 'Casual_Guy',
  'authoritative-female': 'English_compelling_lady1',
  'authoritative-male': 'lecture_man',
};

function mapVoiceId(voiceType: string): string {
  return VOICE_TYPE_MAP[voiceType] || 'Friendly_Person';
}

interface AICharacterCreatorProps {
  onCharacterSaved: () => void;
  onClose: () => void;
}

type WizardStep = 'chat' | 'preview' | 'angles' | 'save';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

const ANGLE_PROMPTS = [
  (desc: string) => `Photorealistic front portrait of ${desc}. 85mm lens, studio lighting, neutral background, direct eye contact, shoulders visible. No text, no watermark.`,
  (desc: string) => `Photorealistic 3/4 left profile of ${desc}. 50mm lens, soft studio lighting, turned slightly left, warm expression. No text, no watermark.`,
  (desc: string) => `Photorealistic side profile of ${desc}. 85mm lens, dramatic rim lighting, clean background, elegant pose. No text, no watermark.`,
  (desc: string) => `Photorealistic low angle hero shot of ${desc}. 35mm lens, looking up at subject, powerful composition, confident expression. No text, no watermark.`,
  (desc: string) => `Photorealistic 3/4 right profile of ${desc}. 50mm lens, natural lighting, turned slightly right, approachable expression. No text, no watermark.`,
];

export function AICharacterCreator({ onCharacterSaved, onClose }: AICharacterCreatorProps) {
  const [step, setStep] = useState<WizardStep>('chat');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: "I'm Loop AI, your creative director. Describe the character you want to create — include details like gender, age, clothing, what they're holding, and the setting. For example: \"A confident woman in her 30s holding a bottle of supplements in a modern gym.\""
  }]);
  const [userInput, setUserInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [characterDescription, setCharacterDescription] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [personality, setPersonality] = useState('');
  const [voiceType, setVoiceType] = useState('');
  const [isPreviewingVoice, setIsPreviewingVoice] = useState(false);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [angleImages, setAngleImages] = useState<string[]>([]);
  const [isGeneratingAngles, setIsGeneratingAngles] = useState(false);
  const [anglesProgress, setAnglesProgress] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [refinementNotes, setRefinementNotes] = useState('');
  const [selectedAngleIndex, setSelectedAngleIndex] = useState<number | null>(null);
  const [angleRegenPrompt, setAngleRegenPrompt] = useState('');
  const [isRegeneratingAngle, setIsRegeneratingAngle] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, []);

  const sendMessage = async () => {
    if (!userInput.trim() || isThinking) return;
    const userMsg = userInput.trim();
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    scrollToBottom();
    setIsThinking(true);

    try {
      // Step 1: Get AI to generate structured character details
      const { data: aiData, error: aiError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [
            {
              role: 'system',
              content: `You are Loop AI, a creative director specializing in character design for video commercials. The user will describe a character they want. You must:
1. Expand their description into a vivid, detailed visual description
2. Suggest a character name
3. Suggest a personality type
4. Suggest a voice type (one of: professional-male, professional-female, casual-male, casual-female, energetic-male, energetic-female, authoritative-male, authoritative-female)
5. Write a short sample script line this character would say

Return ONLY valid JSON:
{"name":"Character Name","description":"Detailed visual description for image generation","personality":"personality traits","voiceType":"voice-type-value","sampleScript":"A sample line they would say"}`
            },
            ...chatMessages.filter(m => m.role === 'user').map(m => ({ role: 'user' as const, content: m.content })),
            { role: 'user', content: userMsg }
          ],
          model: 'google/gemini-2.5-flash',
        }
      });

      if (aiError) throw aiError;

      const aiText = aiData?.choices?.[0]?.message?.content || aiData?.response || '';
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: aiText || "I couldn't understand that. Could you describe the character again?" }]);
        setIsThinking(false);
        scrollToBottom();
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      setCharacterName(parsed.name || 'New Character');
      setCharacterDescription(parsed.description || userMsg);
      setPersonality(parsed.personality || 'professional');
      setVoiceType(parsed.voiceType || 'professional-female');

      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: `Great! Here's what I'm envisioning:\n\n**${parsed.name}**\n${parsed.description}\n\n*Personality:* ${parsed.personality}\n*Voice:* ${parsed.voiceType}\n*Sample line:* "${parsed.sampleScript}"\n\nNow generating the character image...`
      }]);
      scrollToBottom();

      // Step 2: Generate the character image
      const { data: imgData, error: imgError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [{
            role: 'user',
            content: `Generate a photorealistic portrait image of: ${parsed.description}. Professional studio photography, 85mm lens, beautiful lighting, high quality. No text, no watermark.`
          }],
          model: 'google/gemini-3.1-flash-image-preview',
          modalities: ['image', 'text'],
        }
      });

      if (imgError) throw imgError;

      const imageUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url
        || imgData?.imageUrl || null;

      if (imageUrl) {
        setGeneratedImage(imageUrl);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Here\'s your character! You can approve, regenerate with notes, or preview the voice.',
          imageUrl,
        }]);

        // Also generate voice preview
        generateVoicePreview(parsed.sampleScript || `Hi, I'm ${parsed.name}. Let me tell you about something amazing.`);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: "I generated the character details but couldn't create the image. Try describing the character again with more visual details."
        }]);
      }

      setStep('preview');
    } catch (err) {
      console.error('Character creation error:', err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Please try again with a different description.'
      }]);
    } finally {
      setIsThinking(false);
      scrollToBottom();
    }
  };

  const generateVoicePreview = async (text: string) => {
    setIsPreviewingVoice(true);
    try {
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice_id: mapVoiceId(voiceType) }
      });
      if (error) throw error;
      if (data?.audioUrl) {
        setVoicePreviewUrl(data.audioUrl);
      }
    } catch (err) {
      console.error('Voice preview failed:', err);
    } finally {
      setIsPreviewingVoice(false);
    }
  };

  const toggleVoice = () => {
    if (!voicePreviewUrl) return;
    if (isPlayingVoice) {
      audioRef.current?.pause();
      setIsPlayingVoice(false);
    } else {
      if (audioRef.current) audioRef.current.pause();
      audioRef.current = new Audio(voicePreviewUrl);
      audioRef.current.onended = () => setIsPlayingVoice(false);
      audioRef.current.play();
      setIsPlayingVoice(true);
    }
  };

  const handleRegenerate = async () => {
    if (!refinementNotes.trim()) {
      toast.error('Add notes about what to change');
      return;
    }
    const notes = refinementNotes.trim();
    setRefinementNotes('');
    setChatMessages(prev => [...prev, { role: 'user', content: notes }]);
    setIsThinking(true);
    setGeneratedImage(null);
    scrollToBottom();

    try {
      const updatedDesc = `${characterDescription}. Additional direction: ${notes}`;
      setCharacterDescription(updatedDesc);

      const { data: imgData, error: imgError } = await supabase.functions.invoke('ai', {
        body: {
          messages: [{
            role: 'user',
            content: `Generate a photorealistic portrait image of: ${updatedDesc}. Professional studio photography, 85mm lens, beautiful lighting. No text, no watermark.`
          }],
          model: 'google/gemini-3.1-flash-image-preview',
          modalities: ['image', 'text'],
        }
      });

      if (imgError) throw imgError;

      const imageUrl = imgData?.choices?.[0]?.message?.images?.[0]?.image_url?.url
        || imgData?.imageUrl || null;

      if (imageUrl) {
        setGeneratedImage(imageUrl);
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Here\'s the updated character. What do you think?',
          imageUrl,
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: "Couldn't regenerate. Try different notes."
        }]);
      }
    } catch (err) {
      console.error('Regeneration error:', err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Regeneration failed. Please try again.'
      }]);
    } finally {
      setIsThinking(false);
      scrollToBottom();
    }
  };

  const handleApproveAndGenerateAngles = async () => {
    if (!generatedImage) return;
    setStep('angles');
    setIsGeneratingAngles(true);
    setAngleImages([generatedImage]); // First angle is the approved image
    setAnglesProgress(1);

    try {
      // Generate remaining angles using the approved image as reference
      for (let i = 0; i < ANGLE_PROMPTS.length; i++) {
        const prompt = ANGLE_PROMPTS[i](characterDescription);
        try {
          const { data, error } = await supabase.functions.invoke('generate-scene-image', {
            body: {
              prompt,
              aspectRatio: '1:1',
              referenceImageUrl: generatedImage.startsWith('data:') ? undefined : generatedImage,
            }
          });

          if (!error && data?.imageUrl) {
            setAngleImages(prev => [...prev, data.imageUrl]);
          }
        } catch (err) {
          console.warn(`Angle ${i + 1} failed:`, err);
        }
        setAnglesProgress(i + 2);
      }

      toast.success('Character angles generated!');
    } catch (err) {
      console.error('Angle generation error:', err);
      toast.error('Some angles failed to generate');
    } finally {
      setIsGeneratingAngles(false);
      setStep('save');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Please sign in'); return; }

      // Upload base64 images to storage for permanent URLs
      const imageUrls: string[] = [];
      for (const img of angleImages) {
        if (img.startsWith('http')) {
          imageUrls.push(img);
        } else {
          // base64 - store as-is for now
          imageUrls.push(img);
        }
      }

      const { error } = await supabase
        .from('characters')
        .insert({
          user_id: user.id,
          name: characterName,
          description: characterDescription,
          reference_images: imageUrls,
          voice_type: voiceType,
          personality,
        });

      if (error) throw error;

      // Also save as AI Twin for cross-feature use
      await supabase
        .from('ai_twins')
        .insert({
          user_id: user.id,
          name: characterName,
          description: characterDescription,
          reference_images: imageUrls,
          gender: voiceType.includes('female') ? 'female' : 'male',
        });

      toast.success(`${characterName} saved as character template!`);
      onCharacterSaved();
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save character');
    } finally {
      setIsSaving(false);
    }
  };

  const angleLabels = ['Main', 'Front', '3/4 Left', 'Side', 'Low Angle', '3/4 Right'];

  return (
    <div className="flex flex-col h-full max-h-[80vh]">
      {/* Header with steps */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">AI Character Creator</span>
        </div>
        <div className="flex items-center gap-1">
          {(['chat', 'preview', 'angles', 'save'] as WizardStep[]).map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <Badge
                variant={step === s ? 'default' : 'secondary'}
                className={cn('text-[10px]', step === s && 'bg-primary')}
              >
                {['Describe', 'Preview', 'Angles', 'Save'][i]}
              </Badge>
            </React.Fragment>
          ))}
          <Button variant="ghost" size="icon" className="h-7 w-7 ml-2" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {chatMessages.map((msg, i) => (
          <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <div className={cn(
              'max-w-[80%] rounded-lg p-3 text-sm',
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-foreground'
            )}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Generated character"
                  className="mt-2 rounded-lg max-h-[300px] w-full object-cover border border-border"
                />
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </div>
        ))}

        {isThinking && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            </div>
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-sm text-muted-foreground">Thinking...</span>
            </div>
          </div>
        )}

        {/* Preview controls */}
        {step === 'preview' && generatedImage && !isThinking && (
          <div className="space-y-3 border border-primary/20 rounded-lg p-4 bg-primary/5">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Voice preview */}
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
                onClick={toggleVoice}
                disabled={isPreviewingVoice || !voicePreviewUrl}
              >
                {isPreviewingVoice ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : isPlayingVoice ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Volume2 className="h-3 w-3" />
                )}
                {isPreviewingVoice ? 'Generating voice...' : isPlayingVoice ? 'Pause' : 'Preview Voice'}
              </Button>

              {/* Approve */}
              <Button
                size="sm"
                className="gap-1 text-xs"
                onClick={handleApproveAndGenerateAngles}
              >
                <Check className="h-3 w-3" />
                Approve & Generate Angles
              </Button>
            </div>

            {/* Refinement notes */}
            <div className="flex gap-2">
              <Textarea
                placeholder="Notes for regeneration... e.g. 'make her younger' or 'change to blue outfit'"
                value={refinementNotes}
                onChange={(e) => setRefinementNotes(e.target.value)}
                rows={2}
                className="text-sm flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                className="gap-1 self-end"
                onClick={handleRegenerate}
                disabled={isThinking || !refinementNotes.trim()}
              >
                <RefreshCw className="h-3 w-3" />
                Redo
              </Button>
            </div>
          </div>
        )}

        {/* Angles progress */}
        {step === 'angles' && isGeneratingAngles && (
          <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Generating camera angles...</span>
              <span className="text-xs text-muted-foreground ml-auto">{anglesProgress}/6</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {angleImages.map((img, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={img} alt={angleLabels[i]} className="w-full h-full object-cover" />
                  <span className="text-[10px] text-center block mt-0.5 text-muted-foreground">{angleLabels[i]}</span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 6 - angleImages.length) }).map((_, i) => (
                <div key={`placeholder-${i}`} className="aspect-square rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save step */}
        {step === 'save' && !isGeneratingAngles && (
          <div className="border border-primary/20 rounded-lg p-4 bg-primary/5 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Character ready! Review and save.</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {angleImages.map((img, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden border border-border">
                  <img src={img} alt={angleLabels[i]} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div>
                <Label className="text-xs">Character Name</Label>
                <Input
                  value={characterName}
                  onChange={(e) => setCharacterName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Personality</Label>
                <Input
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full gap-2"
              size="sm"
            >
              {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save Character Template
            </Button>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      {(step === 'chat' || (step === 'preview' && !generatedImage)) && (
        <div className="px-4 py-3 border-t border-border shrink-0">
          <div className="flex gap-2">
            <Textarea
              placeholder="Describe your character... e.g. 'A lady holding a bottle of supplements in a modern gym'"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              rows={2}
              className="text-sm flex-1"
              disabled={isThinking}
            />
            <Button
              onClick={sendMessage}
              disabled={isThinking || !userInput.trim()}
              size="icon"
              className="h-auto self-end"
            >
              {isThinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
