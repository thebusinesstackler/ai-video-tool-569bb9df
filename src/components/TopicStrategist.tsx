import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Sparkles,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Loader2,
  Clock,
  Layers,
  Play,
  Megaphone,
  BookOpen,
  Smile,
  Target,
  Calendar,
  ArrowRight
} from 'lucide-react';

interface ContentStrategy {
  title: string;
  hookText: string;
  hookStyle: string;
  targetDuration: 30 | 60;
  sceneCount: number;
  sceneDurations: number[];
  contentType: string;
  callToAction: string | null;
  outroTemplate: string;
  seriesNumber: number;
  seriesPillar: string;
}

interface ContentPillar {
  name: string;
  description: string;
  color: string;
}

interface StrategyResponse {
  contentPillars: ContentPillar[];
  videoIdeas: ContentStrategy[];
  weeklySchedule: { day: string; pillar: string; contentType: string }[];
}

interface TopicStrategistProps {
  onApplyStrategy: (strategy: ContentStrategy) => void;
  disabled?: boolean;
}

const contentTypeIcons: Record<string, React.ReactNode> = {
  educational: <BookOpen className="w-3 h-3" />,
  entertainment: <Smile className="w-3 h-3" />,
  promotional: <Megaphone className="w-3 h-3" />,
  motivational: <Target className="w-3 h-3" />,
  storytelling: <Play className="w-3 h-3" />,
};

