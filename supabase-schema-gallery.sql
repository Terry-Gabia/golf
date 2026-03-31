-- =============================================
-- 갤러리(Storage + Metadata) 추가
-- =============================================

-- 1. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery-media',
  'gallery-media',
  true,
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
  bucket_name   text NOT NULL DEFAULT 'gallery-media',
  file_path     text NOT NULL UNIQUE,
  public_url    text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_created_at ON public.gallery_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_user_id ON public.gallery_items(user_id, created_at DESC);

-- 3. RLS
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Users can insert own gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Users can update own gallery items" ON public.gallery_items;
DROP POLICY IF EXISTS "Users can delete own gallery items" ON public.gallery_items;

CREATE POLICY "Authenticated users can view gallery items" ON public.gallery_items
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert own gallery items" ON public.gallery_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gallery items" ON public.gallery_items
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gallery items" ON public.gallery_items
  FOR DELETE USING (auth.uid() = user_id);

-- 4. Storage policies
DROP POLICY IF EXISTS "Authenticated users can view gallery media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own gallery media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own gallery media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own gallery media" ON storage.objects;

CREATE POLICY "Authenticated users can view gallery media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'gallery-media' AND auth.uid() IS NOT NULL
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
