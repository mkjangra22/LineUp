-- ==========================================================
-- LineUp Resilient Onboarding & Multi-Tenant Relational Schema
-- ==========================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  phone text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users manage their own profile'
  ) THEN
    CREATE POLICY "Users manage their own profile" ON public.profiles
      FOR ALL TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;


-- 2. Business Members Table (Authoritative Tenancy & Ownership Model)
CREATE TABLE IF NOT EXISTS public.business_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_members_business_user_unique UNIQUE (business_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_members TO authenticated;
GRANT ALL ON public.business_members TO service_role;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_members' AND policyname = 'Members view business memberships'
  ) THEN
    CREATE POLICY "Members view business memberships" ON public.business_members
      FOR SELECT TO authenticated
      USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_members.business_id AND b.owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_members' AND policyname = 'Owners manage business members'
  ) THEN
    CREATE POLICY "Owners manage business members" ON public.business_members
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_members.business_id AND b.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = business_members.business_id AND bm.user_id = auth.uid() AND bm.role = 'owner')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_members.business_id AND b.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = business_members.business_id AND bm.user_id = auth.uid() AND bm.role = 'owner')
      );
  END IF;
END $$;


-- 3. Business Settings Table
CREATE TABLE IF NOT EXISTS public.business_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  business_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_settings_business_unique UNIQUE (business_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_settings TO authenticated;
GRANT ALL ON public.business_settings TO service_role;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_settings' AND policyname = 'Members view business settings'
  ) THEN
    CREATE POLICY "Members view business settings" ON public.business_settings
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = business_settings.business_id AND bm.user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'business_settings' AND policyname = 'Owners manage business settings'
  ) THEN
    CREATE POLICY "Owners manage business settings" ON public.business_settings
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = business_settings.business_id AND bm.user_id = auth.uid() AND bm.role = 'owner')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = business_settings.business_id AND bm.user_id = auth.uid() AND bm.role = 'owner')
      );
  END IF;
END $$;


-- 4. Subscriptions Table (Separate from Business Profiles)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  billing_period text NOT NULL DEFAULT 'monthly',
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  razorpay_customer_id text,
  razorpay_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_business_unique UNIQUE (business_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Members view subscriptions'
  ) THEN
    CREATE POLICY "Members view subscriptions" ON public.subscriptions
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = subscriptions.business_id AND bm.user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscriptions' AND policyname = 'Owners manage subscriptions'
  ) THEN
    CREATE POLICY "Owners manage subscriptions" ON public.subscriptions
      FOR ALL TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = subscriptions.business_id AND bm.user_id = auth.uid() AND bm.role = 'owner')
      )
      WITH CHECK (
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = subscriptions.business_id AND bm.user_id = auth.uid() AND bm.role = 'owner')
      );
  END IF;
END $$;


-- 5. Payment Transactions Table (Future Razorpay Compatibility)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  amount integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_transactions_business_idx ON public.payment_transactions(business_id);
CREATE INDEX IF NOT EXISTS payment_transactions_subscription_idx ON public.payment_transactions(subscription_id);

GRANT SELECT, INSERT, UPDATE ON public.payment_transactions TO authenticated;
GRANT ALL ON public.payment_transactions TO service_role;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payment_transactions' AND policyname = 'Members view payment transactions'
  ) THEN
    CREATE POLICY "Members view payment transactions" ON public.payment_transactions
      FOR SELECT TO authenticated
      USING (
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = payment_transactions.business_id AND bm.user_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = payment_transactions.business_id AND b.owner_id = auth.uid())
      );
  END IF;
END $$;


-- 6. Update Businesses RLS to allow access by authoritative business_members
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'businesses' AND policyname = 'Members view their business'
  ) THEN
    CREATE POLICY "Members view their business" ON public.businesses
      FOR SELECT TO authenticated
      USING (
        owner_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = businesses.id AND bm.user_id = auth.uid())
      );
  END IF;
END $$;


-- 7. Idempotent Business Onboarding Database RPC
CREATE OR REPLACE FUNCTION public.complete_business_onboarding(
  p_name text,
  p_address text,
  p_business_type text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_brand_color text DEFAULT '#077E42'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_business_id uuid;
  v_slug text;
  v_existing_business public.businesses%ROWTYPE;
  v_clean_name text := btrim(p_name);
  v_clean_address text := btrim(p_address);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_clean_name = '' OR length(v_clean_name) > 60 THEN
    RAISE EXCEPTION 'Business name must be between 1 and 60 characters';
  END IF;

  -- Fetch authenticated user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  -- 1. Idempotently create / update profile
  INSERT INTO public.profiles (id, email, phone, updated_at)
  VALUES (v_user_id, COALESCE(v_user_email, ''), p_phone, now())
  ON CONFLICT (id) DO UPDATE
    SET phone = COALESCE(EXCLUDED.phone, profiles.phone),
        email = COALESCE(EXCLUDED.email, profiles.email),
        updated_at = now();

  -- 2. Check if user already owns a business (prevents duplicates)
  SELECT * INTO v_existing_business
  FROM public.businesses
  WHERE owner_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF FOUND THEN
    v_business_id := v_existing_business.id;
    UPDATE public.businesses
    SET address = COALESCE(v_clean_address, address),
        brand_color = COALESCE(p_brand_color, brand_color)
    WHERE id = v_business_id;
  ELSE
    -- Generate unique slug
    v_slug := lower(regexp_replace(v_clean_name, '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    IF v_slug = '' THEN v_slug := 'queue'; END IF;
    v_slug := substr(v_slug, 1, 28) || '-' || substr(md5(random()::text), 1, 4);

    -- Insert new business workspace
    INSERT INTO public.businesses (owner_id, name, slug, address, brand_color)
    VALUES (v_user_id, v_clean_name, v_slug, v_clean_address, COALESCE(p_brand_color, '#077E42'))
    RETURNING id INTO v_business_id;
  END IF;

  -- 3. Idempotently create / verify business membership (owner)
  INSERT INTO public.business_members (business_id, user_id, role)
  VALUES (v_business_id, v_user_id, 'owner')
  ON CONFLICT (business_id, user_id) DO NOTHING;

  -- 4. Idempotently create / verify business_settings
  IF p_business_type IS NOT NULL AND btrim(p_business_type) <> '' THEN
    INSERT INTO public.business_settings (business_id, business_type, updated_at)
    VALUES (v_business_id, btrim(p_business_type), now())
    ON CONFLICT (business_id) DO UPDATE
      SET business_type = EXCLUDED.business_type,
          updated_at = now();
  END IF;

  -- 5. Idempotently create / verify free subscription
  INSERT INTO public.subscriptions (business_id, plan, status, billing_period, amount, currency)
  VALUES (v_business_id, 'free', 'active', 'monthly', 0, 'INR')
  ON CONFLICT (business_id) DO NOTHING;

  RETURN jsonb_build_object(
    'business_id', v_business_id,
    'slug', (SELECT slug FROM public.businesses WHERE id = v_business_id),
    'name', (SELECT name FROM public.businesses WHERE id = v_business_id),
    'owner_id', v_user_id,
    'role', 'owner'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_business_onboarding(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_business_onboarding(text, text, text, text, text) TO authenticated;
