import { WarningTriangle } from '@/components/dashboard/icons';

/**
 * DisconnectedStrip — shown when usePolling's isDisconnected flips true
 * (3 consecutive failures). Sticky under the header; retry re-triggers the
 * poll immediately.
 */

type DisconnectedStripProps = {
  onRetry: () => void;
  locale?: 'nl' | 'en';
};

export default function DisconnectedStrip({
  onRetry,
  locale = 'nl',
}: DisconnectedStripProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-[#fcf0d8] rounded-card px-4 py-2.5 mb-3">
      <div className="flex items-center gap-2 text-[#8a5208]">
        <WarningTriangle width={16} height={16} />
        <span
          className="text-[13px]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
        >
          {locale === 'nl' ? 'Verbinding verbroken' : 'Connection lost'}
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="tafel-tap text-[12px] uppercase tracking-[0.08em] text-[#8a5208] underline underline-offset-2"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {locale === 'nl' ? 'Opnieuw proberen' : 'Retry'}
      </button>
    </div>
  );
}
