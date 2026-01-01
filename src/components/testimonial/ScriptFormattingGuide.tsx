import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormattingExample {
  marker: string;
  effect: string;
  example?: string;
}

const pauseExamples: FormattingExample[] = [
  { marker: '...', effect: 'Natural pause/breath', example: 'I tried it... and it worked.' },
  { marker: '(inhale)', effect: 'Breath pause', example: '(inhale) Let me tell you...' },
  { marker: '(pause)', effect: 'Medium pause', example: 'The results (pause) were incredible.' },
  { marker: '(long pause)', effect: 'Dramatic pause', example: 'And then (long pause) everything changed.' },
  { marker: '[BEAT]', effect: 'Rhythmic pause', example: 'First step [BEAT] second step.' },
];

const emphasisExamples: FormattingExample[] = [
  { marker: '**word**', effect: 'Strong emphasis', example: 'This is **incredible**!' },
  { marker: '*word*', effect: 'Moderate emphasis', example: 'I lost *twenty pounds*.' },
  { marker: 'ALL CAPS', effect: 'Emphasized word', example: 'It was AMAZING.' },
  { marker: '?', effect: 'Rising inflection', example: 'Can you believe it?' },
  { marker: '!', effect: 'Energetic delivery', example: 'This changed my life!' },
];

const paceExamples: FormattingExample[] = [
  { marker: '(slower)', effect: 'Slow down speech', example: '(slower) This part is important (end slower)' },
  { marker: '(faster)', effect: 'Speed up speech', example: '(faster) Quick quick quick (end faster)' },
  { marker: '—', effect: 'Dramatic pause (em dash)', example: 'The truth is— I never expected this.' },
];

interface ScriptFormattingGuideProps {
  compact?: boolean;
  className?: string;
}

export function ScriptFormattingGuide({ compact = false, className }: ScriptFormattingGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  const renderSection = (title: string, examples: FormattingExample[]) => (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">{title}</h4>
      <div className="space-y-1.5">
        {examples.map((ex, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-primary whitespace-nowrap">
              {ex.marker}
            </code>
            <span className="text-muted-foreground">{ex.effect}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-6 px-2 text-xs gap-1", className)}
        >
          <HelpCircle className="h-3 w-3" />
          {!compact && 'Formatting'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm mb-1">Script Formatting Guide</h3>
            <p className="text-xs text-muted-foreground">
              Use these markers to control how the AI reads your script.
            </p>
          </div>
          
          {renderSection('Pauses & Breaths', pauseExamples)}
          {renderSection('Emphasis & Inflection', emphasisExamples)}
          {renderSection('Pacing', paceExamples)}
          
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Tip:</span> Commas create slight pauses. 
              Use punctuation naturally for better rhythm.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
