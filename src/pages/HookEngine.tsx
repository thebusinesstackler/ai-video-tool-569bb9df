import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Sparkles, Brain, Zap, Target, TrendingUp, Eye, MessageSquare,
  Play, Save, RotateCcw, ChevronDown, ChevronUp, Copy, Wand2,
  BarChart3, Lightbulb, Film, Volume2, Type, Loader2, Clock,
  ArrowLeft, Trash2, CheckCircle2, AlertCircle, Star, Flame,
  Shield, Heart, Trophy, Megaphone, FolderPlus, Folder, Send,
} from 'lucide-react';
import { useVideoHooks, VideoHook, HookScores } from '@/hooks/useVideoHooks';
import { cn } from '@/lib/utils';
import { HookLibrary, SaveToFolderDialog } from '@/components/HookLibrary';

const HOOK_TYPE_ICONS: Record<string, { icon: typeof Sparkles; color: string }> = {
  'curiosity': { icon: Eye, color: 'text-violet-500' },
  'shocking': { icon: Zap, color: 'text-red-500' },
  'problem-solution': { icon: Target, color: 'text-blue-500' },
  'pain-point': { icon: AlertCircle, color: 'text-orange-500' },
  'transformation': { icon: TrendingUp, color: 'text-emerald-500' },
  'social-proof': { icon: Trophy, color: 'text-amber-500' },
  'fomo': { icon: Flame, color: 'text-rose-500' },
  'direct-benefit': { icon: Star, color: 'text-yellow-500' },
  'contrarian': { icon: Shield, color: 'text-indigo-500' },
  'emotional-story': { icon: Heart, color: 'text-pink-500' },
  'urgency': { icon: Clock, color: 'text-red-400' },
  'authority': { icon: Shield, color: 'text-sky-500' },
  'question': { icon: MessageSquare, color: 'text-teal-500' },
  'list-style': { icon: BarChart3, color: 'text-cyan-500' },
  'myth-busting': { icon: Lightbulb, color: 'text-purple-500' },
  'educational': { icon: Brain, color: 'text-fuchsia-500' },
};

const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Facebook', 'YouTube Ads', 'Landing Page'];
const VIDEO_GOALS = ['Increase watch time', 'Stop the scroll', 'Drive clicks', 'Generate leads', 'Book appointments', 'Get purchases', 'Improve ad performance', 'Introduce brand', 'Build trust'];
const VIDEO_TYPES = ['Ad', 'Educational', 'Testimonial', 'Promo', 'Founder video', 'Product demo', 'Social content', 'UGC'];
const TONES = ['Professional', 'Casual', 'Bold', 'Friendly', 'Authoritative', 'Playful', 'Luxury', 'Raw/Authentic'];
const CTA_GOALS = ['Click link', 'Visit website', 'Buy now', 'Sign up', 'Download app', 'Follow', 'Share', 'Comment'];
const CONTENT_MODES = ['Organic', 'Paid Ad'];
const HOOK_STYLES = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'aggressive', label: 'More Aggressive' },
  { value: 'professional', label: 'More Professional' },
  { value: 'emotional', label: 'More Emotional' },
  { value: 'high-converting', label: 'High-Converting' },
  { value: 'natural', label: 'More Natural' },
  { value: 'luxury', label: 'Luxury / Premium' },
  { value: 'ugc', label: 'UGC Style' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'viral', label: 'Viral' },
  { value: 'direct-response', label: 'Direct Response' },
];

