'use server';

import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';

// Updates the locale preference in the profiles table AND the caller's own
// restaurant_staff.language (their dashboard language), like the Account page does.
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

    // Staff language (own active memberships only; the user id comes from the
    // verified session, never from the client). Service role because staff
    // rows aren't self-writable under RLS.
    try {
      const admin = await createSupabaseServerClientAdmin();
      await admin
        .from('restaurant_staff')
        .update({ language: locale })
        .eq('user_id', user.id)
        .is('deactivated_at', null);
    } catch (err) {
      console.error('[updateLocalePreference] staff language update failed', err);
    }
  }
}
