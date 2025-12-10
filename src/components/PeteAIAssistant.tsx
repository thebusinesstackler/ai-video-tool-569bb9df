import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mic, MicOff, Film, Sparkles, Volume2, Send } from 'lucide-react';
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
  inputValue?: string;
  onInputChange?: (value: string) => void;
}

const PETE_GREETINGS = [
  "Hey there, future filmmaker! I'm Pete, your AI movie director. Tell me about the movie you want to create!",
  "Welcome to the studio! I'm Pete, ready to help bring your movie vision to life. What story are we telling today?",
  "Lights, camera, action! I'm Pete, your creative partner. Share your movie idea and let's make cinematic magic together!",
];

const PETE_ENCOURAGEMENTS = [
  "That sounds incredible! I can already see the potential. Let me help you build this out!",
  "Wow, what a concept! This has blockbuster written all over it. Let's develop this further!",
  "I love the direction you're going! This could be something truly special. Ready to create your outline?",
  "Brilliant idea! I'm excited to help you bring this vision to the screen!",
];

export const PeteAIAssistant: React.FC<PeteAIAssistantProps> = ({
  onMovieIdeaCaptured,
  currentIdea,
  inputValue = '',
  onInputChange
}) => {
  const [isListening, setIsListening] = useState(false);
  const [peteMessage, setPeteMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const [transcript, setTranscript] = useState('');
  const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [localInput, setLocalInput] = useState('');
  const messageRef = useRef('');

  // Use controlled or uncontrolled input
  const textInputValue = onInputChange ? inputValue : localInput;
  const setTextInputValue = onInputChange || setLocalInput;

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

  // Typewriter effect for Pete's messages - fixed to prevent character doubling
  const typeMessage = (message: string) => {
    // Sanitize message - remove undefined and clean up
    const cleanMessage = (message || '').replace(/undefined/g, '').trim();
    
    // Clear any existing typing interval to prevent interleaving
    if (typeIntervalRef.current) {
      clearInterval(typeIntervalRef.current);
      typeIntervalRef.current = null;
    }
    
    setIsTyping(true);
    setPeteMessage('');
    messageRef.current = '';
    let index = 0;
    
    typeIntervalRef.current = setInterval(() => {
      if (index < cleanMessage.length) {
        const char = cleanMessage.charAt(index);
        messageRef.current += char;
        setPeteMessage(messageRef.current);
        index++;
      } else {
        if (typeIntervalRef.current) {
          clearInterval(typeIntervalRef.current);
          typeIntervalRef.current = null;
        }
        setIsTyping(false);
      }
    }, 25);
  };

  // Get Pete's response to the movie idea
  const getPeteResponse = async (idea: string) => {
    setIsThinking(true);
    try {
      const { data, error } = await supabase.functions.invoke('pete-ai-chat', {
        body: { movieIdea: idea }
      });

      if (error) throw error;

      if (data?.response && typeof data.response === 'string') {
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

  const handleSubmitIdea = () => {
    const idea = textInputValue.trim();
    if (!idea) return;
    
    onMovieIdeaCaptured(idea);
    getPeteResponse(idea);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitIdea();
    }
  };

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      typeMessage("Hmm, speech recognition is not supported in your browser. Try typing your idea instead, or use Chrome!");
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
        setTextInputValue(transcript);
        onMovieIdeaCaptured(transcript);
        getPeteResponse(transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
    typeMessage("I'm listening... Tell me about your movie!");
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

          {/* Pete's Message and Input */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-lg text-foreground">Pete AI</h3>
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                Movie Director
              </span>
            </div>
            
            <p className="text-muted-foreground leading-relaxed mb-4">
              {peteMessage}
              {isTyping && <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />}
            </p>

            {/* Show transcript while listening */}
            {isListening && transcript && (
              <div className="mb-4 p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm text-foreground italic">"{transcript}"</p>
              </div>
            )}

            {/* Text Input - Taller Textarea */}
            <div className="flex gap-2">
              <Textarea
                value={textInputValue}
                onChange={(e) => setTextInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your movie idea here... (Press Enter to submit, Shift+Enter for new line)"
                className="flex-1 min-h-[80px] bg-background/50 border-border focus:border-primary resize-none"
                disabled={isListening || isThinking}
                rows={3}
              />
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSubmitIdea}
                  disabled={!textInputValue.trim() || isListening || isThinking}
                  size="icon"
                  className="shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
                <Button
                  onClick={isListening ? stopListening : startListening}
                  size="icon"
                  variant={isListening ? "destructive" : "outline"}
                  className={cn(
                    "shrink-0 transition-all",
                    isListening && "animate-pulse"
                  )}
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" />
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};