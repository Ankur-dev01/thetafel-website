/**
 * StatusChip — the four dashboard status tones. Colour is never the only
 * signal: the label is always visible.
 */

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONES: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: '#eef3e0', fg: '#4a7c46' },
  warning: { bg: '#fcf0d8', fg: '#a86205' },
  danger: { bg: '#f7e8e6', fg: '#b3422f' },
  neutral: { bg: '#f0ece3', fg: '#8c8577' },
};

type StatusChipProps = {
  tone: StatusTone;
  label: string;
  icon?: React.ReactNode;
};

export default function StatusChip({ tone, label, icon }: StatusChipProps) {
  const { bg, fg } = TONES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] uppercase tracking-[0.08em] whitespace-nowrap"
      style={{
        backgroundColor: bg,
        color: fg,
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 600,
      }}
    >
      {icon}
      {label}
    </span>
  );
}
