'use client';

import { useEffect, useState } from 'react';
import AlertStripPrimitive from '@/components/dashboard/ui/AlertStrip';
import { getDismissedIds, dismissAlert } from '@/lib/dashboard/alerts/dismissal';
import type { DashboardAlert, DashboardAlertId } from '@/lib/dashboard/alerts/types';

type AlertStripProps = {
  alerts: DashboardAlert[];
  locale: 'nl' | 'en';
  todayAmsterdamCivilDate: string;
};

const REGION_LABEL = { nl: 'Meldingen', en: 'Alerts' } as const;

export default function AlertStrip({ alerts, locale, todayAmsterdamCivilDate }: AlertStripProps) {
  const [dismissed, setDismissed] = useState<Set<DashboardAlertId>>(new Set());

  // Dismissal state is per-device localStorage — read only on mount / day
  // change, never persisted to the server.
  useEffect(() => {
    setDismissed(getDismissedIds(todayAmsterdamCivilDate));
  }, [todayAmsterdamCivilDate]);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  const handleDismiss = (id: DashboardAlertId) => {
    dismissAlert(todayAmsterdamCivilDate, id);
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div
      role="region"
      aria-label={REGION_LABEL[locale]}
      className="max-md:sticky max-md:top-0 max-md:z-10"
    >
      <AlertStripPrimitive
        alerts={visible.map((a) => ({
          id: a.id,
          tone: a.tone,
          label: locale === 'nl' ? a.label_nl : a.label_en,
          actionHref: a.action_href,
          actionLabel: locale === 'nl' ? a.action_label_nl : a.action_label_en,
          onDismiss: () => handleDismiss(a.id),
        }))}
      />
    </div>
  );
}
