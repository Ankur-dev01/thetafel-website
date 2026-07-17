'use client'

import { useSyncExternalStore } from 'react'
import Script from 'next/script'
import { getConsentSnapshot, getServerConsentSnapshot, subscribeConsent } from '@/lib/consent'

export default function PlausibleLoader() {
  const analyticsAllowed = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot
  )

  if (!analyticsAllowed) return null

  return (
    <Script
      defer
      data-domain="thetafel.nl"
      src="https://plausible.io/js/script.js"
      strategy="afterInteractive"
    />
  )
}
