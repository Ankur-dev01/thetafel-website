import React from 'react'

type Token =
  | { t: 'h1'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'h3'; text: string }
  | { t: 'hr' }
  | { t: 'blockquote'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'table'; headers: string[]; rows: string[][] }
  | { t: 'p'; text: string }

function tokenize(md: string): Token[] {
  const lines = md.split('\n')
  const tokens: Token[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    if (line.startsWith('# ')) {
      tokens.push({ t: 'h1', text: line.slice(2) })
      i++
      continue
    }
    if (line.startsWith('## ')) {
      tokens.push({ t: 'h2', text: line.slice(3) })
      i++
      continue
    }
    if (line.startsWith('### ')) {
      tokens.push({ t: 'h3', text: line.slice(4) })
      i++
      continue
    }
    if (/^-{3,}$/.test(line.trim())) {
      tokens.push({ t: 'hr' })
      i++
      continue
    }
    if (line.startsWith('> ')) {
      tokens.push({ t: 'blockquote', text: line.slice(2) })
      i++
      continue
    }
    if (line.startsWith('|') || line.startsWith('|-')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i]!.startsWith('|')) {
        tableLines.push(lines[i]!)
        i++
      }
      const parsed = tableLines
        .filter((l) => !/^\|[-| :]+\|$/.test(l.trim()))
        .map((l) =>
          l
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim())
        )
      if (parsed.length > 0) {
        const [headers, ...rows] = parsed as [string[], ...string[][]]
        tokens.push({ t: 'table', headers, rows })
      }
      continue
    }
    if (line.startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i]!.startsWith('- ')) {
        items.push(lines[i]!.slice(2))
        i++
      }
      tokens.push({ t: 'ul', items })
      continue
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\. /.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\. /, ''))
        i++
      }
      tokens.push({ t: 'ol', items })
      continue
    }
    if (line.trim() === '') {
      i++
      continue
    }
    const paraLines: string[] = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]!
      if (
        next.trim() === '' ||
        next.startsWith('# ') ||
        next.startsWith('## ') ||
        next.startsWith('### ') ||
        next.startsWith('- ') ||
        /^\d+\. /.test(next) ||
        next.startsWith('|') ||
        next.startsWith('> ') ||
        /^-{3,}$/.test(next.trim())
      ) break
      paraLines.push(next)
      i++
    }
    tokens.push({ t: 'p', text: paraLines.join(' ') })
  }

  return tokens
}

function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const regex = /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) {
      nodes.push(
        <strong key={m.index} style={{ color: 'var(--earth)', fontWeight: 500 }}>
          {m[2]}
        </strong>
      )
    } else if (m[3]) {
      nodes.push(
        <code
          key={m.index}
          style={{
            fontFamily: 'monospace',
            fontSize: '0.9em',
            background: 'rgba(30,21,8,0.06)',
            borderRadius: '3px',
            padding: '1px 4px',
          }}
        >
          {m[4]}
        </code>
      )
    } else if (m[5]) {
      nodes.push(
        <a
          key={m.index}
          href={m[7]}
          style={{ color: 'var(--amber)', textDecoration: 'underline' }}
        >
          {m[6]}
        </a>
      )
    }
    last = regex.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

const listItemStyle: React.CSSProperties = {
  marginBottom: '8px',
  fontFamily: 'var(--font-jost), -apple-system, BlinkMacSystemFont, sans-serif',
  fontWeight: 400,
  fontSize: '15px',
  lineHeight: 1.75,
  color: 'var(--stone)',
}

