-- ============================================
-- 피터파 워치카운터 - 워치 라운드 테이블
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 워치에서 기록한 라운드 (홀별 raw 타수)
CREATE TABLE IF NOT EXISTS public.golf_watch_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cc_name       text NOT NULL,
  play_date     date NOT NULL DEFAULT CURRENT_DATE,
  holes         integer NOT NULL DEFAULT 18,
  scores        jsonb NOT NULL DEFAULT '[]'::jsonb,
  total         integer NOT NULL DEFAULT 0,
  status        text NOT NULL DEFAULT 'in_progress'
                CHECK (status IN ('in_progress', 'completed')),
  current_hole  integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_golf_watch_rounds_user
  ON public.golf_watch_rounds(user_id, play_date DESC);

-- RLS 활성화
ALTER TABLE public.golf_watch_rounds ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 데이터만 CRUD
CREATE POLICY "Users can view own watch rounds"
  ON public.golf_watch_rounds FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watch rounds"
  ON public.golf_watch_rounds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watch rounds"
  ON public.golf_watch_rounds FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watch rounds"
  ON public.golf_watch_rounds FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_golf_watch_rounds_updated_at
  BEFORE UPDATE ON public.golf_watch_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
