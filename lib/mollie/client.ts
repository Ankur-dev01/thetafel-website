import createMollieClient, {
  type MollieClient,
} from '@mollie/api-client'

/**
 * Server-only Mollie client factories.
 *
 * Two flavours:
 *
 *  1. Platform client — authenticated with the platform API key.
 *     Used for operations The Tafel performs as itself (creating
 *     webhooks, listing platform-level settlements, etc.).
 *
 *  2. OAuth client — authenticated with an access token issued for
 *     a specific connected restaurant. Used for any operation the
 *     platform performs on behalf of one restaurant (creating a
 *     payment with an application fee, reading their onboarding
 *     status, managing their mandates).
 *
 * Both factories throw if the required environment variables are
 * missing, surfacing config errors at boot rather than as opaque
 * Mollie 401s at runtime.
 *
 * NEVER import this module from a Client Component or any file that
 * could be bundled to the browser. The SDK contains node-only code
 * paths and the API key is a secret. To enforce this, every consumer
 * lives under `app/api/`, server actions, or other server-only paths.
 */

let cachedPlatformClient: MollieClient | null = null

/**
 * Returns a Mollie client authenticated with the platform API key.
 * The instance is cached for the lifetime of the server process —
 * the SDK is stateless beyond auth, so reuse is safe.
 */
export function getMolliePlatformClient(): MollieClient {
  if (cachedPlatformClient) return cachedPlatformClient

  const apiKey = process.env.MOLLIE_API_KEY
  if (!apiKey) {
    throw new Error('MOLLIE_API_KEY is not set')
  }

  cachedPlatformClient = createMollieClient({ apiKey })
  return cachedPlatformClient
}

/**
 * Returns a Mollie client authenticated as a connected restaurant
 * via an OAuth access token. Not cached — every call site passes
 * its own token, and tokens rotate.
 *
 * The token is whatever the most recent token refresh produced and
 * stored on the restaurant row. The caller is responsible for
 * refreshing expired tokens before invoking this factory.
 */
export function getMollieOAuthClient(accessToken: string): MollieClient {
  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('getMollieOAuthClient called without an access token')
  }
  return createMollieClient({ accessToken })
}

/**
 * Convenience accessor for OAuth app credentials. Used by the OAuth
 * authorize-URL builder and the code/refresh-token exchange handlers
 * in subsequent units. Centralised here so we only validate env-var
 * presence in one place.
 */
export function getMollieOAuthConfig(): {
  clientId: string
  clientSecret: string
  redirectUri: string
} {
  const clientId = process.env.MOLLIE_CLIENT_ID
  const clientSecret = process.env.MOLLIE_CLIENT_SECRET
  const redirectUri = process.env.MOLLIE_REDIRECT_URI

  if (!clientId) {
    throw new Error('MOLLIE_CLIENT_ID is not set')
  }
  if (!clientSecret) {
    throw new Error('MOLLIE_CLIENT_SECRET is not set')
  }
  if (!redirectUri) {
    throw new Error('MOLLIE_REDIRECT_URI is not set')
  }

  return { clientId, clientSecret, redirectUri }
}
