'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

export default function HowItWorks() {
  const t = useTranslations('howItWorks')
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const photos = sectionRef.current?.querySelectorAll('.hiw-photo')
            photos?.forEach((photo, index) => {
              setTimeout(() => {
                ;(photo as HTMLElement).style.opacity = '1'
                ;(photo as HTMLElement).style.transform = 'translateX(0)'
              }, index * 150)
            })
            const steps = sectionRef.current?.querySelectorAll('.hiw-step')
            steps?.forEach((step, index) => {
              setTimeout(() => {
                ;(step as HTMLElement).style.opacity = '1'
                ;(step as HTMLElement).style.transform = 'translateY(0)'
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

  const steps = [
    { number: '01', title: t('step1Title'), body: t('step1Body') },
    { number: '02', title: t('step2Title'), body: t('step2Body') },
    { number: '03', title: t('step3Title'), body: t('step3Body') },
  ]

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      style={{ backgroundColor: 'var(--warm)', padding: '100px 0' }}
    >
      <div
        style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 64px' }}
        className="hiw-container"
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
              maxWidth: '480px',
            }}
          >
            {t('sub')}
          </p>
        </div>

        <div
          className="hiw-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '45% 55%',
            gap: '80px',
            alignItems: 'center',
          }}
        >
          <div className="hiw-photo-stack" style={{ position: 'relative', height: '540px' }}>
            <div
              className="hiw-photo"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '78%',
                height: '360px',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(30,21,8,0.12)',
                opacity: 0,
                transform: 'translateX(-16px)',
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              }}
            >
              <Image
                src="/images/hiw-photo-a.jpg"
                alt="Restaurant owner setting up on laptop"
                fill
                sizes="(max-width: 768px) 100vw, 35vw"
                style={{ objectFit: 'cover' }}
              />
            </div>

            <div
              className="hiw-photo"
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                width: '55%',
                height: '260px',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 16px 48px rgba(30,21,8,0.12)',
                border: '4px solid var(--warm)',
                opacity: 0,
                transform: 'translateX(-16px)',
                transition: 'opacity 0.6s ease-out 0.15s, transform 0.6s ease-out 0.15s',
              }}
            >
              <Image
                src="/images/hiw-photo-b.jpg"
                alt="QR code on restaurant table"
                fill
                sizes="(max-width: 768px) 100vw, 25vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {steps.map((step, index) => (
              <div
                key={index}
                className="hiw-step"
                style={{
                  display: 'flex',
                  gap: '24px',
                  paddingBottom: index < 2 ? '40px' : '0',
                  opacity: 0,
                  transform: 'translateY(24px)',
                  transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--amber)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'var(--cream)',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {step.number}
                    </span>
                  </div>
                  {index < 2 && (
                    <div
                      style={{
                        width: '1px',
                        flex: 1,
                        marginTop: '8px',
                        borderLeft: '1px dashed rgba(212,130,10,0.4)',
                        minHeight: '40px',
                      }}
                    />
                  )}
                </div>

                <div style={{ paddingTop: '10px' }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-raleway), sans-serif',
                      fontWeight: 900,
                      fontSize: '22px',
                      letterSpacing: '-0.015em',
                      color: 'var(--earth)',
                      marginBottom: '8px',
                      lineHeight: 1.2,
                    }}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '15px',
                      fontWeight: 400,
                      lineHeight: 1.7,
                      color: 'var(--stone)',
                    }}
                  >
                    {step.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .hiw-container { padding: 0 24px !important; }
          .hiw-grid { grid-template-columns: 1fr !important; gap: 48px !important; }
          .hiw-photo-stack { height: 300px !important; }
        }
      `}</style>
    </section>
  )
}