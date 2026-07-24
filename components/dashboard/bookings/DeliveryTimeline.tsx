'use client';

import { useTranslations } from 'next-intl';
import StatusChip, { type StatusTone } from '@/components/dashboard/ui/StatusChip';
import { Coins, GuestBook, Bell } from '@/components/dashboard/icons';
import { formatDateTimeShort } from '@/lib/dashboard/date/amsterdamDay';
import type { DeliveryInfo } from '@/lib/dashboard/bookings/types';

const currencyFormatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

const DEPOSIT_TONE: Record<'pending' | 'paid' | 'failed' | 'refunded', StatusTone> = {
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
};

type DeliveryTimelineProps = {
  delivery: DeliveryInfo;
  locale: 'nl' | 'en';
};

function Row({
  icon,
  label,
  chip,
  meta,
  subMeta,
}: {
  icon: React.ReactNode;
  label: string;
  chip: React.ReactNode;
  meta?: string;
  subMeta?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="text-[#8c8577] flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div
          className="text-[13px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
        >
          {label}
        </div>
        {subMeta && (
          <div
            className="text-[12px] text-[#8c8577] mt-0.5"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            {subMeta}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {chip}
        {meta && (
          <span
            className="text-[11px] text-[#8c8577]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            {meta}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DeliveryTimeline({ delivery, locale }: DeliveryTimelineProps) {
  const t = useTranslations('dashboard.bookings.detail');

  const rows: React.ReactNode[] = [];

  if (delivery.depositIntent.state !== 'not_required') {
    const state = delivery.depositIntent.state as 'pending' | 'paid' | 'failed' | 'refunded';
    rows.push(
      <Row
        key="deposit"
        icon={<Coins width={18} height={18} />}
        label={t('delivery.deposit.label')}
        chip={<StatusChip tone={DEPOSIT_TONE[state]} label={t(`delivery.state.${state}`)} />}
        meta={
          delivery.depositIntent.amountCents !== null
            ? currencyFormatter.format(delivery.depositIntent.amountCents / 100)
            : undefined
        }
      />
    );
  }

  if (delivery.confirmationEmail.state !== 'not_sent') {
    const state = delivery.confirmationEmail.state;
    rows.push(
      <Row
        key="email"
        icon={<GuestBook width={18} height={18} />}
        label={t('delivery.email.label')}
        chip={
          <StatusChip
            tone={state === 'sent' ? 'success' : 'danger'}
            label={t(`delivery.state.${state === 'sent' ? 'sent' : 'failed'}`)}
          />
        }
        meta={delivery.confirmationEmail.at ? formatDateTimeShort(delivery.confirmationEmail.at, locale) : undefined}
        subMeta={state === 'failed' ? delivery.confirmationEmail.failureReason : null}
      />
    );
  }

  if (delivery.reminder.state !== 'not_scheduled') {
    const state = delivery.reminder.state as 'scheduled' | 'sent' | 'failed';
    rows.push(
      <Row
        key="reminder"
        icon={<Bell width={18} height={18} />}
        label={t('delivery.reminder.label')}
        chip={
          <StatusChip
            tone={state === 'failed' ? 'danger' : state === 'sent' ? 'success' : 'warning'}
            label={t(`delivery.state.${state === 'scheduled' ? 'pending' : state === 'sent' ? 'sent' : 'failed'}`)}
          />
        }
        meta={delivery.reminder.at ? formatDateTimeShort(delivery.reminder.at, locale) : undefined}
      />
    );
  }

  if (delivery.whatsapp.state !== 'disabled' && delivery.whatsapp.state !== 'not_sent') {
    const state = delivery.whatsapp.state as 'sent' | 'failed';
    rows.push(
      <Row
        key="whatsapp"
        icon={<Bell width={18} height={18} />}
        label={t('delivery.whatsapp.label')}
        chip={
          <StatusChip
            tone={state === 'sent' ? 'success' : 'danger'}
            label={t(`delivery.state.${state}`)}
          />
        }
        meta={delivery.whatsapp.at ? formatDateTimeShort(delivery.whatsapp.at, locale) : undefined}
      />
    );
  }

  if (rows.length === 0) return null;

  return (
    <div>
      <h3
        className="text-[13px] uppercase tracking-[0.1em] text-[#8c8577] mb-1"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {t('delivery.title')}
      </h3>
      <div className="flex flex-col divide-y divide-[#f0e8d8]">{rows}</div>
    </div>
  );
}