export default function LegalDocument({ markdown }: { markdown: string; locale?: 'nl' | 'en' }) {
  const tokens = tokenize(markdown)

  return (
    <div
      className="legal-document"
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: 'clamp(80px, 10vw, 120px) clamp(24px, 5vw, 64px) 80px',
      }}
    >
      {tokens.map((tok, idx) => {
        if (tok.t === 'h1') {
          return (
            <h1
              key={idx}
              style={{
                fontFamily: 'var(--font-raleway), Georgia, serif',
                fontWeight: 900,
                fontSize: '48px',
                letterSpacing: '-0.03em',
                color: 'var(--earth)',
                marginBottom: '8px',
                lineHeight: 1.2,
              }}
            >
              {renderInline(tok.text)}
            </h1>
          )
        }
        if (tok.t === 'h2') {
          return (
            <h2
              key={idx}
              style={{
                fontFamily: 'var(--font-raleway), Georgia, serif',
                fontWeight: 900,
                fontSize: '24px',
                letterSpacing: '-0.02em',
                color: 'var(--earth)',
                marginTop: '40px',
                marginBottom: '12px',
              }}
            >
              {renderInline(tok.text)}
            </h2>
          )
        }
        if (tok.t === 'h3') {
          return (
            <h3
              key={idx}
              style={{
                fontFamily: 'var(--font-raleway), Georgia, serif',
                fontWeight: 900,
                fontSize: '18px',
                color: 'var(--earth)',
                marginTop: '28px',
                marginBottom: '10px',
              }}
            >
              {renderInline(tok.text)}
            </h3>
          )
        }
        if (tok.t === 'hr') {
          return (
            <hr
              key={idx}
              style={{
                border: 'none',
                borderTop: '1px solid rgba(30,21,8,0.1)',
                margin: '32px 0',
              }}
            />
          )
        }
        if (tok.t === 'blockquote') {
          return (
            <blockquote
              key={idx}
              style={{
                borderLeft: '3px solid var(--amber)',
                paddingLeft: '16px',
                margin: '24px 0',
                fontStyle: 'italic',
                color: 'var(--stone)',
                fontSize: '14px',
                lineHeight: 1.75,
              }}
            >
              {renderInline(tok.text)}
            </blockquote>
          )
        }
        if (tok.t === 'ul') {
          return (
            <ul
              key={idx}
              style={{
                paddingLeft: '24px',
                margin: '0 0 16px',
                listStyle: 'disc',
              }}
            >
              {tok.items.map((item, ii) => (
                <li key={ii} style={listItemStyle}>
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          )
        }
        if (tok.t === 'ol') {
          return (
            <ol
              key={idx}
              style={{
                paddingLeft: '24px',
                margin: '0 0 16px',
              }}
            >
              {tok.items.map((item, ii) => (
                <li key={ii} style={listItemStyle}>
                  {renderInline(item)}
                </li>
              ))}
            </ol>
          )
        }
        if (tok.t === 'table') {
          return (
            <div key={idx} style={{ overflowX: 'auto', margin: '16px 0' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  fontSize: '14px',
                  fontFamily: 'var(--font-jost), -apple-system, BlinkMacSystemFont, sans-serif',
                }}
              >
                <thead>
                  <tr>
                    {tok.headers.map((h, hi) => (
                      <th
                        key={hi}
                        style={{
                          padding: '8px 12px',
                          textAlign: 'left',
                          fontWeight: 500,
                          border: '1px solid rgba(30,21,8,0.1)',
                          background: 'var(--warm-surface, #f8f2e6)',
                          color: 'var(--earth)',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tok.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          style={{
                            padding: '8px 12px',
                            border: '1px solid rgba(30,21,8,0.1)',
                            color: 'var(--stone)',
                            verticalAlign: 'top',
                          }}
                        >
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        return (
          <p
            key={idx}
            style={{
              fontFamily: 'var(--font-jost), -apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 400,
              fontSize: '15px',
              lineHeight: 1.75,
              color: 'var(--stone)',
              marginBottom: '16px',
            }}
          >
            {renderInline(tok.text)}
          </p>
        )
      })}

      <style>{`
        @media (max-width: 768px) {
          .legal-document {
            padding: 100px 24px 60px !important;
          }
        }
      `}</style>
    </div>
  )
}
