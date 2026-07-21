/**
 * DetailPanel — desktop right-side panel for list+detail pages.
 * The parent grid gives the list 60% and this panel 40% of content width.
 */

type DetailPanelProps = {
  title: string;
  children: React.ReactNode;
  footerAction?: React.ReactNode;
};

export default function DetailPanel({
  title,
  children,
  footerAction,
}: DetailPanelProps) {
  return (
    <aside className="bg-white rounded-card flex flex-col max-h-[calc(100vh-8rem)] sticky top-20">
      <div className="px-5 py-4">
        <h2
          className="text-[18px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
        >
          {title}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
      {footerAction && <div className="px-5 py-4 bg-[#f7f2e9] rounded-b-card">{footerAction}</div>}
    </aside>
  );
}
