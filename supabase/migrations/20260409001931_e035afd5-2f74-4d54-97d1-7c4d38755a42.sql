CREATE TABLE public.chatcut_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Project',
  video_url TEXT,
  transcript JSONB,
  timeline_state JSONB NOT NULL DEFAULT '{}',
  chat_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.chatcut_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own chatcut drafts" ON public.chatcut_drafts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER update_chatcut_drafts_updated_at
  BEFORE UPDATE ON public.chatcut_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();