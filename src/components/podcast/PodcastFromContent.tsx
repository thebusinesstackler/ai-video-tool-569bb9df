import React, { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import {
  FileText, Globe, Upload, Loader2, Sparkles, Download, Play, RotateCcw,
  Headphones, Users,
} from 'lucide-react';

// PDF.js setup (browser worker)
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type InputMode = 'text' | 'url' | 'pdf';

const VOICE_OPTIONS = [
  { id: 'george', label: 'George (M, warm)' },
  { id: 'henry', label: 'Henry (M, deep)' },
  { id: 'snoop', label: 'Snoop (M, casual)' },
  { id: 'kristy', label: 'Kristy (F, friendly)' },
  { id: 'jennifer', label: 'Jennifer (F, clear)' },
  { id: 'aria', label: 'Aria (F, energetic)' },
];

interface Props {
  onUseTranscriptForVideo?: (transcript: string) => void;
}

export const PodcastFromContent: React.FC<Props> = ({ onUseTranscriptForVideo }) => {
  const { toast } = useToast();
  const { user } = useAuth();

  const [mode, setMode] = useState<InputMode>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [pdfText, setPdfText] = useState('');
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [isParsingPdf, setIsParsingPdf] = useState(false);

  const [hostAName, setHostAName] = useState('Alex');
  const [hostBName, setHostBName] = useState('Jordan');
  const [voiceA, setVoiceA] = useState('george');
  const [voiceB, setVoiceB] = useState('kristy');
  const [targetMinutes, setTargetMinutes] = useState(3);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'PDF too large', description: 'Max 20MB', variant: 'destructive' });
      return;
    }
    setIsParsingPdf(true);
    setPdfText('');
    setPdfName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const pages: string[] = [];
      const maxPages = Math.min(pdf.numPages, 50);
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((it: any) => it.str).join(' ');
        pages.push(pageText);
      }
      const full = pages.join('\n\n').replace(/\s+/g, ' ').trim();
      if (full.length < 100) throw new Error('Could not extract enough text from PDF');
      setPdfText(full);
      toast({
        title: 'PDF parsed',
        description: `${full.length.toLocaleString()} characters extracted from ${maxPages} page${maxPages > 1 ? 's' : ''}.`,
      });
    } catch (e: any) {
      console.error('PDF parse failed:', e);
      toast({
        title: 'PDF parse failed',
        description: e.message || 'Could not read PDF',
        variant: 'destructive',
      });
      setPdfName(null);
    } finally {
      setIsParsingPdf(false);
    }
  };

  const generate = async () => {
    if (!user) {
      toast({ title: 'Sign in required', variant: 'destructive' });
      return;
    }
    let content = '';
    if (mode === 'text') content = text.trim();
    else if (mode === 'url') content = url.trim();
    else if (mode === 'pdf') content = pdfText.trim();

    if (!content) {
      toast({
        title: 'Missing input',
        description: mode === 'url' ? 'Paste a URL.' : mode === 'pdf' ? 'Upload a PDF first.' : 'Paste some text.',
        variant: 'destructive',
      });
      return;
    }
    if (mode === 'url' && !/^https?:\/\//i.test(content)) {
      toast({ title: 'Invalid URL', description: 'URL must start with http(s)://', variant: 'destructive' });
      return;
    }

    setIsGenerating(true);
    setProgress(15);
    setAudioUrl(null);
    setTranscript(null);

    // Slow progress crawl while we wait
    const tick = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 2 : p));
    }, 1200);

    try {
      const { data, error } = await supabase.functions.invoke('generate-podcast-from-content', {
        body: {
          inputType: mode,
          content,
          hostAName,
          hostBName,
          voiceA,
          voiceB,
          targetMinutes,
        },
      });
      if (error) throw error;
      if (!data?.audioUrl) throw new Error(data?.error || 'No audio returned');

      setAudioUrl(data.audioUrl);
      setTranscript(data.transcript || null);
      setProgress(100);
      toast({
        title: '🎙️ Podcast ready',
        description: `${data.lineCount || 0} dialogue turns rendered.`,
      });
    } catch (e: any) {
      console.error('Podcast gen failed:', e);
      toast({
        title: 'Generation failed',
        description: e.message || 'Try again',
        variant: 'destructive',
      });
    } finally {
      clearInterval(tick);
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setAudioUrl(null);
    setTranscript(null);
    setText('');
    setUrl('');
    setPdfText('');
    setPdfName(null);
    setProgress(0);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Headphones className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Turn Into Podcast</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Paste text, drop a link, or upload a PDF — we'll generate a two-host podcast conversation.
        </p>
      </div>

      {audioUrl ? (
        <Card className="border-primary/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="gap-1">
                <Headphones className="w-3 h-3" /> Podcast Ready
              </Badge>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <a href={audioUrl} download="podcast.mp3" target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 mr-1" /> Download
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={reset}>
                  <RotateCcw className="w-4 h-4 mr-1" /> New
                </Button>
              </div>
            </div>
            <audio src={audioUrl} controls className="w-full" />
            {transcript && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Transcript</Label>
                <div className="max-h-72 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {transcript}
                </div>
                {onUseTranscriptForVideo && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => onUseTranscriptForVideo(transcript)}
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Use this script for Talking Head video
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Step 1: Source */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">1. Source content</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v as InputMode)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="text"><FileText className="w-4 h-4 mr-1" /> Text</TabsTrigger>
                <TabsTrigger value="url"><Globe className="w-4 h-4 mr-1" /> URL</TabsTrigger>
                <TabsTrigger value="pdf"><Upload className="w-4 h-4 mr-1" /> PDF</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-3">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste an article, blog post, notes, or any text content..."
                  className="min-h-[160px] rounded-xl text-sm"
                  disabled={isGenerating}
                />
                {text.trim() && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {text.trim().split(/\s+/).length} words
                  </p>
                )}
              </TabsContent>
              <TabsContent value="url" className="mt-3 space-y-2">
                <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article-to-discuss"
                  disabled={isGenerating}
                  className="rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  We'll fetch and extract readable text from the page.
                </p>
              </TabsContent>
              <TabsContent value="pdf" className="mt-3">
                {pdfName && pdfText ? (
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pdfName}</p>
                      <p className="text-xs text-muted-foreground">
                        {pdfText.length.toLocaleString()} characters extracted
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setPdfName(null); setPdfText(''); }}
                      disabled={isGenerating}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-accent/30 transition-colors">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      disabled={isParsingPdf || isGenerating}
                      onChange={(e) => e.target.files?.[0] && handlePdfUpload(e.target.files[0])}
                    />
                    {isParsingPdf ? (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" /> Parsing PDF...
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Click to upload PDF (max 20MB, first 50 pages)
                        </p>
                      </>
                    )}
                  </label>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Step 2: Hosts */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> 2. Hosts
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Host A (curious)</Label>
                <Input
                  value={hostAName}
                  onChange={(e) => setHostAName(e.target.value)}
                  placeholder="Alex"
                  disabled={isGenerating}
                  className="rounded-lg"
                />
                <Select value={voiceA} onValueChange={setVoiceA} disabled={isGenerating}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Host B (expert)</Label>
                <Input
                  value={hostBName}
                  onChange={(e) => setHostBName(e.target.value)}
                  placeholder="Jordan"
                  disabled={isGenerating}
                  className="rounded-lg"
                />
                <Select value={voiceB} onValueChange={setVoiceB} disabled={isGenerating}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Step 3: Length */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">3. Approx length</Label>
            <div className="flex gap-2 flex-wrap">
              {[2, 3, 5, 8].map((m) => (
                <button
                  key={m}
                  onClick={() => setTargetMinutes(m)}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    targetMinutes === m
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/30 hover:bg-accent/50'
                  } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  ~{m} min
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full h-12 text-base font-semibold rounded-xl"
            size="lg"
            onClick={generate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Generating podcast...</>
            ) : (
              <><Sparkles className="w-5 h-5 mr-2" /> Generate Podcast</>
            )}
          </Button>

          {isGenerating && (
            <div className="space-y-1">
              <Progress value={progress} className="h-2 rounded-full" />
              <p className="text-xs text-center text-muted-foreground">
                Writing dialogue and rendering voices...
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};
