-- =============================================
-- 골프 스코어카드 (라운드) 테이블 추가
-- =============================================

-- 1. 라운드 테이블 (한 판의 골프)
CREATE TABLE IF NOT EXISTS public.golf_rounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  play_type   text NOT NULL CHECK (play_type IN ('필드', '파3', '스크린')),
  cc_name     text NOT NULL,
  play_date   date NOT NULL,
  holes       integer NOT NULL DEFAULT 9,
  pars        jsonb NOT NULL DEFAULT '[3,3,3,3,3,3,3,3,3]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. 라운드 참가자별 스코어 테이블
CREATE TABLE IF NOT EXISTS public.golf_round_players (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id    uuid NOT NULL REFERENCES public.golf_rounds(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  scores      jsonb NOT NULL DEFAULT '[]',
  total       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_golf_rounds_user ON public.golf_rounds(user_id, play_date DESC);
CREATE INDEX IF NOT EXISTS idx_golf_round_players_round ON public.golf_round_players(round_id);

-- 4. RLS
ALTER TABLE public.golf_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_round_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rounds" ON public.golf_rounds
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own rounds" ON public.golf_rounds
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rounds" ON public.golf_rounds
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own rounds" ON public.golf_rounds
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view round players" ON public.golf_round_players
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.golf_rounds WHERE id = round_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can insert round players" ON public.golf_round_players
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.golf_rounds WHERE id = round_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can update round players" ON public.golf_round_players
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.golf_rounds WHERE id = round_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete round players" ON public.golf_round_players
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.golf_rounds WHERE id = round_id AND user_id = auth.uid())
  );

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.golf_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.golf_round_players;

-- 6. updated_at 트리거
CREATE TRIGGER update_golf_rounds_updated_at
  BEFORE UPDATE ON public.golf_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
