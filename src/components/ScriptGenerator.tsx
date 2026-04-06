import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  SparklesIcon, 
  ClockIcon, 
  TargetIcon,
  WandIcon,
  CopyIcon,
  DownloadIcon,
  RefreshCwIcon,
  MicIcon,
  MicOffIcon,
  PlayIcon,
  VideoIcon,
  User,
  ImageIcon,
  Volume2,
  Loader2,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { getFriendlyError } from '@/lib/errorClassifier';

interface AITwin {
  id: string;
  name: string;
  reference_images: string[];
  voice_cloning_key: string | null;
  face_description: string | null;
  description: string | null;
}

interface ScriptParams {
  topic: string;
  duration: string;
  secondsPerScene: string;
  style: string;
  audience: string;
  tone: string;
  callToAction: string;
  characterId?: string;
}

interface ScriptGeneratorProps {
  onUseInReel?: (scenes: { sceneNumber: number; narration: string; visualDescription: string; duration: number }[]) => void;
}

export const ScriptGenerator = ({ onUseInReel }: ScriptGeneratorProps = {}) => {
  const [params, setParams] = useState<ScriptParams>({
    topic: '',
    duration: '60',
    secondsPerScene: '10',
    style: 'educational',
    audience: 'general',
    tone: 'professional',
    callToAction: '',
    characterId: 'none'
  });
  
  const [generatedScript, setGeneratedScript] = useState('');
  const [cleanScript, setCleanScript] = useState('');
  const [scenePreview, setScenePreview] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'detailed' | 'clean' | 'scenes'>('detailed');
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(true);
  const [kieConfigured, setKieConfigured] = useState(true);
  const [isNarrating, setIsNarrating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('default');
  const [isNarrationDialogOpen, setIsNarrationDialogOpen] = useState(false);
  
  // AI Twin and gender state
  const [aiTwins, setAiTwins] = useState<AITwin[]>([]);
  const [selectedTwinId, setSelectedTwinId] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string>('auto');
  const [selectedTwin, setSelectedTwin] = useState<AITwin | null>(null);
  
  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Speech recognition setup
  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Not Supported", description: "Speech recognition is not available in your browser.", variant: "destructive" });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setParams(prev => ({ ...prev, topic: transcript }));
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    toast({ title: "🎤 Listening...", description: "Speak your video topic. Click the mic again to stop." });
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // AI enhance the spoken/typed topic
  const enhanceTopic = async () => {
    if (!params.topic.trim()) {
      toast({ title: "Enter a topic first", description: "Type or speak your video idea before enhancing.", variant: "destructive" });
      return;
    }

    setIsEnhancing(true);
    setAiSuggestions([]);
    try {
      const { data, error } = await supabase.functions.invoke('ai', {
        body: {
          message: `You are a viral content strategist. The user described a video idea (possibly via voice, so it may be rough/unpolished):

"${params.topic}"

Do TWO things:
1. Rewrite their idea into a clear, compelling video topic description (2-3 sentences max). Fix grammar, add specificity, make it actionable for script generation.
2. Suggest 3 alternative angles or variations they could take on this topic that would perform well on social media.

Return ONLY valid JSON:
{
  "enhanced": "the polished topic description",
  "suggestions": ["angle 1", "angle 2", "angle 3"]
}`,
          model: 'google/gemini-2.5-flash'
        }
      });

      if (error) throw error;

      const text = data?.response || '';
      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setParams(prev => ({ ...prev, topic: parsed.enhanced || prev.topic }));
        setAiSuggestions(parsed.suggestions || []);
        toast({ title: "✨ Topic Enhanced", description: "Your idea has been polished and suggestions added." });
      } else {
        // Fallback: use the whole response as enhanced topic
        setParams(prev => ({ ...prev, topic: text.trim() }));
        toast({ title: "✨ Topic Enhanced", description: "Your idea has been polished by AI." });
      }
    } catch (err) {
      console.error('Topic enhancement error:', err);
      toast({ title: "Enhancement Failed", description: "Could not enhance topic. Try again.", variant: "destructive" });
    } finally {
      setIsEnhancing(false);
    }
  };
  useEffect(() => {
    // API is always configured since we use server-side keys
    setApiConfigured(true);
    setKieConfigured(true);
  }, []);

  // Load AI Twins
  useEffect(() => {
    const loadAITwins = async () => {
      const { data } = await supabase
        .from('ai_twins')
        .select('id, name, reference_images, voice_cloning_key, face_description, description')
        .order('created_at', { ascending: false });
      
      if (data) {
        setAiTwins(data.filter(t => t.reference_images && t.reference_images.length > 0));
      }
    };
    
    loadAITwins();
  }, []);

  // Handle AI Twin selection
  const handleTwinSelect = (twinId: string) => {
    if (twinId === 'none') {
      setSelectedTwinId(null);
      setSelectedTwin(null);
      return;
    }
    
    const twin = aiTwins.find(t => t.id === twinId);
    if (twin) {
      setSelectedTwinId(twinId);
      setSelectedTwin(twin);
      
      // Auto-detect gender from face description
      const desc = (twin.face_description || twin.description || '').toLowerCase();
      if (desc.includes('male') && !desc.includes('female')) {
        setSelectedGender('male');
      } else if (desc.includes('female') || desc.includes('woman')) {
        setSelectedGender('female');
      }
      
      toast({
        title: `AI Twin "${twin.name}" Selected`,
        description: twin.voice_cloning_key 
          ? `Cloned voice active • ${twin.reference_images?.length || 0} reference images`
          : `${twin.reference_images?.length || 0} reference images (no cloned voice)`,
      });
    }
  };

  const handleGenerate = async () => {
    if (!params.topic.trim()) {
      toast({
        title: "Topic Required",
        description: "Please enter a video topic to generate a script.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-script', {
          body: {
            topic: params.topic,
            duration: parseInt(params.duration),
            secondsPerScene: parseInt(params.secondsPerScene),
            style: params.style,
            audience: params.audience,
            tone: params.tone,
            callToAction: params.callToAction,
            characterId: params.characterId === 'none' ? undefined : params.characterId
          }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate script');
      }

      if (!data || !data.script) {
        throw new Error('No script content received from the server');
      }
      
      const detailedScriptContent = data.detailedScript || data.script;
      const cleanScriptContent = data.cleanScript || data.script;
      
      setGeneratedScript(detailedScriptContent);
      setCleanScript(cleanScriptContent);
      
      // Use structured scenes from edge function if available, else fall back to parsing
      if (Array.isArray(data.scenes) && data.scenes.length > 0) {
        const structuredScenes = data.scenes.map((s: any, idx: number) => ({
          id: `scene-${idx}`,
          sceneNumber: idx + 1,
          narration: s.narration || '',
          visualDescription: s.visualDescription || '',
          description: s.visualDescription || '', // backward compat
        }));
        setScenePreview(structuredScenes);
      } else {
        const scenes = parseScriptIntoScenes(cleanScriptContent);
        setScenePreview(scenes);
      }

      // Save script to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const duration = parseInt(params.duration);
        const segments = splitScriptIntoSegments(detailedScriptContent, duration);
        
        const { error: saveError } = await supabase
          .from('scripts')
          .insert({
            user_id: user.id,
            title: params.topic.substring(0, 100),
            content: detailedScriptContent,
            duration: duration,
            style: params.style,
            audience: params.audience,
            tone: params.tone,
            segments: segments
          });

        if (saveError) {
          console.error('Error saving script:', saveError);
        }
      }
      
      toast({
        title: "Script Generated & Saved",
        description: "Your AI-powered video script is ready!",
      });
    } catch (error) {
      console.error('Script generation error:', error);
      const friendly = getFriendlyError(error);
      toast({
        title: friendly.title, 
        description: friendly.description,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(generatedScript);
    toast({
      title: "Copied",
      description: "Script copied to clipboard!",
    });
  };

  const handleNarrate = async () => {
    if (!generatedScript.trim()) {
      toast({
        title: "No Script",
        description: "Generate a script first before creating narration.",
        variant: "destructive"
      });
      return;
    }

    setIsNarrating(true);
    try {
      // Get character voice ID if selected
      let voiceId = 'default';
      if (selectedCharacter && selectedCharacter !== 'default') {
        const { data: characters } = await supabase
          .from('characters')
          .select('kie_voice_id')
          .eq('id', selectedCharacter);
        
        if (characters && characters.length > 0) {
          voiceId = characters[0].kie_voice_id || 'default';
        }
      }

      // Generate audio using OpenAI TTS for consistent voice
      const { data, error } = await supabase.functions.invoke('openai-tts', {
        body: {
          text: generatedScript,
          voice: voiceId === 'default' ? 'alloy' : voiceId,
          model: 'eleven_multilingual_v2'
        }
      });

      if (error) {
        throw new Error(`Voice generation failed: ${error.message}`);
      }

      // Create audio URL from base64
      const audioBlob = new Blob([Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0))], { type: 'audio/mp3' });
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioUrl);
    } catch (error) {
      console.error('Narration error:', error);
      const friendly = getFriendlyError(error);
      toast({
        title: friendly.title,
        description: friendly.description,
        variant: "destructive"
      });
    } finally {
      setIsNarrating(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `narration-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast({
      title: "Downloaded",
      description: "Audio narration downloaded successfully!",
    });
  };

  const handleDownloadScript = () => {
    const blob = new Blob([generatedScript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `script-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: "Script downloaded successfully!",
    });
  };

  // Load characters from database
  const [characters, setCharacters] = React.useState<any[]>([]);
  
  React.useEffect(() => {
    const loadCharacters = async () => {
      const { data } = await supabase
        .from('characters')
        .select('*')
        .order('created_at', { ascending: false });
      
      setCharacters(data || []);
    };
    
    loadCharacters();
  }, []);

  // Function to parse clean script into scene previews
  const parseScriptIntoScenes = (script: string) => {
    const lines = script.split('\n').filter(line => line.trim());
    const scenes: any[] = [];
    
    lines.forEach((line, index) => {
      if (line.trim()) {
        scenes.push({
          id: `scene-${index}`,
          sceneNumber: index + 1,
          description: line.trim()
        });
      }
    });
    
    return scenes;
  };

  // Function to split script into segments based on duration
  const splitScriptIntoSegments = (script: string, totalDuration: number) => {
    const segmentDuration = Math.min(15, totalDuration); // Max 15 seconds per segment
    const numSegments = Math.ceil(totalDuration / segmentDuration);
    
    // Split script by paragraphs or sentences
    const paragraphs = script.split('\n\n').filter(p => p.trim());
    const segmentsPerParagraph = Math.ceil(paragraphs.length / numSegments);
    
    const segments = [];
    for (let i = 0; i < numSegments; i++) {
      const startIndex = i * segmentsPerParagraph;
      const endIndex = Math.min(startIndex + segmentsPerParagraph, paragraphs.length);
      const segmentText = paragraphs.slice(startIndex, endIndex).join('\n\n');
      
      if (segmentText.trim()) {
        segments.push({
          segment: i + 1,
          duration: segmentDuration,
          script: segmentText.trim()
        });
      }
    }
    
    return segments;
  };

  const handleTestScene = (scene: any) => {
    // Navigate to videos page with just this one scene for testing
    navigate('/videos', { 
      state: { 
        testScene: {
          sceneNumber: scene.sceneNumber,
          description: scene.description,
          duration: parseInt(params.secondsPerScene)
        }
      }
    });
    
    toast({
      title: "Test Scene Ready",
      description: `Testing scene ${scene.sceneNumber} generation.`,
    });
  };
  const handleCreateVideo = () => {
    if (!generatedScript.trim()) {
      toast({
        title: "No Script",
        description: "Generate a script first before creating videos.",
        variant: "destructive"
      });
      return;
    }

    const duration = parseInt(params.duration);
    const segments = splitScriptIntoSegments(generatedScript, duration);
    
    // Navigate to videos page with script data
    navigate('/videos', { 
      state: { 
        scriptData: {
          originalScript: generatedScript,
          segments: segments,
          params: params,
          audioUrl: audioUrl
        }
      }
    });
    
    toast({
      title: "Script Ready",
      description: `Navigating to video creation with ${segments.length} segments.`,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <WandIcon className="w-5 h-5 text-primary" />
            Script Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="topic">Video Topic</Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant={isListening ? "destructive" : "outline"}
                  size="sm"
                  onClick={toggleListening}
                  className={`h-8 gap-1.5 ${isListening ? 'animate-pulse' : ''}`}
                >
                  {isListening ? <MicOffIcon className="w-3.5 h-3.5" /> : <MicIcon className="w-3.5 h-3.5" />}
                  {isListening ? 'Stop' : 'Speak'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={enhanceTopic}
                  disabled={isEnhancing || !params.topic.trim()}
                  className="h-8 gap-1.5"
                >
                  {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Enhance
                </Button>
              </div>
            </div>
            <div className="relative">
              <Textarea
                id="topic"
                placeholder={isListening ? "🎤 Listening... speak your video idea" : "Describe your video topic, key messages, or product details..."}
                value={params.topic}
                onChange={(e) => setParams(prev => ({ ...prev, topic: e.target.value }))}
                className={`min-h-[100px] ${isListening ? 'border-destructive/50 bg-destructive/5' : ''}`}
              />
              {isListening && (
                <div className="absolute top-2 right-2">
                  <span className="flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                  </span>
                </div>
              )}
            </div>
            
            {/* AI Suggestions */}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Alternative Angles
                </p>
                <div className="space-y-1.5">
                  {aiSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setParams(prev => ({ ...prev, topic: suggestion }));
                        setAiSuggestions([]);
                        toast({ title: "Topic Updated", description: "Switched to suggested angle." });
                      }}
                      className="w-full text-left text-xs p-2 rounded-md border border-border hover:border-primary/30 hover:bg-muted/50 transition-all text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Twin Selector */}
          <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
            <Label className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-primary" />
              AI Twin (Recommended)
            </Label>
            <Select value={selectedTwinId || 'none'} onValueChange={handleTwinSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select your AI Twin..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No AI Twin</SelectItem>
                {aiTwins.map((twin) => (
                  <SelectItem key={twin.id} value={twin.id}>
                    <div className="flex items-center gap-2">
                      <span>{twin.name}</span>
                      {twin.voice_cloning_key && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          <Volume2 className="w-2.5 h-2.5 mr-1" />
                          Voice
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        <ImageIcon className="w-2.5 h-2.5 mr-1" />
                        {twin.reference_images?.length || 0}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Selected Twin Preview */}
            {selectedTwin && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  {/* Reference Images Preview */}
                  <div className="flex -space-x-2">
                    {selectedTwin.reference_images?.slice(0, 4).map((img, idx) => (
                      <img 
                        key={idx}
                        src={img} 
                        alt={`Reference ${idx + 1}`}
                        className="w-10 h-10 rounded-full border-2 border-background object-cover"
                      />
                    ))}
                    {(selectedTwin.reference_images?.length || 0) > 4 && (
                      <div className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                        +{(selectedTwin.reference_images?.length || 0) - 4}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{selectedTwin.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedTwin.reference_images?.length || 0} reference images
                      {selectedTwin.voice_cloning_key && ' • Cloned voice ready'}
                    </p>
                  </div>
                </div>
                
                {/* Voice Status */}
                {selectedTwin.voice_cloning_key && (
                  <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
                    <Volume2 className="w-4 h-4 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Cloned voice will be used — no voice selection needed
                    </span>
                  </div>
                )}
                
                {/* Face Description */}
                {selectedTwin.face_description && (
                  <p className="text-xs text-muted-foreground italic">
                    "{selectedTwin.face_description}"
                  </p>
                )}
              </div>
            )}
            
            {aiTwins.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No AI Twins found. Create one to use your cloned voice and reference images.
              </p>
            )}
          </div>

          {/* Gender / Presenter Type - Only show if no AI Twin selected */}
          {!selectedTwin && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Presenter Gender
              </Label>
              <Select value={selectedGender} onValueChange={setSelectedGender}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Topic-based)</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="neutral">Neutral / Unspecified</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Helps generate appropriate pronouns and descriptions in the script.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="character">Legacy Character (Optional)</Label>
            <Select value={params.characterId} onValueChange={(value) => setParams(prev => ({ ...prev, characterId: value }))}>
              <SelectTrigger id="character">
                <SelectValue placeholder="No character (generic script)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No character (generic script)</SelectItem>
                {characters.map((character) => (
                  <SelectItem key={character.id} value={character.id}>
                    {character.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Use AI Twins above for better results. Legacy characters are for backwards compatibility.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Total Duration (seconds)</Label>
              <Input
                id="duration"
                type="number"
                min="5"
                max="300"
                value={params.duration}
                onChange={(e) => setParams(prev => ({ ...prev, duration: e.target.value }))}
                placeholder="e.g., 30, 60"
              />
              <p className="text-xs text-muted-foreground">5-300 seconds</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondsPerScene">Seconds Per Scene</Label>
              <Select value={params.secondsPerScene} onValueChange={(value) => setParams(prev => ({ ...prev, secondsPerScene: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 seconds (fast cuts)</SelectItem>
                  <SelectItem value="10">10 seconds (balanced)</SelectItem>
                  <SelectItem value="15">15 seconds (detailed)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Based on your model</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="style">Content Style</Label>
              <Select value={params.style} onValueChange={(value) => setParams(prev => ({ ...prev, style: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educational">Educational</SelectItem>
                  <SelectItem value="promotional">Promotional</SelectItem>
                  <SelectItem value="storytelling">Storytelling</SelectItem>
                  <SelectItem value="tutorial">Tutorial</SelectItem>
                  <SelectItem value="testimonial">Testimonial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="audience">Target Audience</Label>
              <Select value={params.audience} onValueChange={(value) => setParams(prev => ({ ...prev, audience: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Audience</SelectItem>
                  <SelectItem value="professionals">Professionals</SelectItem>
                  <SelectItem value="students">Students</SelectItem>
                  <SelectItem value="entrepreneurs">Entrepreneurs</SelectItem>
                  <SelectItem value="consumers">Consumers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone of Voice</Label>
              <Select value={params.tone} onValueChange={(value) => setParams(prev => ({ ...prev, tone: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                  <SelectItem value="authoritative">Authoritative</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cta">Call to Action (Optional)</Label>
            <Input
              id="cta"
              placeholder="e.g., Visit our website, Subscribe now, Download the app..."
              value={params.callToAction}
              onChange={(e) => setParams(prev => ({ ...prev, callToAction: e.target.value }))}
            />
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating}
            className="w-full"
            variant="hero"
          >
            {isGenerating ? (
              <>
                <RefreshCwIcon className="w-4 h-4 animate-spin" />
                Generating Script...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Generate Script
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Script */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-foreground">
              <TargetIcon className="w-5 h-5 text-primary" />
              Generated Script
            </CardTitle>
            {generatedScript && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  {params.duration}s
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleCopyScript}>
                  <CopyIcon className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDownloadScript}>
                  <DownloadIcon className="w-4 h-4" />
                </Button>
                {kieConfigured && (
                  <Dialog open={isNarrationDialogOpen} onOpenChange={setIsNarrationDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MicIcon className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Narration</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Select Character (Optional)</Label>
                          <Select value={selectedCharacter} onValueChange={setSelectedCharacter}>
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a character or use default voice" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Default Voice</SelectItem>
                              {characters.map((char: any) => (
                                <SelectItem key={char.id} value={char.id}>
                                  {char.name} {char.kie_voice_id ? `(${char.kie_voice_id})` : '(Default)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleNarrate} disabled={isNarrating} className="w-full">
                          {isNarrating ? (
                            <>
                              <RefreshCwIcon className="w-4 h-4 animate-spin mr-2" />
                              Creating Narration...
                            </>
                          ) : (
                            <>
                              <MicIcon className="w-4 h-4 mr-2" />
                              Create Narration
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {generatedScript ? (
            <div className="space-y-4">
              {/* Tabs for detailed vs clean script */}
              <div className="border-b border-border">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('detailed')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'detailed' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Detailed Script
                  </button>
                  <button
                    onClick={() => setActiveTab('clean')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'clean' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Clean Version
                  </button>
                  <button
                    onClick={() => setActiveTab('scenes')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'scenes' 
                        ? 'border-primary text-primary' 
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Scene Preview ({scenePreview.length})
                  </button>
                </div>
              </div>
              
              {activeTab === 'detailed' && (
                <div className="space-y-2">
                  <Label>Detailed Script (with timestamps & production notes)</Label>
                  <Textarea
                    value={generatedScript}
                    onChange={(e) => setGeneratedScript(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Your generated script will appear here..."
                  />
                </div>
              )}
              
              {activeTab === 'clean' && (
                <div className="space-y-2">
                  <Label>Clean Version (for video generation)</Label>
                  <Textarea
                    value={cleanScript}
                    onChange={(e) => setCleanScript(e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Clean script for video generation..."
                  />
                </div>
              )}
              
              {activeTab === 'scenes' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Scene-by-Scene Preview (editable)</Label>
                    <Badge variant="secondary">{scenePreview.length} scenes</Badge>
                  </div>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto p-2">
                    {scenePreview.length > 0 ? (
                      scenePreview.map((scene, index) => (
                        <Card key={scene.id} className="p-3">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="shrink-0">Scene {scene.sceneNumber}</Badge>
                              <span className="text-xs text-muted-foreground">{params.secondsPerScene}s</span>
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <Volume2 className="w-3 h-3" /> Narration (voiceover)
                              </Label>
                              <Textarea
                                value={scene.narration || ''}
                                onChange={(e) => {
                                  const updated = [...scenePreview];
                                  updated[index].narration = e.target.value;
                                  setScenePreview(updated);
                                }}
                                className="min-h-[50px] text-sm"
                                placeholder="What the narrator says..."
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" /> Visual Description (video prompt)
                              </Label>
                              <Textarea
                                value={scene.visualDescription || scene.description || ''}
                                onChange={(e) => {
                                  const updated = [...scenePreview];
                                  updated[index].visualDescription = e.target.value;
                                  updated[index].description = e.target.value;
                                  setScenePreview(updated);
                                }}
                                className="min-h-[50px] text-sm"
                                placeholder="What the camera sees..."
                              />
                            </div>

                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleTestScene(scene)}
                              className="text-xs"
                            >
                              <PlayIcon className="w-3 h-3 mr-1" />
                              Test Generate
                            </Button>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm text-center py-8">
                        No scenes to preview yet. Generate a script first.
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {audioUrl && (
                <div className="space-y-2 p-4 bg-accent/10 rounded-lg">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Generated Narration</Label>
                    <Button variant="outline" size="sm" onClick={handleDownloadAudio}>
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Download MP3
                    </Button>
                  </div>
                  <audio controls className="w-full">
                    <source src={audioUrl} type="audio/mp3" />
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}
              <Separator />
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Style: {params.style}</Badge>
                  <Badge variant="outline">Audience: {params.audience}</Badge>
                  <Badge variant="outline">Tone: {params.tone}</Badge>
                </div>
                
                {onUseInReel && scenePreview.length > 0 && (
                  <Button 
                    onClick={() => {
                      const reelScenes = scenePreview.map((scene: any, idx: number) => ({
                        sceneNumber: idx + 1,
                        narration: scene.narration || scene.description || '',
                        visualDescription: scene.visualDescription || scene.description || '',
                        duration: parseInt(params.secondsPerScene) || 10,
                      }));
                      onUseInReel(reelScenes);
                    }}
                    className="w-full"
                    variant="default"
                  >
                    <SparklesIcon className="w-4 h-4 mr-2" />
                    Use in Reel
                  </Button>
                )}
                <Button 
                  onClick={handleCreateVideo}
                  className="w-full"
                  variant={onUseInReel ? "outline" : "default"}
                >
                  <VideoIcon className="w-4 h-4 mr-2" />
                  Create Video from Script
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[400px] text-muted-foreground">
              <div className="text-center space-y-2">
                <SparklesIcon className="w-12 h-12 mx-auto opacity-50" />
                <p>Your AI-generated script will appear here</p>
                <p className="text-sm">Fill out the parameters and click generate to get started</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};