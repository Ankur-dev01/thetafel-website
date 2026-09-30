-- 031: D8.2 RLS wave 2 (additive staff-membership SELECT policies).
-- Applied via MCP 2026-10-01. Do not re-run.
CREATE OR REPLACE FUNCTION public.is_restaurant_staff(p_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.restaurant_staff s
    WHERE s.restaurant_id = p_restaurant_id AND s.user_id = auth.uid() AND s.deactivated_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.is_restaurant_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_restaurant_staff(uuid) TO authenticated, service_role;

CREATE POLICY restaurants_staff_select ON public.restaurants FOR SELECT TO authenticated USING (public.is_restaurant_staff(id));
CREATE POLICY availability_staff_select ON public.availability FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY avail_exc_staff_select ON public.availability_exceptions FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY bookings_staff_select ON public.bookings FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY booking_tables_staff_select ON public.booking_tables FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_tables.booking_id AND public.is_restaurant_staff(b.restaurant_id)));
CREATE POLICY consumer_audit_staff_select ON public.consumer_audit_logs FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY dashboard_audit_staff_select ON public.dashboard_audit_logs FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY guest_notes_staff_select ON public.guest_notes FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY guests_staff_select ON public.guests FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.guest_id = guests.id AND public.is_restaurant_staff(b.restaurant_id))
      OR EXISTS (SELECT 1 FROM public.orders o WHERE o.guest_id = guests.id AND public.is_restaurant_staff(o.restaurant_id)));
CREATE POLICY menu_cats_staff_select ON public.menu_categories FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY menu_items_staff_select ON public.menu_items FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY variants_staff_select ON public.menu_item_variants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.menu_items mi WHERE mi.id = menu_item_variants.item_id AND public.is_restaurant_staff(mi.restaurant_id)));
CREATE POLICY uploads_staff_select ON public.menu_source_uploads FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY orders_staff_select ON public.orders FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY order_items_staff_select ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_restaurant_staff(o.restaurant_id)));
CREATE POLICY payment_intents_staff_select ON public.payment_intents FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY restaurant_staff_colleague_select ON public.restaurant_staff FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY staff_invites_staff_select ON public.staff_invites FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY tables_staff_select ON public.restaurant_tables FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY sessions_staff_select ON public.table_sessions FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY tabs_staff_select ON public.tabs FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY waitlist_staff_select ON public.waitlist_entries FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
CREATE POLICY zones_staff_select ON public.zones FOR SELECT TO authenticated USING (public.is_restaurant_staff(restaurant_id));
