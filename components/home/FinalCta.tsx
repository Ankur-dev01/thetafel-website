'use client'

import { useTranslations } from 'next-intl'
import { useModal } from '@/components/ui/ModalContext'
import { useInView, rv } from './motion'
import s from './home.module.css'
import { box, cx } from './layout'

export default function FinalCta() {
  const t = useTranslations('home.finalCta')
  const { openModal } = useModal()
  const [ref, inView] = useInView<HTMLDivElement>()

  return (
    <section id="final-cta" className={s.finalCta}>
      <div ref={ref} className={s.stage}>
        <h2
          className={cx(s.abs, s.t, s.ctaTitle, s.rv, inView && s.rvIn)}
          style={box({ x: 219.5, y: 159.3, w: 1000, fs: 64 }, rv({ ty: 26 }))}
        >
          {t('title1')} <span className={s.accentCta}>{t('title2')}</span>
        </h2>
        <p
          className={cx(s.abs, s.t, s.ctaSub, s.rv, inView && s.rvIn)}
          style={box({ x: 219.5, y: 240.9, w: 1000, fs: 30.38 }, rv({ ty: 18, delay: 100 }))}
        >
          {t('sub')}
        </p>
        <button
          type="button"
          onClick={openModal}
          className={cx(s.abs, s.btn, s.btnOrange, s.ctaBtn, s.rv, inView && s.rvIn)}
          style={box({ x: 662.8, y: 313, w: 114.5, h: 41 }, rv({ ty: 16, sc: 0.94, delay: 200 }))}
        >
          {t('cta')}
        </button>
      </div>
    </section>
  )
}
