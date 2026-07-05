// lib/mollie/refundConnectedPayment.ts
//
// Server-side refund via a restaurant's connected Mollie account.
// Mirrors createConnectedPayment's OAuth token refresh + SDK-call pattern.
//
// Never called from the client. Always audited from the calling route.

import 'server-only';
import { getMollieOAuthClient } from './client';
import { refreshAccessToken } from './oauth';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';

const TOKEN_REFRESH_MARGIN_MS = 60_000;

export type RefundConnectedInput = {
  restaurantId: string;
  molliePaymentId: string;
  amountCents: number;
  currency: string;
  description: string;
};

export type RefundConnectedResult =
  | { ok: true; refundId: string }
  | {
      ok: false;
      reason: 'not_connected' | 'token_refresh_failed' | 'mollie_error';
      message?: string;
    };

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function refundConnectedPayment(
  input: RefundConnectedInput,
): Promise<RefundConnectedResult> {
  const admin = await createSupabaseServerClientAdmin();

  const { data: restaurant, error: fetchErr } = await admin
    .from('restaurants')
    .select(
      'mollie_access_token, mollie_refresh_token, mollie_token_expires_at, mollie_organization_id',
    )
    .eq('id', input.restaurantId)
    .maybeSingle();

  if (
    fetchErr ||
    !restaurant?.mollie_access_token ||
    !restaurant?.mollie_organization_id
  ) {
    return { ok: false, reason: 'not_connected' };
  }

  let accessToken = restaurant.mollie_access_token as string;
  const expiresAt = restaurant.mollie_token_expires_at
    ? new Date(restaurant.mollie_token_expires_at as string).getTime()
    : 0;

  if (expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS) {
    if (!restaurant.mollie_refresh_token) {
      return {
        ok: false,
        reason: 'token_refresh_failed',
        message: 'no_refresh_token',
      };
    }
    try {
      const tokens = await refreshAccessToken(
        restaurant.mollie_refresh_token as string,
      );
      accessToken = tokens.access_token;
      const newExpiresAt = new Date(
        Date.now() + tokens.expires_in * 1000,
      ).toISOString();
      await admin
        .from('restaurants')
        .update({
          mollie_access_token: tokens.access_token,
          mollie_refresh_token: tokens.refresh_token,
          mollie_token_expires_at: newExpiresAt,
        })
        .eq('id', input.restaurantId);
    } catch (err) {
      console.error(
        '[refundConnectedPayment] token refresh failed',
        err instanceof Error ? err.message : err,
      );
      return {
        ok: false,
        reason: 'token_refresh_failed',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const client = getMollieOAuthClient(accessToken);

  try {
    const refund = await client.paymentRefunds.create({
      paymentId: input.molliePaymentId,
      amount: {
        value: formatAmount(input.amountCents),
        currency: input.currency,
      },
      description: input.description,
    });

    if (!refund?.id) {
      return { ok: false, reason: 'mollie_error', message: 'no_refund_id' };
    }
    return { ok: true, refundId: refund.id };
  } catch (err) {
    console.error(
      '[refundConnectedPayment] mollie refund create failed',
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false,
      reason: 'mollie_error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
