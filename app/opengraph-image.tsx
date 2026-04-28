import { ImageResponse } from 'next/og'

export const alt = 'The Tafel — You deserve better.'
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          backgroundColor: '#0f0d08',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: '120px',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: '24px',
          }}
        >
          THE TAFEL
        </div>
        <div
          style={{
            fontSize: '36px',
            fontWeight: 400,
            color: '#d4820a',
            letterSpacing: '0.02em',
            marginBottom: '48px',
          }}
        >
          You deserve better.
        </div>
        <div
          style={{
            fontSize: '20px',
            fontWeight: 400,
            color: '#9c8b6a',
            letterSpacing: '0.1em',
          }}
        >
          thetafel.nl
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
