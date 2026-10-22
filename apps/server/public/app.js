'use strict'
// Zeus Mobile — acompanhar e decidir o trabalho do Hermes pelo celular (Passo 3 do Zeus Mobile).
// Fala com o serviço zeus-hermes pela mesma API do Zeus do PC. O token fica só neste aparelho
// (localStorage); chega pelo link de pareamento (#t=...) ou colado à mão.
// Tudo que vem do servidor entra na página como texto (textContent), nunca como HTML.

const $main = document.getElementById('main')
const $title = document.getElementById('title')
const $back = document.getElementById('back')
const $conn = document.getElementById('conn')

const TOKEN_KEY = 'zeus_hermes_token'
let token = ''
try { token = localStorage.getItem(TOKEN_KEY) || '' } catch { /* sem armazenamento */ }
const fromLink = location.hash.match(/(?:^#|&)t=([a-f0-9]{64})\b/)
if (fromLink) {
  token = fromLink[1]
  try { localStorage.setItem(TOKEN_KEY, token) } catch { /* segue só nesta aba */ }
  history.replaceState(null, '', location.pathname)
}

// Aberto pela notificação: #p=<projeto> (o service worker monta esse endereço).
let pendingProjectId = (location.hash.match(/(?:^#|&)p=([A-Za-z0-9_-]{1,64})/) || [])[1] || ''
if (pendingProjectId) history.replaceState(null, '', location.pathname)

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
  // App já aberto e o usuário tocou numa notificação: o service worker avisa para qual projeto ir.
  navigator.serviceWorker.addEventListener('message', ev => {
    if (ev.data?.type !== 'open') return
    const m = String(ev.data.url || '').match(/#p=([A-Za-z0-9_-]{1,64})/)
    if (m) { pendingProjectId = m[1]; showProjects() }
  })
}

// ── Notificações (Web Push) ─────────────────────────────────────────────────
function b64ToBytes(b64) {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(s), c => c.charCodeAt(0))
}

function notificationsCard() {
  const card = h('div', { class: 'card' }, h('h2', {}, 'Notificações'))
  const msg = h('p', { class: 'muted' })
  const row = h('div', { class: 'row' })
  card.append(msg, row)
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    msg.textContent = 'Este navegador não recebe notificações. Instale o app pelo Chrome (⋮ → Instalar app).'
    return card
  }
  const render = async () => {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    row.replaceChildren()
    if (Notification.permission === 'denied') {
      msg.textContent = 'Notificações bloqueadas neste celular. Libere em Configurações do Android → Apps → Chrome (ou Zeus) → Notificações.'
      return
    }
    if (sub) {
      msg.textContent = 'Ativas: o Hermes avisa quando precisar de você (aprovação, decisão, bloqueio, loop parado, entrega).'
      row.append(
        h('button', { class: 'btn grow', onclick: () => run(async () => {
          const r = await api('POST', '/api/push/test')
          msg.textContent = r.sent ? 'Teste enviado — deve chegar em alguns segundos.' : 'Nenhum aparelho recebeu o teste. Desative e ative de novo.'
        }) }, 'Enviar teste'),
        h('button', { class: 'btn ghost', onclick: () => run(async () => {
          await api('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
          await sub.unsubscribe()
          await render()
        }) }, 'Desativar'),
      )
    } else {
      msg.textContent = 'Receba um aviso quando o Hermes parar esperando você — mesmo com o app fechado.'
      row.append(h('button', { class: 'btn full', onclick: () => run(async () => {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') { await render(); return }
        const { publicKey } = await api('GET', '/api/push/key')
        const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) })
        const j = s.toJSON()
        await api('POST', '/api/push/subscribe', { endpoint: j.endpoint, keys: j.keys, label: (navigator.userAgentData && navigator.userAgentData.platform) || 'celular' })
        await render()
      }) }, 'Ativar notificações'))
    }
  }
  const run = async fn => {
    for (const b of row.querySelectorAll('button')) b.disabled = true
    try { await fn() } catch (e) { msg.textContent = `Erro: ${e.message}` }
    for (const b of row.querySelectorAll('button')) b.disabled = false
  }
  render().catch(e => { msg.textContent = `Erro: ${e.message}` })
  return card
}

// ── utilidades ──────────────────────────────────────────────────────────────
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k === 'class') el.className = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c))
  return el
}

class AuthError extends Error {}

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => null)
  if (res.status === 401) throw new AuthError('Token inválido')
  if (!res.ok) throw new Error((data && data.error) || `Erro ${res.status}`)
  return data
}

