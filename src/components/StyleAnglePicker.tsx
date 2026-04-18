import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Film, Smile, Heart, Zap, MessageSquare, Sparkles, Newspaper } from 'lucide-react';

export interface StyleOption {
  id: string;
  label: string;
  description: string;
  promptSuffix: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const STYLE_OPTIONS: StyleOption[] = [
  { id: 'ugc', label: 'UGC Selfie', description: 'Handheld, authentic, talking-to-camera', promptSuffix: 'Style: raw UGC selfie. Handheld iPhone, natural daylight, talking directly to camera, unscripted feel.', icon: Camera },
  { id: 'cinematic', label: 'Cinematic', description: 'Polished shots, shallow depth, dramatic light', promptSuffix: 'Style: cinematic ad. Shallow depth of field, dramatic three-point lighting, slow tracking shots, color-graded warm/teal.', icon: Film },
  { id: 'documentary', label: 'Documentary', description: 'Real-person testimony, observational', promptSuffix: 'Style: documentary testimonial. Subject seated, soft window light, observational B-roll cuts, calm voiceover.', icon: Newspaper },
  { id: 'comedic', label: 'Comedic', description: 'Punchy timing, surprise reactions, fun pace', promptSuffix: 'Style: comedic skit. Quick cuts, exaggerated reactions, punchline at the end, lighthearted music vibe.', icon: Smile },
  { id: 'aspirational', label: 'Aspirational', description: 'Lifestyle, slow-mo, premium feel', promptSuffix: 'Style: aspirational lifestyle. Slow-motion, golden-hour locations, premium product hero shots, minimal voiceover.', icon: Heart },
  { id: 'high-energy', label: 'High Energy', description: 'Fast cuts, music-driven, hype edit', promptSuffix: 'Style: high-energy hype edit. Beat-synced cuts, whip pans, motion graphics, urgent VO with strong CTA.', icon: Zap },
];

export const ALTERNATIVE_ANGLES: { id: string; label: string; description: string; instruction: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'bolder-hook', label: 'Bolder hook', description: 'Rewrite the first 3 seconds with a stronger pattern-interrupt', instruction: 'Rewrite ONLY the hook (first 3-6 seconds) with a much bolder pattern-interrupt — a controversial claim, shocking visual, or contrarian statement. Keep the rest of the script intact and re-output the full updated script with the new hook.', icon: Zap },
  { id: 'problem-first', label: 'Problem-first angle', description: 'Lead with the pain before any solution', instruction: 'Rewrite the script to lead with the audience\'s problem/pain for the first 8-10 seconds before any product mention. Then introduce the dropper ritual as the rescue. Re-output the full updated script.', icon: MessageSquare },
  { id: 'comedic-twist', label: 'Comedic twist', description: 'Add humor and a punchline ending', instruction: 'Rewrite the script with a comedic tone — add a relatable absurd moment in the middle and end with a punchline CTA. Keep the product/benefits intact. Re-output the full updated script.', icon: Smile },
  { id: 'testimonial', label: 'Testimonial style', description: 'Reframe as a real-customer story', instruction: 'Rewrite the script as a first-person testimonial — "30 days ago I…" arc, with specific before/after moments. Keep the product and CTA. Re-output the full updated script.', icon: Heart },
];

interface StylePickerProps {
  value: string | null;
  onChange: (styleId: string | null) => void;
  className?: string;
}

export const StylePicker = ({ value, onChange, className = '' }: StylePickerProps) => (
  <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
    <span className="text-[11px] text-muted-foreground font-medium mr-1">Style:</span>
    {STYLE_OPTIONS.map((opt) => {
      const active = value === opt.id;
      const Icon = opt.icon;
      return (
        <Badge
          key={opt.id}
          variant={active ? 'default' : 'outline'}
          className={`cursor-pointer text-[11px] gap-1 py-1 px-2 transition-colors ${active ? 'bg-orange-500 hover:bg-orange-600 text-white border-orange-500' : 'hover:bg-muted'}`}
          onClick={() => onChange(active ? null : opt.id)}
          title={opt.description}
        >
          <Icon className="w-3 h-3" />
          {opt.label}
        </Badge>
      );
    })}
  </div>
);

interface AlternativeAnglesProps {
  onPick: (instruction: string, label: string) => void;
  disabled?: boolean;
  className?: string;
}

export const AlternativeAngles = ({ onPick, disabled, className = '' }: AlternativeAnglesProps) => (
  <div className={`rounded-xl border border-dashed border-orange-500/40 bg-orange-500/5 p-3 ${className}`}>
    <div className="flex items-center gap-1.5 mb-2">
      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
      <span className="text-xs font-semibold">Want to try a different angle?</span>
    </div>
    <p className="text-[11px] text-muted-foreground mb-2.5">
      Marco can rewrite the script with one of these directions — keeps your product, swaps the storytelling.
    </p>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {ALTERNATIVE_ANGLES.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.id}
            variant="outline"
            size="sm"
            disabled={disabled}
            className="justify-start h-auto py-2 px-3 text-left rounded-lg hover:border-orange-500/60 hover:bg-orange-500/10"
            onClick={() => onPick(a.instruction, a.label)}
          >
            <Icon className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5 mr-2" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold leading-tight">{a.label}</div>
              <div className="text-[10px] text-muted-foreground leading-tight mt-0.5 whitespace-normal">{a.description}</div>
            </div>
          </Button>
        );
      })}
    </div>
  </div>
);
