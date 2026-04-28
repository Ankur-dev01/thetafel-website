'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

export default function ComingSoon() {
  const t = useTranslations('comingSoon')
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const cards = sectionRef.current?.querySelectorAll('.cs-card')
            cards?.forEach((card, index) => {
              setTimeout(() => {
                ;(card as HTMLElement).style.opacity = '1'
                ;(card as HTMLElement).style.transform = 'translateY(0)'
              }, index * 100)
            })
            observer.disconnect()
          }
        })
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  const cards = [
    { title: t('card1Title'), body: t('card1Body') },
    { title: t('card2Title'), body: t('card2Body') },
    { title: t('card3Title'), body: t('card3Body') },
    { title: t('card4Title'), body: t('card4Body') },
  ]

  return (
    <section
      ref={sectionRef}
      id="coming-soon"
      style={{
        backgroundColor: 'var(--warm)',
        padding: '100px 0',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 64px',
        }}
        className="cs-container"
      >
        {/* Header */}
        <div style={{ marginBottom: '64px' }}>
          <div
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--amber)',
              marginBottom: '16px',
            }}
          >
            {t('eyebrow')}
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-raleway), sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(30px, 3.8vw, 48px)',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              color: 'var(--earth)',
              marginBottom: '16px',
            }}
          >
            {t('heading')}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '16px',
              fontWeight: 300,
              lineHeight: 1.75,
              color: 'var(--stone)',
              maxWidth: '560px',
            }}
          >
            {t('sub')}
          </p>
        </div>

        {/* Cards Grid */}
        <div
          className="cs-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '24px',
          }}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              className="cs-card"
              style={{
                backgroundColor: 'var(--cream)',
                borderRadius: '20px',
                padding: '32px 28px',
                position: 'relative',
                overflow: 'hidden',
                opacity: 0,
                transform: 'translateY(24px)',
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              }}
            >
              {/* Amber top line */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  backgroundColor: 'var(--amber)',
                }}
              />

              {/* Badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: 'var(--amber-light)',
                  borderRadius: '100px',
                  padding: '4px 12px',
                  marginBottom: '20px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: 'var(--amber)',
                  }}
                >
                  {t('badge')}
                </span>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontFamily: 'var(--font-raleway), sans-serif',
                  fontWeight: 900,
                  fontSize: '20px',
                  letterSpacing: '-0.01em',
                  color: 'var(--earth)',
                  marginBottom: '12px',
                  lineHeight: 1.2,
                }}
              >
                {card.title}
              </h3>

              {/* Body */}
              <p
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: 'var(--stone)',
                }}
              >
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          .cs-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 768px) {
          .cs-container {
            padding: 0 24px !important;
          }
          .cs-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}