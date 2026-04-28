'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

export default function Problem() {
  const t = useTranslations('problem')
  const sectionRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (photoRef.current) {
              photoRef.current.style.opacity = '1'
              photoRef.current.style.transform = 'translateX(0)'
            }
            const cards = cardsRef.current?.querySelectorAll('.pain-card')
            cards?.forEach((card, index) => {
              setTimeout(() => {
                ;(card as HTMLElement).style.opacity = '1'
                ;(card as HTMLElement).style.transform = 'translateX(0)'
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
  ]

  return (
    <section
      ref={sectionRef}
      id="problem"
      style={{ backgroundColor: 'var(--cream)', padding: '100px 0' }}
    >
      <div
        style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 64px' }}
        className="problem-container"
      >
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
              maxWidth: '600px',
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
              maxWidth: '520px',
            }}
          >
            {t('sub')}
          </p>
        </div>

        <div
          className="problem-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '45% 55%',
            gap: '64px',
            alignItems: 'start',
          }}
        >
          <div
            ref={photoRef}
            style={{
              position: 'relative',
              opacity: 0,
              transform: 'translateX(-24px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            }}
          >
            <div
              style={{
                borderRadius: '24px',
                overflow: 'hidden',
                position: 'relative',
                height: '520px',
              }}
            >
              <Image
                src="/images/problem-main.jpg"
                alt="Empty restaurant table set for dinner"
                fill
                sizes="(max-width: 768px) 100vw, 45vw"
                style={{ objectFit: 'cover' }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                right: '0px',
                backgroundColor: 'var(--cream)',
                borderRadius: '16px',
                padding: '16px 20px',
                boxShadow: '0 8px 32px rgba(30,21,8,0.12)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-raleway), sans-serif',
                  fontWeight: 900,
                  fontSize: '32px',
                  color: 'var(--amber)',
                  lineHeight: 1,
                }}
              >
                28%
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--stone)',
                  marginTop: '4px',
                  textAlign: 'center',
                  maxWidth: '100px',
                }}
              >
                {t('badge')}
              </span>
            </div>
          </div>

          <div
            ref={cardsRef}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            {cards.map((card, index) => (
              <div
                key={index}
                className="pain-card"
                style={{
                  backgroundColor: 'var(--warm)',
                  borderLeft: '3px solid var(--amber)',
                  borderRadius: '0 16px 16px 0',
                  padding: '28px 32px',
                  opacity: 0,
                  transform: 'translateX(24px)',
                  transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--earth)',
                    marginBottom: '8px',
                    lineHeight: 1.4,
                  }}
                >
                  {card.title}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: 'var(--stone)',
                    lineHeight: 1.7,
                  }}
                >
                  {card.body}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .problem-container { padding: 0 24px !important; }
          .problem-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
        }
      `}</style>
    </section>
  )
}