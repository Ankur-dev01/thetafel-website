'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { STARTER_MONTHLY_BOOKING_LIMIT, TRIAL_DAYS } from '@/lib/pricing/subscription'
import { useInView, rv } from './motion'
import s from './home.module.css'
import { cx } from './layout'

const ITEMS = [1, 2, 3, 4, 5] as const

export default function Faq() {
  const t = useTranslations('home.faq')
  const [open, setOpen] = useState<number | null>(null)
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.1 })

  return (
    <section id="faq" className={s.faq}>
      <div ref={ref}>
        <p className={cx(s.faqChip, s.rv, inView && s.rvIn)} style={rv({ ty: 14 })}>
          {t('chip')}
        </p>
        <h2 className={cx(s.faqTitle, s.rv, inView && s.rvIn)} style={rv({ ty: 20, delay: 90 })}>
          {t('title')}
        </h2>
      </div>
      <div className={cx(s.faqPanel, s.rv, inView && s.rvIn)} style={rv({ ty: 26, delay: 180 })}>
        {ITEMS.map((n) => {
          const isOpen = open === n
          return (
            <div key={n} className={cx(s.faqItem, isOpen && s.faqItemOpen)}>
              <h3 className={s.faqQ}>
                <button
                  type="button"
                  id={`faq-q-${n}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-a-${n}`}
                  className={s.faqBtn}
                  onClick={() => setOpen(isOpen ? null : n)}
                >
                  {t(`q${n}`)}
                  <span className={s.faqPlus} aria-hidden="true" />
                </button>
              </h3>
              <div
                id={`faq-a-${n}`}
                role="region"
                aria-labelledby={`faq-q-${n}`}
                aria-hidden={!isOpen}
                className={s.faqAWrap}
              >
                <div className={s.faqAInner}>
                  <p className={s.faqA}>{t(`a${n}`, { limit: STARTER_MONTHLY_BOOKING_LIMIT, days: TRIAL_DAYS })}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
