import { randomUUID } from 'node:crypto'
import { test, expect } from '../fixtures/base'
import { adminClient } from '../fixtures/test-restaurant'

// GDPR privacy requests are platform-scoped, not restaurant-scoped — they
// use the PLATFORM_RESTAURANT_ID sentinel (lib/consumer/audit.ts) rather
// than TEST_RESTAURANT_ID, and the guest doesn't need any booking/order
// history for this endpoint to work. wipeTestRestaurant() only cleans up
// rows tied to TEST_RESTAURANT_ID, so this suite handles its own cleanup.
const PLATFORM_RESTAURANT_ID = '00000000-0000-0000-0000-000000000000'

test.describe('GDPR data-export request', () => {
  test('issues a data_export magic link for a known guest email', async ({ page, testRunId }) => {
    const email = `e2e-gdpr-export-${testRunId}@e2e.thetafel.invalid`
    const supabase = adminClient()

    const { data: guest, error: guestErr } = await supabase
      .from('guests')
      .insert({
        id: randomUUID(),
        full_name: 'GDPR Export Test',
        email,
        phone: '+31600000001',
      })
      .select('id')
      .single()
    expect(guestErr).toBeNull()
    const guestId = guest!.id

    try {
      await page.goto('/privacybeleid/data-request')
      await page.getByRole('textbox', { name: 'E-mailadres' }).fill(email)
      await page.getByRole('checkbox', { name: /Ik bevestig dat ik mijn eigen/ }).click()
      await page.getByRole('button', { name: 'Gegevens opvragen' }).click()

      await expect(
        page.getByText('Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten'),
      ).toBeVisible()

      const { data: links } = await supabase
        .from('magic_links')
        .select('id, token_hash, purpose, guest_id, expires_at, consumed_at')
        .eq('guest_id', guestId)
        .eq('purpose', 'data_export')
      expect(links).toHaveLength(1)
      const link = links![0]

      expect(link.consumed_at).toBeNull()
      expect(new Date(link.expires_at).getTime()).toBeGreaterThan(Date.now())
      // SHA-256 hex digest — never the plaintext token (magicLinks.ts hashMagicLinkToken).
      expect(link.token_hash).toMatch(/^[0-9a-f]{64}$/)

      const { data: auditRows } = await supabase
        .from('consumer_audit_logs')
        .select('event_data')
        .eq('restaurant_id', PLATFORM_RESTAURANT_ID)
        .eq('event_type', 'privacy.data_export_requested')
        .order('created_at', { ascending: false })
        .limit(5)
      const matching = (auditRows ?? []).find(
        (r) => (r.event_data as { guestFound?: boolean })?.guestFound === true,
      )
      // No guest_id column on consumer_audit_logs for this event (auditLog()
      // call in the route doesn't pass actorId) — guestFound=true is as far
      // as this audit row can be tied back to our guest.
      expect(matching).toBeTruthy()
    } finally {
      await supabase.from('magic_links').delete().eq('guest_id', guestId)
      await supabase.rpc('anonymise_guest', { p_guest_id: guestId })
    }
  })
})
