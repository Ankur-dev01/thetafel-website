'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

// Updates the locale preference in the profiles table.
// Fire-and-forget — callers should not await this; navigation happens client-side.
export async function updateLocalePreference(locale: 'nl' | 'en') {
  if (locale !== 'nl' && locale !== 'en') return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from('profiles')
      .update({ locale })
      .eq('id', user.id);
  }
}
