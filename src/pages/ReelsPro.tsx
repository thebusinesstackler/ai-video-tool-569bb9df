import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Send, Sparkles, Video, Mic, FileText, Users, Save, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type ToolEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; id: string; name: string; args: any }
  | { type: "tool_result"; id: string; name: string; result?: any; error?: string }
  | { type: "done" }
  | { type: "error"; message: string };

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolEvents?: Array<{ id: string; name: string; args: any; result?: any; error?: string; status: "running" | "done" | "error" }>;
}

interface PlanState {
  topic?: string;
  twin?: { id: string; name: string; portrait?: string };
  script?: string;
  audioUrl?: string;
  videoUrl?: string;
  taskId?: string;
  videoProgress?: number;
  saved?: boolean;
}

const TOOL_META: Record<string, { icon: any; label: string }> = {
  list_twins: { icon: Users, label: "Loading AI Twins" },
  draft_script: { icon: FileText, label: "Drafting script" },
  synthesize_voice: { icon: Mic, label: "Generating voice" },
  generate_talking_head: { icon: Video, label: "Starting lip-sync" },
  poll_video_task: { icon: Loader2, label: "Rendering video" },
  save_to_library: { icon: Save, label: "Saving to library" },
};

export default function ReelsPro() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<PlanState>({});
  const [quality, setQuality] = useState<"480p" | "720p">(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("reelsPro.quality") : null;
    return saved === "720p" ? "720p" : "480p";
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { localStorage.setItem("reelsPro.quality", quality); } catch {}
  }, [quality]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const newUserMsg: ChatMessage = { role: "user", content: text };
    const assistantMsg: ChatMessage = { role: "assistant", content: "", toolEvents: [] };
    const history = [...messages, newUserMsg];
    setMessages([...history, assistantMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const apiMessages = history.map((m) => ({ role: m.role, content: m.content }));
      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/reels-pro-agent`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ messages: apiMessages, quality }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: ToolEvent;
          try { ev = JSON.parse(line); } catch { continue; }
          handleEvent(ev);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Generation failed");
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") last.content = `❌ ${err?.message || "Error"}`;
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEvent = (ev: ToolEvent) => {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (!last || last.role !== "assistant") return copy;

      if (ev.type === "text") {
        last.content += ev.text;
      } else if (ev.type === "tool_call") {
        last.toolEvents = [...(last.toolEvents || []), { id: ev.id, name: ev.name, args: ev.args, status: "running" }];
      } else if (ev.type === "tool_result") {
        last.toolEvents = (last.toolEvents || []).map((t) =>
          t.id === ev.id ? { ...t, result: ev.result, error: ev.error, status: ev.error ? "error" : "done" } : t
        );
        // Update plan from tool results
        applyResultToPlan(ev.name, ev.result, ev.error);
      } else if (ev.type === "error") {
        last.content += `\n\n❌ ${ev.message}`;
      }
      return copy;
    });
  };

  const applyResultToPlan = (name: string, result: any, error?: string) => {
    if (error || !result) return;
    setPlan((p) => {
      const next = { ...p };
      if (name === "draft_script" && result.script) next.script = result.script;
      if (name === "synthesize_voice" && result.audioUrl) next.audioUrl = result.audioUrl;
      if (name === "generate_talking_head" && result.taskId) next.taskId = result.taskId;
      if (name === "poll_video_task") {
        if (typeof result.progress === "number") next.videoProgress = result.progress;
        if (result.videoUrl) next.videoUrl = result.videoUrl;
      }
      if (name === "save_to_library" && result.success) next.saved = true;
      return next;
    });
  };

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Reels & Stories Pro</h1>
          <Badge variant="secondary">Beta</Badge>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Quality</span>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setQuality("480p")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${quality === "480p" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                480p · cheaper
              </button>
              <button
                type="button"
                onClick={() => setQuality("720p")}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${quality === "720p" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                720p HD
              </button>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground mb-6 text-sm">
          Chat with Marco Pro — he plans, narrates, and renders long-form talking-head reels (up to 5 min) using your AI Twin and InfiniteTalk lip-sync. Currently rendering at <strong>{quality}</strong>.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 h-[calc(100vh-220px)]">
          {/* Chat */}
          <Card className="flex flex-col overflow-hidden">
            <ScrollArea className="flex-1 p-4" ref={scrollRef as any}>
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">Try: <em>"Make a 60s reel about magnesium for sleep using my female twin"</em></p>
                </div>
              )}
              <div className="space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                    {m.role === "user" ? (
                      <div className="bg-primary text-primary-foreground rounded-2xl px-4 py-2 max-w-[80%] text-sm">
                        {m.content}
                      </div>
                    ) : (
                      <div className="space-y-2 max-w-full">
                        {m.toolEvents?.map((t) => (
                          <ToolCallCard key={t.id} ev={t} />
                        ))}
                        {m.content && (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {loading && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && !messages[messages.length - 1]?.toolEvents?.length && (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="border-t p-3 flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe the reel you want…"
                rows={2}
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                disabled={loading}
              />
              <Button onClick={() => send(input)} disabled={loading || !input.trim()} size="icon" className="shrink-0">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </Card>

          {/* Plan panel */}
          <Card className="p-4 overflow-y-auto">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Video className="h-4 w-4" /> Live Plan
            </h3>
            <div className="space-y-3 text-sm">
              <PlanRow label="Script" value={plan.script ? `${plan.script.split(/\s+/).length} words` : "—"} />
              <PlanRow label="Audio" value={plan.audioUrl ? "✓ Ready" : "—"} />
              <PlanRow label="Video task" value={plan.taskId ? plan.taskId.slice(0, 12) + "…" : "—"} />
              {plan.videoProgress !== undefined && !plan.videoUrl && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Rendering {plan.videoProgress}%</div>
                  <div className="h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${plan.videoProgress}%` }} />
                  </div>
                </div>
              )}
              {plan.audioUrl && !plan.videoUrl && (
                <audio controls src={plan.audioUrl} className="w-full mt-2" />
              )}
              {plan.videoUrl && (
                <div className="space-y-2">
                  <video src={plan.videoUrl} controls className="w-full rounded-lg" />
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <a href={plan.videoUrl} download target="_blank" rel="noopener">Download</a>
                  </Button>
                </div>
              )}
              {plan.saved && <Badge className="w-full justify-center">✓ Saved to Reels library</Badge>}
              {plan.script && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground">View script</summary>
                  <p className="mt-2 text-xs whitespace-pre-wrap">{plan.script}</p>
                </details>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/50 pb-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate ml-2 max-w-[180px] text-right">{value}</span>
    </div>
  );
}

function ToolCallCard({ ev }: { ev: NonNullable<ChatMessage["toolEvents"]>[number] }) {
  const meta = TOOL_META[ev.name] || { icon: Sparkles, label: ev.name };
  const Icon = meta.icon;
  return (
    <div className="border rounded-lg p-2.5 bg-muted/30 text-xs">
      <div className="flex items-center gap-2">
        {ev.status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
        ) : ev.status === "error" ? (
          <AlertCircle className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <Icon className="h-3.5 w-3.5 text-primary" />
        )}
        <span className="font-medium">{meta.label}</span>
        {ev.status === "done" && <span className="text-muted-foreground">✓</span>}
      </div>
      {ev.error && <div className="mt-1.5 text-destructive">{ev.error}</div>}
      {ev.status === "done" && ev.result && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-muted-foreground">details</summary>
          <pre className="mt-1 text-[10px] overflow-x-auto bg-background/50 p-2 rounded max-h-40">
            {JSON.stringify(ev.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