const STATUS = {
  TODO: ['Pendente', ''], IN_PROGRESS: ['Em andamento', 'b-run'], BLOCKED: ['Bloqueada', 'b-err'], DONE: ['Concluída', 'b-ok'],
}
const MODE = {
  idle: 'Parado', message: 'Respondendo', planning: 'Gerando plano', loop: 'Trabalhando nas tarefas',
  single: 'Executando 1 tarefa', decision: 'Aplicando decisão', approval: 'Aplicando aprovação', review: 'Revisando a entrega',
}
const AUTONOMY = { manual: 'Assistido', semi: 'Semi-autônomo', autonomous: 'Autônomo' }

function setConn(state) { $conn.className = `dot ${state === true ? 'on' : state === false ? 'off' : ''}` }

let stopStream = null
function leaveProject() { if (stopStream) { stopStream(); stopStream = null } }

// ── telas ───────────────────────────────────────────────────────────────────
function showLogin(msg) {
  leaveProject()
  $title.textContent = 'Zeus Mobile'
  $back.hidden = true
  const input = h('input', { class: 'txt', type: 'password', placeholder: 'Cole o token do Zeus', autocomplete: 'off' })
  const err = h('p', { class: 'err-msg' }, msg || '')
  $main.replaceChildren(
    h('div', { class: 'card' },
      h('h2', {}, 'Entrar'),
      h('p', { class: 'muted' }, 'Abra pelo link de pareamento que o Zeus gera no PC, ou cole o token. Ele fica salvo só neste celular.'),
      input, err,
      h('button', {
        class: 'btn full', onclick: async () => {
          token = input.value.trim()
          try { localStorage.setItem(TOKEN_KEY, token) } catch { /* ignorar */ }
          showProjects()
        },
      }, 'Entrar'),
    ),
  )
}

async function showProjects() {
  leaveProject()
  $title.textContent = 'Projetos'
  $back.hidden = true
  if (!token) return showLogin()
  $main.replaceChildren(h('p', { class: 'muted' }, 'Carregando…'))
  try {
    const projects = await api('GET', '/api/projects')
    setConn(true)
    if (projects.length === 0) {
      $main.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Nenhum projeto no serviço. Projetos entram aqui quando migrados no Zeus do PC.')))
      return
    }
    // Aberto pela notificação (#p=<projeto>): vai direto para ele.
    if (pendingProjectId) {
      const target = projects.find(p => p.id === pendingProjectId)
      pendingProjectId = ''
      if (target) return showProject(target)
    }
    $main.replaceChildren(...projects.map(p => h('button', { class: 'list-item', onclick: () => showProject(p) },
      h('div', { class: 'grow' }, h('div', {}, p.name), h('div', { class: 'muted' }, `${p.vpsName} · ${p.remotePath}`)),
      h('span', { class: 'muted' }, '›'))), notificationsCard())
  } catch (e) {
    setConn(false)
    if (e instanceof AuthError) return showLogin('Token inválido — gere um novo link de pareamento no Zeus.')
    $main.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'err-msg' }, `Sem conexão com o serviço: ${e.message}`),
      h('p', { class: 'muted' }, 'O Tailscale está ligado neste celular?'),
      h('button', { class: 'btn ghost full', onclick: showProjects }, 'Tentar de novo')))
  }
}

