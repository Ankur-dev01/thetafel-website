import { randomUUID, randomBytes, createHash } from 'node:crypto'
import {
  adminClient,
  TEST_RESTAURANT_ID,
  TEST_RESTAURANT_TABLE_ID,
  TEST_RESTAURANT_ZONE_ID,
  TEST_RESTAURANT_OWNER_ID,
} from './test-restaurant'

/**
 * `tabs_table_open_unique` allows only one open tab per table at a time —
 * tests that need two *concurrently open* tabs (e.g. the stale filter) can't
 * both use the single fixture table (T1). This provisions a throwaway second
 * table for the duration of one test; callers must delete it in `finally`.
 */
export async function createSecondaryTestTable(): Promise<{ tableId: string }> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('restaurant_tables')
    .insert({
      restaurant_id: TEST_RESTAURANT_ID,
      zone_id: TEST_RESTAURANT_ZONE_ID,
      label: 'E2E-T2',
      seats: 4,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`[createSecondaryTestTable] failed: ${error?.message}`)
  return { tableId: data.id as string }
}

export async function deleteSecondaryTestTable(tableId: string): Promise<void> {
  const supabase = adminClient()
  await supabase.from('restaurant_tables').delete().eq('id', tableId)
}

export type SeedTabOrderSpec = {
  orderType: 'qr' | 'takeaway'
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled' | 'refunded'
  paymentStatus?: string // default 'open_tab'
  totalCents: number
  guestName?: string
  itemCount?: number // default 1
}

export type SeedTabOpts = {
  restaurantId: string
  tableId?: string // defaults to fixture table
  status?: 'open' | 'settled' | 'cancelled' // default 'open'
  settlement?: 'paid_at_table' | 'written_off' | null
  useOwnerAsCloser?: boolean // resolves TEST_RESTAURANT_OWNER_ID's restaurant_staff.id for closed_by
  writeOffReason?: string
  openedMinutesAgo?: number // default 30
  closedMinutesAgo?: number
  orders?: SeedTabOrderSpec[]
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function randomOrderRef(prefix: 'QR' | 'PU'): string {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`
}

/**
 * Seeds one tab (+ optional orders/order_items/guests) for
 * tests/e2e/dashboard/tabs.spec.ts. Admin client — bypasses RLS, same as
 * every other seed fixture. Tab `total_cents` is the sum of the seeded
 * orders' totals unless the caller only wants a bare tab (no orders → 0).
 */
export async function seedTab(
  opts: SeedTabOpts,
): Promise<{ tabId: string; orderIds: string[]; guestIds: string[] }> {
  const supabase = adminClient()
  const orderIds: string[] = []
  const guestIds: string[] = []

  const orders = opts.orders ?? []
  const totalCents = orders.reduce((sum, o) => sum + o.totalCents, 0)
  const openedAt = new Date(Date.now() - (opts.openedMinutesAgo ?? 30) * 60_000).toISOString()

  let closedBy: string | null = null
  if (opts.useOwnerAsCloser) {
    const { data: staffRow, error: staffError } = await supabase
      .from('restaurant_staff')
      .select('id')
      .eq('restaurant_id', opts.restaurantId)
      .eq('user_id', TEST_RESTAURANT_OWNER_ID)
      .maybeSingle()
    if (staffError || !staffRow) throw new Error(`[seedTab] owner staff lookup failed: ${staffError?.message}`)
    closedBy = staffRow.id as string
  }

  const tabInsert: Record<string, unknown> = {
    restaurant_id: opts.restaurantId,
    table_id: opts.tableId ?? TEST_RESTAURANT_TABLE_ID,
    status: opts.status ?? 'open',
    opened_at: openedAt,
    total_cents: totalCents,
  }
  if (opts.status && opts.status !== 'open') {
    tabInsert.closed_at = new Date(Date.now() - (opts.closedMinutesAgo ?? 0) * 60_000).toISOString()
    tabInsert.settlement = opts.settlement ?? null
    tabInsert.closed_by = closedBy
    tabInsert.write_off_reason = opts.writeOffReason ?? null
    if (opts.status === 'settled') {
      tabInsert.settled_at = tabInsert.closed_at
    }
  }

  const { data: tab, error: tabError } = await supabase.from('tabs').insert(tabInsert).select('id').single()
  if (tabError || !tab) throw new Error(`[seedTab] tab insert failed: ${tabError?.message}`)
  const tabId = tab.id as string

  for (const spec of orders) {
    let guestId: string | null = null
    if (spec.orderType === 'takeaway') {
      const uuid = randomUUID()
      const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({
          full_name: spec.guestName ?? 'E2E Tab Guest',
          email: `e2e-${uuid}@thetafel.test`,
          phone: '+31600000008',
          marketing_consent: false,
        })
        .select('id')
        .single()
      if (guestError || !guest) throw new Error(`[seedTab] guest insert failed: ${guestError?.message}`)
      guestId = guest.id as string
      guestIds.push(guestId)
    } else if (spec.guestName) {
      // QR orders on a tab still get a guest row in real usage (the QR
      // session identifies a guest) — seeded here only when the test cares
      // about guest_count, distinguishing per-order guests on the same tab.
      const uuid = randomUUID()
      const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({
          full_name: spec.guestName,
          email: `e2e-${uuid}@thetafel.test`,
          phone: '+31600000009',
          marketing_consent: false,
        })
        .select('id')
        .single()
      if (guestError || !guest) throw new Error(`[seedTab] guest insert failed: ${guestError?.message}`)
      guestId = guest.id as string
      guestIds.push(guestId)
    }

    const token = randomBytes(32).toString('base64url')
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        restaurant_id: opts.restaurantId,
        order_ref: randomOrderRef(spec.orderType === 'qr' ? 'QR' : 'PU'),
        order_type: spec.orderType,
        status: spec.status,
        payment_status: spec.paymentStatus ?? 'open_tab',
        subtotal_cents: spec.totalCents,
        vat_cents: 0,
        total_cents: spec.totalCents,
        guest_id: guestId,
        table_id: spec.orderType === 'qr' ? opts.tableId ?? TEST_RESTAURANT_TABLE_ID : null,
        pickup_time: spec.orderType === 'takeaway' ? new Date(Date.now() + 20 * 60_000).toISOString() : null,
        tab_id: tabId,
        created_at: openedAt,
        updated_at: openedAt,
        magic_link_token_hash: hashToken(token),
      })
      .select('id')
      .single()
    if (orderError || !order) throw new Error(`[seedTab] order insert failed: ${orderError?.message}`)
    orderIds.push(order.id as string)

    const itemCount = spec.itemCount ?? 1
    const itemRows = Array.from({ length: itemCount }, (_, i) => ({
      order_id: order.id,
      menu_item_id: null,
      name_snapshot: `E2E Tab Item ${i + 1}`,
      unit_price_cents: Math.round(spec.totalCents / itemCount),
      quantity: 1,
      line_total_cents: Math.round(spec.totalCents / itemCount),
    }))
    const { error: itemsError } = await supabase.from('order_items').insert(itemRows)
    if (itemsError) throw new Error(`[seedTab] order_items insert failed: ${itemsError.message}`)
  }

  return { tabId, orderIds, guestIds }
}

/** Deletes guest rows created by `seedTab` (tabs/orders/order_items are swept by `wipeTestRestaurant`). */
export async function cleanupSeededTabGuests(guestIds: string[]): Promise<void> {
  if (guestIds.length === 0) return
  const supabase = adminClient()
  await supabase.from('guests').delete().in('id', guestIds)
}
