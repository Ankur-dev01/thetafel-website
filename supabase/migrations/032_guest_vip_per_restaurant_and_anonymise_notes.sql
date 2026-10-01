-- 032: per-restaurant VIP flag on guest_notes (never guests.loyalty_tier — global table),
-- note made nullable, and anonymise_guest() now hard-deletes guest_notes + nulls loyalty_tier.
-- Applied via Supabase MCP 2026-10-01. Do not re-run.

ALTER TABLE public.guest_notes ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false;
ALTER TABLE public.guest_notes ALTER COLUMN note DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.anonymise_guest(p_guest_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_original_email text;
  v_blocking_bookings int;
  v_blocking_orders int;
  v_blocking_payments int;
begin
  select count(*) into v_blocking_bookings
  from bookings
  where guest_id = p_guest_id
    and status in ('pending', 'confirmed')
    and slot_time >= date_trunc('day', now());

  if v_blocking_bookings > 0 then
    return jsonb_build_object('ok', false, 'reason', 'upcoming_booking');
  end if;

  select count(*) into v_blocking_orders
  from orders
  where guest_id = p_guest_id
    and status in ('pending', 'confirmed', 'preparing', 'ready', 'served');

  if v_blocking_orders > 0 then
    return jsonb_build_object('ok', false, 'reason', 'active_order');
  end if;

  select count(*) into v_blocking_payments
  from payment_intents pi
  where pi.status = 'pending'
    and (
      exists (
        select 1 from bookings b
        where b.guest_id = p_guest_id
          and (b.deposit_intent_id = pi.id or b.refund_intent_id = pi.id)
      )
      or exists (
        select 1 from orders o
        where o.guest_id = p_guest_id
          and (o.payment_intent_id = pi.id or o.refund_intent_id = pi.id)
      )
    );

  if v_blocking_payments > 0 then
    return jsonb_build_object('ok', false, 'reason', 'payment_in_flight');
  end if;

  select email into v_original_email from guests where id = p_guest_id;

  if v_original_email is null then
    return jsonb_build_object('ok', false, 'reason', 'guest_not_found');
  end if;

  update guests
  set full_name = 'Deleted user',
      email = 'deleted-' || p_guest_id::text || '@deleted.thetafel.nl',
      phone = '+10000000000',
      marketing_consent = false,
      marketing_consent_at = null,
      loyalty_tier = null,
      anonymised_at = now(),
      updated_at = now()
  where id = p_guest_id;

  update bookings
  set guest_note = null,
      updated_at = now()
  where guest_id = p_guest_id and guest_note is not null;

  update orders
  set guest_note = null,
      guest_company_name = null,
      updated_at = now()
  where guest_id = p_guest_id
    and (guest_note is not null or guest_company_name is not null);

  update order_items oi
  set item_notes = null
  from orders o
  where oi.order_id = o.id
    and o.guest_id = p_guest_id
    and oi.item_notes is not null;

  -- Restaurant-private notes and VIP flags are personal data: hard delete.
  delete from guest_notes where guest_id = p_guest_id;

  delete from magic_links ml
  where ml.guest_id = p_guest_id
     or ml.booking_id in (select id from bookings where guest_id = p_guest_id)
     or ml.order_id in (select id from orders where guest_id = p_guest_id);

  update consumer_audit_logs cal
  set ip_address = null,
      user_agent = null
  where cal.actor_id = p_guest_id
     or cal.booking_id in (select id from bookings where guest_id = p_guest_id)
     or cal.order_id in (select id from orders where guest_id = p_guest_id);

  return jsonb_build_object('ok', true, 'original_email', v_original_email);
end;
$function$;

REVOKE ALL ON FUNCTION public.anonymise_guest(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymise_guest(uuid) TO service_role;
