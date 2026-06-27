// lib/booking/zones.ts
//
// Load a restaurant's bookable zones for the consumer booking flow.
// Returns zones ordered by display_order; deleted zones excluded.
// Names are passed through as-is (no localization — zone names are
// restaurant-owned strings).

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';

export interface ConsumerZone {
  id: string;
  name: string;
  displayOrder: number;
}

export async function loadBookableZones(restaurantId: string): Promise<ConsumerZone[]> {
  const supabase = await createSupabaseServerClientAdmin();

  const { data, error } = await supabase
    .from('zones')
    .select('id, name, display_order')
    .eq('restaurant_id', restaurantId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
    .returns<{ id: string; name: string; display_order: number }[]>();

  if (error || !data) {
    if (error) console.error('[booking/zones] load failed', { code: error.code });
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    displayOrder: row.display_order,
  }));
}
