import type { Metadata } from 'next'
import { Raleway, Jost } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['900'],
  variable: '--font-raleway',
  display: 'swap',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-jost',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'The Tafel — Gratis boekingssysteem voor restaurants | thetafel.nl',
  description:
    'Gratis boekingssysteem voor Nederlandse restaurants. Gasten betalen vooraf, jij krijgt je geld voor de service. Geen commissie. Alle gastgegevens van jou. Probeer het gratis.',
  metadataBase: new URL('https://thetafel.nl'),
  openGraph: {
    title: 'The Tafel — Gratis boekingssysteem voor restaurants',
    description:
      'Gratis boekingssysteem voor Nederlandse restaurants. Geen commissie. Alle gastgegevens van jou.',
    url: 'https://thetafel.nl',
    siteName: 'The Tafel',
    locale: 'nl_NL',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'The Tafel — You deserve better.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Tafel — Gratis boekingssysteem voor restaurants',
    description:
      'Gratis boekingssysteem voor Nederlandse restaurants. Geen commissie. Alle gastgegevens van jou.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://thetafel.nl',
    languages: {
      'nl': 'https://thetafel.nl',
      'en': 'https://thetafel.nl/en',
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl" className={`${raleway.variable} ${jost.variable}`} data-scroll-behavior="smooth">
      <body>{children}</body>
      <Script
        defer
        data-domain="thetafel.nl"
        src="https://plausible.io/js/script.js"
        strategy="afterInteractive"
      />
    </html>
  )
}