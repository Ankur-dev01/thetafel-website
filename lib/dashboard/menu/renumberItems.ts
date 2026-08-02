import 'server-only'

import type { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

type AdminClient = Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>

/**
 * Rewrite one category's items to dense 0-based display_order, preserving
 * their current relative order. Used after a delete or a re-parent leaves a
 * gap. Only rows whose position actually changed are written.
 *
 * Never throws: the caller has already completed the mutation that matters,
 * and a leftover gap is cosmetic — the next reorder normalises it. Failures
 * are logged loudly instead of turning a successful edit into a 500.
 */
export async function renumberCategoryItems(
  admin: AdminClient,
  restaurantId: string,
  categoryId: string,
): Promise<void> {
  const { data: rows, error } = await admin
    .from('menu_items')
    .select('id, display_order')
    .eq('restaurant_id', restaurantId)
    .eq('category_id', categoryId)
    .order('display_order', { ascending: true })
  if (error) {
    console.error('[renumberCategoryItems] lookup failed', { categoryId, error })
    return
  }

  const misplaced = (rows ?? [])
    .map((row, index) => ({ id: row.id as string, index, current: row.display_order as number | null }))
    .filter((row) => row.current !== row.index)

  for (const row of misplaced) {
    const { error: updateError } = await admin
      .from('menu_items')
      .update({ display_order: row.index })
      .eq('id', row.id)
      .eq('restaurant_id', restaurantId)
    if (updateError) {
      console.error('[renumberCategoryItems] update failed', { id: row.id, error: updateError })
    }
  }
}
