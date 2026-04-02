-- =============================================
-- 갤러리(Storage + Metadata) 추가
-- =============================================

-- 1. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery-media',
  'gallery-media',
  false,
  104857600,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Metadata table
CREATE TABLE IF NOT EXISTS public.gallery_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  uploader_name text NOT NULL,
  title         text,
  description   text,
  media_type    text NOT NULL CHECK (media_type IN ('image', 'video')),
  visibility    text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  source_type   text NOT NULL DEFAULT 'upload' CHECK (source_type IN ('upload', 'youtube')),
  bucket_name   text NOT NULL DEFAULT 'gallery-media',
  file_path     text NOT NULL UNIQUE,
  public_url    text NOT NULL,
  external_url  text,
  embed_url     text,
  thumbnail_url text,
  view_count    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'upload';

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS external_url text;

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS embed_url text;

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE public.gallery_items
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.gallery_items
  DROP CONSTRAINT IF EXISTS gallery_items_visibility_check;

ALTER TABLE public.gallery_items
  ADD CONSTRAINT gallery_items_visibility_check CHECK (visibility IN ('public', 'private'));

ALTER TABLE public.gallery_items
  DROP CONSTRAINT IF EXISTS gallery_items_source_type_check;

ALTER TABLE public.gallery_items
  ADD CONSTRAINT gallery_items_source_type_check CHECK (source_type IN ('upload', 'youtube'));

CREATE INDEX IF NOT EXISTS idx_gallery_items_created_at ON public.gallery_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_user_id ON public.gallery_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_visibility_created_at ON public.gallery_items(visibility, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gallery_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_item_id uuid NOT NULL REFERENCES public.gallery_items(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  commenter_name  text NOT NULL,
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_comments_item_created_at
  ON public.gallery_comments(gallery_item_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_gallery_comments_user_id
  ON public.gallery_comments(user_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Users can view own or public gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Users can insert own gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Users can update own gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Users can delete own gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Authenticated users can view gallery comments" ON public.gallery_comments;
DROP POLICY IF EXISTS "Users can view accessible gallery comments" ON public.gallery_comments;
DROP POLICY IF EXISTS "Users can insert own gallery comments" ON public.gallery_comments;
DROP POLICY IF EXISTS "Users can update own gallery comments" ON public.gallery_comments;
DROP POLICY IF EXISTS "Users can delete own gallery comments" ON public.gallery_comments;

CREATE OR REPLACE FUNCTION public.gallery_item_owner_id(target_item_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.gallery_items
  WHERE id = target_item_id
$$;

CREATE OR REPLACE FUNCTION public.gallery_item_is_accessible(target_item_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT auth.uid() = user_id OR (auth.uid() IS NOT NULL AND visibility = 'public')
      FROM public.gallery_items
      WHERE id = target_item_id
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.gallery_item_file_is_accessible(target_file_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT auth.uid() = user_id OR (auth.uid() IS NOT NULL AND visibility = 'public')
      FROM public.gallery_items
      WHERE file_path = target_file_path
    ),
    false
  )
$$;

CREATE POLICY "Users can view own or public gallery items" ON public.gallery_items
  FOR SELECT USING (
    auth.uid() = user_id OR
    (auth.uid() IS NOT NULL AND visibility = 'public')
  );

CREATE POLICY "Users can insert own gallery items" ON public.gallery_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gallery items" ON public.gallery_items
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery items" ON public.gallery_items
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view accessible gallery comments" ON public.gallery_comments
  FOR SELECT USING (public.gallery_item_is_accessible(gallery_item_id));

CREATE POLICY "Users can insert own gallery comments" ON public.gallery_comments
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.gallery_item_is_accessible(gallery_item_id)
  );

CREATE POLICY "Users can update own gallery comments" ON public.gallery_comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery comments" ON public.gallery_comments
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.increment_gallery_item_view(target_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.gallery_items
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = target_item_id
    AND public.gallery_item_is_accessible(target_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_gallery_item_view(uuid) TO authenticated;

-- 4. Storage policies
DROP POLICY IF EXISTS "Authenticated users can view gallery media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own gallery media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own gallery media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own gallery media" ON storage.objects;

CREATE POLICY "Authenticated users can view gallery media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'gallery-media'
    AND public.gallery_item_file_is_accessible(name)
  );

CREATE POLICY "Users can upload own gallery media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'gallery-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own gallery media" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'gallery-media'
    AND auth.uid() IS NOT NULL
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'gallery-media'
    AND auth.uid() IS NOT NULL
    AND owner = auth.uid()
  );

CREATE POLICY "Users can delete own gallery media" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'gallery-media'
    AND auth.uid() IS NOT NULL
    AND owner = auth.uid()
  );

-- 5. Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'gallery_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_items;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'gallery_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.gallery_comments;
  END IF;
END $$;
