import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VolumeIcon, LoaderIcon, PlayIcon, DownloadIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AudioGeneratorProps {
  onAudioGenerated: (audioUrl: string, audioFile: File) => void;
  text?: string;
  voice?: string;
  disabled?: boolean;
}

const VOICES = [
  { id: 'alloy', name: 'Alloy' },
  { id: 'echo', name: 'Echo' },
  { id: 'fable', name: 'Fable' },
  { id: 'onyx', name: 'Onyx' },  
  { id: 'nova', name: 'Nova' },
  { id: 'shimmer', name: 'Shimmer' }
];

export const AudioGenerator: React.FC<AudioGeneratorProps> = ({
  onAudioGenerated,
  text = '',
  voice = 'alloy',
  disabled = false
}) => {
  const [inputText, setInputText] = useState(text);
  const [selectedVoice, setSelectedVoice] = useState(voice);
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const generateAudio = async () => {
    if (!inputText.trim()) {
      toast({
        title: "Text Required",
        description: "Please enter text to generate audio from.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('openai-tts', {
        body: {
          text: inputText,
          voice: selectedVoice,
          model: 'tts-1'
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to generate audio');
      }

      if (!data?.audioContent) {
        throw new Error('No audio content received');
      }

      // Convert base64 to blob
      const binaryString = atob(data.audioContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
      const audioFile = new File([audioBlob], 'generated-audio.mp3', { type: 'audio/mpeg' });
      const url = URL.createObjectURL(audioBlob);
      
      setAudioUrl(url);
      
      // Create audio element for playback
      const audio = new Audio(url);
      setAudioElement(audio);
      
      onAudioGenerated(url, audioFile);
      
      toast({
        title: "Audio Generated",
        description: "Your audio has been generated successfully!",
      });
    } catch (error) {
      console.error('Audio generation error:', error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : 'Failed to generate audio',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const playAudio = () => {
    if (audioElement) {
      audioElement.play();
    }
  };

  const downloadAudio = () => {
    if (audioUrl) {
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = 'generated-audio.mp3';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <VolumeIcon className="w-5 h-5" />
          Audio Generator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="audio-text">Text to Convert</Label>
          <textarea
            id="audio-text"
            className="w-full min-h-[100px] p-3 border rounded-md resize-none"
            placeholder="Enter the text you want to convert to speech..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={disabled}
          />
        </div>
        
        <div>
          <Label htmlFor="voice-select">Voice</Label>
          <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={generateAudio} 
          disabled={isGenerating || !inputText.trim() || disabled}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
              Generating Audio...
            </>
          ) : (
            <>
              <VolumeIcon className="w-4 h-4 mr-2" />
              Generate Audio
            </>
          )}
        </Button>

        {audioUrl && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={playAudio}>
              <PlayIcon className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={downloadAudio}>
              <DownloadIcon className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};