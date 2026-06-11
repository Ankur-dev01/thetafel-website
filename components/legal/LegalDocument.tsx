import React from 'react'

type Token =
  | { t: 'h1'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'hr' }
  | { t: 'blockquote'; text: string }
  | { t: 'ul'; items: string[] }
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
        next.startsWith('- ') ||
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
  const regex = /(\*\*([^*]+)\*\*)|(`([^`]+)`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) {
      nodes.push(
        <strong key={m.index} style={{ fontWeight: 700 }}>
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
    }
    last = regex.lastIndex
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function LegalDocument({ content }: { content: string }) {
  const tokens = tokenize(content)

  return (
    <div
      style={{
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        lineHeight: '1.75',
        color: '#1e1508',
        maxWidth: '720px',
        margin: '0 auto',
        padding: '48px 24px 80px',
      }}
    >
      {tokens.map((tok, idx) => {
        if (tok.t === 'h1') {
          return (
            <h1
              key={idx}
              style={{
                fontFamily: 'Georgia, serif',
                fontWeight: 900,
                fontSize: '28px',
                color: '#1e1508',
                margin: '0 0 8px',
                lineHeight: '1.3',
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
                fontFamily: 'Georgia, serif',
                fontWeight: 700,
                fontSize: '18px',
                color: '#1e1508',
                margin: '32px 0 8px',
              }}
            >
              {renderInline(tok.text)}
            </h2>
          )
        }
        if (tok.t === 'hr') {
          return (
            <hr
              key={idx}
              style={{
                border: 'none',
                borderTop: '1px solid rgba(30,21,8,0.15)',
                margin: '32px 0',
              }}
            />
          )
        }
        if (tok.t === 'blockquote') {
          return (
            <div
              key={idx}
              style={{
                borderLeft: '3px solid #d4820a',
                paddingLeft: '16px',
                margin: '16px 0',
                color: '#9c8b6a',
                fontStyle: 'italic',
                fontSize: '14px',
              }}
            >
              {renderInline(tok.text)}
            </div>
          )
        }
        if (tok.t === 'ul') {
          return (
            <ul
              key={idx}
              style={{
                paddingLeft: '24px',
                margin: '8px 0 16px',
                listStyle: 'disc',
              }}
            >
              {tok.items.map((item, ii) => (
                <li key={ii} style={{ marginBottom: '6px' }}>
                  {renderInline(item)}
                </li>
              ))}
            </ul>
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
                          fontWeight: 700,
                          borderBottom: '2px solid rgba(30,21,8,0.15)',
                          color: '#1e1508',
                          whiteSpace: 'nowrap',
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
                            borderBottom: '1px solid rgba(30,21,8,0.08)',
                            color: ci === 0 ? '#1e1508' : '#9c8b6a',
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
          <p key={idx} style={{ margin: '0 0 12px' }}>
            {renderInline(tok.text)}
          </p>
        )
      })}
    </div>
  )
}
