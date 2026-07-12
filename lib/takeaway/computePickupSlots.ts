// lib/takeaway/computePickupSlots.ts
//
// Given the day's opening window, prep time, slot interval, kitchen close
// offset, current backlog of confirmed takeaway orders per slot, and now,
// produce the list of candidate pickup slots.
//
// Pure: no I/O, no clock reads. All time inputs are ISO UTC strings for
// determinism. Amsterdam-local rendering is the caller's job.
//
// Callers:
//   - API route /api/v1/public/{slug}/pickup-slots for scheduled mode.
//   - The ASAP branch uses only earliestPickupInstant, ignoring the grid.

export type ComputePickupSlotsInput = {
  windowOpenInstant: string // ISO UTC — takeaway service opens
  windowCloseInstant: string // ISO UTC — takeaway service closes
  nowInstant: string // ISO UTC — current time
  prepTimeMinutes: number // takeaway_prep_time_minutes
  slotIntervalMinutes: number // takeaway_slot_interval_minutes
  kitchenClosesOffsetMinutes: number // last accepted pickup this many min before close
  maxOrdersPerSlot: number // Infinity if no cap configured
  backlogByInstant: Record<string, number> // ISO UTC → confirmed-order count in that slot
}

export type PickupSlot = {
  instant: string // ISO UTC — the pickup time
  isSoonestAvailable: boolean
  full: boolean // backlog >= maxOrdersPerSlot
  backlogCount: number
}

export type ComputePickupSlotsResult = {
  slots: PickupSlot[]
  earliestPickupInstant: string | null // null if no valid slots
  latestPickupInstant: string | null
}

export function computePickupSlots(input: ComputePickupSlotsInput): ComputePickupSlotsResult {
  const now = new Date(input.nowInstant).getTime()
  const open = new Date(input.windowOpenInstant).getTime()
  const close = new Date(input.windowCloseInstant).getTime()

  const prepMs = input.prepTimeMinutes * 60_000
  const intervalMs = input.slotIntervalMinutes * 60_000
  const closeOffsetMs = input.kitchenClosesOffsetMinutes * 60_000

  // Earliest possible pickup: max(now + prep, service open), rounded up to
  // the next interval boundary from the service open time.
  const earliestFloor = Math.max(now + prepMs, open)
  const intervalsFromOpen = Math.ceil((earliestFloor - open) / intervalMs)
  const firstSlot = open + intervalsFromOpen * intervalMs

  // Last accepted pickup: close - kitchen close offset.
  const lastAccepted = close - closeOffsetMs

  if (firstSlot > lastAccepted) {
    return { slots: [], earliestPickupInstant: null, latestPickupInstant: null }
  }

  const slots: PickupSlot[] = []
  let soonestSet = false

  for (let t = firstSlot; t <= lastAccepted; t += intervalMs) {
    const iso = new Date(t).toISOString()
    const backlogCount = input.backlogByInstant[iso] ?? 0
    const full = backlogCount >= input.maxOrdersPerSlot
    const isSoonestAvailable = !soonestSet && !full
    if (isSoonestAvailable) soonestSet = true
    slots.push({ instant: iso, isSoonestAvailable, full, backlogCount })
  }

  const earliestAvailable = slots.find((s) => !s.full)?.instant ?? null
  const latestAvailable = [...slots].reverse().find((s) => !s.full)?.instant ?? null

  return {
    slots,
    earliestPickupInstant: earliestAvailable,
    latestPickupInstant: latestAvailable,
  }
}
