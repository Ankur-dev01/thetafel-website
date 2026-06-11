import { readFile } from 'fs/promises'
import path from 'path'
import { CURRENT_DPA_VERSION } from '@/lib/legal/versions'
import LegalDocument from '@/components/legal/LegalDocument'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return {
    title: locale === 'en'
      ? 'Data Processing Agreement — The Tafel'
      : 'Verwerkersovereenkomst — The Tafel',
  }
}

export default async function VerwerkersovereenkomstPage({ params }: { params: Promise<{ locale: string }> }) {
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
  const content = await readFile(filePath, 'utf-8')

  return (
    <div style={{ minHeight: '100vh', background: '#fdfaf5' }}>
      <header
        style={{
          borderBottom: '1px solid rgba(30,21,8,0.1)',
          padding: '20px 24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: '8px',
            fontWeight: 700,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: '#d4820a',
            marginBottom: '2px',
          }}
        >
          THE
        </div>
        <div
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: '22px',
            fontWeight: 900,
            color: '#1e1508',
            letterSpacing: '0.05em',
          }}
        >
          TAFEL
        </div>
      </header>
      <main>
        <LegalDocument content={content} />
      </main>
    </div>
  )
}
