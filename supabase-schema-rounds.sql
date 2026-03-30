-- =============================================
-- 골프 스코어카드 (라운드) 테이블 추가
-- =============================================

-- 1. 라운드 테이블 (한 판의 골프)
CREATE TABLE IF NOT EXISTS public.golf_rounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  play_type   text NOT NULL CHECK (play_type IN ('필드', '파3', '스크린')),
  visibility  text NOT NULL DEFAULT 'private' CONSTRAINT golf_rounds_visibility_check CHECK (visibility IN ('public', 'private')),
  cc_name     text NOT NULL,
  play_date   date NOT NULL,
  holes       integer NOT NULL DEFAULT 9,
  pars        jsonb NOT NULL DEFAULT '[3,3,3,3,3,3,3,3,3]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.golf_rounds
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private';

ALTER TABLE public.golf_rounds
  DROP CONSTRAINT IF EXISTS golf_rounds_visibility_check;

ALTER TABLE public.golf_rounds
  ADD CONSTRAINT golf_rounds_visibility_check CHECK (visibility IN ('public', 'private'));

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
DROP INDEX IF EXISTS idx_golf_rounds_public_par3;
CREATE INDEX IF NOT EXISTS idx_golf_rounds_public_visibility ON public.golf_rounds(play_date DESC) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_golf_round_players_round ON public.golf_round_players(round_id);

-- 4. RLS
ALTER TABLE public.golf_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_round_players ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.round_owner_id(target_round_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.golf_rounds
  WHERE id = target_round_id
$$;

CREATE OR REPLACE FUNCTION public.round_is_public(target_round_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT visibility = 'public'
      FROM public.golf_rounds
      WHERE id = target_round_id
    ),
    false
  )
$$;

DROP POLICY IF EXISTS "Users can view own rounds" ON public.golf_rounds;
DROP POLICY IF EXISTS "Users can insert own rounds" ON public.golf_rounds;
DROP POLICY IF EXISTS "Users can update own rounds" ON public.golf_rounds;
DROP POLICY IF EXISTS "Users can delete own rounds" ON public.golf_rounds;
DROP POLICY IF EXISTS "Users can view own or public par3 rounds" ON public.golf_rounds;
DROP POLICY IF EXISTS "Users can update own or public par3 rounds" ON public.golf_rounds;
DROP POLICY IF EXISTS "Users can view round players" ON public.golf_round_players;
DROP POLICY IF EXISTS "Users can insert round players" ON public.golf_round_players;
DROP POLICY IF EXISTS "Users can update round players" ON public.golf_round_players;
DROP POLICY IF EXISTS "Users can delete round players" ON public.golf_round_players;

CREATE POLICY "Users can view own or public rounds" ON public.golf_rounds
  FOR SELECT USING (
    auth.uid() = user_id OR
    (auth.uid() IS NOT NULL AND visibility = 'public')
  );
CREATE POLICY "Users can insert own rounds" ON public.golf_rounds
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own rounds" ON public.golf_rounds
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update public rounds" ON public.golf_rounds
  FOR UPDATE USING (
    auth.uid() IS NOT NULL AND visibility = 'public'
  )
  WITH CHECK (
    visibility = 'public' AND user_id = public.round_owner_id(id)
  );
CREATE POLICY "Users can delete own rounds" ON public.golf_rounds
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view round players" ON public.golf_round_players
  FOR SELECT USING (
    auth.uid() = public.round_owner_id(round_id) OR
    (auth.uid() IS NOT NULL AND public.round_is_public(round_id))
  );
CREATE POLICY "Users can insert round players" ON public.golf_round_players
  FOR INSERT WITH CHECK (
    auth.uid() = public.round_owner_id(round_id) OR
    (auth.uid() IS NOT NULL AND public.round_is_public(round_id))
  );
CREATE POLICY "Users can update round players" ON public.golf_round_players
  FOR UPDATE USING (
    auth.uid() = public.round_owner_id(round_id) OR
    (auth.uid() IS NOT NULL AND public.round_is_public(round_id))
  )
  WITH CHECK (
    auth.uid() = public.round_owner_id(round_id) OR
    (auth.uid() IS NOT NULL AND public.round_is_public(round_id))
  );
CREATE POLICY "Users can delete round players" ON public.golf_round_players
  FOR DELETE USING (
    auth.uid() = public.round_owner_id(round_id) OR
    (auth.uid() IS NOT NULL AND public.round_is_public(round_id))
  );

-- 5. Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'golf_rounds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.golf_rounds;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'golf_round_players'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.golf_round_players;
  END IF;
END $$;

-- 6. updated_at 트리거
DROP TRIGGER IF EXISTS update_golf_rounds_updated_at ON public.golf_rounds;

CREATE TRIGGER update_golf_rounds_updated_at
  BEFORE UPDATE ON public.golf_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
