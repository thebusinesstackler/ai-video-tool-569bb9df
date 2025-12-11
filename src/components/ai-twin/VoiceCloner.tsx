import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Mic, Upload, Play, Pause, Loader2, Check, Volume2, StopCircle, Trash2, AlertCircle } from 'lucide-react';

interface VoiceClonerProps {
  voiceSampleUrl: string | null;
  voiceCloningKey: string | null;
  consentAudioUrl?: string | null;
  onVoiceSampleChange: (url: string | null) => void;
  onVoiceCloningKeyChange: (key: string | null) => void;
  onConsentAudioChange?: (url: string | null) => void;
}

const CONSENT_SCRIPT = "I am the owner of this voice and I consent to Google using this voice to create a synthetic voice model";

// Convert AudioBuffer to WAV blob
const audioBufferToWav = (buffer: AudioBuffer): Blob => {
  const numChannels = 1; // Mono
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const samples = buffer.getChannelData(0);
  const dataLength = samples.length * bytesPerSample;
  const bufferLength = 44 + dataLength;
  
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };
  
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);
  
  // Write audio data
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' });
};

// Convert any audio blob to WAV format
const convertToWav = async (blob: Blob): Promise<Blob> => {
  const audioContext = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioContext.close();
  return audioBufferToWav(audioBuffer);
};

type RecordingStep = 'idle' | 'consent' | 'reference';

