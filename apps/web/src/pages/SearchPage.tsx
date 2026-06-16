import { useState, useEffect, useRef } from 'react'
import { Search, MessageSquare, BookMarked, Zap, Clock, ChevronRight, Loader2 } from 'lucide-react'
import { ipc, type ConversationResult } from '../lib/ipc'
import type { KnowledgeEntry } from '../lib/ipc'

type AgentSkill = { id: string; title: string; description: string; category: string; triggers: string[] }

interface SearchResults {
  knowledge: KnowledgeEntry[]
  skills: AgentSkill[]
  conversations: ConversationResult[]
}

const AGENT_EMOJI: Record<string, string> = {
  friday: '⚡', tester: '🧪', reviewer: '👁', devops: '🚀',
  shuri: '🎨', pepper: '📣', vision: '📊', requis: '📋',
  fury: '🔍', jarvis: '🧠', user: '🧑',
}

function highlight(text: string) {
  const parts = text.split(/(\[\[.*?\]\])/g)
  return parts.map((p, i) =>
    p.startsWith('[[') && p.endsWith(']]')
      ? <mark key={i} style={{ background: 'rgba(217,164,65,0.25)', color: '#F2C879', borderRadius: 2 }}>{p.slice(2, -2)}</mark>
      : <span key={i}>{p}</span>
  )
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch { return iso }
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!query.trim()) { setResults(null); setError(null); return }
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await ipc.search.global(query)
        setResults(r)
      } catch (e) {
        setError((e as Error).message)
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query])

  const total = results
    ? results.conversations.length + results.knowledge.length + results.skills.length
    : 0

  return (
    <div className="h-full flex flex-col" style={{ background: '#080612' }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="px-8 pt-8 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3 mb-5">
          <Search size={20} style={{ color: '#D9A441' }} />
          <h1 className="text-lg font-semibold" style={{ color: '#F2C879' }}>Busca Global</h1>
        </div>

        {/* Search input */}
        <div className="relative max-w-2xl">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'rgba(248,248,252,0.3)' }} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar em conversas, conhecimento e skills…"
            className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(217,164,65,0.15)',
              color: 'rgba(248,248,252,0.9)',
              caretColor: '#D9A441',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(217,164,65,0.4)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'rgba(217,164,65,0.15)' }}
          />
          {loading && (
            <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" style={{ color: '#D9A441' }} />
          )}
        </div>

        {results && !loading && (
          <p className="mt-2 text-xs" style={{ color: 'rgba(248,248,252,0.35)' }}>
            {total === 0 ? 'Nenhum resultado encontrado.' : `${total} resultado${total !== 1 ? 's' : ''} para "${query}"`}
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">

        {/* Empty state */}
        {!query.trim() && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Search size={36} style={{ color: 'rgba(217,164,65,0.2)' }} />
            <p className="text-sm" style={{ color: 'rgba(248,248,252,0.3)' }}>
              Digite para pesquisar em todo o sistema
            </p>
            <div className="flex gap-6 text-xs mt-2" style={{ color: 'rgba(248,248,252,0.2)' }}>
              <span className="flex items-center gap-1.5"><MessageSquare size={11} /> Conversas Squad</span>
              <span className="flex items-center gap-1.5"><BookMarked size={11} /> Conhecimento</span>
              <span className="flex items-center gap-1.5"><Zap size={11} /> Skills</span>
            </div>
          </div>
        )}

        {/* Conversations */}
        {results && results.conversations.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare size={14} style={{ color: '#B78DFF' }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#B78DFF' }}>
                Conversas ({results.conversations.length})
              </h2>
            </div>
            <div className="space-y-2">
              {results.conversations.map(c => (
                <div
                  key={c.id}
                  className="rounded-lg px-4 py-3 transition-all"
                  style={{ background: 'rgba(183,141,255,0.04)', border: '1px solid rgba(183,141,255,0.1)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(183,141,255,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(183,141,255,0.04)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-base shrink-0 mt-0.5">{AGENT_EMOJI[c.agentName] ?? '💬'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium" style={{ color: '#B78DFF' }}>@{c.agentName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(248,248,252,0.4)' }}>
                            {c.role}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: 'rgba(248,248,252,0.7)' }}>
                          {highlight(c.snippet)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-1">
                      <Clock size={10} style={{ color: 'rgba(248,248,252,0.25)' }} />
                      <span className="text-[10px]" style={{ color: 'rgba(248,248,252,0.25)' }}>
                        {formatDate(c.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 ml-7">
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(248,248,252,0.2)' }}>
                      sessão: {c.sessionId.slice(0, 8)}…
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Knowledge */}
        {results && results.knowledge.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <BookMarked size={14} style={{ color: '#D9A441' }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#D9A441' }}>
                Conhecimento ({results.knowledge.length})
              </h2>
            </div>
            <div className="space-y-2">
              {results.knowledge.map(k => (
                <div
                  key={k.id}
                  className="rounded-lg px-4 py-3 transition-all"
                  style={{ background: 'rgba(217,164,65,0.04)', border: '1px solid rgba(217,164,65,0.1)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(217,164,65,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(217,164,65,0.04)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium" style={{ color: '#F2C879' }}>{k.title}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(217,164,65,0.12)', color: '#D9A441' }}>
                          {k.category}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'rgba(248,248,252,0.55)' }}>
                        {k.content.slice(0, 200)}
                      </p>
                      {k.tags && (
                        <p className="text-[10px] mt-1" style={{ color: 'rgba(248,248,252,0.25)' }}>
                          #{k.tags.split(',').map(t => t.trim()).join(' #')}
                        </p>
                      )}
                    </div>
                    <ChevronRight size={14} style={{ color: 'rgba(248,248,252,0.2)', flexShrink: 0 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {results && results.skills.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={14} style={{ color: '#60D9B0' }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#60D9B0' }}>
                Skills ({results.skills.length})
              </h2>
            </div>
            <div className="space-y-2">
              {results.skills.map((s: AgentSkill) => (
                <div
                  key={s.id}
                  className="rounded-lg px-4 py-3 transition-all"
                  style={{ background: 'rgba(96,217,176,0.04)', border: '1px solid rgba(96,217,176,0.1)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,217,176,0.08)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(96,217,176,0.04)' }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" style={{ color: '#60D9B0' }}>{s.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(96,217,176,0.1)', color: '#60D9B0' }}>
                      {s.category}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(248,248,252,0.55)' }}>
                    {s.description}
                  </p>
                  {s.triggers && (
                    <p className="text-[10px] mt-1" style={{ color: 'rgba(248,248,252,0.25)' }}>
                      gatilhos: {s.triggers.slice(0, 3).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No results */}
        {results && total === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search size={32} style={{ color: 'rgba(248,248,252,0.1)' }} />
            <p className="text-sm" style={{ color: 'rgba(248,248,252,0.3)' }}>
              Nenhum resultado para <span style={{ color: '#F2C879' }}>"{query}"</span>
            </p>
            <p className="text-xs" style={{ color: 'rgba(248,248,252,0.2)' }}>
              Tente termos diferentes ou mais curtos
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
