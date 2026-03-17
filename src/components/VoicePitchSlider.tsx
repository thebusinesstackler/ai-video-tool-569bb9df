import React from 'react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

interface VoicePitchSliderProps {
  pitch: number;
  onPitchChange: (pitch: number) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const VoicePitchSlider: React.FC<VoicePitchSliderProps> = ({
  pitch,
  onPitchChange,
  disabled = false,
  compact = false,
}) => {
  const pitchLabel = pitch === 0 ? 'Normal' : pitch > 0 ? `+${pitch}` : `${pitch}`;

  return (
    <div className={`space-y-1.5 ${compact ? '' : 'pt-1'}`}>
      <div className="flex items-center justify-between">
        <Label className={`${compact ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
          Pitch
        </Label>
        <Badge variant="outline" className={`${compact ? 'text-[9px] px-1.5 py-0' : 'text-[10px]'} bg-muted/50`}>
          {pitchLabel}
        </Badge>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] text-muted-foreground w-4">-10</span>
        <Slider
          value={[pitch]}
          onValueChange={([v]) => onPitchChange(v)}
          min={-10}
          max={10}
          step={1}
          disabled={disabled}
          className="flex-1"
        />
        <span className="text-[9px] text-muted-foreground w-4">+10</span>
      </div>
    </div>
  );
};
