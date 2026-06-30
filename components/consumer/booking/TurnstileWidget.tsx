'use client';

// Cloudflare Turnstile widget with explicit-render.
//
// Dev behavior: in any non-production environment, immediately call
// onSuccess('dev-bypass-token') on mount. The widget itself does not render.
// The server's verifyTurnstileToken accepts this token when TURNSTILE_SECRET_KEY
// is unset, so both layers bypass cleanly in dev.
//
// Prod behavior: render the Cloudflare widget and call onSuccess(token)
// when the challenge resolves.

import { useEffect, useRef } from 'react';
import Script from 'next/script';

interface Props {
  onSuccess: (token: string) => void;
  onError?: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId?: string) => void;
    };
  }
}

const IS_PROD = process.env.NODE_ENV === 'production';

export function TurnstileWidget({ onSuccess, onError }: Props) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const calledDevBypassRef = useRef(false);

  // Dev / non-production: instant bypass on mount.
  useEffect(() => {
    if (IS_PROD && siteKey) return;
    if (calledDevBypassRef.current) return;
    calledDevBypassRef.current = true;
    onSuccess('dev-bypass-token');
  }, [siteKey, onSuccess]);

  // Production: real widget render.
  useEffect(() => {
    if (!IS_PROD) return;
    if (!siteKey) return;
    if (!containerRef.current) return;
    const tryRender = () => {
      if (!window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current!, {
        sitekey: siteKey,
        callback: (token) => onSuccess(token),
        'error-callback': () => onError?.(),
        'expired-callback': () => onError?.(),
        theme: 'light',
      });
    };
    tryRender();
    const interval = window.setInterval(tryRender, 500);
    const tid = window.setTimeout(() => window.clearInterval(interval), 10_000);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(tid);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onSuccess, onError]);

  if (!IS_PROD || !siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div ref={containerRef} />
    </>
  );
}
