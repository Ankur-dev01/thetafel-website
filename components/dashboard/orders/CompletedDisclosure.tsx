'use client';

import { useTranslations } from 'next-intl';

type CompletedDisclosureProps = {
  count: number;
  children: React.ReactNode;
  open?: boolean;
  onToggle?: (open: boolean) => void;
};

/**
 * "Voltooid ({n})" expandable section — desktop column wrapper. Phone uses
 * the Actief/Voltooid tabs instead (OrdersClient renders this only on
 * desktop), so this component owns no URL state of its own by default; the
 * optional open/onToggle props let a caller control it when needed.
 */
export default function CompletedDisclosure({ count, children, open, onToggle }: CompletedDisclosureProps) {
  const t = useTranslations('dashboard.orders.tab');

  return (
    <details
      className="group"
      open={open}
      onToggle={(e) => onToggle?.((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className="tafel-tap cursor-pointer text-[13px] text-[#6f6353] uppercase tracking-[0.08em] list-none flex items-center gap-1.5 py-2"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-transform group-open:rotate-90"
          aria-hidden="true"
        >
          <path d="M9.4 5.6l6.4 6.4-6.3 6.4" />
        </svg>
        {t('completed', { count })}
      </summary>
      <div className="mt-2.5 flex flex-col gap-2.5">{children}</div>
    </details>
  );
}
