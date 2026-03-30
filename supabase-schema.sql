-- =============================================
-- 골프 기록 관리 앱 - Supabase 데이터베이스 스키마
-- =============================================

-- 1. 골프 기록 테이블
CREATE TABLE IF NOT EXISTS public.golf_records (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  play_type   text NOT NULL CHECK (play_type IN ('필드', '파3', '스크린')),
  cc_name     text NOT NULL,
  play_date   date NOT NULL,
  score       integer,
  memo        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. 공지 게시판 테이블
CREATE TABLE IF NOT EXISTS public.notices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  play_type   text NOT NULL CHECK (play_type IN ('필드', '파3', '스크린')),
  cc_name     text,
  play_date   date NOT NULL,
  play_time   time,
  max_members integer DEFAULT 4,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3. 공지 참가자 테이블
CREATE TABLE IF NOT EXISTS public.notice_participants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notice_id   uuid NOT NULL REFERENCES public.notices(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notice_id, user_id)
);

-- 4. 골프 유저 프로필 테이블
CREATE TABLE IF NOT EXISTS public.golf_user_profiles (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  text,
  theme         text DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  slack_user_id text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS idx_golf_records_user_id ON public.golf_records(user_id);
CREATE INDEX IF NOT EXISTS idx_golf_records_play_date ON public.golf_records(user_id, play_date DESC);
CREATE INDEX IF NOT EXISTS idx_notices_play_date ON public.notices(play_date DESC);
CREATE INDEX IF NOT EXISTS idx_notice_participants_notice ON public.notice_participants(notice_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_slack ON public.golf_user_profiles(slack_user_id);

-- 6. RLS 활성화
ALTER TABLE public.golf_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.golf_user_profiles ENABLE ROW LEVEL SECURITY;

-- 7. RLS 정책 - golf_records (본인 기록만 CRUD)
CREATE POLICY "Users can view own golf records" ON public.golf_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own golf records" ON public.golf_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own golf records" ON public.golf_records
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own golf records" ON public.golf_records
  FOR DELETE USING (auth.uid() = user_id);

-- 8. RLS 정책 - notices (로그인한 사용자 전체 조회, 본인만 수정/삭제)
CREATE POLICY "Anyone can view notices" ON public.notices
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can insert notices" ON public.notices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notices" ON public.notices
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notices" ON public.notices
  FOR DELETE USING (auth.uid() = user_id);

-- 9. RLS 정책 - notice_participants
CREATE POLICY "Anyone can view participants" ON public.notice_participants
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can join notices" ON public.notice_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave notices" ON public.notice_participants
  FOR DELETE USING (auth.uid() = user_id);

-- 10. RLS 정책 - user_profiles (이미 존재할 수 있으므로 DROP 후 재생성)
DROP POLICY IF EXISTS "Users can view own profile" ON public.golf_user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.golf_user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.golf_user_profiles;
CREATE POLICY "Users can view own profile" ON public.golf_user_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.golf_user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.golf_user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- 11. Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.golf_records;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notice_participants;

-- 12. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_golf_records_updated_at
  BEFORE UPDATE ON public.golf_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notices_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
