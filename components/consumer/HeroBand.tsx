/**
 * Cover-photo band: photo (or amber wordmark fallback) with a bottom-up
 * legibility gradient. Extracted from `RestaurantHeader` so the booking page
 * can show the same hero treatment without pulling in the full identity
 * strip (name/cuisine/hours/address/phone), which the booking page already
 * renders itself via `BookingStepShell`.
 */
export function HeroBand({
  photo,
  name,
}: {
  photo: string | null
  name: string
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16 / 7',
        minHeight: '220px',
        maxHeight: '480px',
        overflow: 'hidden',
        backgroundColor: photo
          ? 'var(--night, #0f0d08)'
          : 'var(--amber, #d4820a)',
      }}
    >
      {photo ? (
        // Plain <img> rather than next/image because we don't yet have a
        // loader configured for arbitrary Supabase Storage hosts on the
        // consumer side. The hero is purely decorative — alt is empty.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <AmberWordmarkFallback name={name} />
      )}

      {/* Bottom-up gradient for legibility of any overlaid copy */}
      {photo ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(15,13,8,0) 50%, rgba(15,13,8,0.45) 100%)',
          }}
        />
      ) : null}
    </div>
  )
}

function AmberWordmarkFallback({ name }: { name: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(36px, 7vw, 72px)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: 'var(--cream, #fdfaf5)',
          textShadow: '0 2px 14px rgba(15,13,8,0.18)',
        }}
      >
        {name}
      </span>
    </div>
  )
}
