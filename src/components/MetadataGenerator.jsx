import { useState } from 'react'
import { Copy, Check, Loader2 } from 'lucide-react'

// Generates YouTube/Shorts titles, descriptions, and hashtags from the
// finished script, and lets the user copy any piece with one click.
// Session is required because /api/generate-metadata is an authenticated,
// rate-limited route (see api/_lib/auth.js and api/_lib/rateLimit.js).
export default function MetadataGenerator({ session, script, mood }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('titles') // 'titles' | 'description' | 'hashtags'
  const [titleTab, setTitleTab] = useState('youtube') // 'youtube' | 'shorts'
  const [copiedKey, setCopiedKey] = useState('')

  const generate = async () => {
    if (!script) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/generate-metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ script, mood }),
      })

      const result = await res.json()

      if (!res.ok) {
        throw new Error(result.error || `Server returned ${res.status}`)
      }

      setData(result)
    } catch (err) {
      setError(err.message || 'Failed to generate metadata.')
    } finally {
      setLoading(false)
    }
  }

  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(''), 1500)
    } catch {
      setError('Could not copy — your browser may be blocking clipboard access.')
    }
  }

  const styles = {
    section: { marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #2E2A3F' },
    label: { fontSize: '12px', color: '#9691A8', marginBottom: '10px' },
    genBtn: {
      padding: '10px 16px',
      background: 'linear-gradient(135deg, #FF5D8F, #FF9F45)',
      color: '#14121C',
      border: 'none',
      borderRadius: '8px',
      fontSize: '13px',
      fontWeight: 600,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    },
    tabRow: { display: 'flex', gap: '8px', marginTop: '14px', marginBottom: '12px' },
    tabBtn: (active) => ({
      padding: '6px 12px',
      borderRadius: '6px',
      border: active ? '1px solid #FF9F45' : '1px solid #2E2A3F',
      background: active ? '#2E2A3F' : 'transparent',
      color: active ? '#F5F3FA' : '#9691A8',
      fontSize: '12px',
      cursor: 'pointer',
    }),
    card: {
      background: '#14121C',
      border: '1px solid #2E2A3F',
      borderRadius: '8px',
      padding: '10px 12px',
      marginBottom: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: '10px',
    },
    itemText: { fontSize: '13px', color: '#F5F3FA', lineHeight: '1.4', flex: 1 },
    scoreRow: { display: 'flex', gap: '10px', marginTop: '6px' },
    score: { fontSize: '10px', color: '#6B6780' },
    copyBtn: (copied) => ({
      flexShrink: 0,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: copied ? '#C6F135' : '#6B6780',
      padding: '2px',
    }),
    hashtagWrap: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    hashtag: {
      fontSize: '12px',
      color: '#F5F3FA',
      background: '#14121C',
      border: '1px solid #2E2A3F',
      borderRadius: '999px',
      padding: '5px 10px',
      cursor: 'pointer',
    },
    subheading: { fontSize: '11px', color: '#6B6780', textTransform: 'uppercase', margin: '12px 0 6px' },
    error: { fontSize: '12px', color: '#FF5D8F', marginTop: '8px' },
  }

  const CopyButton = ({ itemKey, text }) => (
    <button style={styles.copyBtn(copiedKey === itemKey)} onClick={() => copy(itemKey, text)} title="Copy">
      {copiedKey === itemKey ? <Check size={14} /> : <Copy size={14} />}
    </button>
  )

  return (
    <div style={styles.section}>
      <div style={styles.label}>Titles, description &amp; hashtags:</div>

      {!data && (
        <button style={styles.genBtn} onClick={generate} disabled={loading || !script}>
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {loading ? 'Generating…' : 'Generate titles, description & hashtags'}
        </button>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {data && (
        <>
          <div style={styles.tabRow}>
            <button style={styles.tabBtn(tab === 'titles')} onClick={() => setTab('titles')}>Titles</button>
            <button style={styles.tabBtn(tab === 'description')} onClick={() => setTab('description')}>Description</button>
            <button style={styles.tabBtn(tab === 'hashtags')} onClick={() => setTab('hashtags')}>Hashtags</button>
            <button style={{ ...styles.tabBtn(false), marginLeft: 'auto' }} onClick={generate} disabled={loading}>
              {loading ? 'Regenerating…' : 'Regenerate'}
            </button>
          </div>

          {tab === 'titles' && (
            <div>
              <div style={styles.tabRow}>
                <button style={styles.tabBtn(titleTab === 'youtube')} onClick={() => setTitleTab('youtube')}>YouTube (10)</button>
                <button style={styles.tabBtn(titleTab === 'shorts')} onClick={() => setTitleTab('shorts')}>Shorts (10)</button>
              </div>
              {(data.titles?.[titleTab] || []).map((t, i) => (
                <div key={i} style={styles.card}>
                  <div>
                    <div style={styles.itemText}>{t.text}</div>
                    <div style={styles.scoreRow}>
                      <span style={styles.score}>CTR {t.ctrScore}</span>
                      <span style={styles.score}>SEO {t.seoScore}</span>
                    </div>
                  </div>
                  <CopyButton itemKey={`title-${titleTab}-${i}`} text={t.text} />
                </div>
              ))}
            </div>
          )}

          {tab === 'description' && (
            <div>
              {['seo', 'short', 'long', 'cta'].map((k) => (
                <div key={k}>
                  <div style={styles.subheading}>{k === 'cta' ? 'Call to action' : `${k} description`}</div>
                  <div style={styles.card}>
                    <div style={styles.itemText}>{data.description?.[k]}</div>
                    <CopyButton itemKey={`desc-${k}`} text={data.description?.[k] || ''} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'hashtags' && (
            <div>
              {['trending', 'niche', 'broad'].map((cat) => (
                <div key={cat}>
                  <div style={styles.subheading}>{cat}</div>
                  <div style={styles.hashtagWrap}>
                    {(data.hashtags?.[cat] || []).map((h, i) => (
                      <span key={i} style={styles.hashtag} onClick={() => copy(`hash-${cat}-${i}`, h)}>
                        {copiedKey === `hash-${cat}-${i}` ? '✓ copied' : h}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {Object.entries(data.hashtags?.platformSpecific || {}).map(([platform, tags]) => (
                <div key={platform}>
                  <div style={styles.subheading}>{platform}</div>
                  <div style={styles.hashtagWrap}>
                    {tags.map((h, i) => (
                      <span key={i} style={styles.hashtag} onClick={() => copy(`hash-${platform}-${i}`, h)}>
                        {copiedKey === `hash-${platform}-${i}` ? '✓ copied' : h}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '10px' }}>
                <CopyButton
                  itemKey="hash-all"
                  text={[
                    ...(data.hashtags?.trending || []),
                    ...(data.hashtags?.niche || []),
                    ...(data.hashtags?.broad || []),
                  ].join(' ')}
                />
                <span style={{ fontSize: '11px', color: '#6B6780', marginLeft: '4px' }}>Copy all trending + niche + broad</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
      }
