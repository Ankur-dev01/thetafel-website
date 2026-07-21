/**
 * EmptyState — cream card with an illustration slot, Raleway heading,
 * Jost body, and an optional single action.
 */

type EmptyStateProps = {
  illustration?: React.ReactNode;
  heading: string;
  body?: string;
  action?: React.ReactNode;
};

export default function EmptyState({
  illustration,
  heading,
  body,
  action,
}: EmptyStateProps) {
  return (
    <div className="bg-[#f7f2e9] rounded-card px-6 py-10 flex flex-col items-center text-center">
      {illustration && <div className="mb-4 text-[#c2b594]">{illustration}</div>}
      <h2
        className="text-[19px] text-[#1e1508]"
        style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
      >
        {heading}
      </h2>
      {body && (
        <p
          className="mt-2 text-[14px] text-[#6f6353] leading-relaxed max-w-[380px]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}
        >
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
