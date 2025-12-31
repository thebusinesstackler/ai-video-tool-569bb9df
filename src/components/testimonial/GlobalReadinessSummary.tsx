import { CommercialSegment, SegmentReadiness } from '@/types/testimonialCommercial';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, AlertTriangle, ImagePlus, Play, Loader2 } from 'lucide-react';
import { getSegmentReadiness } from '@/lib/segmentReadiness';

interface GlobalReadinessSummaryProps {
  segments: CommercialSegment[];
  onGenerateAllBroll: () => void;
  onGenerateCommercial: () => void;
  isGenerating: boolean;
  isGeneratingBroll: boolean;
  generationProgress: number;
}

export function GlobalReadinessSummary({
  segments,
  onGenerateAllBroll,
  onGenerateCommercial,
  isGenerating,
  isGeneratingBroll,
  generationProgress
}: GlobalReadinessSummaryProps) {
  const readinessResults = segments.map(s => ({
    segment: s,
    readiness: getSegmentReadiness(s)
  }));

  const readyCount = readinessResults.filter(r => r.readiness.isReady).length;
  const totalCount = segments.length;
  const allReady = readyCount === totalCount && totalCount > 0;
  const readinessPercent = totalCount > 0 ? (readyCount / totalCount) * 100 : 0;

  // Find segments missing B-roll images
  const segmentsMissingBroll = segments.filter(s => {
    if (s.type === 'twin-speaking') return false;
    const hasPrompts = (s.brollPrompts?.length ?? 0) > 0 || (s.brollSlots?.some(slot => slot.prompt) ?? false);
    const hasAllImages = s.brollSlots?.every(slot => slot.imageUrl) ?? false;
    return hasPrompts && !hasAllImages;
  });

  // Collect all blocking issues
  const blockingIssues: string[] = [];
  readinessResults.forEach((r, i) => {
    if (!r.readiness.isReady) {
      r.readiness.missingRequired.forEach(missing => {
        blockingIssues.push(`Segment ${i + 1}: ${missing}`);
      });
    }
  });

  if (totalCount === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-4">
          {/* Readiness Summary */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {allReady ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              )}
              <span className="font-medium">
                {readyCount} of {totalCount} segments ready
              </span>
            </div>
            <Progress value={readinessPercent} className="h-2" />
            
            {/* Blocking issues */}
            {blockingIssues.length > 0 && blockingIssues.length <= 3 && (
              <div className="mt-2 space-y-1">
                {blockingIssues.slice(0, 3).map((issue, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {issue}</p>
                ))}
                {blockingIssues.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    ...and {blockingIssues.length - 3} more issues
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {segmentsMissingBroll.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerateAllBroll}
                disabled={isGeneratingBroll || isGenerating}
              >
                {isGeneratingBroll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4 mr-2" />
                )}
                Generate B-Roll ({segmentsMissingBroll.length})
              </Button>
            )}
            <Button
              onClick={onGenerateCommercial}
              disabled={!allReady || isGenerating || isGeneratingBroll}
              className="min-w-[160px]"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {Math.round(generationProgress)}%
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Generate Commercial
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
