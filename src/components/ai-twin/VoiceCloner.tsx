import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Upload, Play, Pause, Loader2, Check, Volume2, StopCircle, Trash2, AlertCircle, User, Mail } from 'lucide-react';

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
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Consent form fields
  const [consentName, setConsentName] = useState('');
  const [consentEmail, setConsentEmail] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });
      streamRef.current = stream;
      
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';
      
      console.log('Recording with MIME type:', mimeType);
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await uploadAudioBlob(audioBlob, mimeType);
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

  const uploadAudioBlob = async (blob: Blob, mimeType?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const ext = mimeType?.includes('mp4') ? 'm4a' : 'webm';
      const contentType = mimeType || 'audio/webm';
      
      const fileName = `${user.id}/voice-samples/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('project-files')
        .upload(fileName, blob, { contentType });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName);

      onVoiceSampleChange(urlData.publicUrl);
      toast({
        title: 'Voice Sample Uploaded',
        description: 'Audio file uploaded. Fill in the consent form to clone your voice.'
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
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File selected:', file.name, 'Type:', file.type, 'Size:', file.size);

    // Check file size - Speechify has a ~10MB limit
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: 'File Too Large',
        description: 'Please upload an audio file under 10MB. Try using MP3 format for smaller file sizes.',
        variant: 'destructive'
      });
      e.target.value = '';
      return;
    }

    // Check by file extension (more reliable than MIME type)
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const supportedExtensions = ['mp3', 'wav', 'wave', 'm4a', 'webm', 'mp4', 'ogg'];
    
    if (!supportedExtensions.includes(ext)) {
      toast({
        title: 'Unsupported Format',
        description: `Please upload an audio file (MP3, WAV, M4A, or WebM). Got: .${ext}`,
        variant: 'destructive'
      });
      e.target.value = '';
      return;
    }

    // Map extension to content type
    const contentTypeMap: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'wave': 'audio/wav',
      'm4a': 'audio/mp4',
      'webm': 'audio/webm',
      'mp4': 'audio/mp4',
      'ogg': 'audio/ogg'
    };
    const contentType = contentTypeMap[ext] || 'audio/mpeg';
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const fileName = `${user.id}/voice-samples/${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from('project-files')
        .upload(fileName, file, { contentType });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName);

      onVoiceSampleChange(urlData.publicUrl);
      toast({
        title: 'Voice Sample Uploaded',
        description: 'Audio file uploaded. Fill in the consent form to clone your voice.'
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

  const cloneVoice = async () => {
    if (!voiceSampleUrl) {
      toast({
        title: 'Missing Audio',
        description: 'Please record or upload a voice sample first',
        variant: 'destructive'
      });
      return;
    }

    if (!consentName.trim() || !consentEmail.trim()) {
      toast({
        title: 'Missing Consent Info',
        description: 'Please enter your name and email for consent',
        variant: 'destructive'
      });
      return;
    }

    if (!consentChecked) {
      toast({
        title: 'Consent Required',
        description: 'Please confirm you have the right to clone this voice',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsCloning(true);

      const { data, error } = await supabase.functions.invoke('clone-voice-speechify', {
        body: { 
          audioUrl: voiceSampleUrl,
          name: consentName.trim(),
          email: consentEmail.trim(),
          gender: 'male' // Could be made configurable
        }
      });

      if (error) throw error;

      if (data?.speechifyVoiceId) {
        onVoiceCloningKeyChange(data.speechifyVoiceId);
        toast({
          title: 'Voice Cloned!',
          description: 'Your voice has been successfully cloned with Speechify'
        });
      } else {
        throw new Error(data?.error || 'No voice ID returned');
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

  const playPreview = async () => {
    if (!audioRef.current || !voiceSampleUrl) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        audioRef.current.src = voiceSampleUrl;
        audioRef.current.load();
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error playing audio:', error);
        toast({
          title: 'Playback Failed',
          description: 'Could not play audio.',
          variant: 'destructive'
        });
      }
    }
  };

  const clearAudio = () => {
    onVoiceSampleChange(null);
    onVoiceCloningKeyChange(null);
    setConsentName('');
    setConsentEmail('');
    setConsentChecked(false);
    setIsPlaying(false);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasVoiceSample = voiceSampleUrl;
  const isReadyToClone = hasVoiceSample && !voiceCloningKey && consentName.trim() && consentEmail.trim() && consentChecked;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="font-medium">Clone Your Voice (Optional)</h4>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            Beta
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          AI Voice Cloning — record 30+ seconds of clear speech
        </p>
        <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            AI Voice Cloning is in beta and temporarily unavailable. Cloning will unlock once voice credits are added to your account.
          </span>
        </div>
      </div>

      {/* Recording UI */}
      {isRecording && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <StopCircle className="w-16 h-16 text-destructive mb-4 animate-pulse" />
            <p className="font-medium text-lg mb-2">Recording Voice Sample...</p>
            <p className="text-3xl font-mono mb-4">{formatTime(recordingTime)}</p>
            <p className="text-sm text-muted-foreground mb-4">
              Speak naturally for 30+ seconds for best results
            </p>
            <Button variant="destructive" onClick={stopRecording}>
              <StopCircle className="w-4 h-4 mr-2" />
              Stop Recording
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Voice Sample Recording/Upload */}
      {!hasVoiceSample && !isRecording && (
        <Card className="border-primary/50">
          <CardContent className="p-6">
            <h5 className="font-medium mb-2">Step 1: Record or Upload Voice Sample</h5>
            <p className="text-sm text-muted-foreground mb-4">
              Record 30+ seconds of clear, natural speech for best results
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <Card 
                className="cursor-pointer transition-all hover:border-primary"
                onClick={startRecording}
              >
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <Mic className="w-10 h-10 text-primary mb-2" />
                  <p className="font-medium text-sm">Record Voice</p>
                </CardContent>
              </Card>

              <label className="cursor-pointer">
                <Card className="transition-all hover:border-primary">
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Upload className="w-10 h-10 text-primary mb-2" />
                    <p className="font-medium text-sm">Upload Audio</p>
                  </CardContent>
                </Card>
                <input
                  type="file"
                  accept=".mp3,.wav,.m4a,.webm,audio/mpeg,audio/wav,audio/mp4,audio/webm"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Voice sample ready - show consent form */}
      {hasVoiceSample && !voiceCloningKey && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <Check className="w-3 h-3 mr-1" />
              Voice Sample Ready
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={playPreview}
              className="h-8"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          <Card className="border-primary/50">
            <CardContent className="p-6 space-y-4">
              <h5 className="font-medium">Step 2: Consent Information</h5>
              <p className="text-sm text-muted-foreground">
                We require consent information before cloning your voice
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Your full name"
                    value={consentName}
                    onChange={(e) => setConsentName(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Your email address"
                    value={consentEmail}
                    onChange={(e) => setConsentEmail(e.target.value)}
                  />
                </div>
                <div className="flex items-start gap-2 pt-2">
                  <Checkbox
                    id="consent"
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked === true)}
                  />
                  <label htmlFor="consent" className="text-sm text-muted-foreground cursor-pointer">
                    I confirm this voice belongs to me or I have permission from the voice owner to clone it
                  </label>
                </div>
              </div>

              <Button
                onClick={cloneVoice}
                disabled={isCloning || !isReadyToClone}
                className="w-full"
              >
                {isCloning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cloning Voice...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 mr-2" />
                    Clone Voice with Speechify
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Voice cloned successfully */}
      {voiceCloningKey && (
        <Card className="bg-green-500/10 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h5 className="font-medium text-green-600">Voice Cloned Successfully!</h5>
                  <p className="text-sm text-muted-foreground">
                    Your AI Twin can now speak with your cloned voice
                  </p>
                </div>
              </div>
              
              <Button variant="ghost" size="sm" onClick={clearAudio}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <audio
        ref={audioRef}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
};
