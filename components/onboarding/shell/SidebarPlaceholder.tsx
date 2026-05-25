/**
 * SidebarPlaceholder
 *
 * Temporary sidebar contents. Replaced by OnboardingSidebar in D1.2.
 * Shows the wordmark, a tiny diagnostic of resolved state, and a
 * "coming next" note. Server component (no client behaviour needed yet).
 */

type SidebarPlaceholderProps = {
  locale: 'nl' | 'en'
  restaurantName: string | null
  currentStep: number
}

export default function SidebarPlaceholder({
  locale,
  restaurantName,
  currentStep,
}: SidebarPlaceholderProps) {
  const messages = {
    nl: {
      eyebrow: 'RESTAURANT SETUP',
      noRestaurant: 'Nog geen restaurant gestart',
      currentStep: 'Huidige stap',
      placeholder: 'Volledige zijbalk komt in D1.2.',
    },
    en: {
      eyebrow: 'RESTAURANT SETUP',
      noRestaurant: 'No restaurant started yet',
      currentStep: 'Current step',
      placeholder: 'Full sidebar arrives in D1.2.',
    },
  } as const

  const t = messages[locale]

  return (
    <div className="flex flex-col h-full p-6">
      {/* Wordmark */}
      <div className="mb-8">
        <div
          className="text-[11px] tracking-[0.18em] text-[#d4820a] leading-none"
          style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
          }}
        >
          THE
        </div>
        <div
          className="text-[28px] text-[#fdfaf5] leading-none mt-1"
          style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
          }}
        >
          Tafel
        </div>
        <div
          className="text-[9px] tracking-[0.22em] text-[#9c8b6a] mt-3 uppercase"
          style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 600,
          }}
        >
          {t.eyebrow}
        </div>
      </div>

      {/* Diagnostic block (placeholder) */}
      <div
        className="rounded bg-white/5 p-4 text-[12px] leading-relaxed"
        style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
        }}
      >
        <div className="text-[#9c8b6a]">{t.currentStep}</div>
        <div className="text-[#fdfaf5] font-medium mt-1">
          {restaurantName ?? t.noRestaurant}
        </div>
        <div className="text-[#d4820a] mt-3">Step {currentStep}</div>
      </div>

      <div className="flex-1" />

      <div
        className="text-[11px] text-[#9c8b6a]"
        style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
        }}
      >
        {t.placeholder}
      </div>
    </div>
  )
}
