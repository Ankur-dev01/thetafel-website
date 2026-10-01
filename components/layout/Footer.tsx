'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { Link as LocaleLink } from '@/i18n/routing'
import { openCookieSettings } from '@/lib/consent'
import { useModal } from '@/components/ui/ModalContext'
import { InstagramIcon, LinkedInIcon, XIcon } from '@/components/home/svgs'
import { useInView } from '@/components/home/motion'
import s from './Footer.module.css'

const EMAIL = 'hello@thetafel.nl'
const WHATSAPP_HREF = 'https://wa.me/31634339839'

const pos = (x: number, y: number) => ({ '--x': x, '--y': y }) as CSSProperties

export default function Footer() {
  const t = useTranslations('home.footer')
  const legacy = useTranslations('footer')
  const modal = useTranslations('modal')
  const locale = useLocale()
  const { openModal } = useModal()

  const base = locale === 'nl' ? '' : '/en'

  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [revealRef, revealed] = useInView<HTMLDivElement>({ threshold: 0.1 })

  // No newsletter backend exists: the form opens a pre-filled email to the team.
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!agreed) return
    const body = `${firstName}\n${email}`
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(t('newsletterSubject'))}&body=${encodeURIComponent(body)}`
  }

  return (
    <footer className={s.footer}>
      <div className={s.main}>
        <Image src="/images/home/footer-ring.jpg" alt="" fill sizes="100vw" className={s.ring} />
        <div ref={revealRef} className={`${s.stage} ${s.reveal} ${revealed ? s.revealIn : ''}`}>
          <form className={s.newsletter} onSubmit={handleSubmit}>
            <p className={`${s.abs} ${s.title}`} style={pos(63, 87.3)}>
              {t('newsletterTitle')}
            </p>
            <div className={`${s.abs} ${s.field}`} style={pos(62, 150.5)}>
              <label htmlFor="footer-first-name" className={s.srOnly}>
                {t('firstName')}
              </label>
              <input
                id="footer-first-name"
                name="newsletterFirstName"
                autoComplete="given-name"
                placeholder={t('firstName')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={`${s.input} ${s.inputFirst}`}
              />
              <label htmlFor="footer-email" className={s.srOnly}>
                {modal('labelEmail')}
              </label>
              <input
                id="footer-email"
                name="newsletterEmail"
                type="email"
                required
                autoComplete="email"
                placeholder={t('email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={s.input}
              />
            </div>
            <label className={`${s.abs} ${s.agree}`} style={pos(62, 232)}>
              <input
                type="checkbox"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className={s.checkbox}
              />
              <span className={s.check} aria-hidden="true" />
              <span>
                {t('agree')}{' '}
                <Link href={`${base}/privacybeleid`} className={s.agreeLink}>
                  {t('privacyPolicy')}
                </Link>
              </span>
            </label>
            <button type="submit" className={`${s.abs} ${s.submit}`} style={pos(361.6, 227.3)}>
              {t('getUpdates')}
            </button>
          </form>

          <nav className={s.cols} aria-label="Footer">
            <div className={`${s.abs} ${s.col}`} style={pos(808, 86.1)}>
              <p className={s.colTitle}>{t('colTafel')}</p>
              <ul className={s.list}>
                <li>
                  <a href={`mailto:${EMAIL}`}>{t('contact')}</a>
                </li>
                <li>
                  <Link href={`${base}/privacybeleid`}>{t('gdpr')}</Link>
                </li>
                <li>
                  <Link href={`${base}/algemene-voorwaarden`}>{t('terms')}</Link>
                </li>
              </ul>
            </div>
            <div className={`${s.abs} ${s.col}`} style={pos(1021, 86.1)}>
              <p className={s.colTitle}>{t('colProduct')}</p>
              <ul className={s.list}>
                <li>
                  <LocaleLink href={{ pathname: '/', hash: 'products' }}>{t('reservations')}</LocaleLink>
                </li>
                <li>
                  <LocaleLink href={{ pathname: '/', hash: 'products' }}>{t('qrOrdering')}</LocaleLink>
                </li>
                <li>
                  <LocaleLink href={{ pathname: '/', hash: 'products' }}>{t('takeaway')}</LocaleLink>
                </li>
              </ul>
            </div>
            <div className={`${s.abs} ${s.col}`} style={pos(1246, 86.1)}>
              <p className={s.colTitle}>{t('colCompany')}</p>
              <ul className={s.list}>
                <li>
                  <LocaleLink href={{ pathname: '/', hash: 'ownership' }}>{t('about')}</LocaleLink>
                </li>
                <li>
                  <LocaleLink href={{ pathname: '/', hash: 'pricing' }}>{t('pricing')}</LocaleLink>
                </li>
                <li>
                  <LocaleLink href={{ pathname: '/', hash: 'faq' }}>{t('faqs')}</LocaleLink>
                </li>
              </ul>
            </div>
          </nav>

          <div className={`${s.abs} ${s.actions}`} style={pos(807.6, 349.4)}>
            <Link href={`${base}/login`} className={`${s.pill} ${s.login}`}>
              {t('login')}
            </Link>
            <button type="button" onClick={openModal} className={`${s.pill} ${s.bookCall}`}>
              {t('bookCall')}
            </button>
            <span className={`${s.social} ${s.socialFirst} ${s.round}`} aria-hidden="true">
              <LinkedInIcon className={s.socialIcon} />
            </span>
            <span className={s.social} aria-hidden="true">
              <InstagramIcon className={s.socialIcon} />
            </span>
            <span className={`${s.social} ${s.round}`} aria-hidden="true">
              <XIcon className={s.socialIcon} />
            </span>
          </div>

          <div className={s.wordmark} aria-hidden="true" />
        </div>
      </div>

      <div className={s.bar}>
        <div className={s.tags}>
          <Link href={`${base}/verwerkersovereenkomst`} className={s.tag}>
            {t('dpa')}
          </Link>
          <Link href={`${base}/algemene-voorwaarden`} className={s.tag}>
            {t('tcs')}
          </Link>
          <Link href={`${base}/privacybeleid`} className={s.tag}>
            {t('privacy')}
          </Link>
          <button type="button" onClick={openCookieSettings} className={s.tag}>
            {t('cookies')}
          </button>
        </div>
        <p className={s.copy}>{t('copyright')}</p>
        <div className={s.meta}>
          <span>{legacy('kvk')}</span>
          <span>{legacy('btw')}</span>
          <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer" className={`${s.tag} ${s.tagOrange}`}>
            {t('whatsapp')}
          </a>
        </div>
      </div>
    </footer>
  )
}