const REFINE_OPTIONS = [
  'Make it shorter', 'Make it stronger', 'Make it more emotional',
  'Turn into ad hook', 'Turn into organic UGC hook', 'Make it more controversial',
  'Add urgency', 'Make it more professional', 'Rewrite completely',
];

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${value * 10}%` }} />
      </div>
      <span className="text-[10px] font-mono text-muted-foreground w-4 text-right">{value}</span>
    </div>
  );
}

function HookCard({
  hook, index, onRefine, isRefining, onCopy, onApply,
}: {
  hook: VideoHook;
  index: number;
  onRefine: (index: number, instruction: string) => void;
  isRefining: boolean;
  onCopy: (text: string) => void;
  onApply: (hook: VideoHook, action: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const typeInfo = HOOK_TYPE_ICONS[hook.hookType] || { icon: Sparkles, color: 'text-primary' };
  const TypeIcon = typeInfo.icon;

  const overallScore = hook.scores
    ? Math.round(Object.values(hook.scores).reduce((a, b) => a + b, 0) / 7)
    : 0;

  return (
    <Card className={cn(
      "group border transition-all hover:shadow-lg",
      index === 0 && "border-primary/40 bg-gradient-to-br from-primary/5 to-transparent shadow-md",
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-muted/80", index === 0 && "bg-primary/10")}>
              <TypeIcon className={cn("h-4 w-4", typeInfo.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] h-5 capitalize">
                  {hook.hookType?.replace(/-/g, ' ')}
                </Badge>
                {index === 0 && (
                  <Badge className="bg-primary/20 text-primary text-[10px] h-5 gap-1">
                    <Star className="h-2.5 w-2.5" /> Top Pick
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Best for: {hook.bestPlatform}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "text-xs font-bold px-2 py-0.5 rounded-full",
              overallScore >= 8 ? "bg-emerald-500/20 text-emerald-600" :
              overallScore >= 6 ? "bg-amber-500/20 text-amber-600" :
              "bg-muted text-muted-foreground"
            )}>
              {overallScore}/10
            </div>
          </div>
        </div>

        {/* Hook Text */}
        <div className="bg-muted/50 rounded-lg p-3 border border-border/50">
          <p className="text-sm font-medium leading-relaxed">"{hook.hookText}"</p>
        </div>

        {/* On-screen text */}
        <div className="flex items-center gap-2">
          <Type className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">On-screen:</span>
          <span className="text-xs font-semibold">{hook.onScreenText}</span>
        </div>

        {/* Why chosen */}
        <p className="text-[11px] text-muted-foreground italic">
          💡 {hook.whyChosen}
        </p>

        {/* Best for tags */}
        {hook.bestFor && hook.bestFor.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {hook.bestFor.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[9px] h-4 capitalize">
                {tag.replace(/-/g, ' ')}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions Row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => onCopy(hook.hookText)}>
            <Copy className="h-3 w-3" /> Copy Hook
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => onCopy(hook.voiceoverVersion)}>
            <Volume2 className="h-3 w-3" /> Copy VO
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => onCopy(hook.onScreenText)}>
            <Type className="h-3 w-3" /> Copy Text
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setShowRefine(!showRefine)}>
            <Wand2 className="h-3 w-3" /> Refine
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Less' : 'More'}
          </Button>
        </div>

        {/* Refine Options */}
        {showRefine && (
          <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-lg border border-border/30">
            {REFINE_OPTIONS.map((opt) => (
              <Button
                key={opt}
                variant="outline"
                size="sm"
                className="h-6 text-[10px]"
                disabled={isRefining}
                onClick={() => { onRefine(index, opt); setShowRefine(false); }}
              >
                {opt}
              </Button>
            ))}
          </div>
        )}

        {/* Expanded Section */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-border/50">
            {/* Voiceover */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Volume2 className="h-3 w-3" /> Voiceover Version
              </p>
              <p className="text-xs bg-muted/30 rounded-md p-2 italic">"{hook.voiceoverVersion}"</p>
            </div>

            {/* Visual Direction */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Film className="h-3 w-3" /> Visual Direction
              </p>
              <p className="text-xs bg-muted/30 rounded-md p-2">{hook.visualDirection}</p>
            </div>

            {/* Scores */}
            {hook.scores && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> Performance Prediction
                </p>
                <ScoreBar label="Scroll-Stop" value={hook.scores.scrollStop} color="bg-rose-500" />
                <ScoreBar label="Clarity" value={hook.scores.clarity} color="bg-blue-500" />
                <ScoreBar label="Emotion" value={hook.scores.emotionalPull} color="bg-pink-500" />
                <ScoreBar label="Conversion" value={hook.scores.conversionIntent} color="bg-emerald-500" />
                <ScoreBar label="Curiosity" value={hook.scores.curiosity} color="bg-violet-500" />
                <ScoreBar label="Ad Fit" value={hook.scores.adSuitability} color="bg-amber-500" />
                <ScoreBar label="Organic Fit" value={hook.scores.organicSuitability} color="bg-teal-500" />
              </div>
            )}

            {/* Apply Actions */}
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="default" className="h-7 text-[10px] gap-1" onClick={() => onApply(hook, 'use-in-reel')}>
                <Play className="h-3 w-3" /> Use in Reel
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => onApply(hook, 'text-overlay')}>
                <Type className="h-3 w-3" /> Text Overlay
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => onApply(hook, 'title-card')}>
                <Film className="h-3 w-3" /> Title Card
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => onApply(hook, 'voiceover')}>
                <Volume2 className="h-3 w-3" /> Voiceover Script
              </Button>
              <SaveToFolderDialog
                hookText={hook.hookText}
                hookType={hook.hookType}
                onScreenText={hook.onScreenText}
                voiceoverVersion={hook.voiceoverVersion}
                visualDirection={hook.visualDirection}
                scores={hook.scores}
                bestFor={hook.bestFor}
                bestPlatform={hook.bestPlatform}
                whyChosen={hook.whyChosen}
              >
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1">
                  <FolderPlus className="h-3 w-3" /> Save to Folder
                </Button>
              </SaveToFolderDialog>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HookEngine() {
  const navigate = useNavigate();
  const {
    contentSummary, hooks, contextSettings, isAnalyzing, isGenerating, isRefining,
    videoTitle, setVideoTitle, videoDescription, setVideoDescription,
    analyzeVideo, generateHooks, refineHook, saveSession,
    updateContext, resetAll, savedSessions, loadSession, setHooks,
  } = useVideoHooks();

  const [activeTab, setActiveTab] = useState('input');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleApply = (hook: VideoHook, action: string) => {
    switch (action) {
      case 'save':
        toast.success('Hook saved to library');
        break;
      case 'text-overlay':
        toast.success('Hook queued as text overlay — head to your editor to position it');
        break;
      case 'title-card':
        toast.success('Hook queued as title card');
        break;
      case 'voiceover':
        navigator.clipboard.writeText(hook.voiceoverVersion);
        toast.success('Voiceover script copied — paste into your TTS tool');
        break;
      case 'use-in-reel':
        navigate(`/reels?source=hook-engine&topic=${encodeURIComponent(hook.hookText)}`);
        break;
    }
  };

  const handleAnalyzeAndGenerate = async () => {
    await analyzeVideo();
  };

  const handleGenerateAfterAnalysis = async () => {
    await generateHooks();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 p-6">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
                  <Zap className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">AI Video Hook Engine</h1>
                  <p className="text-sm text-muted-foreground">by Loop AI Director</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-lg mt-2">
                Analyze your video content and generate scroll-stopping hooks optimized for every platform.
                The first 5 seconds decide everything — make them count.
              </p>
            </div>
            <div className="flex gap-2">
              {hooks.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={saveSession}>
                  <Save className="h-4 w-4" /> Save Session
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={resetAll}>
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Panel — Input & Context */}
          <div className="lg:col-span-4 space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="input" className="text-xs gap-1">
                  <Film className="h-3 w-3" /> Video
                </TabsTrigger>
                <TabsTrigger value="context" className="text-xs gap-1">
                  <Target className="h-3 w-3" /> Context
                </TabsTrigger>
                <TabsTrigger value="library" className="text-xs gap-1">
                  <Folder className="h-3 w-3" /> Library
                </TabsTrigger>
                <TabsTrigger value="saved" className="text-xs gap-1">
                  <Save className="h-3 w-3" /> History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="input" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold">Video Title</label>
                  <Input
                    placeholder="e.g., How to 10x Your Productivity in 2026"
                    value={videoTitle}
                    onChange={(e) => setVideoTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold">Description / Transcript / Script</label>
                  <Textarea
                    placeholder="Paste your video transcript, script, or a detailed description of what the video covers..."
                    value={videoDescription}
                    onChange={(e) => setVideoDescription(e.target.value)}
                    rows={8}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    The more detail you provide, the more targeted the hooks will be.
                  </p>
                </div>

                <Button
                  className="w-full gap-2"
                  onClick={handleAnalyzeAndGenerate}
                  disabled={isAnalyzing || (!videoTitle && !videoDescription)}
                >
                  {isAnalyzing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing Video...</>
                  ) : (
                    <><Brain className="h-4 w-4" /> Analyze Video</>
                  )}
                </Button>

                {/* Analysis Result */}
                {contentSummary && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary" /> Content Analysis
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Topic:</span>
                          <p className="font-medium">{contentSummary.mainTopic}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tone:</span>
                          <p className="font-medium capitalize">{contentSummary.emotionalTone}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <p className="font-medium capitalize">{contentSummary.contentType}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Pacing:</span>
                          <p className="font-medium capitalize">{contentSummary.pacing}</p>
                        </div>
                      </div>
                      {contentSummary.keyPromise && (
                        <div>
                          <span className="text-muted-foreground">Key Promise:</span>
                          <p className="font-medium">{contentSummary.keyPromise}</p>
                        </div>
                      )}
                      {contentSummary.bestAudienceAngle && (
                        <div>
                          <span className="text-muted-foreground">Best Audience Angle:</span>
                          <p className="font-medium">{contentSummary.bestAudienceAngle}</p>
                        </div>
                      )}
                      <Separator />
                      <Button
                        className="w-full gap-2"
                        onClick={handleGenerateAfterAnalysis}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Generating Hooks...</>
                        ) : (
                          <><Sparkles className="h-4 w-4" /> Generate Hooks</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="context" className="space-y-3 mt-4">
                <p className="text-xs text-muted-foreground">
                  Fine-tune hook generation by providing context about your video and goals.
                </p>

                <SelectField label="Hook Style" value={contextSettings.hookStyle} onChange={(v) => updateContext('hookStyle', v)} options={HOOK_STYLES.map(s => s.value)} labels={HOOK_STYLES.map(s => s.label)} />
                <SelectField label="Platform" value={contextSettings.platform} onChange={(v) => updateContext('platform', v)} options={PLATFORMS} />
                <SelectField label="Video Goal" value={contextSettings.videoGoal} onChange={(v) => updateContext('videoGoal', v)} options={VIDEO_GOALS} />
                <SelectField label="Video Type" value={contextSettings.videoType} onChange={(v) => updateContext('videoType', v)} options={VIDEO_TYPES} />
                <SelectField label="Tone of Voice" value={contextSettings.toneOfVoice} onChange={(v) => updateContext('toneOfVoice', v)} options={TONES} />
                <SelectField label="CTA Goal" value={contextSettings.ctaGoal} onChange={(v) => updateContext('ctaGoal', v)} options={CTA_GOALS} />
                <SelectField label="Content Mode" value={contextSettings.contentMode} onChange={(v) => updateContext('contentMode', v)} options={CONTENT_MODES} />

                <div className="space-y-2">
                  <label className="text-xs font-semibold">Target Audience</label>
                  <Input placeholder="e.g., SaaS founders, 25-40" value={contextSettings.targetAudience} onChange={(e) => updateContext('targetAudience', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold">Niche</label>
                  <Input placeholder="e.g., Fitness, AI, Real Estate" value={contextSettings.niche} onChange={(e) => updateContext('niche', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold">Brand Voice</label>
                  <Input placeholder="e.g., Nike-like, Apple-inspired" value={contextSettings.brandVoice} onChange={(e) => updateContext('brandVoice', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold">Offer Being Promoted</label>
                  <Input placeholder="e.g., Free trial, $997 course" value={contextSettings.offer} onChange={(e) => updateContext('offer', e.target.value)} />
                </div>
              </TabsContent>

              <TabsContent value="library" className="mt-4">
                <HookLibrary />
              </TabsContent>

              <TabsContent value="saved" className="mt-4">
                <ScrollArea className="h-[500px]">
                  {savedSessions.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Save className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No saved sessions yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedSessions.map((session) => (
                        <Card
                          key={session.id}
                          className="cursor-pointer hover:border-primary/30 transition-colors"
                          onClick={() => { loadSession(session); setActiveTab('input'); }}
                        >
                          <CardContent className="p-3">
                            <p className="text-sm font-medium truncate">{session.video_title || 'Untitled'}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {(session.hooks as any[])?.length || 0} hooks • {new Date(session.created_at).toLocaleDateString()}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel — Generated Hooks */}
          <div className="lg:col-span-8">
            {hooks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4">
                  <Zap className="h-10 w-10 text-primary/40" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Hooks Yet</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Describe your video on the left, then hit <strong>Analyze Video</strong> followed by <strong>Generate Hooks</strong> to get AI-powered opening hooks optimized for maximum retention.
                </p>
                <div className="flex flex-wrap gap-2 mt-6 justify-center">
                  {['curiosity', 'shocking', 'emotional-story', 'social-proof', 'fomo', 'question'].map(type => {
                    const info = HOOK_TYPE_ICONS[type];
                    const Icon = info?.icon || Sparkles;
                    return (
                      <Badge key={type} variant="outline" className="gap-1 text-[10px] capitalize">
                        <Icon className={cn("h-3 w-3", info?.color)} />
                        {type.replace(/-/g, ' ')}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Hooks Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      Generated Hooks
                      <Badge variant="secondary" className="text-xs">{hooks.length}</Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground">Ranked by overall performance prediction</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={contextSettings.hookStyle} onValueChange={(v) => updateContext('hookStyle', v)}>
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Hook style" />
                      </SelectTrigger>
                      <SelectContent>
                        {HOOK_STYLES.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={generateHooks} disabled={isGenerating}>
                      {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                      Regenerate
                    </Button>
                  </div>
                </div>

                {isRefining && (
                  <div className="flex items-center gap-2 text-xs text-primary animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Refining hook...
                  </div>
                )}

                {/* Hook Cards */}
                <ScrollArea className="h-[calc(100vh-280px)]">
                  <div className="space-y-4 pr-2">
                    {hooks.map((hook, index) => (
                      <HookCard
                        key={index}
                        hook={hook}
                        index={index}
                        onRefine={refineHook}
                        isRefining={isRefining}
                        onCopy={handleCopy}
                        onApply={handleApply}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

function SelectField({
  label, value, onChange, options, labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt, i) => (
            <SelectItem key={opt} value={opt}>{labels?.[i] || opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
