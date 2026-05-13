import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Volume2, Mic2, MapPin, Clock, Music, MessageSquare, Sparkles } from 'lucide-react';

interface Character {
  name: string;
  role?: string;
  appearance?: string;
  wardrobe?: string;
  personality?: string;
  voiceStyle?: string;
  arc?: string;
  assignedTwinName?: string;
  referenceImage?: string;
}

interface SceneSummary {
  sceneNumber: number;
  title: string;
  location?: string;
  timeOfDay?: string;
  mood?: string;
  charactersInScene?: string[];
  ambientSound?: string;
  backgroundChatter?: string[];
  suggestedMusic?: string;
  startFrameImage?: string;
  endFrameImage?: string;
}

interface Props {
  logline?: string;
  theme?: string;
  characters: Character[];
  scenes: SceneSummary[];
}

export function StoryboardReviewPanel({ logline, theme, characters, scenes }: Props) {
  if (!characters?.length && !scenes?.length) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <CardTitle className="text-base">Storyboard Review</CardTitle>
          <Badge variant="secondary" className="ml-auto text-xs">
            {scenes.length} scenes • {characters.length} characters
          </Badge>
        </div>
        {logline && (
          <p className="text-sm text-muted-foreground italic mt-2">"{logline}"</p>
        )}
        {theme && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold">Theme:</span> {theme}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {/* CAST ROSTER */}
        {characters.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Cast</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {characters.map((c) => (
                <div key={c.name} className="flex gap-3 p-3 rounded-lg border bg-card">
                  <Avatar className="w-12 h-12 shrink-0">
                    {c.referenceImage && <AvatarImage src={c.referenceImage} alt={c.name} />}
                    <AvatarFallback className="text-xs">
                      {c.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{c.name}</span>
                      {c.role && <Badge variant="outline" className="text-[10px] py-0 h-4">{c.role}</Badge>}
                      {c.assignedTwinName && (
                        <Badge variant="secondary" className="text-[10px] py-0 h-4 gap-0.5">
                          <Mic2 className="w-2.5 h-2.5" />
                          {c.assignedTwinName}
                        </Badge>
                      )}
                    </div>
                    {c.appearance && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <span className="font-medium text-foreground/80">Look:</span> {c.appearance}
                      </p>
                    )}
                    {c.wardrobe && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <span className="font-medium text-foreground/80">Wardrobe:</span> {c.wardrobe}
                      </p>
                    )}
                    {c.voiceStyle && (
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        <span className="font-medium text-foreground/80">Voice:</span> {c.voiceStyle}
                      </p>
                    )}
                    {c.arc && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <span className="font-medium text-foreground/80">Arc:</span> {c.arc}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SCENE-BY-SCENE BREAKDOWN */}
        {scenes.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Scene Breakdown</h3>
            </div>
            <ScrollArea className="max-h-[420px] pr-3">
              <div className="space-y-3">
                {scenes.map((s) => (
                  <div key={s.sceneNumber} className="rounded-lg border p-3 bg-card space-y-2">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className="shrink-0">#{s.sceneNumber}</Badge>
                        <span className="font-semibold text-sm truncate">{s.title}</span>
                      </div>
                      {s.mood && <Badge variant="outline" className="text-[10px]">{s.mood}</Badge>}
                    </div>

                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {s.location && (
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>
                      )}
                      {s.timeOfDay && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.timeOfDay}</span>
                      )}
                    </div>

                    {/* Characters in this scene */}
                    {s.charactersInScene && s.charactersInScene.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {s.charactersInScene.map((n) => (
                          <Badge key={n} variant="secondary" className="text-[10px]">{n}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Ambient soundscape */}
                    {s.ambientSound && (
                      <div className="flex items-start gap-2 text-xs bg-muted/40 rounded p-2">
                        <Volume2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium text-foreground/90 mb-0.5">Ambient Soundscape</div>
                          <p className="text-muted-foreground">{s.ambientSound}</p>
                        </div>
                      </div>
                    )}

                    {/* Background chatter */}
                    {s.backgroundChatter && s.backgroundChatter.length > 0 && (
                      <div className="text-xs bg-muted/40 rounded p-2">
                        <div className="font-medium text-foreground/90 mb-1 flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          Background Chatter
                        </div>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          {s.backgroundChatter.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {s.suggestedMusic && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Music className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span>{s.suggestedMusic}</span>
                      </div>
                    )}

                    {/* Frame thumbs */}
                    {(s.startFrameImage || s.endFrameImage) && (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="aspect-video rounded overflow-hidden bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                          {s.startFrameImage ? (
                            <img src={s.startFrameImage} alt="Start frame" className="w-full h-full object-cover" loading="lazy" />
                          ) : 'Start frame pending'}
                        </div>
                        <div className="aspect-video rounded overflow-hidden bg-muted flex items-center justify-center text-[10px] text-muted-foreground">
                          {s.endFrameImage ? (
                            <img src={s.endFrameImage} alt="End frame" className="w-full h-full object-cover" loading="lazy" />
                          ) : 'End frame pending'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
