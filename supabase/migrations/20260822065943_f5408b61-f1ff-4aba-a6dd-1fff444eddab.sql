ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS brand_color text NOT NULL DEFAULT '#c05621',
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS welcome_message text;

DROP FUNCTION IF EXISTS public.get_queue_info(text);

CREATE FUNCTION public.get_queue_info(p_slug text)
 RETURNS TABLE(business_name text, now_serving integer, waiting_count integer, paused boolean, brand_color text, logo_path text, welcome_message text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.name, b.now_serving,
    (SELECT count(*)::int FROM public.tickets t WHERE t.business_id = b.id AND t.status = 'waiting'),
    b.paused, b.brand_color, b.logo_path, b.welcome_message
  FROM public.businesses b WHERE b.slug = p_slug;
$function$;

REVOKE ALL ON FUNCTION public.get_queue_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_queue_info(text) TO anon, authenticated;

CREATE POLICY "Anyone can read logos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "Owners can upload their own logo"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners can update their own logo"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners can delete their own logo"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);