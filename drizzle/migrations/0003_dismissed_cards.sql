CREATE TABLE public.dismissed_cards (
  user_id uuid NOT NULL,
  card_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, card_id)
);
GRANT SELECT, INSERT, DELETE ON public.dismissed_cards TO authenticated;
GRANT ALL ON public.dismissed_cards TO service_role;
ALTER TABLE public.dismissed_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own dismissed cards" ON public.dismissed_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users add own dismissed cards" ON public.dismissed_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users remove own dismissed cards" ON public.dismissed_cards FOR DELETE TO authenticated USING (auth.uid() = user_id);