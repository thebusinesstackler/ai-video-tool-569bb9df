import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Upload, Play, Pause, Loader2, Check, Volume2, StopCircle, Trash2 } from 'lucide-react';

interface VoiceClonerProps {
  voiceSampleUrl: string | null;
  voiceCloningKey: string | null;
  onVoiceSampleChange: (url: string | null) => void;
  onVoiceCloningKeyChange: (key: string | null) => void;
}

export const VoiceCloner: React.FC<VoiceClonerProps> = ({
  voiceSampleUrl,
  voiceCloningKey,
  onVoiceSampleChange,
  onVoiceCloningKeyChange
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await uploadAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      const interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      setRecordingInterval(interval);

    } catch (error: any) {
      console.error('Error starting recording:', error);
      toast({
        title: 'Recording Failed',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingInterval) {
        clearInterval(recordingInterval);
        setRecordingInterval(null);
      }
    }
  };

  const uploadAudioBlob = async (blob: Blob) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Path must start with user ID for RLS policy: (auth.uid())::text = (storage.foldername(name))[1]
      const fileName = `${user.id}/voice-samples/${Date.now()}.webm`;
      const { data, error } = await supabase.storage
        .from('project-files')
        .upload(fileName, blob, { contentType: 'audio/webm' });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName);

      onVoiceSampleChange(urlData.publicUrl);
      toast({
        title: 'Audio Uploaded',
        description: 'Your voice sample is ready for cloning'
      });
    } catch (error: any) {
      console.error('Error uploading audio:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload audio',
        variant: 'destructive'
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      toast({
        title: 'Invalid File',
        description: 'Please upload an audio file (MP3, WAV, etc.)',
        variant: 'destructive'
      });
      return;
    }

    await uploadAudioBlob(file);
  };

  const cloneVoice = async () => {
    if (!voiceSampleUrl) {
      toast({
        title: 'No Audio Sample',
        description: 'Please record or upload an audio sample first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsCloning(true);

      const { data, error } = await supabase.functions.invoke('clone-voice', {
        body: { audioUrl: voiceSampleUrl }
      });

      if (error) throw error;

      if (data?.voiceCloningKey) {
        onVoiceCloningKeyChange(data.voiceCloningKey);
        toast({
          title: 'Voice Cloned!',
          description: 'Your voice has been successfully cloned'
        });
      } else {
        throw new Error('No voice cloning key returned');
      }
    } catch (error: any) {
      console.error('Error cloning voice:', error);
      toast({
        title: 'Cloning Failed',
        description: error.message || 'Failed to clone voice',
        variant: 'destructive'
      });
    } finally {
      setIsCloning(false);
    }
  };

  const playPreview = () => {
    if (audioRef.current && voiceSampleUrl) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.src = voiceSampleUrl;
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const clearAudio = () => {
    onVoiceSampleChange(null);
    onVoiceCloningKeyChange(null);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium">Clone Your Voice (Optional)</h4>
        <p className="text-sm text-muted-foreground">
          Record or upload 30+ seconds of clear speech to create a voice clone using Google Cloud
        </p>
      </div>

      {/* Recording/Upload Options */}
      {!voiceSampleUrl ? (
        <div className="grid grid-cols-2 gap-4">
          <Card 
            className={`cursor-pointer transition-all hover:border-primary ${isRecording ? 'border-destructive bg-destructive/5' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            <CardContent className="flex flex-col items-center justify-center p-8">
              {isRecording ? (
                <>
                  <StopCircle className="w-12 h-12 text-destructive mb-3 animate-pulse" />
                  <p className="font-medium">Recording...</p>
                  <p className="text-2xl font-mono mt-2">{formatTime(recordingTime)}</p>
                  <p className="text-xs text-muted-foreground mt-2">Click to stop</p>
                </>
              ) : (
                <>
                  <Mic className="w-12 h-12 text-primary mb-3" />
                  <p className="font-medium">Record Voice</p>
                  <p className="text-xs text-muted-foreground mt-1">Click to start recording</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer transition-all hover:border-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center p-8">
              <Upload className="w-12 h-12 text-primary mb-3" />
              <p className="font-medium">Upload Audio</p>
              <p className="text-xs text-muted-foreground mt-1">MP3, WAV, or other audio</p>
            </CardContent>
          </Card>

          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={playPreview}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <div>
                  <p className="font-medium">Voice Sample Ready</p>
                  <p className="text-xs text-muted-foreground">Click play to preview</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {voiceCloningKey ? (
                  <Badge className="bg-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    Cloned
                  </Badge>
                ) : (
                  <Button
                    onClick={cloneVoice}
                    disabled={isCloning}
                    className="bg-gradient-primary"
                  >
                    {isCloning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cloning...
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4 mr-2" />
                        Clone Voice
                      </>
                    )}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={clearAudio}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hidden audio element for playback */}
      <audio 
        ref={audioRef} 
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      {/* Info */}
      <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Tips for best results:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Record in a quiet environment</li>
          <li>Speak clearly and naturally for 30+ seconds</li>
          <li>Avoid background noise and music</li>
          <li>Voice cloning is powered by Google Cloud</li>
        </ul>
      </div>
    </div>
  );
};
