import { Link } from '@/i18n/routing';

/**
 * EntityCard — the base card for a booking or order row. White card on cream.
 * When href is set the whole card is a tap target; action buttons render in
 * their own row and stop propagation naturally (separate elements).
 */

type EntityCardAction = {
  key: string;
  label: string;
  onClick?: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
};

type EntityCardProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: string;
  status?: React.ReactNode;
  actions?: EntityCardAction[];
  href?: string;
};

const ACTION_CLASSES: Record<'primary' | 'secondary' | 'danger', string> = {
  primary: 'bg-amber text-[#1e1508]',
  secondary: 'bg-[#f5ede0] text-[#1e1508]',
  danger: 'bg-[#f7e8e6] text-[#b3422f]',
};

export default function EntityCard({
  title,
  subtitle,
  meta,
  status,
  actions,
  href,
}: EntityCardProps) {
  const inner = (
    <div className="bg-white rounded-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="text-[15px] text-[#1e1508] leading-snug truncate"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              className="mt-0.5 text-[13px] text-[#6f6353] leading-snug"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
            >
              {subtitle}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {meta && (
            <span
              className="text-[12px] text-[#8c8577]"
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
            >
              {meta}
            </span>
          )}
          {status}
        </div>
      </div>
      {actions && actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              className={
                'tafel-tap px-3.5 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] ' +
                ACTION_CLASSES[action.tone ?? 'secondary']
              }
              style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="tafel-tap block">
        {inner}
      </Link>
    );
  }
  return inner;
}
