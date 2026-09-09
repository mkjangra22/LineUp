-- ==============================================================================
-- Migration: 20260909010000_fix_get_ticket_status_rpc.sql
-- Description: Convert get_ticket_status and get_queue_info to PL/pgSQL
--              with SECURITY DEFINER so anonymous customers can check
--              their live ticket status and receive the "serving" alert.
-- ==============================================================================

-- 1. Public RPC: Get live status of customer's specific ticket
CREATE OR REPLACE FUNCTION public.get_ticket_status(p_ticket_id uuid)
RETURNS TABLE (
  ticket_number integer,
  customer_name text,
  status text,
  now_serving integer,
  people_ahead integer,
  business_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.number AS ticket_number,
    t.customer_name,
    t.status,
    COALESCE(b.now_serving, 0) AS now_serving,
    (
      SELECT count(*)::int 
      FROM public.tickets o
      WHERE o.business_id = t.business_id 
        AND o.status = 'waiting' 
        AND o.number < t.number
    ) AS people_ahead,
    b.name AS business_name
  FROM public.tickets t
  JOIN public.businesses b ON b.id = t.business_id
  WHERE t.id = p_ticket_id;
END;
$$;

-- 2. Public RPC: Get public queue info
CREATE OR REPLACE FUNCTION public.get_queue_info(p_slug text)
RETURNS TABLE (
  business_name text,
  now_serving integer,
  waiting_count integer,
  paused boolean,
  brand_color text,
  logo_path text,
  welcome_message text,
  address text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.name AS business_name,
    COALESCE(b.now_serving, 0) AS now_serving,
    (
      SELECT count(*)::int 
      FROM public.tickets t 
      WHERE t.business_id = b.id AND t.status = 'waiting'
    ) AS waiting_count,
    COALESCE(b.paused, false) AS paused,
    b.brand_color,
    b.logo_path,
    b.welcome_message,
    b.address
  FROM public.businesses b 
  WHERE b.slug = p_slug;
END;
$$;

-- 3. Ensure proper permissions for anonymous customers & authenticated users
REVOKE ALL ON FUNCTION public.get_ticket_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ticket_status(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_queue_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_queue_info(text) TO anon, authenticated;
