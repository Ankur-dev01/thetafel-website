/**
 * SectionHeader — the primary page-title primitive: Raleway 900 title,
 * optional Jost 300 subtitle, optional right-slot for actions.
 */

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
};

export default function SectionHeader({
  title,
  subtitle,
  rightSlot,
}: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 pt-4 pb-2">
      <div>
        <h1
          className="text-[26px] md:text-[34px] text-[#1e1508] leading-tight"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className="mt-1 text-[14px] text-[#6f6353]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {rightSlot && <div className="flex-shrink-0 pt-1">{rightSlot}</div>}
    </div>
  );
}