export const VoiceCloner: React.FC<VoiceClonerProps> = ({
  voiceSampleUrl,
  voiceCloningKey,
  consentAudioUrl,
  onVoiceSampleChange,
  onVoiceCloningKeyChange,
  onConsentAudioChange
}) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [recordingStep, setRecordingStep] = useState<RecordingStep>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCloning, setIsCloning] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);
  const [tempConsentUrl, setTempConsentUrl] = useState<string | null>(null);

  const startRecording = async (step: RecordingStep) => {
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
      
      // Try to use WAV/PCM format, fallback to webm if not supported
      // Note: Most browsers support audio/webm but Google needs LINEAR16/MP3/M4A
      // We'll record as webm and the file extension will help the backend know the format
      const mimeType = MediaRecorder.isTypeSupported('audio/wav') 
        ? 'audio/wav' 
        : MediaRecorder.isTypeSupported('audio/mp4')
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
        await uploadAudioBlob(audioBlob, step, mimeType);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingStep(step);
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

  const uploadAudioBlob = async (blob: Blob, step: RecordingStep, mimeType?: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Convert to WAV format for Google Cloud compatibility
      let finalBlob = blob;
      let extension = 'wav';
      let contentType = 'audio/wav';
      
      // If not already WAV, convert it
      if (!mimeType?.includes('wav')) {
        console.log('Converting audio to WAV format...');
        try {
          finalBlob = await convertToWav(blob);
          console.log('Audio converted to WAV successfully');
        } catch (conversionError) {
          console.error('Failed to convert audio:', conversionError);
          throw new Error('Failed to convert audio to WAV format. Please try uploading an MP3 or WAV file instead.');
        }
      }
      
      const folder = step === 'consent' ? 'consent-audio' : 'voice-samples';
      const fileName = `${user.id}/${folder}/${Date.now()}.${extension}`;
      const { data, error } = await supabase.storage
        .from('project-files')
        .upload(fileName, finalBlob, { contentType });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('project-files')
        .getPublicUrl(fileName);

      if (step === 'consent') {
        setTempConsentUrl(urlData.publicUrl);
        onConsentAudioChange?.(urlData.publicUrl);
        toast({
          title: 'Consent Recorded',
          description: 'Now record your voice sample (30+ seconds of natural speech)'
        });
        setRecordingStep('idle');
      } else {
        onVoiceSampleChange(urlData.publicUrl);
        toast({
          title: 'Voice Sample Uploaded',
          description: 'Both recordings ready for cloning'
        });
        setRecordingStep('idle');
      }
    } catch (error: any) {
      console.error('Error uploading audio:', error);
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload audio',
        variant: 'destructive'
      });
      setRecordingStep('idle');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Accept only supported formats: MP3, WAV, M4A
    const supportedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/m4a', 'audio/mp4'];
    const isSupported = supportedTypes.some(type => file.type.includes(type.split('/')[1])) || 
                        file.name.match(/\.(mp3|wav|m4a)$/i);
    
    if (!isSupported) {
      toast({
        title: 'Unsupported Format',
        description: 'Please upload an MP3, WAV, or M4A audio file. WebM is not supported.',
        variant: 'destructive'
      });
      return;
    }

    // For file uploads, we still need consent first
    if (!tempConsentUrl && !consentAudioUrl) {
      toast({
        title: 'Consent Required',
        description: 'Please record the consent statement first before uploading a voice sample',
        variant: 'destructive'
      });
      return;
    }

    // Get the file extension
    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
    const contentType = ext === 'wav' ? 'audio/wav' : ext === 'm4a' ? 'audio/m4a' : 'audio/mpeg';
    
    // Upload directly without conversion since it's already in a supported format
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const folder = 'voice-samples';
      const fileName = `${user.id}/${folder}/${Date.now()}.${ext}`;
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
        description: 'Audio file uploaded successfully. Ready for cloning!'
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
    const consent = tempConsentUrl || consentAudioUrl;
    if (!voiceSampleUrl || !consent) {
      toast({
        title: 'Missing Audio',
        description: 'Please record both consent and voice sample first',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsCloning(true);

      const { data, error } = await supabase.functions.invoke('clone-voice', {
        body: { 
          audioUrl: voiceSampleUrl,
          consentAudioUrl: consent,
          consentScript: CONSENT_SCRIPT
        }
      });

      if (error) throw error;

      if (data?.voiceCloningKey) {
        onVoiceCloningKeyChange(data.voiceCloningKey);
        toast({
          title: 'Voice Cloned!',
          description: 'Your voice has been successfully cloned with Google Cloud'
        });
      } else {
        throw new Error(data?.error || 'No voice cloning key returned');
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
    onConsentAudioChange?.(null);
    setTempConsentUrl(null);
    setIsPlaying(false);
    setRecordingStep('idle');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hasConsent = tempConsentUrl || consentAudioUrl;
  const hasVoiceSample = voiceSampleUrl;
  const isReadyToClone = hasConsent && hasVoiceSample && !voiceCloningKey;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium">Clone Your Voice (Optional)</h4>
        <p className="text-sm text-muted-foreground">
          Google Cloud voice cloning requires a consent recording and a voice sample
        </p>
      </div>

      {/* Step 1: Consent Recording */}
      {!hasConsent && !isRecording && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div className="flex-1">
                <h5 className="font-medium mb-2">Step 1: Record Consent Statement</h5>
                <p className="text-sm text-muted-foreground mb-4">
                  Google requires you to say the following consent statement:
                </p>
                <blockquote className="border-l-4 border-primary pl-4 py-2 mb-4 bg-background/50 rounded">
                  <p className="text-sm italic">"{CONSENT_SCRIPT}"</p>
                </blockquote>
                <Button onClick={() => startRecording('consent')}>
                  <Mic className="w-4 h-4 mr-2" />
                  Record Consent
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recording UI */}
      {isRecording && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <StopCircle className="w-16 h-16 text-destructive mb-4 animate-pulse" />
            <p className="font-medium text-lg mb-2">
              Recording {recordingStep === 'consent' ? 'Consent' : 'Voice Sample'}...
            </p>
            <p className="text-3xl font-mono mb-4">{formatTime(recordingTime)}</p>
            {recordingStep === 'consent' && (
              <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
                Say: "{CONSENT_SCRIPT}"
              </p>
            )}
            {recordingStep === 'reference' && (
              <p className="text-sm text-muted-foreground mb-4">
                Speak naturally for 30+ seconds
              </p>
            )}
            <Button variant="destructive" onClick={stopRecording}>
              <StopCircle className="w-4 h-4 mr-2" />
              Stop Recording
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Voice Sample Recording */}
      {hasConsent && !hasVoiceSample && !isRecording && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <Check className="w-3 h-3 mr-1" />
              Consent Recorded
            </Badge>
          </div>
          
          <Card className="border-primary/50">
            <CardContent className="p-6">
              <h5 className="font-medium mb-2">Step 2: Record Voice Sample</h5>
              <p className="text-sm text-muted-foreground mb-4">
                Record 30+ seconds of clear, natural speech for best results
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <Card 
                  className="cursor-pointer transition-all hover:border-primary"
                  onClick={() => startRecording('reference')}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Mic className="w-10 h-10 text-primary mb-2" />
                    <p className="font-medium text-sm">Record Voice</p>
                  </CardContent>
                </Card>

                <Card 
                  className="cursor-pointer transition-all hover:border-primary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Upload className="w-10 h-10 text-primary mb-2" />
                    <p className="font-medium text-sm">Upload Audio</p>
                  </CardContent>
                </Card>
              </div>
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
      )}

      {/* Both recordings complete - ready to clone */}
      {hasVoiceSample && (
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
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                      <Check className="w-3 h-3 mr-1" />
                      Consent
                    </Badge>
                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30 text-xs">
                      <Check className="w-3 h-3 mr-1" />
                      Voice Sample
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Click play to preview voice sample</p>
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
                    disabled={isCloning || !isReadyToClone}
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
          <li>Voice cloning is powered by Google Cloud Chirp 3</li>
        </ul>
      </div>
    </div>
  );
};