import { randomUUID, randomBytes, createHash } from 'node:crypto'
import { adminClient, TEST_RESTAURANT_TABLE_ID } from './test-restaurant'

export type SeedOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type SeedOrderSpec = {
  orderType: 'qr' | 'takeaway'
  status: SeedOrderStatus
  totalCents: number
  paymentStatus?: string // default 'paid'
  tableId?: string // QR only, defaults to the fixture table
  guestName?: string // takeaway only
  guestPhone?: string
  /**
   * takeaway only. Omit for the default `e2e-{uuid}@thetafel.test` address
   * (D3.2's ready-email test needs a real deliverable-shaped address).
   * Pass `null` explicitly to seed a guest with NO email — the D3.2
   * "email skipped, no guest address" case (`guests.email` is nullable
   * since the D2.4 migration).
   */
  guestEmail?: string | null
  minutesAgoCreated?: number
  pickupMinutesFromNow?: number // takeaway only, default 20
  itemCount?: number // default 3 — inserted with menu_item_id=null (nullable FK), plain name_snapshot text
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function randomOrderRef(prefix: 'QR' | 'PU'): string {
  return `${prefix}-${randomBytes(4).toString('hex').toUpperCase()}`
}

/**
 * Seeds N orders (+ optional takeaway guests + order_items) for
 * tests/e2e/dashboard/orders-list.spec.ts. Admin client — bypasses RLS, same
 * as every other seed fixture. `order_items.menu_item_id` is nullable in the
 * live schema, so items are seeded with a plain `name_snapshot` and no real
 * `menu_items` row — no synthetic-menu-item setup/teardown needed.
 */
export async function seedOrders(opts: {
  restaurantId: string
  orders: SeedOrderSpec[]
}): Promise<{ orderIds: string[]; guestIds: string[]; orderItemIds: string[] }> {
  const supabase = adminClient()
  const orderIds: string[] = []
  const guestIds: string[] = []
  const orderItemIds: string[] = []

  for (const spec of opts.orders) {
    let guestId: string | null = null
    if (spec.orderType === 'takeaway') {
      const uuid = randomUUID()
      const email = spec.guestEmail === undefined ? `e2e-${uuid}@thetafel.test` : spec.guestEmail
      const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({
          full_name: spec.guestName ?? 'E2E Order Guest',
          email,
          phone: spec.guestPhone ?? '+31600000007',
          marketing_consent: false,
        })
        .select('id')
        .single()
      if (guestError || !guest) throw new Error(`[seedOrders] guest failed: ${guestError?.message}`)
      guestId = guest.id as string
      guestIds.push(guestId)
    }

    const createdAt = new Date(Date.now() - (spec.minutesAgoCreated ?? 0) * 60_000).toISOString()
    const pickupTime =
      spec.orderType === 'takeaway'
        ? new Date(Date.now() + (spec.pickupMinutesFromNow ?? 20) * 60_000).toISOString()
        : null
    const token = randomBytes(32).toString('base64url')

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        restaurant_id: opts.restaurantId,
        order_ref: randomOrderRef(spec.orderType === 'qr' ? 'QR' : 'PU'),
        order_type: spec.orderType,
        status: spec.status,
        payment_status: spec.paymentStatus ?? 'paid',
        subtotal_cents: spec.totalCents,
        vat_cents: 0,
        total_cents: spec.totalCents,
        guest_id: guestId,
        table_id: spec.orderType === 'qr' ? spec.tableId ?? TEST_RESTAURANT_TABLE_ID : null,
        pickup_time: pickupTime,
        created_at: createdAt,
        updated_at: createdAt,
        magic_link_token_hash: hashToken(token),
      })
      .select('id')
      .single()
    if (orderError || !order) throw new Error(`[seedOrders] order failed: ${orderError?.message}`)
    orderIds.push(order.id)

    const itemCount = spec.itemCount ?? 3
    const itemRows = Array.from({ length: itemCount }, (_, i) => ({
      order_id: order.id,
      menu_item_id: null,
      name_snapshot: `E2E Item ${i + 1}`,
      unit_price_cents: Math.round(spec.totalCents / itemCount),
      quantity: 1,
      line_total_cents: Math.round(spec.totalCents / itemCount),
    }))
    const { data: items, error: itemsError } = await supabase.from('order_items').insert(itemRows).select('id')
    if (itemsError) throw new Error(`[seedOrders] order_items failed: ${itemsError.message}`)
    orderItemIds.push(...(items ?? []).map((i) => i.id as string))
  }

  return { orderIds, guestIds, orderItemIds }
}

/** Single-order helper for "a new order arrives mid-poll" test steps. */
export async function seedNewOrder(restaurantId: string): Promise<{ orderId: string }> {
  const result = await seedOrders({
    restaurantId,
    orders: [{ orderType: 'qr', status: 'pending', totalCents: 1200, itemCount: 1 }],
  })
  return { orderId: result.orderIds[0] }
}

/** Deletes guest rows created by `seedOrders` (orders/order_items are swept by `wipeTestRestaurant`). */
export async function cleanupSeededOrderGuests(guestIds: string[]): Promise<void> {
  if (guestIds.length === 0) return
  const supabase = adminClient()
  await supabase.from('guests').delete().in('id', guestIds)
}
