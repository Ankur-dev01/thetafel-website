// lib/mollie/createConnectedPayment.ts
//
// Creates a one-off Mollie payment on behalf of a restaurant's connected
// (OAuth) Mollie account. Used for consumer-facing money flows where the
// restaurant is the merchant of record — no platform fee (PRD §9.1, and
// Onboarding PRD §9.6: prepaid booking deposit = 0% commission, full amount
// held in escrow by Mollie).
//
// Refreshes the restaurant's OAuth access token first if it's near expiry,
// and persists the refreshed token pair so the next call doesn't have to.

import 'server-only';
import { PaymentMethod } from '@mollie/api-client';
import { getMollieOAuthClient } from './client';
import { refreshAccessToken } from './oauth';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';

const TOKEN_REFRESH_MARGIN_MS = 60_000; // refresh if expiring within 60s

export type CreateConnectedPaymentInput = {
  restaurantId: string;
  amountCents: number;
  currency: string; // 'EUR'
  description: string;
  redirectUrl: string;
  webhookUrl: string;
  /** Restrict the hosted checkout to a single method, or omit to let Mollie show the picker. */
  method?: 'ideal' | 'creditcard';
  metadata: Record<string, unknown>;
};

export type CreateConnectedPaymentResult =
  | { ok: true; molliePaymentId: string; checkoutUrl: string }
  | {
      ok: false;
      reason: 'not_connected' | 'token_refresh_failed' | 'mollie_error';
      message?: string;
    };

function formatAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function createConnectedPayment(
  input: CreateConnectedPaymentInput,
): Promise<CreateConnectedPaymentResult> {
  const admin = await createSupabaseServerClientAdmin();

  const { data: restaurant, error: fetchErr } = await admin
    .from('restaurants')
    .select('mollie_access_token, mollie_refresh_token, mollie_token_expires_at, mollie_organization_id')
    .eq('id', input.restaurantId)
    .maybeSingle();

  if (fetchErr || !restaurant?.mollie_access_token || !restaurant?.mollie_organization_id) {
    return { ok: false, reason: 'not_connected' };
  }

  let accessToken = restaurant.mollie_access_token as string;
  const expiresAt = restaurant.mollie_token_expires_at
    ? new Date(restaurant.mollie_token_expires_at as string).getTime()
    : 0;

  if (expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS) {
    if (!restaurant.mollie_refresh_token) {
      return { ok: false, reason: 'token_refresh_failed', message: 'no_refresh_token' };
    }
    try {
      const tokens = await refreshAccessToken(restaurant.mollie_refresh_token as string);
      accessToken = tokens.access_token;
      const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
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
        '[createConnectedPayment] token refresh failed',
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
    const payment = await client.payments.create({
      amount: { value: formatAmount(input.amountCents), currency: input.currency },
      description: input.description,
      redirectUrl: input.redirectUrl,
      webhookUrl: input.webhookUrl,
      metadata: input.metadata as Record<string, unknown>,
      ...(input.method
        ? { method: input.method === 'ideal' ? PaymentMethod.ideal : PaymentMethod.creditcard }
        : {}),
    });

    const checkoutUrl = payment.getCheckoutUrl();
    if (!checkoutUrl) {
      return { ok: false, reason: 'mollie_error', message: 'no_checkout_url' };
    }

    return { ok: true, molliePaymentId: payment.id, checkoutUrl };
  } catch (err) {
    console.error(
      '[createConnectedPayment] mollie payment create failed',
      err instanceof Error ? err.message : err,
    );
    return {
      ok: false,
      reason: 'mollie_error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
