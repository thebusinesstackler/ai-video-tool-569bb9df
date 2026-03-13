import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Video, 
  Mic, 
  Wand2,
  Film,
  User,
  FileText,
  Sparkles,
  Captions,
  Music,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type ReelMode = 'standard' | 'podcast' | 'ai-twin' | 'script-only';

interface FeatureToggle {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  enabled: boolean;
}

interface ReelFeatureSidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  activeMode: ReelMode;
  onModeChange: (mode: ReelMode) => void;
  features: {
    introOutro: boolean;
    cutScenes: boolean;
    upscaler: boolean;
    lipSync: boolean;
    captions: boolean;
    backgroundMusic: boolean;
  };
  onFeatureChange: (feature: keyof ReelFeatureSidebarProps['features'], value: boolean) => void;
  disabled?: boolean;
}

const MODES = [
  { 
    id: 'standard' as ReelMode, 
    label: 'Standard Reel', 
    description: 'Multi-scene video with images and voiceover',
    icon: <Video className="w-5 h-5" />
  },
  { 
    id: 'podcast' as ReelMode, 
    label: 'Podcast Mode', 
    description: 'Long-form audio-focused content',
    icon: <Mic className="w-5 h-5" />
  },
  { 
    id: 'ai-twin' as ReelMode, 
    label: 'AI Twin Mode', 
    description: 'Use your digital twin with cloned voice',
    icon: <User className="w-5 h-5" />
  },
  { 
    id: 'script-only' as ReelMode, 
    label: 'Script Generator', 
    description: 'Generate scripts without video',
    icon: <FileText className="w-5 h-5" />
  },
];

const FEATURES = [
  {
    id: 'introOutro',
    label: 'Intro & Outro',
    description: 'Add branded intro and outro screens',
    icon: <Film className="w-4 h-4" />
  },
  {
    id: 'captions',
    label: 'Captions',
    description: 'Add animated text captions to video',
    icon: <Captions className="w-4 h-4" />
  },
  {
    id: 'backgroundMusic',
    label: 'Background Music',
    description: 'Add ambient music tracks',
    icon: <Music className="w-4 h-4" />
  },
  {
    id: 'cutScenes',
    label: 'Cut Scenes',
    description: 'Add B-roll and transition scenes',
    icon: <Sparkles className="w-4 h-4" />
  },
  {
    id: 'upscaler',
    label: 'Video Upscaler',
    description: 'Enhance video resolution with AI',
    icon: <Wand2 className="w-4 h-4" />
  },
  {
    id: 'lipSync',
    label: 'Lip Sync',
    description: 'Animate portrait with speech',
    icon: <User className="w-4 h-4" />
  },
];

export function ReelFeatureSidebar({
  collapsed,
  onCollapsedChange,
  activeMode,
  onModeChange,
  features,
  onFeatureChange,
  disabled = false
}: ReelFeatureSidebarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isExpanded = isHovered || !collapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <div 
        className={cn(
          "h-full bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out",
          isExpanded ? "w-56" : "w-14"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Header */}
        <div className={cn(
          "p-3 border-b border-sidebar-border flex items-center transition-all duration-300",
          isExpanded ? "justify-start gap-2" : "justify-center"
        )}>
          <Sparkles className="w-5 h-5 text-sidebar-primary flex-shrink-0" />
          {isExpanded && (
            <span className="text-sm font-semibold text-sidebar-foreground whitespace-nowrap">
              Features
            </span>
          )}
        </div>

        {/* Mode Selection */}
        <div className={cn("p-2 border-b border-sidebar-border")}>
          {isExpanded && (
            <Label className="text-xs text-sidebar-foreground/60 uppercase tracking-wide mb-2 block px-2">
              Mode
            </Label>
          )}
          <div className="space-y-1">
            {MODES.map((mode) => (
              <Tooltip key={mode.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onModeChange(mode.id)}
                    disabled={disabled}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-md transition-all duration-200",
                      isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
                      activeMode === mode.id 
                        ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span className="flex-shrink-0">
                      {mode.icon}
                    </span>
                    {isExpanded && (
                      <span className="text-sm font-medium truncate">{mode.label}</span>
                    )}
                  </button>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="bg-popover text-popover-foreground border-border">
                    <p className="font-medium">{mode.label}</p>
                    <p className="text-xs text-muted-foreground">{mode.description}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Feature Toggles */}
        <div className={cn("flex-1 p-2 space-y-1")}>
          {isExpanded && (
            <Label className="text-xs text-sidebar-foreground/60 uppercase tracking-wide mb-2 block px-2">
              Enhancements
            </Label>
          )}
          
          {FEATURES.map((feature) => {
            const isEnabled = features[feature.id as keyof typeof features];
            return (
              <Tooltip key={feature.id}>
                <TooltipTrigger asChild>
                  <div 
                    className={cn(
                      "flex items-center gap-3 rounded-md transition-all duration-200 cursor-pointer",
                      isExpanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
                      isEnabled 
                        ? "bg-sidebar-primary/10 text-sidebar-primary" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    )}
                    onClick={() => !disabled && onFeatureChange(feature.id as keyof typeof features, !isEnabled)}
                  >
                    <div className="flex-shrink-0 relative">
                      {feature.icon}
                      {!isExpanded && isEnabled && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-sidebar-primary" />
                      )}
                    </div>
                    {isExpanded && (
                      <>
                        <span className="flex-1 text-sm font-medium">
                          {feature.label}
                        </span>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(value) => 
                            onFeatureChange(feature.id as keyof typeof features, value)
                          }
                          disabled={disabled}
                          className="data-[state=checked]:bg-sidebar-primary"
                        />
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="bg-popover text-popover-foreground border-border">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{feature.label}</p>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(value) => 
                          onFeatureChange(feature.id as keyof typeof features, value)
                        }
                        disabled={disabled}
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>

        {/* Footer */}
        {isExpanded && (
          <div className="p-3 border-t border-sidebar-border">
            <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
              <Sparkles className="w-3 h-3" />
              <span>AI-powered generation</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
