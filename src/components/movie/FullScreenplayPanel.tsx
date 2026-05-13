import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Download, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';

interface DialogueLine { character?: string; line: string; voiceTone?: string; }
interface ScreenplayScene {
  sceneNumber: number;
  title: string;
  location?: string;
  timeOfDay?: string;
  description?: string;
  dialogue?: DialogueLine[] | string;
  transitionAction?: string;
}
interface Props {
  logline?: string;
  theme?: string;
  scenes: ScreenplayScene[];
  movieTitle?: string;
}

const formatScreenplay = (logline: string | undefined, theme: string | undefined, scenes: ScreenplayScene[], title: string) => {
  const lines: string[] = [];
  lines.push(title.toUpperCase());
  lines.push('='.repeat(Math.max(10, title.length)));
  if (logline) lines.push(`\nLogline: ${logline}`);
  if (theme) lines.push(`Theme: ${theme}`);
  lines.push('\n');
  scenes.forEach((s) => {
    const slug = [s.location, s.timeOfDay].filter(Boolean).join(' — ');
    lines.push(`SCENE ${s.sceneNumber}: ${s.title.toUpperCase()}`);
    if (slug) lines.push(slug);
    lines.push('');
    if (s.description) lines.push(s.description);
    const dlg = Array.isArray(s.dialogue) ? s.dialogue
      : typeof s.dialogue === 'string'
        ? s.dialogue.split('\n').filter(Boolean).map(l => ({ line: l }))
        : [];
    if (dlg.length) {
      lines.push('');
      dlg.forEach(d => {
        if (d.character) lines.push(`  ${d.character.toUpperCase()}${d.voiceTone ? ` (${d.voiceTone})` : ''}`);
        lines.push(`    ${d.line}`);
      });
    }
    if (s.transitionAction) {
      lines.push('');
      lines.push(`>> TRANSITION: ${s.transitionAction}`);
    }
    lines.push('\n' + '-'.repeat(60) + '\n');
  });
  return lines.join('\n');
};

export function FullScreenplayPanel({ logline, theme, scenes, movieTitle = 'Untitled Movie' }: Props) {
  const [expanded, setExpanded] = useState(true);

  const screenplayText = useMemo(
    () => formatScreenplay(logline, theme, scenes, movieTitle),
    [logline, theme, scenes, movieTitle]
  );

  if (!scenes?.length) return null;

  const totalLines = scenes.reduce((acc, s) => {
    const dlg = Array.isArray(s.dialogue) ? s.dialogue.length : 0;
    return acc + dlg;
  }, 0);

  const downloadScreenplay = () => {
    const blob = new Blob([screenplayText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${movieTitle.replace(/[^\w\s-]/g, '').trim() || 'screenplay'}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <CardTitle className="text-base truncate">Full Screenplay</CardTitle>
            <Badge variant="secondary" className="text-xs shrink-0">
              {scenes.length} scenes • {totalLines} lines
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={downloadScreenplay} className="h-8 gap-1.5">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setExpanded(e => !e)} className="h-8 w-8 p-0">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-5">
              {scenes.map((s, idx) => {
                const dlg: DialogueLine[] = Array.isArray(s.dialogue) ? s.dialogue
                  : typeof s.dialogue === 'string'
                    ? s.dialogue.split('\n').filter(Boolean).map(l => ({ line: l }))
                    : [];
                const slug = [s.location, s.timeOfDay].filter(Boolean).join(' — ');
                return (
                  <div key={s.sceneNumber} className="space-y-2">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <Badge>#{s.sceneNumber}</Badge>
                      <h4 className="font-semibold text-sm">{s.title}</h4>
                      {slug && <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{slug}</span>}
                    </div>
                    {s.description && (
                      <p className="text-xs text-muted-foreground italic leading-relaxed">{s.description}</p>
                    )}
                    {dlg.length > 0 && (
                      <div className="space-y-1.5 pl-3 border-l-2 border-primary/20">
                        {dlg.map((d, i) => (
                          <div key={i} className="text-xs">
                            {d.character && (
                              <div className="font-semibold text-foreground/90 uppercase text-[10px] tracking-wide">
                                {d.character}{d.voiceTone ? ` (${d.voiceTone})` : ''}
                              </div>
                            )}
                            <p className="text-foreground/80 leading-relaxed">{d.line}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {s.transitionAction && idx < scenes.length - 1 && (
                      <div className="flex items-start gap-1.5 text-[11px] text-primary/80 bg-primary/5 rounded p-2">
                        <ArrowRight className="w-3 h-3 mt-0.5 shrink-0" />
                        <span><span className="font-semibold">Transition →</span> {s.transitionAction}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      )}
    </Card>
  );
}
