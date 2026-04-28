'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'

export default function TrustBar() {
  const t = useTranslations('trustBar')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const items = ref.current?.querySelectorAll('.trust-item')
    if (!items) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            items.forEach((item, index) => {
              setTimeout(() => {
                ;(item as HTMLElement).style.opacity = '1'
                ;(item as HTMLElement).style.transform = 'translateY(0)'
              }, index * 80)
            })
            observer.disconnect()
          }
        })
      },
      { threshold: 0.1 }
    )

    observer.observe(ref.current!)
    return () => observer.disconnect()
  }, [])

  const items = [
    t('item1'),
    t('item2'),
    t('item3'),
    t('item4'),
  ]

  return (
    <div
      ref={ref}
      className="trust-bar-outer"
      style={{
        backgroundColor: 'var(--warm2)',
        padding: '16px 0',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
        }}
        className="trust-grid"
      >
        {items.map((item, index) => (
          <div
            key={index}
            className="trust-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '16px 24px',
              borderRight:
                index < 3 ? '1px solid rgba(156,139,106,0.25)' : 'none',
              opacity: 0,
              transform: 'translateY(12px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--amber)',
                flexShrink: 0,
              }}
            />
            <span
              className="trust-label"
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--earth)',
              }}
            >
              {item}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .trust-bar-outer { padding: 16px 0 !important; }
          .trust-grid { grid-template-columns: repeat(2, 1fr) !important; padding: 0 20px !important; gap: 0 !important; }
          .trust-item { border-right: none !important; border-bottom: 1px solid rgba(156,139,106,0.2) !important; justify-content: flex-start !important; padding: 14px 12px !important; gap: 8px !important; }
          .trust-label { font-size: 10px !important; letter-spacing: 0.12em !important; }
        }
      `}</style>
    </div>
  )
}