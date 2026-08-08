import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { QrSettingsPayload } from '@/lib/dashboard/settings/qrSettingsValidation'

/**
 * QR-ordering-settings (D5.5) query helpers. Session client — RLS's
 * owner-all policy on `restaurants` covers this; the `restaurant_id` filter
 * is belt-and-braces on top of that.
 *
 * Reads `qr_item_notes_enabled` only — never the sibling
 * `qr_item_notes_allowed` column, which this unit's migration drops.
 *
 * `service_qr_enabled` is read-only here: it decides whether the page
 * renders the editor or an informational "not enabled" card, but it's
 * never written by this unit.
 */

export type QrSettingsInitialData = {
  config: QrSettingsPayload
  serviceQrEnabled: boolean
}

type RawRow = {
  qr_auto_accept: boolean
  qr_item_notes_enabled: boolean
  qr_menu_language: string
  qr_widget_accent_color: string
  qr_pay_now_enabled: boolean
  qr_pay_at_table_enabled: boolean
  service_qr_enabled: boolean
}

function toMenuLanguage(value: string): QrSettingsPayload['qr_menu_language'] {
  return value === 'nl' || value === 'en' ? value : 'nl_en'
}

export async function getQrSettingsInitialData(restaurantId: string): Promise<QrSettingsInitialData> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('restaurants')
    .select(
      'qr_auto_accept, qr_item_notes_enabled, qr_menu_language, qr_widget_accent_color, qr_pay_now_enabled, qr_pay_at_table_enabled, service_qr_enabled',
    )
    .eq('id', restaurantId)
    .single<RawRow>()
  if (error) throw error

  return {
    config: {
      qr_auto_accept: data.qr_auto_accept,
      qr_item_notes_enabled: data.qr_item_notes_enabled,
      qr_menu_language: toMenuLanguage(data.qr_menu_language),
      qr_widget_accent_color: data.qr_widget_accent_color,
      qr_pay_now_enabled: data.qr_pay_now_enabled,
      qr_pay_at_table_enabled: data.qr_pay_at_table_enabled,
    },
    serviceQrEnabled: data.service_qr_enabled,
  }
}
