export type PayMode = 'pay_now' | 'pay_at_table'

export type EnabledPayModes = {
  modes: PayMode[]
  needsChooser: boolean
  soleMode: PayMode | null
}

export function payModesForRestaurant(restaurant: {
  qr_pay_now_enabled: boolean | null
  qr_pay_at_table_enabled: boolean | null
}): EnabledPayModes {
  const modes: PayMode[] = []
  if (restaurant.qr_pay_now_enabled) modes.push('pay_now')
  if (restaurant.qr_pay_at_table_enabled) modes.push('pay_at_table')

  return {
    modes,
    needsChooser: modes.length === 2,
    soleMode: modes.length === 1 ? modes[0] : null,
  }
}
