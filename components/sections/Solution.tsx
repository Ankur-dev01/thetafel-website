'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

export default function Solution() {
  const t = useTranslations('solution')
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const header = sectionRef.current?.querySelector('.solution-header')
            if (header) {
              ;(header as HTMLElement).style.opacity = '1'
              ;(header as HTMLElement).style.transform = 'translateY(0)'
            }
            const cards = sectionRef.current?.querySelectorAll('.solution-card')
            cards?.forEach((card, index) => {
              setTimeout(() => {
                ;(card as HTMLElement).style.opacity = '1'
                ;(card as HTMLElement).style.transform = 'translateY(0)'
              }, index * 120)
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
    {
      number: t('card1Number'),
      title: t('card1Title'),
      body: t('card1Body'),
      image: '/images/solution-card-1.jpg',
      alt: 'Restaurant owner smiling at phone',
    },
    {
      number: t('card2Number'),
      title: t('card2Title'),
      body: t('card2Body'),
      image: '/images/solution-card-2.jpg',
      alt: 'iDEAL payment confirmation',
    },
    {
      number: t('card3Number'),
      title: t('card3Title'),
      body: t('card3Body'),
      image: '/images/solution-card-3.jpg',
      alt: 'Restaurant manager reviewing guest list',
    },
  ]

  return (
    <section
      ref={sectionRef}
      id="solution"
      style={{ backgroundColor: 'var(--night)', padding: '100px 0' }}
    >
      <div
        style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 64px' }}
        className="solution-container"
      >
        <div
          className="solution-header"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '64px',
            alignItems: 'end',
            marginBottom: '64px',
            opacity: 0,
            transform: 'translateY(24px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
          <div>
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
                color: 'var(--cream)',
              }}
            >
              {t('heading')}
            </h2>
          </div>
          <div>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '16px',
                fontWeight: 300,
                lineHeight: 1.75,
                color: 'var(--stone)',
              }}
            >
              {t('sub')}
            </p>
          </div>
        </div>

        <div
          className="solution-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
          }}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              className="solution-card"
              style={{
                backgroundColor: '#141210',
                border: '1px solid rgba(156,139,106,0.12)',
                borderRadius: '20px',
                overflow: 'hidden',
                opacity: 0,
                transform: 'translateY(24px)',
                transition:
                  'opacity 0.6s ease-out, transform 0.6s ease-out, box-shadow 0.25s ease',
                cursor: 'default',
                position: 'relative',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.transform = 'translateY(-6px)'
                el.style.boxShadow = '0 24px 48px rgba(0,0,0,0.4)'
                const line = el.querySelector('.card-amber-line') as HTMLElement
                if (line) line.style.transform = 'scaleX(1)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'none'
                const line = el.querySelector('.card-amber-line') as HTMLElement
                if (line) line.style.transform = 'scaleX(0)'
              }}
            >
              <div
                style={{
                  position: 'relative',
                  height: '180px',
                  overflow: 'hidden',
                }}
              >
                <Image
                  src={card.image}
                  alt={card.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>

              <div style={{ padding: '28px' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.2em',
                    color: 'var(--amber)',
                    marginBottom: '12px',
                  }}
                >
                  {card.number}
                </div>
                <h3
                  style={{
                    fontFamily: 'var(--font-raleway), sans-serif',
                    fontWeight: 900,
                    fontSize: '22px',
                    letterSpacing: '-0.015em',
                    color: 'var(--cream)',
                    marginBottom: '12px',
                    lineHeight: 1.2,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '14px',
                    fontWeight: 300,
                    lineHeight: 1.7,
                    color: 'var(--stone)',
                  }}
                >
                  {card.body}
                </p>
              </div>

              <div
                className="card-amber-line"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  backgroundColor: 'var(--amber)',
                  transform: 'scaleX(0)',
                  transformOrigin: 'left',
                  transition: 'transform 0.25s ease',
                }}
              />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .solution-container { padding: 0 24px !important; }
          .solution-header { grid-template-columns: 1fr !important; gap: 24px !important; }
          .solution-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}