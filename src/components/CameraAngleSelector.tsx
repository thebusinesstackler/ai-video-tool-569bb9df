import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  CAMERA_ANGLES, 
  CAMERA_CATEGORIES, 
  CameraAngle,
  CameraCategory 
} from '@/data/cameraAngles';
import { 
  Camera, 
  Move, 
  User, 
  Maximize,
  Eye,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Crosshair,
  Video,
  Sun,
  Sparkles,
  Zap
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CameraAngleSelectorProps {
  selectedAngle: string;
  onAngleChange: (id: string) => void;
  disabled?: boolean;
}

const categoryIcons: Record<CameraCategory, React.ReactNode> = {
  'static': <Camera className="w-4 h-4" />,
  'framing': <Maximize className="w-4 h-4" />,
  'character': <User className="w-4 h-4" />,
  'movement': <Move className="w-4 h-4" />,
  'lighting': <Sun className="w-4 h-4" />,
  'mood': <Sparkles className="w-4 h-4" />,
  'action': <Zap className="w-4 h-4" />,
};

const angleIcons: Record<string, React.ReactNode> = {
  'eye-level': <Eye className="w-4 h-4" />,
  'low-angle': <ArrowUp className="w-4 h-4" />,
  'high-angle': <ArrowDown className="w-4 h-4" />,
  'birds-eye': <ArrowDown className="w-4 h-4" />,
  'worms-eye': <ArrowUp className="w-4 h-4" />,
  'dutch-angle': <RotateCcw className="w-4 h-4" />,
  'closeup': <Crosshair className="w-4 h-4" />,
  'pov-shot': <Eye className="w-4 h-4" />,
  'tracking-shot': <Move className="w-4 h-4" />,
  'dolly-zoom': <Video className="w-4 h-4" />,
};

export function CameraAngleSelector({
  selectedAngle,
  onAngleChange,
  disabled = false
}: CameraAngleSelectorProps) {
  const [activeCategory, setActiveCategory] = useState<string>('static');
  const selectedAngleData = CAMERA_ANGLES.find(a => a.id === selectedAngle);

  const getAngleIcon = (angleId: string) => {
    return angleIcons[angleId] || <Camera className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Camera Angle</Label>
        {selectedAngleData && (
          <span className="text-xs text-muted-foreground">
            {selectedAngleData.name}
          </span>
        )}
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1">
          {CAMERA_CATEGORIES.map((category) => (
            <TabsTrigger 
              key={category.id} 
              value={category.id}
              className="text-xs px-3 py-1.5 gap-1"
              disabled={disabled}
            >
              {categoryIcons[category.id as CameraCategory]}
              <span className="hidden sm:inline">{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {CAMERA_CATEGORIES.map((category) => (
          <TabsContent key={category.id} value={category.id} className="mt-3">
            <TooltipProvider delayDuration={300}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {CAMERA_ANGLES
                  .filter(angle => angle.category === category.id)
                  .map((angle) => (
                    <Tooltip key={angle.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onAngleChange(angle.id)}
                          disabled={disabled}
                          className={cn(
                            "flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center min-h-[80px]",
                            "hover:border-primary/50 hover:bg-primary/5",
                            selectedAngle === angle.id 
                              ? "border-primary bg-primary/10" 
                              : "border-border bg-background",
                            disabled && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center mb-2",
                            selectedAngle === angle.id 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted text-muted-foreground"
                          )}>
                            {getAngleIcon(angle.id)}
                          </div>
                          <span className="text-xs font-medium line-clamp-2">{angle.name}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[250px] p-3">
                        <div className="space-y-2">
                          <p className="font-medium text-sm">{angle.name}</p>
                          <p className="text-xs text-muted-foreground">{angle.description}</p>
                          <div className="pt-2 border-t border-border">
                            <p className="text-xs italic text-muted-foreground">
                              Visual: {angle.visualExample}
                            </p>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
              </div>
            </TooltipProvider>
          </TabsContent>
        ))}
      </Tabs>

      {selectedAngleData && (
        <Card className="bg-muted/30 border-muted">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {getAngleIcon(selectedAngleData.id)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{selectedAngleData.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{selectedAngleData.description}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
