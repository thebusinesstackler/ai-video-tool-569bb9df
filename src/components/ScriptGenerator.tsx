import React, { useState } from 'react';
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
  PlayIcon
} from 'lucide-react';
import { generateScript, isOpenAIConfigured } from '@/lib/openai';
import { kieTTS, isKieConfigured } from '@/lib/kie';
import { useToast } from '@/components/ui/use-toast';
import { ApiKeyManager } from '@/components/ApiKeyManager';

interface ScriptParams {
  topic: string;
  duration: string;
  style: string;
  audience: string;
  tone: string;
  callToAction: string;
}

export const ScriptGenerator = () => {
  const [params, setParams] = useState<ScriptParams>({
    topic: '',
    duration: '60',
    style: 'educational',
    audience: 'general',
    tone: 'professional',
    callToAction: ''
  });
  
  const [generatedScript, setGeneratedScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [apiConfigured, setApiConfigured] = useState(false);
  const [kieConfigured, setKieConfigured] = useState(false);
  const [isNarrating, setIsNarrating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [isNarrationDialogOpen, setIsNarrationDialogOpen] = useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    setApiConfigured(isOpenAIConfigured());
    setKieConfigured(isKieConfigured());
    
    // Listen for localStorage changes to update configuration status
    const handleStorageChange = () => {
      setApiConfigured(isOpenAIConfigured());
      setKieConfigured(isKieConfigured());
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also listen for manual changes within the same tab
    const interval = setInterval(() => {
      setApiConfigured(isOpenAIConfigured());
      setKieConfigured(isKieConfigured());
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

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
      const script = await generateScript(params);
      setGeneratedScript(script);
      toast({
        title: "Script Generated",
        description: "Your AI-powered video script is ready!",
      });
    } catch (error) {
      console.error('Script generation error:', error);
      toast({
        title: "Generation Failed", 
        description: "Failed to generate script. Please try again.",
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
      if (selectedCharacter) {
        const characters = JSON.parse(localStorage.getItem('ai_video_characters') || '[]');
        const character = characters.find((c: any) => c.id === selectedCharacter);
        voiceId = character?.kieVoiceId || 'default';
      }

      const audioBlob = await kieTTS({
        text: generatedScript,
        voiceId,
        format: 'mp3'
      });
      
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      setIsNarrationDialogOpen(false);
      
      toast({
        title: "Narration Ready",
        description: "Your script has been converted to speech!",
      });
    } catch (error) {
      console.error('Narration error:', error);
      toast({
        title: "Narration Failed",
        description: error instanceof Error ? error.message : "Failed to create narration.",
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

  // Show API configuration if not set up
  if (!apiConfigured) {
    return (
      <div className="space-y-6">
        <div className="text-center p-8">
          <SparklesIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground mb-2">API Configuration Required</h2>
          <p className="text-muted-foreground mb-6">
            To generate AI-powered scripts, you need to configure your OpenAI API key.
          </p>
        </div>
        <ApiKeyManager />
      </div>
    );
  }

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
            <Label htmlFor="topic">Video Topic</Label>
            <Textarea
              id="topic"
              placeholder="Describe your video topic, key messages, or product details..."
              value={params.topic}
              onChange={(e) => setParams(prev => ({ ...prev, topic: e.target.value }))}
              className="min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration</Label>
              <Select value={params.duration} onValueChange={(value) => setParams(prev => ({ ...prev, duration: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 seconds</SelectItem>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="90">90 seconds</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                </SelectContent>
              </Select>
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
                              <SelectItem value="">Default Voice</SelectItem>
                              {JSON.parse(localStorage.getItem('ai_video_characters') || '[]').map((char: any) => (
                                <SelectItem key={char.id} value={char.id}>
                                  {char.name} {char.kieVoiceId ? `(${char.kieVoiceId})` : '(Default)'}
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
              <Textarea
                value={generatedScript}
                onChange={(e) => setGeneratedScript(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Your generated script will appear here..."
              />
              
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
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Style: {params.style}</Badge>
                <Badge variant="outline">Audience: {params.audience}</Badge>
                <Badge variant="outline">Tone: {params.tone}</Badge>
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