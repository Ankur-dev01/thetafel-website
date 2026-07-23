'use client';

import { Link } from '@/i18n/routing';
import type { StatusTone } from './StatusChip';

/**
 * AlertStrip — amber-tinted card listing alerts in priority order.
 * Renders nothing when there are no alerts (no "all clear" filler — PRD §4.1).
 * Per-day per-device dismissal is the caller's concern (D1.2); this component
 * only invokes onDismiss.
 */

export type DashboardAlert = {
  id: string;
  tone: StatusTone;
  label: string;
  actionHref?: string;
  actionLabel?: string;
  onDismiss?: () => void;
};

const DOT: Record<StatusTone, string> = {
  success: '#4a7c46',
  warning: '#d4820a',
  danger: '#b3422f',
  neutral: '#8c8577',
};

type AlertStripProps = {
  alerts: DashboardAlert[];
};

export default function AlertStrip({ alerts }: AlertStripProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="bg-[#fcf0d8] rounded-card p-3 md:p-4" role="status">
      <ul className="flex flex-col gap-2">
        {alerts.map((alert) => (
          <li key={alert.id} className="flex items-center gap-3">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: DOT[alert.tone] }}
              aria-hidden="true"
            />
            <span
              className="flex-1 text-[13px] text-[#1e1508] leading-snug"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
            >
              {alert.label}
            </span>
            {alert.actionHref && alert.actionLabel && (
              <Link
                href={alert.actionHref}
                className="tafel-tap text-[12px] text-[#a86205] underline underline-offset-2 whitespace-nowrap"
                style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
              >
                {alert.actionLabel}
              </Link>
            )}
            {alert.onDismiss && (
              <button
                type="button"
                onClick={alert.onDismiss}
                className="tafel-tap p-1 -m-1 text-[#8c8577] hover:text-[#1e1508] transition-colors"
                aria-label="Sluiten"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
