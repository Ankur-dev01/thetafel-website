import { revalidatePath } from 'next/cache'

/**
 * Invalidates the Next.js fetch cache for all onboarding pages and their
 * shared layout. Call this from any API route that mutates restaurant
 * state that the sidebar or any step page reads (service flags, status,
 * step counter, Mollie connection, etc.).
 */
export function invalidateOnboardingLayout(): void {
  revalidatePath('/onboarding', 'layout')
  revalidatePath('/en/onboarding', 'layout')
}