const contentTypeColors: Record<string, string> = {
  educational: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  entertainment: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  promotional: 'bg-green-500/20 text-green-400 border-green-500/30',
  motivational: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  storytelling: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

export const TopicStrategist: React.FC<TopicStrategistProps> = ({
  onApplyStrategy,
  disabled = false
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [niche, setNiche] = useState('');
  const [videoDuration, setVideoDuration] = useState<'30' | '60' | 'mix'>('mix');
  const [includePromotional, setIncludePromotional] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);

  const generateStrategy = async () => {
    if (!niche.trim()) {
      toast({
        title: 'Enter a niche',
        description: 'Please enter a topic or niche to generate ideas for.',
        variant: 'destructive'
      });
      return;
    }

    setIsGenerating(true);
    setStrategy(null);

    try {
      const { data, error } = await supabase.functions.invoke('generate-content-strategy', {
        body: {
          niche: niche.trim(),
          videoDuration,
          includePromotional
        }
      });

      if (error) throw error;

      if (!data || !data.videoIdeas) {
        throw new Error('Invalid response from strategy generator');
      }

      setStrategy(data);
      toast({
        title: 'Strategy Generated!',
        description: `Created ${data.videoIdeas.length} video ideas for "${niche}"`
      });
    } catch (err) {
      console.error('Strategy generation failed:', err);
      toast({
        title: 'Generation Failed',
        description: err instanceof Error ? err.message : 'Failed to generate content strategy',
        variant: 'destructive'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = (idea: ContentStrategy) => {
    onApplyStrategy(idea);
    toast({
      title: 'Strategy Applied!',
      description: 'Settings configured - ready to generate your reel!'
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-to-br from-primary/5 via-background to-purple-500/5 border-primary/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Need Ideas? AI Content Strategist</CardTitle>
                  <CardDescription className="text-xs">
                    Get video topics, hooks, and scene breakdowns for your niche
                  </CardDescription>
                </div>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Input Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2 space-y-2">
                <Label htmlFor="niche">Your Niche / Topic Area</Label>
                <Input
                  id="niche"
                  placeholder="e.g., fitness tips, SaaS marketing, cooking hacks..."
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  disabled={isGenerating || disabled}
                  className="bg-background"
                />
              </div>

              <div className="space-y-2">
                <Label>Video Length</Label>
                <Select value={videoDuration} onValueChange={(v) => setVideoDuration(v as typeof videoDuration)} disabled={isGenerating || disabled}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 seconds only</SelectItem>
                    <SelectItem value="60">60 seconds only</SelectItem>
                    <SelectItem value="mix">Mix both</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Include Promotional
                </Label>
                <div className="flex items-center gap-3 h-10 px-3 rounded-md border border-border bg-background">
                  <span className={`text-sm ${!includePromotional ? 'text-foreground' : 'text-muted-foreground'}`}>No</span>
                  <Switch
                    checked={includePromotional}
                    onCheckedChange={setIncludePromotional}
                    disabled={isGenerating || disabled}
                  />
                  <span className={`text-sm ${includePromotional ? 'text-foreground' : 'text-muted-foreground'}`}>Yes</span>
                </div>
              </div>
            </div>

            <Button
              onClick={generateStrategy}
              disabled={isGenerating || disabled || !niche.trim()}
              className="w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Strategy...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Video Ideas
                </>
              )}
            </Button>

            {/* Results */}
            {strategy && (
              <div className="space-y-4 pt-4 border-t border-border">
                {/* Content Pillars */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Content Pillars</Label>
                  <div className="flex flex-wrap gap-2">
                    {strategy.contentPillars.map((pillar, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="px-3 py-1"
                        style={{ borderColor: pillar.color, color: pillar.color }}
                      >
                        {pillar.name}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Video Ideas Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Video Ideas ({strategy.videoIdeas.length})</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowSchedule(!showSchedule)}
                      className="text-xs"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      {showSchedule ? 'Hide' : 'Show'} Weekly Schedule
                    </Button>
                  </div>

                  {showSchedule && strategy.weeklySchedule && (
                    <div className="p-3 bg-muted/50 rounded-lg mb-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {strategy.weeklySchedule.map((day, idx) => (
                          <div key={idx} className="text-center p-2 bg-background rounded-md">
                            <p className="text-xs font-medium text-muted-foreground">{day.day}</p>
                            <p className="text-xs font-semibold truncate" title={day.pillar}>{day.pillar}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <ScrollArea className="h-[400px] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {strategy.videoIdeas.map((idea, idx) => (
                        <Card
                          key={idx}
                          className="bg-card hover:bg-accent/50 transition-colors cursor-pointer group"
                          onClick={() => handleApply(idea)}
                        >
                          <CardContent className="p-4 space-y-3">
                            {/* Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className="text-xs shrink-0">
                                    #{idea.seriesNumber}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground truncate">
                                    {idea.seriesPillar}
                                  </span>
                                </div>
                                <h4 className="font-medium text-sm leading-tight line-clamp-2">
                                  {idea.title}
                                </h4>
                              </div>
                              <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>

                            {/* Hook Preview */}
                            <p className="text-xs text-muted-foreground italic line-clamp-2">
                              "{idea.hookText}"
                            </p>

                            {/* Metadata */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                {idea.targetDuration}s
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                <Layers className="w-3 h-3 mr-1" />
                                {idea.sceneCount} scenes
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${contentTypeColors[idea.contentType] || ''}`}
                              >
                                {contentTypeIcons[idea.contentType]}
                                <span className="ml-1 capitalize">{idea.contentType}</span>
                              </Badge>
                            </div>

                            {/* CTA Preview */}
                            {idea.callToAction && (
                              <p className="text-xs text-green-400">
                                CTA: {idea.callToAction}
                              </p>
                            )}

                            {/* Scene Breakdown */}
                            <div className="flex gap-1 pt-1">
                              {idea.sceneDurations.map((dur, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="flex-1 h-1.5 bg-primary/30 rounded-full"
                                  style={{
                                    flex: dur,
                                    backgroundColor: sIdx === 0 
                                      ? 'hsl(var(--primary))' 
                                      : sIdx === idea.sceneDurations.length - 1 
                                        ? 'hsl(var(--accent))' 
                                        : undefined
                                  }}
                                  title={`Scene ${sIdx + 1}: ${dur}s`}
                                />
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
