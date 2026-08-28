ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS address text;

DROP FUNCTION IF EXISTS public.get_queue_info(text);

CREATE FUNCTION public.get_queue_info(p_slug text)
 RETURNS TABLE(business_name text, now_serving integer, waiting_count integer, paused boolean, brand_color text, logo_path text, welcome_message text, address text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.name, b.now_serving,
    (SELECT count(*)::int FROM public.tickets t WHERE t.business_id = b.id AND t.status = 'waiting'),
    b.paused, b.brand_color, b.logo_path, b.welcome_message, b.address
  FROM public.businesses b WHERE b.slug = p_slug;
$function$;

REVOKE ALL ON FUNCTION public.get_queue_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_queue_info(text) TO anon, authenticated;
