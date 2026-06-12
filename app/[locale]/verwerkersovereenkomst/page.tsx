import { readFile } from 'fs/promises'
import path from 'path'
import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'
import LegalDocument from '@/components/legal/LegalDocument'
import { CURRENT_DPA_VERSION } from '@/lib/legal/versions'

export const dynamic = 'force-static'
export const revalidate = 3600

type Props = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  return {
    title: locale === 'en' ? 'Data Processing Agreement — The Tafel' : 'Verwerkersovereenkomst — The Tafel',
  }
}

export default async function VerwerkersovereenkomstPage({ params }: Props) {
  const { locale } = await params
  const lang: 'nl' | 'en' = locale === 'en' ? 'en' : 'nl'
  const filePath = path.join(
    process.cwd(),
    'lib',
    'legal',
    'dpa',
    `v${CURRENT_DPA_VERSION}`,
    `dpa_${lang}.md`
  )
  const markdown = await readFile(filePath, 'utf-8')

  return (
    <>
      <Nav />
      <main style={{ backgroundColor: 'var(--cream)', minHeight: '100vh' }}>
        <LegalDocument markdown={markdown} locale={lang} />
      </main>
      <Footer />
    </>
  )
}
