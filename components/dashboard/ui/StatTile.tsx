import Link from 'next/link';

/**
 * StatTile — the reference-dashboard stat card in the Tafel palette.
 * White card on cream, value in Raleway 900, label in Jost 600 small caps.
 */

type StatTileProps = {
  label: string;
  value: React.ReactNode;
  delta?: { text: string; tone: 'positive' | 'negative' | 'neutral' };
  href?: string;
};

const DELTA_COLOR: Record<'positive' | 'negative' | 'neutral', string> = {
  positive: '#4a7c46',
  negative: '#b3422f',
  neutral: '#8c8577',
};

export default function StatTile({ label, value, delta, href }: StatTileProps) {
  const body = (
    <div className="bg-white rounded-card p-4 md:p-5 h-full">
      <div
        className="text-[11px] uppercase tracking-[0.12em] text-[#6f6353]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-[30px] md:text-[36px] leading-none text-[#1e1508]"
        style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
      >
        {value}
      </div>
      {delta && (
        <div
          className="mt-2 text-[12px]"
          style={{
            color: DELTA_COLOR[delta.tone],
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
          }}
        >
          {delta.text}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="tafel-tap block h-full">
        {body}
      </Link>
    );
  }
  return body;
}
