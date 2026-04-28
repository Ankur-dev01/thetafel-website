'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useModal } from '@/components/ui/ModalContext'

function useCountUp(target: number, duration: number, started: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!started) return
    let start = 0
    const increment = target / (duration / 18)
    const timer = setInterval(() => {
      start += increment
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 18)
    return () => clearInterval(timer)
  }, [started, target, duration])

  return count
}

export default function Proof() {
  const t = useTranslations('proof')
  const { openModal } = useModal()
  const sectionRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)

  const stat1 = useCountUp(247, 1500, started)
  const stat2 = useCountUp(68, 1500, started)
  const stat3 = useCountUp(71, 1500, started)
  const progressValue = useCountUp(12, 1500, started)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStarted(true)
            const reveals = sectionRef.current?.querySelectorAll('.proof-reveal')
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
      id="proof"
      style={{ backgroundColor: 'var(--cream)', padding: '100px 0' }}
    >
      <div
        style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 64px' }}
        className="proof-container"
      >
        <div
          className="proof-reveal"
          style={{
            marginBottom: '64px',
            opacity: 0,
            transform: 'translateY(24px)',
            transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
          }}
        >
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
              maxWidth: '600px',
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
          className="proof-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '45% 55%',
            gap: '48px',
            alignItems: 'start',
          }}
        >
          <div
            className="proof-reveal"
            style={{
              position: 'relative',
              opacity: 0,
              transform: 'translateY(24px)',
              transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
            }}
          >
            <div
              style={{
                borderRadius: '24px',
                overflow: 'hidden',
                position: 'relative',
                height: '440px',
              }}
            >
              <Image
                src="/images/proof-main.jpg"
                alt="Dutch restaurant exterior"
                fill
                sizes="(max-width: 768px) 100vw, 45vw"
                style={{ objectFit: 'cover' }}
              />
            </div>

            <div
              style={{
                position: 'absolute',
                bottom: '24px',
                left: '0px',
                backgroundColor: 'var(--cream)',
                borderRadius: '16px',
                padding: '20px 24px',
                boxShadow: '0 8px 32px rgba(30,21,8,0.12)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-raleway), sans-serif',
                  fontWeight: 900,
                  fontSize: '36px',
                  color: 'var(--amber)',
                  lineHeight: 1,
                }}
              >
                {stat1}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '10px',
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--stone)',
                  marginTop: '4px',
                }}
              >
                {t('stat1Label')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div
              className="proof-reveal proof-data-card"
              style={{
                backgroundColor: 'var(--night)',
                borderLeft: '4px solid var(--amber)',
                borderRadius: '0 20px 20px 0',
                padding: '36px',
                opacity: 0,
                transform: 'translateY(24px)',
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '24px',
                  marginBottom: '24px',
                }}
              >
                {[
                  { value: stat1, label: t('stat1Label') },
                  { value: stat2, label: t('stat2Label') },
                  { value: stat3, label: t('stat3Label') },
                ].map((stat, index) => (
                  <div key={index}>
                    <div
                      style={{
                        fontFamily: 'var(--font-raleway), sans-serif',
                        fontWeight: 900,
                        fontSize: '36px',
                        color: 'var(--amber)',
                        lineHeight: 1,
                        marginBottom: '6px',
                      }}
                    >
                      {index === 0 ? stat.value : `${stat.value}%`}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: 'var(--stone)',
                        lineHeight: 1.4,
                      }}
                    >
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '11px',
                  fontWeight: 400,
                  color: 'rgba(156,139,106,0.6)',
                  fontStyle: 'italic',
                }}
              >
                {t('sourceLabel')} — 2026 · {stat1} Dutch restaurant websites analysed
              </div>
            </div>

            <div
              className="proof-reveal proof-founding-card"
              style={{
                backgroundColor: 'var(--warm)',
                borderRadius: '20px',
                padding: '36px',
                opacity: 0,
                transform: 'translateY(24px)',
                transition: 'opacity 0.6s ease-out, transform 0.6s ease-out',
              }}
            >
              <h3
                style={{
                  fontFamily: 'var(--font-raleway), sans-serif',
                  fontWeight: 900,
                  fontSize: '22px',
                  letterSpacing: '-0.015em',
                  color: 'var(--earth)',
                  marginBottom: '12px',
                }}
              >
                {t('foundingTitle')}
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: 400,
                  lineHeight: 1.7,
                  color: 'var(--stone)',
                  marginBottom: '24px',
                }}
              >
                {t('foundingBody')}
              </p>

              <div style={{ marginBottom: '24px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--earth)',
                    }}
                  >
                    {progressValue} of 500 {t('foundingProgress')}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--amber)',
                    }}
                  >
                    {progressValue}/500
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'rgba(156,139,106,0.2)',
                    borderRadius: '100px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    ref={progressRef}
                    style={{
                      height: '100%',
                      width: `${(progressValue / 500) * 100}%`,
                      backgroundColor: 'var(--amber)',
                      borderRadius: '100px',
                      transition: 'width 0.1s ease',
                    }}
                  />
                </div>
              </div>

              <button
                onClick={openModal}
                className="btn-primary"
                style={{ display: 'inline-flex' }}
              >
                {t('foundingCta')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .proof-container { padding: 0 24px !important; }
          .proof-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .proof-data-card { padding: 24px !important; }
          .proof-founding-card { padding: 24px !important; }
        }
      `}</style>
    </section>
  )
}