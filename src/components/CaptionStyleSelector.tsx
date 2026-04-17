import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  KaraokeCaption,
  CaptionStyle, 
  CaptionBackground, 
  CaptionPosition,
  CaptionSettings,
  CaptionFontFamily,
  CaptionFontSize,
} from './KaraokeCaption';
import { Type, Sparkles, Zap, Square, Palette, Circle, Lightbulb, Film, Minus } from 'lucide-react';

interface CaptionStyleSelectorProps {
  settings: CaptionSettings;
  onChange: (settings: CaptionSettings) => void;
  compact?: boolean;
}

const CAPTION_STYLES: { value: CaptionStyle; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'boldPop', label: 'Bold Pop', icon: <Sparkles className="w-4 h-4" />, description: 'TikTok-style chunky pop on every word' },
  { value: 'hype', label: 'Hype', icon: <Zap className="w-4 h-4" />, description: 'Bouncy, glowing, high-energy reveal' },
  { value: 'cinematic', label: 'Cinematic', icon: <Film className="w-4 h-4" />, description: 'Wide-tracked, premium movie subtitles' },
  { value: 'subtitle', label: 'Subtitle', icon: <Type className="w-4 h-4" />, description: 'Clean Netflix-style — no per-word highlight' },
  { value: 'minimal', label: 'Minimal', icon: <Minus className="w-4 h-4" />, description: 'Soft fade-in, distraction-free' },
];

const CAPTION_BACKGROUNDS: { value: CaptionBackground; label: string; icon: React.ReactNode }[] = [
  { value: 'glass', label: 'Glass', icon: <Square className="w-4 h-4" /> },
  { value: 'solid', label: 'Solid', icon: <Square className="w-4 h-4 fill-current" /> },
  { value: 'gradient', label: 'Gradient', icon: <Palette className="w-4 h-4" /> },
  { value: 'outline', label: 'Outline', icon: <Circle className="w-4 h-4" /> },
  { value: 'neon', label: 'Neon', icon: <Lightbulb className="w-4 h-4" /> },
];

const FONT_FAMILIES: { value: CaptionFontFamily; label: string }[] = [
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Oswald', label: 'Oswald' },
  { value: 'Bebas Neue', label: 'Bebas Neue' },
];

const FONT_SIZES: { value: CaptionFontSize; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
  { value: 'xl', label: 'XL' },
];

const FONT_COLORS: { value: string; label: string }[] = [
  { value: '#ffffff', label: 'White' },
  { value: '#facc15', label: 'Yellow' },
  { value: '#22d3ee', label: 'Cyan' },
  { value: '#f472b6', label: 'Pink' },
  { value: '#4ade80', label: 'Green' },
  { value: '#f97316', label: 'Orange' },
];

export const CaptionStyleSelector: React.FC<CaptionStyleSelectorProps> = ({
  settings,
  onChange,
  compact = false
}) => {
  const updateSetting = <K extends keyof CaptionSettings>(key: K, value: CaptionSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Switch
            checked={settings.enabled}
            onCheckedChange={(enabled) => updateSetting('enabled', enabled)}
          />
          <Label className="text-xs text-muted-foreground">Captions</Label>
        </div>
        
        {settings.enabled && (
          <>
            <div className="flex gap-1">
              {CAPTION_STYLES.map((style) => (
                <Button
                  key={style.value}
                  variant={settings.style === style.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => updateSetting('style', style.value)}
                  title={style.description}
                >
                  {style.icon}
                </Button>
              ))}
            </div>
            
            <div className="flex gap-1">
              {CAPTION_BACKGROUNDS.map((bg) => (
                <Button
                  key={bg.value}
                  variant={settings.background === bg.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => updateSetting('background', bg.value)}
                  title={bg.label}
                >
                  {bg.icon}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Enable/Disable toggle */}
      <div className="flex items-center justify-between">
        <Label className="font-medium">Show Captions</Label>
        <Switch
          checked={settings.enabled}
          onCheckedChange={(enabled) => updateSetting('enabled', enabled)}
        />
      </div>

      {settings.enabled && (
        <>
          {/* Caption Style */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Animation Style</Label>
            <div className="grid grid-cols-5 gap-2">
              {CAPTION_STYLES.map((style) => (
                <Button
                  key={style.value}
                  variant={settings.style === style.value ? 'default' : 'outline'}
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                  onClick={() => updateSetting('style', style.value)}
                >
                  {style.icon}
                  <span className="text-[10px]">{style.label}</span>
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {CAPTION_STYLES.find(s => s.value === settings.style)?.description}
            </p>
          </div>

          {/* Background Style */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Background Style</Label>
            <div className="grid grid-cols-5 gap-2">
              {CAPTION_BACKGROUNDS.map((bg) => (
                <Button
                  key={bg.value}
                  variant={settings.background === bg.value ? 'default' : 'outline'}
                  size="sm"
                  className="flex flex-col items-center gap-1 h-auto py-2"
                  onClick={() => updateSetting('background', bg.value)}
                >
                  {bg.icon}
                  <span className="text-[10px]">{bg.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Font Family */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Font Family</Label>
            <div className="flex gap-2 flex-wrap">
              {FONT_FAMILIES.map((font) => (
                <Button
                  key={font.value}
                  variant={settings.fontFamily === font.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 px-3 text-xs"
                  style={{ fontFamily: font.value }}
                  onClick={() => updateSetting('fontFamily', font.value)}
                >
                  {font.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Font Size</Label>
            <div className="flex gap-2">
              {FONT_SIZES.map((size) => (
                <Button
                  key={size.value}
                  variant={settings.fontSize === size.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 w-10 text-xs"
                  onClick={() => updateSetting('fontSize', size.value)}
                >
                  {size.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Font Color */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Text Color</Label>
            <div className="flex gap-2 flex-wrap">
              {FONT_COLORS.map((color) => (
                <button
                  key={color.value}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    settings.fontColor === color.value ? 'border-primary scale-110 ring-2 ring-primary/30' : 'border-muted-foreground/30'
                  }`}
                  style={{ backgroundColor: color.value }}
                  onClick={() => updateSetting('fontColor', color.value)}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Preview</Label>
            <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-center min-h-[80px]">
              <CaptionPreview settings={settings} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Live preview component
const CaptionPreview: React.FC<{ settings: CaptionSettings }> = ({ settings }) => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => (p + 0.02) % 1);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <KaraokeCaption
      text="Preview text appears here"
      currentTime={progress * 3}
      duration={3}
      style={settings.style}
      background={settings.background}
      fontFamily={settings.fontFamily}
      fontSize={settings.fontSize}
      fontColor={settings.fontColor}
    />
  );
};
