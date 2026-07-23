/**
 * D0.2 placeholder page body — proves a dashboard route resolves inside the
 * shell. Each is replaced by its real page in D1–D5.
 */

type PlaceholderPageProps = {
  title: string;
  subtitle: string;
};

export default function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <div className="pt-4">
      <h1
        className="text-[28px] md:text-[36px] text-[#1e1508]"
        style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
      >
        {title}
      </h1>
      <p
        className="mt-2 text-[14px] text-[#6f6353]"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
      >
        {subtitle}
      </p>
    </div>
  );
}
