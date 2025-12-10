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
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    cutScenes: boolean;
    upscaler: boolean;
    lipSync: boolean;
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
    id: 'cutScenes',
    label: 'Cut Scenes',
    description: 'Add B-roll and transition scenes',
    icon: <Film className="w-4 h-4" />
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
  return (
    <TooltipProvider delayDuration={0}>
      <div 
        className={cn(
          "h-full bg-card border-r border-border flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Header with collapse button */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          {!collapsed && (
            <span className="text-sm font-semibold text-foreground">Features</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-auto"
            onClick={() => onCollapsedChange(!collapsed)}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Mode Selection */}
        <div className={cn("p-3 border-b border-border", collapsed && "px-2")}>
          {!collapsed && (
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
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
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                      "hover:bg-muted/50",
                      activeMode === mode.id 
                        ? "bg-primary/10 text-primary border border-primary/30" 
                        : "text-muted-foreground",
                      disabled && "opacity-50 cursor-not-allowed",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <span className={cn(
                      "flex-shrink-0",
                      activeMode === mode.id && "text-primary"
                    )}>
                      {mode.icon}
                    </span>
                    {!collapsed && (
                      <span className="text-sm font-medium truncate">{mode.label}</span>
                    )}
                  </button>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p className="font-medium">{mode.label}</p>
                    <p className="text-xs text-muted-foreground">{mode.description}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </div>
        </div>

        {/* Feature Toggles */}
        <div className={cn("flex-1 p-3 space-y-3", collapsed && "px-2")}>
          {!collapsed && (
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
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
                      "flex items-center gap-3 p-2 rounded-lg transition-all",
                      isEnabled ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/30",
                      collapsed && "justify-center"
                    )}
                  >
                    <div className={cn(
                      "flex-shrink-0",
                      isEnabled ? "text-primary" : "text-muted-foreground"
                    )}>
                      {feature.icon}
                    </div>
                    {!collapsed && (
                      <>
                        <span className={cn(
                          "flex-1 text-sm",
                          isEnabled ? "text-foreground" : "text-muted-foreground"
                        )}>
                          {feature.label}
                        </span>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={(value) => 
                            onFeatureChange(feature.id as keyof typeof features, value)
                          }
                          disabled={disabled}
                        />
                      </>
                    )}
                    {collapsed && (
                      <div 
                        className={cn(
                          "absolute -right-1 -top-1 w-2 h-2 rounded-full",
                          isEnabled ? "bg-primary" : "hidden"
                        )}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{feature.label}</p>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(value) => 
                          onFeatureChange(feature.id as keyof typeof features, value)
                        }
                        disabled={disabled}
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
        {!collapsed && (
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="w-3 h-3" />
              <span>AI-powered generation</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
