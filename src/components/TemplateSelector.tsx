import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  INTRO_TEMPLATES, 
  OUTRO_TEMPLATES,
  OUTRO_CATEGORIES,
  IntroTemplate,
  OutroTemplate,
  LogoAnimation
} from '@/data/reelTemplates';
import { LogoUploader } from '@/components/LogoUploader';
import { 
  Sparkles, 
  MessageCircle, 
  HelpCircle, 
  Timer,
  UserPlus,
  Bell,
  MessageSquare,
  Share2,
  X,
  Palette,
  Briefcase,
  Heart,
  Globe,
  Quote,
  ListChecks,
  Flame,
  Mail,
  Calendar,
  Film,
  ThumbsUp,
  Users,
  Zap
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
  selectedLogoUrl?: string | null;
  selectedLogoAnimation?: LogoAnimation;
  onLogoChange?: (url: string | null) => void;
  onLogoAnimationChange?: (animation: LogoAnimation) => void;
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
  // Brand
  'logo-fade': <Palette className="w-4 h-4" />,
  'logo-animate': <Zap className="w-4 h-4" />,
  'logo-glitch': <Sparkles className="w-4 h-4" />,
  'logo-neon': <Sparkles className="w-4 h-4" />,
  // Social
  'cta-follow': <UserPlus className="w-4 h-4" />,
  'cta-follow-animated': <Heart className="w-4 h-4" />,
  'cta-subscribe': <Bell className="w-4 h-4" />,
  'cta-like-subscribe': <ThumbsUp className="w-4 h-4" />,
  'cta-all-socials': <Users className="w-4 h-4" />,
  'cta-comment': <MessageSquare className="w-4 h-4" />,
  'cta-share': <Share2 className="w-4 h-4" />,
  // Engagement
  'teaser-next': <Film className="w-4 h-4" />,
  'question-poll': <HelpCircle className="w-4 h-4" />,
  'quote-end': <Quote className="w-4 h-4" />,
  'recap-highlights': <ListChecks className="w-4 h-4" />,
  'challenge-cta': <Flame className="w-4 h-4" />,
  // Professional
  'thank-you': <Heart className="w-4 h-4" />,
  'contact-info': <Mail className="w-4 h-4" />,
  'website-cta': <Globe className="w-4 h-4" />,
  'credits-roll': <Film className="w-4 h-4" />,
  'book-call': <Calendar className="w-4 h-4" />
};

const categoryIcons: Record<string, React.ReactNode> = {
  'brand': <Palette className="w-4 h-4" />,
  'social': <Share2 className="w-4 h-4" />,
  'engagement': <MessageCircle className="w-4 h-4" />,
  'professional': <Briefcase className="w-4 h-4" />
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
  selectedLogoUrl,
  selectedLogoAnimation = 'fade',
  onLogoChange,
  onLogoAnimationChange,
  disabled = false
}: TemplateSelectorProps) {
  const [outroCategory, setOutroCategory] = useState<string>('brand');
  const selectedIntroTemplate = INTRO_TEMPLATES.find(t => t.id === selectedIntro);
  const selectedOutroTemplate = OUTRO_TEMPLATES.find(t => t.id === selectedOutro);

  const filteredOutros = OUTRO_TEMPLATES.filter(t => 
    t.id === 'none' || t.category === outroCategory
  );

  const showLogoUploader = selectedOutroTemplate?.supportsLogo && onLogoChange && onLogoAnimationChange;

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
        
        {/* Category Tabs */}
        <Tabs value={outroCategory} onValueChange={setOutroCategory} className="w-full">
          <TabsList className="grid w-full grid-cols-4 h-9">
            {OUTRO_CATEGORIES.map((cat) => (
              <TabsTrigger 
                key={cat.id} 
                value={cat.id}
                className="text-xs px-2 gap-1"
                disabled={disabled}
              >
                {categoryIcons[cat.id]}
                <span className="hidden sm:inline">{cat.name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {OUTRO_CATEGORIES.map((cat) => (
            <TabsContent key={cat.id} value={cat.id} className="mt-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {/* No Outro option */}
                <button
                  onClick={() => onOutroChange('none')}
                  disabled={disabled}
                  className={cn(
                    "flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center",
                    "hover:border-primary/50 hover:bg-primary/5",
                    selectedOutro === 'none'
                      ? "border-primary bg-primary/10" 
                      : "border-border bg-background",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center mb-2",
                    selectedOutro === 'none'
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    <X className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-medium">No Outro</span>
                </button>

                {OUTRO_TEMPLATES
                  .filter(t => t.category === cat.id)
                  .map((template) => (
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
                      {template.supportsLogo && (
                        <span className="text-[10px] text-primary mt-1">+ Logo</span>
                      )}
                    </button>
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        
        {selectedOutroTemplate && selectedOutroTemplate.id !== 'none' && (
          <div className="pt-2 space-y-4">
            <div>
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

            {/* Logo Uploader for logo-supporting outros */}
            {showLogoUploader && (
              <Card className="bg-muted/20 border-muted">
                <CardContent className="p-4">
                  <LogoUploader
                    selectedLogoUrl={selectedLogoUrl || null}
                    selectedAnimation={selectedLogoAnimation}
                    onLogoChange={onLogoChange}
                    onAnimationChange={onLogoAnimationChange}
                    disabled={disabled}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
