import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { 
  INTRO_TEMPLATES, 
  OUTRO_TEMPLATES,
  IntroTemplate,
  OutroTemplate 
} from '@/data/reelTemplates';
import { 
  Sparkles, 
  MessageCircle, 
  HelpCircle, 
  Timer,
  UserPlus,
  Bell,
  MessageSquare,
  Share2,
  X
} from 'lucide-react';

interface TemplateSelectorProps {
  selectedIntro: string;
  selectedOutro: string;
  introText: string;
  outroText: string;
  onIntroChange: (id: string) => void;
  onOutroChange: (id: string) => void;
  onIntroTextChange: (text: string) => void;
  onOutroTextChange: (text: string) => void;
  disabled?: boolean;
}

const introIcons: Record<string, React.ReactNode> = {
  'none': <X className="w-4 h-4" />,
  'hook-text': <Sparkles className="w-4 h-4" />,
  'topic-title': <MessageCircle className="w-4 h-4" />,
  'question-hook': <HelpCircle className="w-4 h-4" />,
  'countdown': <Timer className="w-4 h-4" />
};

const outroIcons: Record<string, React.ReactNode> = {
  'none': <X className="w-4 h-4" />,
  'cta-follow': <UserPlus className="w-4 h-4" />,
  'cta-subscribe': <Bell className="w-4 h-4" />,
  'cta-comment': <MessageSquare className="w-4 h-4" />,
  'cta-share': <Share2 className="w-4 h-4" />
};

export function TemplateSelector({
  selectedIntro,
  selectedOutro,
  introText,
  outroText,
  onIntroChange,
  onOutroChange,
  onIntroTextChange,
  onOutroTextChange,
  disabled = false
}: TemplateSelectorProps) {
  const selectedIntroTemplate = INTRO_TEMPLATES.find(t => t.id === selectedIntro);
  const selectedOutroTemplate = OUTRO_TEMPLATES.find(t => t.id === selectedOutro);

  return (
    <div className="space-y-6">
      {/* Intro Templates */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Intro Screen</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {INTRO_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onIntroChange(template.id)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center",
                "hover:border-primary/50 hover:bg-primary/5",
                selectedIntro === template.id 
                  ? "border-primary bg-primary/10" 
                  : "border-border bg-background",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center mb-2",
                selectedIntro === template.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}>
                {introIcons[template.id]}
              </div>
              <span className="text-xs font-medium truncate w-full">{template.name}</span>
            </button>
          ))}
        </div>
        
        {selectedIntroTemplate && selectedIntroTemplate.id !== 'none' && (
          <div className="pt-2">
            <Input
              placeholder={selectedIntroTemplate.textPlaceholder}
              value={introText}
              onChange={(e) => onIntroTextChange(e.target.value)}
              disabled={disabled}
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {selectedIntroTemplate.description} • {selectedIntroTemplate.duration}s
            </p>
          </div>
        )}
      </div>

      {/* Outro Templates */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Outro Screen</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {OUTRO_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => onOutroChange(template.id)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center",
                "hover:border-primary/50 hover:bg-primary/5",
                selectedOutro === template.id 
                  ? "border-primary bg-primary/10" 
                  : "border-border bg-background",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center mb-2",
                selectedOutro === template.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-muted-foreground"
              )}>
                {outroIcons[template.id]}
              </div>
              <span className="text-xs font-medium truncate w-full">{template.name}</span>
            </button>
          ))}
        </div>
        
        {selectedOutroTemplate && selectedOutroTemplate.id !== 'none' && (
          <div className="pt-2">
            <Input
              placeholder={selectedOutroTemplate.textPlaceholder}
              value={outroText}
              onChange={(e) => onOutroTextChange(e.target.value)}
              disabled={disabled}
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {selectedOutroTemplate.description} • {selectedOutroTemplate.duration}s
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
