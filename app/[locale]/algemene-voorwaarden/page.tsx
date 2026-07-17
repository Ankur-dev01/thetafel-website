import { readFile } from 'fs/promises'
import path from 'path'
import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'
import LegalDocument from '@/components/legal/LegalDocument'
import { CURRENT_TERMS_VERSION } from '@/lib/legal/versions'


type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'General Terms and Conditions — The Tafel' : 'Algemene voorwaarden — The Tafel',
  }
}

export default async function AlgemeneVoorwaardenPage({ params }: Props) {
  const { locale } = await params
  const lang: 'nl' | 'en' = locale === 'en' ? 'en' : 'nl'
  const filePath = path.join(
    process.cwd(),
    'lib',
    'legal',
    'terms',
    `v${CURRENT_TERMS_VERSION}`,
    `terms_${lang}.md`
  )
  const markdown = await readFile(filePath, 'utf-8')

  return (
    <>
      <Nav solid />
      <main style={{ backgroundColor: 'var(--cream)', minHeight: '100vh' }}>
        <LegalDocument markdown={markdown} locale={lang} />
      </main>
      <Footer />
    </>
  )
}
