import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Clapperboard, ChevronDown, ChevronUp, Loader2, Star } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface DirectorReview {
  overallVerdict?: "ship" | "revise" | "block";
  overallScore?: number;
  storyNotes?: string;
  continuityIssues?: { sceneNumber: number; issue: string; fix: string }[];
  castingNotes?: { characterName: string; issue: string; fix: string }[];
  sceneNotes?: {
    sceneNumber: number;
    score?: number;
    strengthens?: string;
    weakens?: string;
    recommendedKeyframeRewrite?: { startFrame?: string | null; endFrame?: string | null } | null;
    recommendedDialogueRewrite?: string | null;
    recommendedCameraMove?: string | null;
    recommendedTransitionToNext?: string | null;
  }[];
  finalShootingOrder?: number[] | null;
}

interface Props {
  review: DirectorReview | null;
  isReviewing: boolean;
  onRunReview: () => void;
  onApplyDialogueFix?: (sceneNumber: number, newDialogue: string) => void;
  onApplyTransitionFix?: (sceneNumber: number, transition: string) => void;
  onApplyKeyframeFix?: (sceneNumber: number, frame: "start" | "end", newPrompt: string) => void;
  hasStoryboard: boolean;
}

const verdictStyle: Record<string, string> = {
  ship: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  revise: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  block: "bg-red-500/10 text-red-500 border-red-500/30",
};

export function DirectorNotesPanel({
  review,
  isReviewing,
  onRunReview,
  onApplyDialogueFix,
  onApplyTransitionFix,
  onApplyKeyframeFix,
  hasStoryboard,
}: Props) {
  const [expandedScene, setExpandedScene] = useState<number | null>(null);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clapperboard className="w-5 h-5 text-primary" />
              AI Director Review
              <Badge variant="outline" className="text-[10px] font-normal">Claude · 39-yr veteran</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              A senior creative pass over the full storyboard before any video renders.
            </p>
          </div>
          <Button onClick={onRunReview} disabled={isReviewing || !hasStoryboard} size="sm" className="gap-2">
            {isReviewing ? <><Loader2 className="w-4 h-4 animate-spin" /> Reviewing…</> : <><Sparkles className="w-4 h-4" /> {review ? "Re-review" : "Run review"}</>}
          </Button>
        </div>
      </CardHeader>

      {review && (
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center gap-3 flex-wrap">
            {review.overallVerdict && (
              <Badge variant="outline" className={verdictStyle[review.overallVerdict]}>
                Verdict: {review.overallVerdict.toUpperCase()}
              </Badge>
            )}
            {typeof review.overallScore === "number" && (
              <Badge variant="outline" className="gap-1"><Star className="w-3 h-3" /> {review.overallScore}/10</Badge>
            )}
          </div>

          {review.storyNotes && (
            <div className="rounded-md border bg-card p-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Story Notes</div>
              <p>{review.storyNotes}</p>
            </div>
          )}

          {!!review.continuityIssues?.length && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Continuity Issues</div>
              {review.continuityIssues.map((c, i) => (
                <div key={i} className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                  <div className="font-medium">Scene {c.sceneNumber}: {c.issue}</div>
                  <div className="text-muted-foreground text-xs mt-1">Fix: {c.fix}</div>
                </div>
              ))}
            </div>
          )}

          {!!review.castingNotes?.length && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Casting Consistency</div>
              {review.castingNotes.map((c, i) => (
                <div key={i} className="rounded-md border border-blue-500/30 bg-blue-500/5 p-2">
                  <div className="font-medium">{c.characterName}: {c.issue}</div>
                  <div className="text-muted-foreground text-xs mt-1">Fix: {c.fix}</div>
                </div>
              ))}
            </div>
          )}

          {!!review.sceneNotes?.length && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Per-Scene Notes</div>
              {review.sceneNotes.map((n) => {
                const open = expandedScene === n.sceneNumber;
                return (
                  <Collapsible key={n.sceneNumber} open={open} onOpenChange={(o) => setExpandedScene(o ? n.sceneNumber : null)}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 hover:bg-accent text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Scene {n.sceneNumber}</span>
                          {typeof n.score === "number" && (
                            <Badge variant="outline" className="text-[10px]">{n.score}/10</Badge>
                          )}
                          {n.weakens && <span className="text-xs text-muted-foreground truncate max-w-[300px]">— {n.weakens}</span>}
                        </div>
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 pl-3 space-y-2">
                      {n.strengthens && <div><span className="text-emerald-500 font-medium">Works:</span> {n.strengthens}</div>}
                      {n.weakens && <div><span className="text-amber-500 font-medium">Weakens:</span> {n.weakens}</div>}

                      {n.recommendedDialogueRewrite && (
                        <div className="rounded-md border bg-muted/30 p-2">
                          <div className="text-xs text-muted-foreground mb-1">Suggested dialogue rewrite</div>
                          <div className="italic">"{n.recommendedDialogueRewrite}"</div>
                          {onApplyDialogueFix && (
                            <Button size="sm" variant="secondary" className="mt-2" onClick={() => onApplyDialogueFix(n.sceneNumber, n.recommendedDialogueRewrite!)}>
                              Apply dialogue
                            </Button>
                          )}
                        </div>
                      )}

                      {n.recommendedKeyframeRewrite?.startFrame && (
                        <div className="rounded-md border bg-muted/30 p-2">
                          <div className="text-xs text-muted-foreground mb-1">Start frame rewrite</div>
                          <div className="text-xs">{n.recommendedKeyframeRewrite.startFrame}</div>
                          {onApplyKeyframeFix && (
                            <Button size="sm" variant="secondary" className="mt-2" onClick={() => onApplyKeyframeFix(n.sceneNumber, "start", n.recommendedKeyframeRewrite!.startFrame!)}>
                              Apply to start frame
                            </Button>
                          )}
                        </div>
                      )}

                      {n.recommendedKeyframeRewrite?.endFrame && (
                        <div className="rounded-md border bg-muted/30 p-2">
                          <div className="text-xs text-muted-foreground mb-1">End frame rewrite</div>
                          <div className="text-xs">{n.recommendedKeyframeRewrite.endFrame}</div>
                          {onApplyKeyframeFix && (
                            <Button size="sm" variant="secondary" className="mt-2" onClick={() => onApplyKeyframeFix(n.sceneNumber, "end", n.recommendedKeyframeRewrite!.endFrame!)}>
                              Apply to end frame
                            </Button>
                          )}
                        </div>
                      )}

                      {n.recommendedCameraMove && (
                        <div className="text-xs"><span className="text-muted-foreground">Camera:</span> {n.recommendedCameraMove}</div>
                      )}

                      {n.recommendedTransitionToNext && (
                        <div className="rounded-md border bg-muted/30 p-2">
                          <div className="text-xs text-muted-foreground mb-1">Transition to next scene</div>
                          <div className="text-xs">{n.recommendedTransitionToNext}</div>
                          {onApplyTransitionFix && (
                            <Button size="sm" variant="secondary" className="mt-2" onClick={() => onApplyTransitionFix(n.sceneNumber, n.recommendedTransitionToNext!)}>
                              Apply transition
                            </Button>
                          )}
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
