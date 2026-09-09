-- ==============================================================================
-- Migration: 20260909000000_fix_rls_infinite_recursion.sql
-- Description: Completely eliminate circular RLS dependencies by making
--              business_members a leaf table (no subqueries to businesses).
-- ==============================================================================

-- 1. Drop all previous potentially circular policies
DROP POLICY IF EXISTS "Owners manage their business" ON public.businesses;
DROP POLICY IF EXISTS "Members view their business" ON public.businesses;
DROP POLICY IF EXISTS "Anyone can view businesses" ON public.businesses;

DROP POLICY IF EXISTS "Members view business memberships" ON public.business_members;
DROP POLICY IF EXISTS "Owners manage business members" ON public.business_members;
DROP POLICY IF EXISTS "Users manage own membership" ON public.business_members;
DROP POLICY IF EXISTS "Members access own memberships" ON public.business_members;

DROP POLICY IF EXISTS "Members view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owners manage business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owners and members view settings" ON public.business_settings;
DROP POLICY IF EXISTS "Owners manage settings" ON public.business_settings;

DROP POLICY IF EXISTS "Members view subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners manage subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Owners and members view subscriptions" ON public.subscriptions;

DROP POLICY IF EXISTS "Members view payment transactions" ON public.payment_transactions;
DROP POLICY IF EXISTS "Owners and members view transactions" ON public.payment_transactions;

DROP POLICY IF EXISTS "Owners manage tickets of their business" ON public.tickets;
DROP POLICY IF EXISTS "Owners and members manage tickets" ON public.tickets;

-- Drop previous helper functions if they exist
DROP FUNCTION IF EXISTS public.is_business_owner(uuid);
DROP FUNCTION IF EXISTS public.is_business_member(uuid);


-- ==============================================================================
-- 2. BUSINESS_MEMBERS (LEAF TABLE - ZERO DEPENDENCY ON BUSINESSES)
-- ==============================================================================
-- A user can view and manage their own membership record (user_id = auth.uid()).
-- Because this policy NEVER queries the 'businesses' table, it is IMPOSSIBLE
-- for an infinite recursion cycle to occur.
CREATE POLICY "Members access own memberships" ON public.business_members
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ==============================================================================
-- 3. BUSINESSES TABLE
-- ==============================================================================
-- Owners have full CRUD on their own business
CREATE POLICY "Owners manage their business" ON public.businesses
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Team members can view their business
-- Checking business_members here is completely safe because business_members
-- does NOT query businesses back!
CREATE POLICY "Members view their business" ON public.businesses
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.business_members bm
      WHERE bm.business_id = businesses.id AND bm.user_id = auth.uid()
    )
  );


-- ==============================================================================
-- 4. BUSINESS SETTINGS TABLE
-- ==============================================================================
CREATE POLICY "Owners and members view settings" ON public.business_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = business_settings.business_id AND bm.user_id = auth.uid())
  );

CREATE POLICY "Owners manage settings" ON public.business_settings
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = business_settings.business_id AND b.owner_id = auth.uid())
  );


-- ==============================================================================
-- 5. SUBSCRIPTIONS TABLE
-- ==============================================================================
CREATE POLICY "Owners and members view subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = subscriptions.business_id AND bm.user_id = auth.uid())
  );

CREATE POLICY "Owners manage subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = subscriptions.business_id AND b.owner_id = auth.uid())
  );


-- ==============================================================================
-- 6. PAYMENT TRANSACTIONS TABLE
-- ==============================================================================
CREATE POLICY "Owners and members view transactions" ON public.payment_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = payment_transactions.business_id AND b.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = payment_transactions.business_id AND bm.user_id = auth.uid())
  );


-- ==============================================================================
-- 7. TICKETS TABLE
-- ==============================================================================
CREATE POLICY "Owners and members manage tickets" ON public.tickets
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tickets.business_id AND b.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = tickets.business_id AND bm.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = tickets.business_id AND b.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.business_members bm WHERE bm.business_id = tickets.business_id AND bm.user_id = auth.uid())
  );
