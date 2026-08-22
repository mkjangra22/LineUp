CREATE TABLE public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  now_serving integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.businesses TO authenticated;
GRANT ALL ON public.businesses TO service_role;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their business" ON public.businesses
  FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  number integer NOT NULL,
  customer_name text NOT NULL,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now(),
  served_at timestamptz,
  CONSTRAINT tickets_status_check CHECK (status IN ('waiting','serving','served','skipped')),
  CONSTRAINT tickets_unique_number UNIQUE (business_id, number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage tickets of their business" ON public.tickets
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tickets.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tickets.business_id AND b.owner_id = auth.uid()));

CREATE INDEX tickets_business_status_idx ON public.tickets (business_id, status, number);

-- Public: look up a queue by its link code (name only, no customer data)
CREATE OR REPLACE FUNCTION public.get_queue_info(p_slug text)
RETURNS TABLE (business_name text, now_serving integer, waiting_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT b.name, b.now_serving,
    (SELECT count(*)::int FROM public.tickets t WHERE t.business_id = b.id AND t.status = 'waiting')
  FROM public.businesses b WHERE b.slug = p_slug;
$$;

-- Public: join a queue, get a ticket number
CREATE OR REPLACE FUNCTION public.join_queue(p_slug text, p_name text)
RETURNS TABLE (ticket_id uuid, ticket_number integer, business_name text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public
AS $$
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

  SELECT COALESCE(max(number), 0) + 1 INTO v_number
  FROM public.tickets WHERE business_id = v_business.id;

  INSERT INTO public.tickets (business_id, number, customer_name)
  VALUES (v_business.id, v_number, v_name)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_number, v_business.name;
END;
$$;

-- Public: check the status of one specific ticket
CREATE OR REPLACE FUNCTION public.get_ticket_status(p_ticket_id uuid)
RETURNS TABLE (
  ticket_number integer,
  customer_name text,
  status text,
  now_serving integer,
  people_ahead integer,
  business_name text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.number, t.customer_name, t.status, b.now_serving,
    (SELECT count(*)::int FROM public.tickets o
      WHERE o.business_id = t.business_id AND o.status = 'waiting' AND o.number < t.number),
    b.name
  FROM public.tickets t
  JOIN public.businesses b ON b.id = t.business_id
  WHERE t.id = p_ticket_id;
$$;

REVOKE ALL ON FUNCTION public.get_queue_info(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_queue(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_ticket_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_queue_info(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.join_queue(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket_status(uuid) TO anon, authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.businesses;