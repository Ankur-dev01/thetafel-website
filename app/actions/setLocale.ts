'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function setLocale(formData: FormData) {
  const target = formData.get('locale');
  const currentPath = (formData.get('path') as string | null) ?? '/onboarding';

  if (target !== 'nl' && target !== 'en') {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase
      .from('profiles')
      .update({ locale: target })
      .eq('id', user.id);
  }

  let stripped = currentPath;
  if (stripped.startsWith('/en/')) {
    stripped = stripped.slice(3);
  } else if (stripped === '/en') {
    stripped = '/';
  }
  if (!stripped.startsWith('/')) stripped = '/' + stripped;

  const next = target === 'en' ? `/en${stripped === '/' ? '' : stripped}` : stripped;

  redirect(next);
}
