'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useModal } from '@/components/ui/ModalContext'

export default function Hero() {
  const t = useTranslations('hero')
  const { openModal } = useModal()
  const line1Ref = useRef<HTMLDivElement>(null)
  const line2Ref = useRef<HTMLDivElement>(null)
  const line3Ref = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const elements = [
      { ref: line1Ref, delay: 300 },
      { ref: line2Ref, delay: 450 },
      { ref: line3Ref, delay: 600 },
      { ref: subRef, delay: 750 },
      { ref: ctaRef, delay: 900 },
      { ref: statsRef, delay: 1050 },
    ]

    elements.forEach(({ ref, delay }) => {
      if (ref.current) {
        ref.current.style.opacity = '0'
        ref.current.style.transform = 'translateY(40px)'
        ref.current.style.transition =
          'opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1)'
        setTimeout(() => {
          if (ref.current) {
            ref.current.style.opacity = '1'
            ref.current.style.transform = 'translateY(0)'
          }
        }, delay)
      }
    })
  }, [])

  return (
    <section
      id="hero"
      style={{
        position: 'relative',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        backgroundColor: 'var(--night)',
      }}
    >
      {/* Background Image */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Image
          src="/images/hero-bg.jpg"
          alt="Warm restaurant interior"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center 40%' }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to right, rgba(15,13,8,0.92) 0%, rgba(15,13,8,0.7) 50%, rgba(15,13,8,0.3) 100%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(to bottom, rgba(15,13,8,0.2) 0%, rgba(15,13,8,0) 40%, rgba(15,13,8,0.6) 100%)',
          }}
        />
      </div>

      {/* Content */}
      <div
        className="hero-grid"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 64px',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '55% 45%',
          alignItems: 'center',
          gap: '40px',
        }}
      >
        {/* Left Column */}
        <div>
          {/* Headline */}
          <div className="hero-headline-group" style={{ marginBottom: '20px' }}>
            <div
              ref={line1Ref}
              style={{
                fontFamily: 'var(--font-raleway), sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(42px, 11vw, 80px)',
                letterSpacing: '-0.03em',
                lineHeight: 0.95,
                color: 'var(--cream)',
                marginBottom: '4px',
              }}
            >
              {t('line1')}
            </div>
            <div
              ref={line2Ref}
              style={{
                fontFamily: 'var(--font-raleway), sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(42px, 11vw, 80px)',
                letterSpacing: '-0.03em',
                lineHeight: 0.95,
                color: 'var(--cream)',
                marginBottom: '4px',
              }}
            >
              {t('line2')}
            </div>
            <div
              ref={line3Ref}
              style={{
                fontFamily: 'var(--font-raleway), sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(42px, 11vw, 80px)',
                letterSpacing: '-0.03em',
                lineHeight: 0.95,
                color: 'var(--amber)',
              }}
            >
              {t('line3')}
            </div>
          </div>

          {/* Subheadline */}
          <div
            ref={subRef}
            className="hero-sub"
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: 'clamp(14px, 3.5vw, 17px)',
              fontWeight: 300,
              lineHeight: 1.75,
              color: 'rgba(253,250,245,0.7)',
              maxWidth: '480px',
              marginBottom: '32px',
            }}
          >
            {t('sub')}
          </div>

          {/* CTA Group */}
          <div
            ref={ctaRef}
            className="hero-cta-group"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              marginBottom: '48px',
              flexWrap: 'wrap',
            }}
          >
            <button onClick={openModal} className="btn-primary">
              {t('ctaPrimary')}
            </button>
            <a
              href="#how-it-works"
              className="hero-secondary-cta"
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                fontWeight: 500,
                color: 'rgba(253,250,245,0.7)',
                textDecoration: 'none',
                letterSpacing: '0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {t('ctaSecondary')}
            </a>
          </div>

          {/* Stats Row */}
          <div
            ref={statsRef}
            className="hero-stats-row"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            {[
              { value: t('stat1Value'), label: t('stat1Label') },
              { value: t('stat2Value'), label: t('stat2Label') },
              { value: t('stat3Value'), label: t('stat3Label') },
            ].map((stat, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  paddingRight: index < 2 ? 'clamp(12px, 3vw, 32px)' : '0',
                  paddingLeft: index > 0 ? 'clamp(12px, 3vw, 32px)' : '0',
                  borderRight:
                    index < 2 ? '1px solid rgba(253,250,245,0.15)' : 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-raleway), sans-serif',
                    fontWeight: 900,
                    fontSize: '26px',
                    color: 'var(--amber)',
                    lineHeight: 1,
                    marginBottom: '4px',
                  }}
                >
                  {stat.value}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontWeight: 500,
                    fontSize: '11px',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(253,250,245,0.5)',
                  }}
                >
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column — Floating Photo Cards */}
        <div
          className="hero-cards"
          style={{
            position: 'relative',
            height: '460px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '40px',
              width: '260px',
              height: '300px',
              borderRadius: '20px',
              overflow: 'hidden',
              transform: 'rotate(2deg)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              animation: 'float1 3s ease-in-out infinite alternate',
            }}
          >
            <Image
              src="/images/hero-card-1.jpg"
              alt="Restaurant dish"
              fill
              sizes="(max-width: 768px) 0px, 260px"
              style={{ objectFit: 'cover' }}
            />
          </div>

          {/* Card 2 */}
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              width: '200px',
              height: '200px',
              borderRadius: '20px',
              overflow: 'hidden',
              transform: 'rotate(-3deg)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
              animation: 'float2 4s ease-in-out infinite alternate',
            }}
          >
            <Image
              src="/images/hero-card-2.jpg"
              alt="Restaurant setting"
              fill
              sizes="(max-width: 768px) 0px, 200px"
              style={{ objectFit: 'cover' }}
            />
          </div>

          {/* Badge stickers */}
          <div
            style={{
              position: 'absolute',
              top: '40px',
              left: '60px',
              backgroundColor: 'var(--amber)',
              color: 'var(--cream)',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '8px 16px',
              borderRadius: '100px',
              zIndex: 2,
              boxShadow: '0 4px 16px rgba(212,130,10,0.4)',
            }}
          >
            Boek nu
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '60px',
              right: '30px',
              backgroundColor: 'var(--cream)',
              color: 'var(--earth)',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              padding: '8px 16px',
              borderRadius: '100px',
              zIndex: 2,
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
          >
            Gratis te starten
          </div>
        </div>
      </div>

      {/* Scroll Hint */}
      <div
        className="hero-scroll-hint"
        style={{
          position: 'absolute',
          bottom: '24px',
          left: '64px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          opacity: 0,
          animation: 'fadeIn 0.8s ease forwards 1.5s',
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: '40px',
            height: '1px',
            backgroundColor: 'rgba(253,250,245,0.3)',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '11px',
            fontWeight: 400,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'rgba(253,250,245,0.4)',
          }}
        >
          {t('scrollHint')}
        </span>
      </div>

      <style>{`
        @keyframes float1 {
          from { transform: rotate(2deg) translateY(0px); }
          to { transform: rotate(2deg) translateY(-10px); }
        }
        @keyframes float2 {
          from { transform: rotate(-3deg) translateY(0px); }
          to { transform: rotate(-3deg) translateY(-8px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .hero-secondary-cta:hover {
          color: var(--cream) !important;
        }
        @media (max-width: 768px) {
          #hero {
            height: 100vh !important;
            align-items: flex-start !important;
          }
          .hero-grid {
            grid-template-columns: 1fr !important;
            padding: 100px 24px 48px !important;
            align-self: stretch !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            min-height: 100vh !important;
          }
          .hero-cards { display: none !important; }
          .hero-scroll-hint { display: none !important; }
          .hero-headline-group { margin-bottom: 20px !important; }
          .hero-sub { font-size: 15px !important; margin-bottom: 28px !important; }
          .hero-cta-group { margin-bottom: 0 !important; }
          .hero-stats-row {
            padding-top: 24px !important;
            border-top: 1px solid rgba(253,250,245,0.1) !important;
            margin-top: auto !important;
          }
        }
      `}</style>
    </section>
  )
}