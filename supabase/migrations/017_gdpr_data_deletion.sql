-- C8.2 — GDPR right to erasure: atomic anonymisation function.
--
-- No new columns: guests.anonymised_at already exists (added earlier,
-- comment says "NULL until GDPR erasure") and is reused here rather than
-- adding a redundant deleted_at column.
--
-- supabase-js can't span a real Postgres transaction across multiple
-- .from() calls, and this operation must never partially apply (guest
-- half-anonymised, or magic links orphaned). A single SECURITY DEFINER
-- plpgsql function gives us that atomicity for free — Postgres treats the
-- whole function body as one implicit transaction, so any exception
-- partway through rolls back every write in the function.
--
-- Only ever called via the service-role admin client (see
-- lib/consumer/privacy/anonymiseGuest.ts) — no anon/authenticated grant
-- needed.
--
-- Blocking conditions are re-checked here as a safety net against a race
-- between the app-layer pre-check (lib/consumer/privacy/checkDeletionBlockers.ts)
-- and this call. If blocked, returns before any write — nothing to roll back.

create or replace function public.anonymise_guest(p_guest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_original_email text;
  v_blocking_bookings int;
  v_blocking_orders int;
  v_blocking_payments int;
begin
  -- Upcoming/unresolved booking (today or future, not yet cancelled/attended/no-show).
  select count(*) into v_blocking_bookings
  from bookings
  where guest_id = p_guest_id
    and status in ('pending', 'confirmed')
    and slot_time >= date_trunc('day', now());

  if v_blocking_bookings > 0 then
    return jsonb_build_object('ok', false, 'reason', 'upcoming_booking');
  end if;

  -- Order still in a non-terminal state.
  select count(*) into v_blocking_orders
  from orders
  where guest_id = p_guest_id
    and status in ('pending', 'confirmed', 'preparing', 'ready', 'served');

  if v_blocking_orders > 0 then
    return jsonb_build_object('ok', false, 'reason', 'active_order');
  end if;

  -- Payment settlement or refund still in flight.
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

  -- Capture the pre-anonymisation email — the caller needs it to send the
  -- confirmation, and re-reading it after the update would only see the
  -- placeholder.
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

  -- order_items.item_notes isn't named in the brief but is guest-authored
  -- free text exactly like bookings/orders guest_note — scrubbed for
  -- completeness.
  update order_items oi
  set item_notes = null
  from orders o
  where oi.order_id = o.id
    and o.guest_id = p_guest_id
    and oi.item_notes is not null;

  -- Magic links are pure identity plumbing — hard delete, not anonymise.
  delete from magic_links ml
  where ml.guest_id = p_guest_id
     or ml.booking_id in (select id from bookings where guest_id = p_guest_id)
     or ml.order_id in (select id from orders where guest_id = p_guest_id);

  -- Audit trail itself is the compliance record and is never deleted —
  -- only its PII columns are scrubbed. (event_data never holds
  -- name/email/phone anywhere in this codebase, only refs/ids/statuses.)
  update consumer_audit_logs cal
  set ip_address = null,
      user_agent = null
  where cal.actor_id = p_guest_id
     or cal.booking_id in (select id from bookings where guest_id = p_guest_id)
     or cal.order_id in (select id from orders where guest_id = p_guest_id);

  return jsonb_build_object('ok', true, 'original_email', v_original_email);
end;
$$;

comment on function public.anonymise_guest(uuid) is
  'GDPR erasure (C8.2): anonymises a guest atomically. Re-checks blocking conditions internally as a safety net; returns {ok:false, reason} before any write if blocked, {ok:true, original_email} on success.';
