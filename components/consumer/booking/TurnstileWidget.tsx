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
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Keep the latest callbacks available to the effects below without making
  // them effect dependencies (see the widget-creation effect for why).
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  });

  // Dev / non-production: instant bypass on mount.
  useEffect(() => {
    if (IS_PROD && siteKey) return;
    if (calledDevBypassRef.current) return;
    calledDevBypassRef.current = true;
    onSuccess('dev-bypass-token');
  }, [siteKey, onSuccess]);

  // Production: real widget render.
  //
  // onSuccess/onError are read through refs (onSuccessRef/onErrorRef) rather
  // than closed over directly, and are deliberately excluded from this
  // effect's dependency array. Callers (e.g. OrderSubmit) pass inline
  // closures that get a new identity on every render — including the very
  // render triggered by onSuccess firing. If those props were in the deps
  // array, every solve would tear down the widget (remove() the widget that
  // had just resolved) and immediately render() a brand-new challenge,
  // producing a "verify-and-reset" loop (this was the root cause of the
  // Cloudflare error 600010 / postMessage origin-mismatch loop on the QR pay
  // flow). Routing calls through refs keeps this effect's lifecycle tied
  // only to siteKey, so a real widget instance survives for as long as the
  // component stays mounted.
  useEffect(() => {
    if (!IS_PROD) return;
    if (!siteKey) return;
    if (!containerRef.current) return;
    const tryRender = () => {
      if (!window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current!, {
        sitekey: siteKey,
        callback: (token) => onSuccessRef.current(token),
        'error-callback': () => onErrorRef.current?.(),
        'expired-callback': () => onErrorRef.current?.(),
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
  }, [siteKey]);

  if (!IS_PROD || !siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div ref={containerRef} />
    </>
  );
}
