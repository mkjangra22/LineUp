ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS paused boolean NOT NULL DEFAULT false;

DROP FUNCTION IF EXISTS public.get_queue_info(text);

CREATE FUNCTION public.get_queue_info(p_slug text)
 RETURNS TABLE(business_name text, now_serving integer, waiting_count integer, paused boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT b.name, b.now_serving,
    (SELECT count(*)::int FROM public.tickets t WHERE t.business_id = b.id AND t.status = 'waiting'),
    b.paused
  FROM public.businesses b WHERE b.slug = p_slug;
$function$;

CREATE OR REPLACE FUNCTION public.join_queue(p_slug text, p_name text)
 RETURNS TABLE(ticket_id uuid, ticket_number integer, business_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_business public.businesses%ROWTYPE;
  v_number integer;
  v_id uuid;
  v_name text := btrim(p_name);
BEGIN
  IF v_name = '' OR length(v_name) > 60 THEN
    RAISE EXCEPTION 'Please enter a valid name';
  END IF;

  SELECT * INTO v_business FROM public.businesses WHERE slug = p_slug FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Queue not found';
  END IF;

  IF v_business.paused THEN
    RAISE EXCEPTION 'This queue is paused and is not taking new people right now';
  END IF;

  SELECT COALESCE(max(number), 0) + 1 INTO v_number
  FROM public.tickets WHERE business_id = v_business.id;

  INSERT INTO public.tickets (business_id, number, customer_name)
  VALUES (v_business.id, v_number, v_name)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_number, v_business.name;
END;
$function$;