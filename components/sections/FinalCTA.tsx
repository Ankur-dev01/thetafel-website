'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useModal } from '@/components/ui/ModalContext'

export default function FinalCTA() {
  const t = useTranslations('finalCta')
  const { openModal } = useModal()
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const reveals = sectionRef.current?.querySelectorAll('.cta-reveal')
            reveals?.forEach((el, index) => {
              setTimeout(() => {
                ;(el as HTMLElement).style.opacity = '1'
                ;(el as HTMLElement).style.transform = 'translateY(0)'
              }, index * 150)
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

  return (
    <section
      ref={sectionRef}
      id="final-cta"
      style={{
        position: 'relative',
        backgroundColor: 'var(--night)',
        padding: '100px 0',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Image
          src="/images/cta-bg.jpg"
          alt="Restaurant interior"
          fill
          sizes="100vw"
          style={{ objectFit: 'cover', opacity: 0.18 }}
        />
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 64px',
          display: 'grid',
          gridTemplateColumns: '55% 45%',
          gap: '64px',
          alignItems: 'center',
        }}
        className="cta-grid"
      >
        <div>
          <div
            className="cta-reveal"
            style={{
              opacity: 0,
              transform: 'translateY(24px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-raleway), sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(32px, 7vw, 72px)',
                letterSpacing: '-0.03em',
                lineHeight: 0.95,
                marginBottom: '24px',
              }}
            >
              <span style={{ color: 'var(--cream)' }}>{t('heading1')} </span>
              <span style={{ color: 'var(--amber)' }}>{t('heading2')}</span>
            </h2>
          </div>

          <div
            className="cta-reveal"
            style={{
              opacity: 0,
              transform: 'translateY(24px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '17px',
                fontWeight: 300,
                lineHeight: 1.75,
                color: 'rgba(253,250,245,0.7)',
                marginBottom: '40px',
                maxWidth: '480px',
              }}
            >
              {t('sub')}
            </p>
          </div>

          <div
            className="cta-reveal"
            style={{
              opacity: 0,
              transform: 'translateY(24px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              flexWrap: 'wrap',
              marginBottom: '32px',
            }}
          >
            <button onClick={openModal} className="btn-primary">
              {t('ctaPrimary')}
            </button>
            <button
              onClick={openModal}
              className="btn-ghost"
              style={{
                color: 'rgba(253,250,245,0.7)',
                borderColor: 'rgba(253,250,245,0.2)',
              }}
            >
              {t('ctaSecondary')}
            </button>
          </div>

          <div
            className="cta-reveal"
            style={{
              opacity: 0,
              transform: 'translateY(24px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 0C4.477 0 0 4.477 0 10C0 15.523 4.477 20 10 20C15.523 20 20 15.523 20 10C20 4.477 15.523 0 10 0ZM14.93 6.588L13.19 14.418C13.056 15.01 12.703 15.154 12.209 14.873L9.709 13.049L8.505 14.207C8.362 14.35 8.241 14.471 7.96 14.471L8.148 11.921L12.878 7.648C13.088 7.461 12.832 7.356 12.556 7.543L6.693 11.228L4.226 10.453C3.646 10.268 3.634 9.874 4.348 9.593L14.229 5.801C14.712 5.623 15.134 5.912 14.93 6.588Z"
                fill="#25d366"
              />
            </svg>
            <a
              href="https://wa.me/31634339839"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '14px',
                fontWeight: 400,
                color: 'rgba(253,250,245,0.6)',
                textDecoration: 'none',
                lineHeight: 1.5,
              }}
            >
              {t('whatsapp')}
            </a>
          </div>
        </div>

        <div
          className="cta-reveal cta-card-wrap"
          style={{
            opacity: 0,
            transform: 'translateY(24px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              height: '460px',
              borderRadius: '24px',
              overflow: 'hidden',
              animation: 'ctaFloat 6s ease-in-out infinite alternate',
              boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
              position: 'relative',
            }}
          >
            <Image
              src="/images/cta-card.jpg"
              alt="Restaurant signature dish"
              fill
              sizes="(max-width: 768px) 0px, 380px"
              style={{ objectFit: 'cover' }}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ctaFloat {
          from { transform: rotate(1.5deg) translateY(0px); }
          to { transform: rotate(1.5deg) translateY(-12px); }
        }
        @media (max-width: 768px) {
          .cta-grid {
            grid-template-columns: 1fr !important;
            padding: 0 24px !important;
          }
          .cta-card-wrap {
            display: none !important;
          }
        }
      `}</style>
    </section>
  )
}