async function showProject(p) {
  leaveProject()
  $title.textContent = p.name
  $back.hidden = false
  $back.onclick = showProjects

  const view = { state: null, tasks: [], agent: null, output: '', outputEnd: 0, activity: [], busyAction: false, error: '' }
  const $status = h('div', { class: 'card' })
  const $actions = h('div', { class: 'card' })
  const $alerts = h('div', { style: 'display:flex;flex-direction:column;gap:12px' })
  const $tasks = h('div', { class: 'card' })
  const $live = h('pre', { class: 'out' })
  const $activity = h('div')
  $main.replaceChildren($status, $alerts, $actions,
    h('div', { class: 'card' }, h('h2', {}, 'Ao vivo'), $live, h('details', {}, h('summary', {}, 'Atividade (ferramentas)'), $activity)),
    $tasks)

  const act = async (fn, confirmMsg) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    view.busyAction = true; view.error = ''; render()
    try { await fn() } catch (e) { view.error = e.message }
    view.busyAction = false; render()
  }
  const base = `/api/projects/${encodeURIComponent(p.id)}`

  function render() {
    const s = view.state
    if (!s) return
    const todo = view.tasks.filter(t => t.status === 'TODO').length
    const done = view.tasks.filter(t => t.status === 'DONE').length
    const blocked = view.tasks.filter(t => t.status === 'BLOCKED').length
    const running = s.mode !== 'idle'
    const interrupted = view.agent && view.agent.status === 'error' && /interromp|interrupt/i.test(view.agent.lastError || '')

    $status.replaceChildren(
      h('div', { class: 'row' },
        h('span', { class: `badge ${running ? 'b-run' : interrupted ? 'b-warn' : ''}` }, running ? MODE[s.mode] || s.mode : interrupted ? 'Interrompida' : 'Parado'),
        view.agent && h('span', { class: `badge ${view.agent.hermesStatus === 'running' ? 'b-ok' : 'b-err'}` }, `Hermes ${view.agent.hermesStatus === 'running' ? 'no ar' : view.agent.hermesStatus}`),
        view.agent && h('span', { class: 'badge' }, AUTONOMY[view.agent.autonomyLevel] || view.agent.autonomyLevel),
      ),
      h('p', { class: 'muted', style: 'margin:8px 0 0' }, `${done} concluída(s) · ${todo} pendente(s)${blocked ? ` · ${blocked} bloqueada(s)` : ''} de ${view.tasks.length}`),
      s.stopRequested && running ? h('p', { class: 'muted' }, 'Parando depois da tarefa atual…') : null,
      view.orphan ? h('p', { class: 'muted' }, 'Há uma execução do Hermes rodando na VPS iniciada fora do serviço.') : null,
    )

    // Pedidos que precisam de você: comandos perigosos, decisão, tarefa de risco alto.
    const alerts = []
    for (const a of s.approvals) {
      alerts.push(h('div', { class: 'card alert' },
        h('h2', {}, 'Hermes quer executar'),
        h('pre', { class: 'cmd' }, a.command || '(comando não informado)'),
        h('p', { class: 'muted' }, `Motivo do bloqueio: ${a.reason}${a.parallel ? ' · tarefa paralela' : ''}`),
        running ? h('p', { class: 'muted' }, 'Aguarde a execução atual terminar para decidir.') : null,
        h('div', { class: 'row' },
          a.executable ? h('button', { class: 'btn danger grow', disabled: running || view.busyAction,
            onclick: () => act(() => api('POST', `/api/approvals/${encodeURIComponent(a.id)}`, { approve: true }), `Autorizar e executar na VPS?\n\n${a.command}`) }, 'Autorizar') : null,
          h('button', { class: 'btn ghost grow', disabled: running || view.busyAction,
            onclick: () => act(() => api('POST', `/api/approvals/${encodeURIComponent(a.id)}`, { approve: false })) }, a.executable ? 'Negar' : 'Negar (não executável)'),
        )))
    }
    if (s.pendingDecision) {
      const d = s.pendingDecision
      const free = h('input', { class: 'txt', placeholder: 'Ou responda com suas palavras…' })
      alerts.push(h('div', { class: 'card warn' },
        h('h2', {}, 'Decisão necessária'),
        h('p', {}, d.question),
        ...d.options.map(o => h('button', { class: 'btn ghost full', style: 'margin-top:6px', disabled: running || view.busyAction,
          onclick: () => act(() => api('POST', `${base}/decision`, { answer: o })) }, o)),
        h('div', { class: 'row', style: 'margin-top:8px' }, h('div', { class: 'grow' }, free),
          h('button', { class: 'btn amber', disabled: running || view.busyAction,
            onclick: () => free.value.trim() && act(() => api('POST', `${base}/decision`, { answer: free.value.trim() })) }, 'Enviar')),
      ))
    }
    if (s.riskGateTaskId) {
      const t = view.tasks.find(x => x.id === s.riskGateTaskId)
      if (t && t.status === 'TODO') alerts.push(h('div', { class: 'card warn' },
        h('h2', {}, 'Tarefa de risco alto'),
        h('p', {}, t.title),
        h('p', { class: 'muted' }, 'O loop parou aqui (Semi-autônomo). Revise e libere para continuar.'),
        h('button', { class: 'btn amber full', disabled: running || view.busyAction,
          onclick: () => act(() => api('POST', `${base}/loop`, { approvedTaskId: t.id }), `Liberar "${t.title}"?`) }, 'Liberar e continuar')))
    }
    $alerts.replaceChildren(...alerts)

    // Ações
    const manual = view.agent && view.agent.autonomyLevel === 'manual'
    $actions.replaceChildren(
      h('h2', {}, 'Ações'),
      running
        ? h('div', { class: 'row' },
            h('button', { class: 'btn ghost grow', disabled: s.stopRequested || view.busyAction, onclick: () => act(() => api('POST', `${base}/stop`)) },
              s.stopRequested ? 'Parando…' : 'Parar após a tarefa'),
            h('button', { class: 'btn danger', disabled: view.busyAction,
              onclick: () => act(() => api('POST', `${base}/cancel`), 'Cancelar agora a execução em andamento na VPS?') }, 'Cancelar'))
        : h('div', { class: 'row' },
            todo > 0 ? h('button', { class: 'btn grow', disabled: view.busyAction || s.approvals.length > 0,
              onclick: () => act(() => api('POST', `${base}/${manual ? 'next' : 'loop'}`)) }, manual ? 'Próxima tarefa' : 'Continuar loop') : null,
            interrupted ? h('button', { class: 'btn ghost grow', disabled: view.busyAction, onclick: () => act(() => api('POST', `${base}/resume`)) }, 'Retomar sessão') : null,
            todo === 0 && !interrupted ? h('p', { class: 'muted' }, 'Nada pendente. Novos objetivos se iniciam pelo Zeus no PC.') : null),
      view.error ? h('p', { class: 'err-msg' }, view.error) : null,
    )

    $tasks.replaceChildren(h('h2', {}, `Tarefas (${view.tasks.length})`),
      ...view.tasks.map(t => {
        const [label, cls] = STATUS[t.status] || [t.status, '']
        return h('div', { class: 'task' },
          h('div', { class: 't' }, t.title, t.risk === 'high' ? h('span', { class: 'badge b-err', style: 'margin-left:6px' }, 'risco alto') : null),
          h('span', { class: `badge ${cls}` }, label))
      }))
  }

  function renderOutput() {
    const atBottom = $live.scrollHeight - $live.scrollTop - $live.clientHeight < 40
    $live.textContent = view.output.slice(-20000) || '(nenhuma saída ainda)'
    if (atBottom) $live.scrollTop = $live.scrollHeight
  }
  function renderActivity() {
    $activity.replaceChildren(...view.activity.slice(-40).reverse().map(a => h('div', { class: `act ${a.kind === 'tool_error' ? 'err' : ''}` },
      `${new Date(a.at).toLocaleTimeString('pt-BR')} ${a.kind === 'init' ? `sessão · ${a.summary}` : `${a.tool}${a.summary ? ` — ${a.summary}` : ''}`}`)))
  }

  async function load() {
    const st = await api('GET', `${base}/state`)
    view.state = st.state; view.tasks = st.tasks; view.agent = st.agent; view.orphan = st.orphanRunning
    view.output = st.output; view.outputEnd = st.outputEnd; view.activity = st.activity
    render(); renderOutput(); renderActivity()
  }

  // Eventos ao vivo: fetch em streaming (EventSource não manda o cabeçalho com o token).
  let closed = false
  const ctrl = new AbortController()
  stopStream = () => { closed = true; ctrl.abort() }
  ;(async () => {
    let wait = 1000
    while (!closed) {
      try {
        const res = await fetch(`/api/events?projectId=${encodeURIComponent(p.id)}`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal })
        if (res.status === 401) return showLogin('Token inválido.')
        if (!res.ok || !res.body) throw new Error(String(res.status))
        setConn(true); wait = 1000
        await load() // depois de conectar: nada se perde entre o estado e os eventos
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let buf = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buf += dec.decode(value, { stream: true })
          let i
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const line = buf.slice(0, i).split('\n').find(l => l.startsWith('data: ')); buf = buf.slice(i + 2)
            if (!line) continue
            let e; try { e = JSON.parse(line.slice(6)) } catch { continue }
            if (e.kind === 'state') {
              const prev = view.state
              view.state = e.state
              if (!prev || prev.tasksVersion !== e.state.tasksVersion) view.tasks = await api('GET', `${base}/tasks`).catch(() => view.tasks)
              if (prev && prev.mode !== 'idle' && e.state.mode === 'idle') view.agent = await api('GET', `${base}/agent`).catch(() => view.agent)
              render()
            } else if (e.kind === 'output') {
              if (e.reset) view.output = ''
              const fresh = e.end - view.outputEnd
              if (fresh > 0 && e.text) view.output += e.text.slice(Math.max(0, e.text.length - fresh))
              view.outputEnd = Math.max(view.outputEnd, e.end)
              renderOutput()
            } else if (e.kind === 'activity') {
              view.activity = [...view.activity.slice(-199), e.entry]
              renderActivity()
            }
          }
        }
      } catch (e) {
        if (closed) return
        if (e instanceof AuthError) return showLogin('Token inválido.')
        setConn(false)
      }
      await new Promise(r => setTimeout(r, wait))
      wait = Math.min(wait * 2, 15000)
    }
  })()
}

// Voltar ao app depois de um tempo em segundo plano: o Android pode ter derrubado a conexão.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !stopStream && token) showProjects() })

showProjects()
