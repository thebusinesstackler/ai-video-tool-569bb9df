import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Film, Sparkles, Volume2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

// Speech Recognition types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => ISpeechRecognition;
    webkitSpeechRecognition: new () => ISpeechRecognition;
  }
}

interface PeteAIAssistantProps {
  onMovieIdeaCaptured: (idea: string) => void;
  currentIdea?: string;
}

const PETE_GREETINGS = [
  "Hey there, future filmmaker! 🎬 I'm Pete, your AI movie director. Tell me about the movie you want to create!",
  "Welcome to the studio! I'm Pete, ready to help bring your movie vision to life. What story are we telling today?",
  "Action! I'm Pete, your creative partner. Share your movie idea and let's make cinematic magic together!",
];

const PETE_ENCOURAGEMENTS = [
  "That sounds incredible! I can already see the potential. Let me help you build this out!",
  "Wow, what a concept! This has blockbuster written all over it. Let's develop this further!",
  "I love the direction you're going! This could be something truly special. Ready to create your outline?",
  "Brilliant idea! I'm excited to help you bring this vision to the screen!",
];

export const PeteAIAssistant: React.FC<PeteAIAssistantProps> = ({
  onMovieIdeaCaptured,
  currentIdea
}) => {
  const [isListening, setIsListening] = useState(false);
  const [peteMessage, setPeteMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const [transcript, setTranscript] = useState('');
  const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize with a random greeting
  useEffect(() => {
    if (!hasGreeted) {
      const greeting = PETE_GREETINGS[Math.floor(Math.random() * PETE_GREETINGS.length)];
      typeMessage(greeting);
      setHasGreeted(true);
    }
  }, [hasGreeted]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (typeIntervalRef.current) {
        clearInterval(typeIntervalRef.current);
      }
    };
  }, []);

  // Typewriter effect for Pete's messages
  const typeMessage = (message: string) => {
    // Clear any existing typing interval to prevent interleaving
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
      typeIntervalRef.current = null;
    }
    
    setIsTyping(true);
    setPeteMessage('');
    let index = 0;
    
    typeIntervalRef.current = setInterval(() => {
      if (index < message.length) {
        setPeteMessage(prev => prev + message[index]);
        index++;
      } else {
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
          typeIntervalRef.current = null;
        }
        setIsTyping(false);
      }
    }, 30);
  };

  // Get Pete's response to the movie idea
  const getPeteResponse = async (idea: string) => {
    setIsThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('pete-ai-chat', {
        body: { movieIdea: idea }
      });

      if (error) throw error;

      if (data?.response) {
        typeMessage(data.response);
      } else {
        // Fallback to local encouragement
        const encouragement = PETE_ENCOURAGEMENTS[Math.floor(Math.random() * PETE_ENCOURAGEMENTS.length)];
        typeMessage(encouragement);
      }
    } catch (error) {
      console.error('Pete AI error:', error);
      const encouragement = PETE_ENCOURAGEMENTS[Math.floor(Math.random() * PETE_ENCOURAGEMENTS.length)];
      typeMessage(encouragement);
    } finally {
      setIsThinking(false);
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      typeMessage("Hmm, speech recognition isn't supported in your browser. Try typing your idea instead, or use Chrome!");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript;
      }
      setTranscript(finalTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      typeMessage("Oops! I had trouble hearing that. Want to try again?");
    };

    recognition.onend = () => {
      setIsListening(false);
      if (transcript.trim()) {
        onMovieIdeaCaptured(transcript);
        getPeteResponse(transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
    typeMessage("I'm listening... Tell me about your movie! 🎤");
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20 overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Pete Avatar */}
          <div className={cn(
            "relative flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg",
            isListening && "animate-pulse ring-4 ring-primary/30"
          )}>
            <Film className="w-8 h-8 text-primary-foreground" />
            {isThinking && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-primary animate-spin" />
              </div>
            )}
            {isListening && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center animate-pulse">
                <Volume2 className="w-3 h-3 text-destructive-foreground" />
              </div>
            )}
          </div>

          {/* Pete's Message */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-lg text-foreground">Pete AI</h3>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                Movie Director
              </span>
            </div>
            
            <p className="text-muted-foreground leading-relaxed">
              {peteMessage}
              {isTyping && <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />}
            </p>

            {/* Show transcript while listening */}
            {isListening && transcript && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-foreground italic">"{transcript}"</p>
              </div>
            )}
          </div>

          {/* Microphone Button */}
          <div className="flex-shrink-0">
            <Button
              onClick={isListening ? stopListening : startListening}
              size="lg"
              variant={isListening ? "destructive" : "default"}
              className={cn(
                "rounded-full w-14 h-14 p-0 transition-all",
                isListening && "animate-pulse"
              )}
            >
              {isListening ? (
                <MicOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>
            <p className="text-xs text-center mt-2 text-muted-foreground">
              {isListening ? "Tap to stop" : "Tap to speak"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
