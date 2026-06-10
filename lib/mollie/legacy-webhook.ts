import { getMolliePlatformClient } from '@/lib/mollie/client'

/**
 * Parses a Mollie legacy webhook body (application/x-www-form-urlencoded).
 * Mollie sends `id=tr_xxx`. Returns the raw ID or null if malformed.
 */
export function parseLegacyWebhookBody(rawBody: string): string | null {
  try {
    const params = new URLSearchParams(rawBody)
    const id = params.get('id')
    return id && id.length > 0 ? id : null
  } catch {
    return null
  }
}

export type MollieResourceKind = 'payment' | 'subscription' | 'mandate' | 'refund' | 'chargeback' | 'unknown'

export function classifyMollieId(id: string): MollieResourceKind {
  if (id.startsWith('tr_')) return 'payment'
  if (id.startsWith('sub_')) return 'subscription'
  if (id.startsWith('mdt_')) return 'mandate'
  if (id.startsWith('re_')) return 'refund'
  if (id.startsWith('chb_')) return 'chargeback'
  return 'unknown'
}

/**
 * Fetches a Mollie payment by ID using the platform API key. Returns null
 * on 404 (resource doesn't belong to our platform). Throws on other errors
 * so the caller can return 5xx and let Mollie retry.
 */
export async function fetchPaymentFromMollie(mollieId: string) {
  const client = getMolliePlatformClient()
  try {
    return await client.payments.get(mollieId)
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'statusCode' in err &&
      (err as { statusCode: number }).statusCode === 404
    ) {
      return null
    }
    throw err
  }
}
