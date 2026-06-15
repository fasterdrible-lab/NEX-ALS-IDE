import { useState } from 'react'
import {
  BookOpen, Server, FolderOpen, User, Rocket, Settings,
  ChevronDown, ChevronRight, Terminal, Key, AlertTriangle,
  BotMessageSquare, CheckCircle, Monitor, HelpCircle, Code2,
  BarChart3, History, Box, Cpu, FileText, Bot, Zap,
  Sparkles, Siren, Globe, ShieldCheck, ExternalLink,
  Play, RotateCcw, Database, Layers, LayoutDashboard, Bell,
  Users, GitBranch,
} from 'lucide-react'

interface Section {
  id: string
  icon: React.ElementType
  title: string
  color: string
  content: React.ReactNode
}

function Accordion({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState<string>(sections[0]?.id ?? '')
  return (
    <div className="space-y-2">
      {sections.map(s => {
        const Icon = s.icon
        const isOpen = open === s.id
        return (
          <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setOpen(isOpen ? '' : s.id)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/50 transition-colors"
            >
              <div className={`p-1.5 rounded-lg ${s.color}`}><Icon size={15}/></div>
              <span className="font-medium text-slate-100 flex-1">{s.title}</span>
              {isOpen ? <ChevronDown size={15} className="text-slate-400"/> : <ChevronRight size={15} className="text-slate-400"/>}
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-slate-300 text-sm space-y-3 border-t border-slate-800 pt-4">
                {s.content}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-full bg-brand-600/30 text-brand-300 text-xs flex items-center justify-center font-bold mt-0.5">{n}</span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-slate-800/60 rounded-lg px-3 py-2.5 text-slate-400 text-xs">
      <HelpCircle size={13} className="shrink-0 mt-0.5 text-brand-400"/>
      <span>{children}</span>
    </div>
  )
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-2.5 text-amber-300 text-xs">
      <AlertTriangle size={13} className="shrink-0 mt-0.5"/>
      <span>{children}</span>
    </div>
  )
}

function Info({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-purple-900/20 border border-purple-800/30 rounded-lg px-3 py-2.5 text-purple-300 text-xs">
      <Sparkles size={13} className="shrink-0 mt-0.5"/>
      <span>{children}</span>
    </div>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-slate-800 text-brand-300 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
}

function Block({ children }: { children: React.ReactNode }) {
  return <pre className="bg-slate-800 rounded-lg px-4 py-3 text-xs font-mono text-emerald-300 overflow-x-auto">{children}</pre>
}

function KV({ items }: { items: [string, string][] }) {
  return (
    <div className="grid gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-xs">
          <span className="text-slate-100 font-medium w-40 shrink-0">{k}</span>
          <span className="text-slate-400">{v}</span>
        </div>
      ))}
    </div>
  )
}

const sections: Section[] = [
  // ── INÍCIO RÁPIDO ──────────────────────────────────────────────────────
  {
    id: 'quickstart',
    icon: CheckCircle,
    title: '🚀 Início Rápido — 5 minutos',
    color: 'bg-emerald-600/20 text-emerald-400',
    content: (
      <div className="space-y-3">
        <Step n={1}><strong className="text-slate-100">Cadastre sua VPS</strong> — vá em <em>VPS</em> → Nova VPS. Preencha IP, porta, usuário e senha SSH. Clique em <strong>Testar</strong> para confirmar a conexão.</Step>
        <Step n={2}><strong className="text-slate-100">Configure um provedor de IA</strong> — vá em <em>Configurações → Provedores de IA</em>. Groq é grátis, DeepSeek é barato, Anthropic é o melhor. Salve a API Key e marque como padrão.</Step>
        <Step n={3}><strong className="text-slate-100">Abra o IDE</strong> — vá em <em>Lançador</em> → clique em <strong>IDE</strong> na VPS desejada. O NEX-ALS IDE abre em tela cheia com explorer, editor e terminal SSH.</Step>
        <Step n={4}><strong className="text-slate-100">Converse com a IA</strong> — no IDE, clique no botão roxo <strong>Claude</strong> (canto superior direito). Para o agente autônomo (lê e escreve arquivos), ative o botão 🤖.</Step>
        <Step n={5}><strong className="text-slate-100">Explore o AI HUB</strong> — clique em <strong className="text-slate-100">AI HUB</strong> (botão roxo na sidebar) para um chat avançado com histórico de conversas, streaming e múltiplos provedores.</Step>
        <Tip>Para editar arquivos locais (sem VPS), clique em "Abrir pasta local no IDE" no Lançador — sem risco de afetar produção.</Tip>
      </div>
    ),
  },

  // ── DOIS MODOS DE OPERAÇÃO ─────────────────────────────────────────────
  {
    id: 'modes',
    icon: Layers,
    title: 'Dois modos de operação — VPS remota e Local',
    color: 'bg-slate-600/30 text-slate-300',
    content: (
      <div className="space-y-4">
        <p className="text-xs text-slate-400">O NEX-ALS IDE opera em dois modos distintos. Entender qual usar evita erros e reduz o risco de modificar produção por acidente.</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-900/10 border border-red-800/30 rounded-lg p-3 space-y-2">
            <p className="text-red-300 font-semibold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"/>
              Modo Remoto (VPS)
            </p>
            <p className="text-slate-400 text-xs">Edita arquivos diretamente no servidor de produção via SSH/SFTP. Badge vermelho "PRODUÇÃO" aparece na top bar.</p>
            <div className="space-y-0.5 text-xs">
              <p className="text-slate-300">✓ Explorer SFTP completo</p>
              <p className="text-slate-300">✓ Terminal SSH interativo</p>
              <p className="text-slate-300">✓ Git integrado</p>
              <p className="text-slate-300">✓ Docker, PM2, Port Forwarding</p>
              <p className="text-slate-300">✓ Chat IA + Modo Agente</p>
              <p className="text-amber-400">⚠ Alterações vão para produção</p>
            </div>
          </div>
          <div className="bg-emerald-900/10 border border-emerald-800/30 rounded-lg p-3 space-y-2">
            <p className="text-emerald-300 font-semibold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>
              Modo Local
            </p>
            <p className="text-slate-400 text-xs">Edita arquivos locais (ex: OneDrive, C:\Projetos). Badge verde "LOCAL" na top bar. Não conecta em VPS.</p>
            <div className="space-y-0.5 text-xs">
              <p className="text-slate-300">✓ Monaco Editor completo</p>
              <p className="text-slate-300">✓ Preview de imagem</p>
              <p className="text-slate-300">✓ Chat IA com contexto do projeto</p>
              <p className="text-slate-300">✓ Agente autônomo — cria arquivos e roda comandos</p>
              <p className="text-slate-300">✓ Busca em arquivos (rg/findstr) — Ctrl+Shift+F</p>
              <p className="text-slate-300">✓ Git diff do arquivo ativo — botão Diff na top bar</p>
              <p className="text-slate-300">✓ F2 rename inline, Ctrl+Shift+T reabrir aba</p>
              <p className="text-slate-500">✗ Sem terminal SSH</p>
              <p className="text-emerald-400">✓ Seguro — sem risco de produção</p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Como abrir cada modo</p>
          <KV items={[
            ['Modo Remoto', 'Lançador → botão IDE (ícone Code2) em qualquer VPS'],
            ['Nova janela remota', 'Lançador → ícone ⎋ (ExternalLink) ao lado de IDE — abre em janela independente'],
            ['Modo Local', 'Lançador → botão "Abrir pasta local no IDE" (canto inferior)'],
          ]}/>
        </div>
      </div>
    ),
  },

  // ── AI HUB ─────────────────────────────────────────────────────────────
  {
    id: 'aihub',
    icon: Sparkles,
    title: 'NEX-ALS AI HUB — Central de IA',
    color: 'bg-purple-600/20 text-purple-400',
    content: (
      <div className="space-y-4">
        <p>O AI HUB é a central de inteligência artificial do NEX-ALS IDE. Acesse pelo botão <strong className="text-slate-100">AI HUB</strong> (ícone Sparkles roxo) na sidebar principal.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Layout</p>
          <Block>{`Sidebar (conversas)  │  Chat central  │  Painel Contexto/Memória
─────────────────────┼────────────────┼──────────────────────────
Favoritos            │  Streaming     │  [Contexto] [Memória]
Hoje                 │  token a token │  VPS selecionada
Mais antigas         │  Cancelar ■    │  ☑ Logs  ☑ Docker
─────────────────────┼────────────────┤  ☑ PM2   ☑ Métricas
+ Nova conversa      │  Seletor IA ↓  │  ☐ Memória do projeto
                     │  [Enviar ↵]    │`}</Block>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">6 Provedores disponíveis</p>
          <KV items={[
            ['Anthropic', 'Claude Opus/Sonnet/Haiku — melhor qualidade, raciocínio avançado'],
            ['OpenAI', 'GPT-4.1, GPT-4o, o3 — ampla compatibilidade'],
            ['Gemini', 'Gemini 2.5 Pro / Flash — janela de 1M tokens'],
            ['DeepSeek', 'Chat e Reasoner — código excelente, muito barato'],
            ['OpenRouter', '300+ modelos (Llama, Mistral, Claude, GPT) com 1 chave'],
            ['Ollama', 'Modelos locais (llama3, codestral, etc.) — sem internet, grátis'],
          ]}/>
          <Tip>Ollama não precisa de API Key. Instale o Ollama em localhost e os modelos aparecem automaticamente.</Tip>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Context Selector — painel direito, aba Contexto</p>
          <p className="text-xs">Selecione uma VPS e marque os dados a incluir automaticamente no contexto da próxima mensagem:</p>
          <KV items={[
            ['Logs do sistema', 'journalctl -n 80 da VPS selecionada'],
            ['Docker containers', 'docker ps com estado de cada container'],
            ['PM2 processos', 'pm2 jlist com CPU%, RAM e restarts'],
            ['Métricas da VPS', 'CPU, RAM, Disco, Uptime atuais'],
            ['Memória do projeto', 'Blocos de contexto salvos (stack, padrões, etc.)'],
          ]}/>
          <Info>Com os dados certos no contexto, a IA responde sobre a sua infraestrutura sem você precisar colar nada manualmente.</Info>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Project Memory — painel direito, aba Memória</p>
          <p className="text-xs">Salve informações sobre o projeto que a IA usa em todas as conversas. Organize por VPS ou global.</p>
          <KV items={[
            ['stack', 'Ex: Node.js 22, Prisma, PostgreSQL'],
            ['padrões', 'Ex: Repository Pattern, Service Layer, DTOs com Zod'],
            ['convenções', 'Ex: camelCase, respostas em pt-BR, imports absolutas'],
            ['[chave livre]', 'Qualquer bloco de contexto personalizado'],
          ]}/>
          <Tip>A memória é injetada no system prompt de cada mensagem. Quanto mais específica, melhor a IA entende o projeto.</Tip>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Streaming e histórico</p>
          <KV items={[
            ['Resposta token a token', 'Veja a IA digitar em tempo real'],
            ['Cancelar ■', 'Interrompe o streaming a qualquer momento'],
            ['Histórico persistido', 'Conversas salvas no SQLite local — nunca se perde'],
            ['Pin ⭐', 'Fixa conversa no topo da sidebar'],
            ['Editar título', 'Clique no lápis no header para renomear'],
          ]}/>
        </div>
      </div>
    ),
  },

  // ── INCIDENT MODE ──────────────────────────────────────────────────────
  {
    id: 'incident',
    icon: Siren,
    title: 'Incident Mode — Modo de emergência',
    color: 'bg-red-600/20 text-red-400',
    content: (
      <div className="space-y-4">
        <p>Janela dedicada para diagnosticar e resolver problemas de produção. Abre todos os painéis de diagnóstico de uma vez, com IA analisando o estado automaticamente.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Como abrir</p>
          <KV items={[
            ['Lançador', 'Botão Siren (vermelho) ao lado de cada VPS'],
            ['IDE top bar', 'Ícone Siren vermelho ao lado do botão de nova janela'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">4 painéis em grade</p>
          <Block>{`┌─────────────────────┬──────────────────────┐
│  Diagnóstico IA     │  Logs live           │
│  Auto-análise ao    │  Comando editável    │
│  abrir + chat livre │  journalctl / tail   │
├─────────────────────┼──────────────────────┤
│  Docker + PM2       │  Terminal emergência │
│  Status containers  │  Comandos rápidos   │
│  CPU, RAM, restarts │  Output acumulado    │
└─────────────────────┴──────────────────────┘`}</Block>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Diagnóstico automático</p>
          <p className="text-xs">Ao abrir, o Incident Mode aguarda 1,5s para carregar todos os dados (CPU/RAM/Disco, Docker, PM2, logs recentes) e automaticamente envia para a IA com a pergunta: <em>"Analise o estado atual e informe STATUS, problemas identificados e ação imediata."</em></p>
          <Info>Depois do diagnóstico automático, o painel vira um chat livre. Pergunte o que quiser sobre a infraestrutura.</Info>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Top bar</p>
          <KV items={[
            ['🚨 INCIDENT MODE', 'Badge vermelho pulsante — lembrete de que é uma situação crítica'],
            ['Mini monitor', 'CPU% | RAM% | Disco% | Uptime atualizados em tempo real'],
            ['Botão Atualizar', 'Força refresh de todos os 4 painéis simultaneamente'],
            ['Botão ✗', 'Fecha a janela de emergência'],
          ]}/>
          <Warn>O Incident Mode é uma janela separada — o IDE normal continua funcionando em paralelo.</Warn>
        </div>
      </div>
    ),
  },

  // ── DEPLOY ASSISTANT ──────────────────────────────────────────────────
  {
    id: 'deploy',
    icon: Rocket,
    title: 'Deploy Assistant — Deployar com segurança',
    color: 'bg-emerald-600/20 text-emerald-400',
    content: (
      <div className="space-y-4">
        <p>Assistente de deploy que usa IA para gerar um plano de passos, executa com aprovação e faz rollback automático se algo der errado.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Como abrir</p>
          <KV items={[
            ['Lançador', 'Botão Rocket (verde) ao lado de cada VPS'],
            ['IDE top bar', 'Ícone Rocket verde ao lado do Siren'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Fluxo de uso</p>
          <Step n={1}><span>Descreva o deploy em linguagem natural:</span><Block>{`"Fazer deploy da v2.1.0 — git pull, pnpm build, docker restart api-prod"`}</Block></Step>
          <Step n={2}><strong className="text-slate-100">Clique "Gerar Plano"</strong> — a IA cria um plano numerado com comandos, diretórios e risco de cada passo.</Step>
          <Step n={3}><strong className="text-slate-100">Revise e execute</strong> — clique "Executar Tudo" ou execute passo a passo.</Step>
          <Step n={4}>Passos de <span className="text-red-400 font-bold">risco alto</span> (docker stop, git reset --hard, rm -rf) exigem confirmação antes de executar.</Step>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Tiers de risco</p>
          <KV items={[
            ['baixo', 'git pull, npm install, pnpm build — executa direto'],
            ['médio', 'docker restart, pm2 restart — executa direto'],
            ['🔴 ALTO', 'docker stop/rm, git reset --hard, rm -rf — pede confirmação'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Rollback automático</p>
          <p className="text-xs">Se qualquer passo falhar, a IA recebe a lista de passos já executados e o erro, e gera automaticamente um plano de rollback. Clique "Executar Rollback" para desfazer.</p>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Smoke Test</p>
          <p className="text-xs">No painel direito, informe a URL de health check (ex: <Code>https://api.prod/health</Code>) e clique Executar. O Deploy Assistant faz um GET e mostra o código HTTP + latência.</p>
          <Info>Use o Smoke Test após o deploy para confirmar que o serviço está respondendo antes de dar como concluído.</Info>
        </div>
      </div>
    ),
  },

  // ── NEX-ALS IDE ────────────────────────────────────────────────────────
  {
    id: 'ide',
    icon: Code2,
    title: 'NEX-ALS IDE — Editor integrado',
    color: 'bg-brand-600/20 text-brand-400',
    content: (
      <div className="space-y-4">
        <p>IDE completo que roda diretamente na VPS via SSH/SFTP. Monaco Editor, terminal xterm.js, Git, Docker, PM2 e IA — tudo numa janela.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Layout</p>
          <Block>{`┌─ Arquivos │ Busca │ Git │ Portas │ Docker │ PM2 ─┐
│                                                  │
│  Monaco Editor (split Ctrl+⊟)    Chat IA ──────► │
│                                                  │
├─ Terminal │ Problemas │ Logs ────────────────────┤
│  xterm.js SSH multi-abas                         │
└──────────────────────────────────────────────────┘`}</Block>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Atalhos principais</p>
          <KV items={[
            ['Ctrl+S', 'Salvar arquivo via SFTP ou disco local'],
            ['Ctrl+`', 'Abrir/fechar terminal'],
            ['Ctrl+Shift+F', 'Busca em arquivos — grep SSH (VPS) ou rg/findstr (Local)'],
            ['Ctrl+Shift+P', 'Paleta de comandos Monaco'],
            ['Ctrl+H', 'Find & Replace no arquivo'],
            ['Ctrl+G', 'Ir para linha específica'],
            ['F2', 'Renomear arquivo/pasta inline — clique para selecionar, F2 para editar o nome'],
            ['Ctrl+Shift+T', 'Reabrir última aba fechada (histórico de até 15 abas)'],
            ['Botão ⊟ (Columns2)', 'Ativar/desativar split editor (dois painéis)'],
            ['Botão Claude (roxo)', 'Abrir painel de chat IA'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Botões na top bar</p>
          <KV items={[
            ['🔴 PRODUÇÃO / 🟢 LOCAL', 'Badge de modo — vermelho = VPS real, verde = local seguro'],
            ['Diff (modo Local)', 'Aparece apenas em modo Local quando um arquivo está aberto — executa git diff do arquivo ativo e abre o diff viewer Monaco'],
            ['⎋ (ExternalLink)', 'Abre esta VPS em nova janela independente (multi-monitor)'],
            ['🚨 (Siren)', 'Abre Incident Mode para esta VPS'],
            ['🚀 (Rocket)', 'Abre Deploy Assistant para esta VPS'],
            ['Claude (roxo)', 'Painel de chat + Modo Agente'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Abas do painel esquerdo</p>
          <KV items={[
            ['Arquivos', 'Explorer SFTP/local: criar, renomear (F2 ou menu), deletar, duplicar'],
            ['Busca', 'Busca em arquivos — funciona em VPS (grep SSH) e em modo Local (rg/findstr)'],
            ['Git', 'Status, diff inline, stage, commit, push, pull, log — apenas VPS'],
            ['Portas', 'Port forwarding SSH: acessar porta da VPS como localhost — apenas VPS'],
            ['Docker', 'Listar containers, Start/Stop/Logs/Remover — apenas VPS'],
            ['PM2', 'Listar processos, Restart/Stop/Logs/Excluir — apenas VPS'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Abas do painel inferior</p>
          <KV items={[
            ['Terminal', 'SSH interativo multi-abas com xterm.js'],
            ['Problemas', 'Erros e warnings do Monaco (clicável para ir à linha)'],
            ['Logs', 'tail/journalctl com presets e modo Watch 3s'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Recursos avançados do editor</p>
          <KV items={[
            ['Split editor', 'Dois painéis lado a lado com abas independentes — Ctrl+⊟'],
            ['Preview de imagem', 'PNG/JPG abrem como preview embutido na aba'],
            ['F2 — Rename inline', 'Clique no arquivo para selecioná-lo (highlight), pressione F2 para editar o nome sem abrir menu de contexto'],
            ['Ctrl+Shift+T — Reabrir aba', 'Reabre a última aba fechada; histórico de até 15 abas com conteúdo preservado'],
            ['Diff local', 'Botão "Diff" na top bar (só modo Local) — executa git diff e exibe no Monaco diff viewer'],
            ['Busca local', 'Ctrl+Shift+F em modo Local usa ripgrep (se disponível) ou findstr — sem VPS necessária'],
            ['LSP multi-linguagem', 'TS (6009) · Python/pylsp (6010) · Rust/rust-analyzer (6011) · Go/gopls (6012) — botão na status bar muda conforme o arquivo aberto; requer túnel SSH + wrapper Node.js na VPS'],
            ['DAP debug', 'Clique "⬡ DAP" para abrir Chrome DevTools conectado à VPS'],
          ]}/>
        </div>
      </div>
    ),
  },

  // ── CHAT IA NO IDE ─────────────────────────────────────────────────────
  {
    id: 'ai-chat',
    icon: Bot,
    title: 'Chat IA no IDE — Modos e segurança',
    color: 'bg-purple-600/20 text-purple-400',
    content: (
      <div className="space-y-4">
        <p>O botão <strong className="text-slate-100">Claude</strong> (roxo) na top bar do IDE abre o painel de chat à direita. O contexto do arquivo aberto é enviado automaticamente.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Modo Chat (padrão)</p>
          <p className="text-xs">Claude recebe o contexto completo do projeto (árvore + código + arquivo ativo) e sugere alterações. Você decide o que aplicar.</p>
          <KV items={[
            ['▶ arquivo.ts', 'Aplica o bloco no arquivo aberto no editor (com snapshot automático)'],
            ['Salvar como…', 'Salva o bloco como um novo arquivo na VPS'],
            ['Revisar N alterações', 'Modal para aplicar múltiplos arquivos em lote'],
            ['▶ Executar na VPS', 'Roda blocos bash/sh direto na VPS e mostra output inline'],
            ['📷 Print (Ctrl+V)', 'Cola screenshot diretamente no chat para análise visual'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">🤖 Modo Agente — funciona em VPS e Local</p>
          <p className="text-xs">Ative o botão <strong className="text-slate-100">🤖 Agente</strong> no header do chat. A IA usa ferramentas reais — lê, escreve e executa por conta própria, sem precisar de aprovação a cada passo.</p>
          <div className="bg-slate-800 rounded-lg p-3 text-xs font-mono space-y-0.5">
            <p className="text-slate-400">Você: "Cria API REST com Node, Express e SQLite"</p>
            <p className="text-yellow-400">⟳ execute_command: mkdir -p src/routes</p>
            <p className="text-emerald-400">✓ write_file src/index.js</p>
            <p className="text-emerald-400">✓ write_file src/routes/users.js</p>
            <p className="text-yellow-400">⟳ execute_command: npm install express sqlite3</p>
            <p className="text-slate-300">IA: "API criada e dependências instaladas."</p>
          </div>
          <KV items={[
            ['Até 500 ações', 'Loop automático sem pausas — progresso exibido a cada 50 ações'],
            ['⏹ Parar', 'Interrompe o agente a qualquer momento, mantendo o histórico'],
            ['Modo Local', 'Executa npm, node, mkdir e qualquer comando Windows no PC'],
            ['📦 Snapshots', 'Antes de cada write_file, o conteúdo original é salvo. Clique ↩ Restaurar.'],
          ]}/>
          <Tip>No modo local: descreva o projeto completo — a IA cria todos os arquivos, instala dependências e garante que o projeto rode sem interação manual.</Tip>
          <Warn>Comandos destrutivos (docker stop, rm -rf, git reset --hard) em modo VPS exigem digitar CONFIRMO no modal antes de executar.</Warn>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Snapshot / Rollback</p>
          <p className="text-xs">Toda vez que o agente escreve em um arquivo existente, o conteúdo original é guardado em memória. O painel <strong className="text-slate-100">📦 Snapshots</strong> aparece no chat mostrando todos os arquivos modificados na sessão atual, com o botão <strong className="text-slate-100">↩ Restaurar</strong> para reverter individualmente.</p>
        </div>
      </div>
    ),
  },

  // ── MULTI-MONITOR ──────────────────────────────────────────────────────
  {
    id: 'multimonitor',
    icon: ExternalLink,
    title: 'Multi-monitor — Múltiplas janelas',
    color: 'bg-cyan-600/20 text-cyan-400',
    content: (
      <div className="space-y-3">
        <p>Abra múltiplas VPS em janelas Electron completamente independentes — cada uma com seus próprios terminais, sessões SSH/SFTP, Git e chat IA.</p>
        <KV items={[
          ['⎋ Lançador', 'Botão ExternalLink ao lado do botão IDE em cada VPS'],
          ['⎋ IDE top bar', 'Ícone ExternalLink ao lado do nome da VPS'],
          ['Independência total', 'Estado React, SFTP, terminais e chat são isolados por janela'],
          ['Título da janela', 'Mostra "NEX-ALS IDE — {nome da VPS}" para identificação fácil'],
        ]}/>
        <Tip>Ideal para monitorar uma VPS de produção em um monitor enquanto desenvolve em outra VPS em outro monitor.</Tip>
      </div>
    ),
  },

  // ── FINGERPRINT SSH ────────────────────────────────────────────────────
  {
    id: 'fingerprint',
    icon: ShieldCheck,
    title: 'Fingerprint SSH — Proteção MITM',
    color: 'bg-emerald-600/20 text-emerald-400',
    content: (
      <div className="space-y-3">
        <p>Na primeira conexão com uma VPS, o NEX-ALS IDE salva automaticamente o <strong className="text-slate-100">fingerprint SHA-256</strong> da chave pública do servidor. Em todas as conexões seguintes, o fingerprint é comparado.</p>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Como funciona</p>
          <KV items={[
            ['1ª conexão', 'Fingerprint salvo automaticamente, badge 🛡 verde "Host verificado"'],
            ['Conexões seguintes', 'Fingerprint comparado — se bater, conecta normalmente'],
            ['Mudança detectada', 'Conexão bloqueada com alerta "possível ataque MITM"'],
          ]}/>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Se o fingerprint mudou legitimamente</p>
          <p className="text-xs">(Ex: você reinstalou a VPS, trocou a chave SSH do servidor)</p>
          <Step n={1}><span>Vá em <em>VPS</em> na sidebar.</span></Step>
          <Step n={2}><span>Clique no botão <strong className="text-slate-100">🛡 (ShieldOff)</strong> âmbar ao lado da VPS afetada.</span></Step>
          <Step n={3}><span>Confirme "Limpar fingerprint". Na próxima conexão, o novo fingerprint será salvo.</span></Step>
        </div>
        <Warn>Se você não reinstalou o servidor mas o fingerprint mudou, pode ser um ataque. Não clique em Limpar sem investigar.</Warn>
      </div>
    ),
  },

  // ── NOTIFICAÇÕES DE SISTEMA ───────────────────────────────────────────
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notificações de Sistema',
    color: 'bg-yellow-600/20 text-yellow-400',
    content: (
      <div className="space-y-3">
        <p>O NEX-ALS IDE monitora suas VPS em segundo plano e exibe <strong className="text-slate-100">notificações nativas</strong> quando métricas críticas são atingidas — mesmo com a janela minimizada.</p>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Alertas automáticos</p>
          <KV items={[
            ['Disco acima 85%', 'Notificação "Disco Cheio — NomeDaVPS"'],
            ['CPU acima 90%', 'Notificação "CPU Alta — NomeDaVPS"'],
            ['RAM acima 90%', 'Notificação "RAM Crítica — NomeDaVPS"'],
            ['Erro no AI Hub', 'Notificação quando streaming falha e a janela não está em foco'],
          ]}/>
        </div>
        <KV items={[
          ['Polling', 'Verifica todas as VPS a cada 60 segundos via SSH'],
          ['Cooldown', '30 minutos entre notificações do mesmo tipo por VPS (sem spam)'],
          ['Ativar/desativar', 'Configurações → seção Notificações → toggle'],
        ]}/>
        <Tip>Se uma VPS estiver offline, o monitor ignora silenciosamente e tenta novamente no próximo ciclo de 60s.</Tip>
      </div>
    ),
  },

  // ── DOCKER E PM2 ──────────────────────────────────────────────────────
  {
    id: 'docker-pm2',
    icon: Box,
    title: 'Docker e PM2',
    color: 'bg-blue-600/20 text-blue-400',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><Box size={12}/> Docker Explorer</p>
          <p className="text-xs">Aba "Docker" no painel esquerdo do IDE. Lista containers com status, imagem e portas expostas.</p>
          <KV items={[
            ['Start', 'Inicia container parado'],
            ['Stop', 'Para container em execução'],
            ['Logs', 'Exibe últimas 150 linhas de log no painel'],
            ['Remover', 'Remove container parado (pede confirmação)'],
          ]}/>
          <Tip>Requer Docker instalado na VPS. O usuário SSH precisa estar no grupo <Code>docker</Code> ou ser root.</Tip>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><Cpu size={12}/> PM2 Process Manager</p>
          <p className="text-xs">Aba "PM2" no painel esquerdo do IDE. Lista processos Node.js com CPU%, RAM e restarts.</p>
          <KV items={[
            ['Restart', 'Reinicia processo (salva os logs do crash)'],
            ['Stop', 'Para processo sem remover da lista PM2'],
            ['Logs', 'Exibe as últimas 120 linhas de log do processo'],
            ['Excluir', 'Remove processo do PM2 (apenas se estiver parado)'],
          ]}/>
          <Tip>Instale PM2 na VPS: <Code>npm install -g pm2</Code></Tip>
        </div>
      </div>
    ),
  },

  // ── LOGS E MONITOR ─────────────────────────────────────────────────────
  {
    id: 'logs-monitor',
    icon: FileText,
    title: 'Logs Viewer e Monitor de VPS',
    color: 'bg-emerald-600/20 text-emerald-400',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><FileText size={12}/> Logs Viewer</p>
          <p className="text-xs">Aba "Logs" no painel inferior do IDE. Execute qualquer comando que retorne texto e veja o output aqui.</p>
          <KV items={[
            ['Campo de comando', 'Qualquer comando bash (tail, journalctl, pm2 logs…)'],
            ['▶ Watch', 'Executa automaticamente a cada 3 segundos'],
            ['Presets rápidos', 'syslog · nginx err · nginx acc · PM2 all · journald'],
          ]}/>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><BarChart3 size={12}/> Monitor de VPS</p>
          <p className="text-xs">Página "Monitor" na sidebar. Métricas de todas as VPS com auto-refresh 30s.</p>
          <KV items={[
            ['CPU %', 'Verde &lt; 60% · amarelo 60-84% · vermelho ≥ 85%'],
            ['RAM', 'Usado / total'],
            ['Disco (/)', 'Uso percentual do disco raiz'],
            ['Analisar disco', 'Modal com top dirs · uso Docker · logs PM2 · /var/log'],
          ]}/>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><History size={12}/> Histórico de Lançamentos</p>
          <p className="text-xs">Página "Histórico" na sidebar. Registra abertura de projetos com data, VPS, resultado e taxa de sucesso.</p>
        </div>
      </div>
    ),
  },

  // ── VPS ────────────────────────────────────────────────────────────────
  {
    id: 'vps',
    icon: Server,
    title: 'VPS — Servidores remotos',
    color: 'bg-blue-600/20 text-blue-400',
    content: (
      <div className="space-y-3">
        <p>Cada VPS representa um servidor Linux remoto. Você pode ter múltiplas VPS com contas Claude independentes.</p>
        <KV items={[
          ['Nome', 'Apelido livre. Ex: VPS Dev, Servidor Prod'],
          ['Host / IP', 'Endereço IP público da VPS'],
          ['Porta', 'Porta SSH. Padrão: 22'],
          ['Usuário SSH', 'Usuário de acesso. Geralmente root'],
          ['Senha SSH', 'Opcional. Salva criptografada AES-256'],
          ['Caminho padrão', 'Pasta que abre por padrão no IDE. Ex: /root'],
        ]}/>
        <div className="space-y-1.5 text-xs">
          <p className="text-slate-400 font-semibold uppercase tracking-wide text-[10px]">Badges de status</p>
          <div className="flex items-center gap-2"><ShieldCheck size={11} className="text-emerald-400"/><span className="text-emerald-400">Host verificado</span><span className="text-slate-400">— fingerprint SSH salvo e válido</span></div>
          <div className="flex items-center gap-2"><ShieldCheck size={11} className="text-slate-500"/><span className="text-slate-400">Sem fingerprint</span><span className="text-slate-500">— primeira conexão ainda não realizada</span></div>
        </div>
        <Tip>Use o botão <strong>Testar</strong> para verificar a conexão antes de criar projetos.</Tip>
      </div>
    ),
  },

  // ── AUTENTICAÇÃO ──────────────────────────────────────────────────────
  {
    id: 'auth',
    icon: ShieldCheck,
    title: 'Autenticação e permissões de usuário',
    color: 'bg-brand-600/20 text-brand-400',
    content: (
      <div className="space-y-4">
        <p className="text-xs text-slate-400">A autenticação é <strong className="text-slate-200">opcional</strong>. Sem usuários cadastrados, o app funciona exatamente como antes — modo single-user sem login. Quando você cria o primeiro usuário, login passa a ser obrigatório a cada início do app.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Primeiro uso — Setup</p>
          <Step n={1}><span>No primeiro acesso após ativar o recurso, o app exibe a tela de <strong className="text-slate-100">Configuração inicial</strong>.</span></Step>
          <Step n={2}><span>Defina um nome de usuário e senha (mínimo 6 caracteres) para a conta <strong className="text-slate-100">admin</strong>.</span></Step>
          <Step n={3}><span>Clique <strong className="text-slate-100">Criar conta e entrar</strong>. O app abre normalmente.</span></Step>
          <Tip>Para voltar ao modo single-user, delete todos os usuários em Configurações → Usuários. Sem nenhum usuário, o login para de ser exigido.</Tip>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Perfis (roles)</p>
          <KV items={[
            ['admin', 'Acesso total — cria/edita/exclui VPS, projetos, contas, usuários e configurações'],
            ['viewer', 'Somente leitura — visualiza tudo e usa o IDE, chat IA e agente, mas não altera cadastros'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Gerenciar usuários</p>
          <p className="text-xs">Acesse <em>Configurações → Usuários</em> (visível apenas para admins).</p>
          <KV items={[
            ['Criar usuário', 'Preencha username, senha e role (viewer ou admin) → Criar'],
            ['Excluir usuário', 'Clique no ícone de lixeira na linha do usuário. Não é possível excluir a si mesmo.'],
            ['Alterar senha', 'Implementado via IPC — em breve na UI'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Sessão</p>
          <KV items={[
            ['Logout', 'Sidebar → botão ↙ ao lado do username (canto inferior esquerdo)'],
            ['Duração', 'A sessão dura enquanto o app estiver aberto. Fechar e reabrir o app exige novo login.'],
          ]}/>
        </div>
        <Warn>A autenticação protege o gerenciamento das configurações do app (VPS, projetos, usuários). O acesso SSH às VPS em si ainda depende das credenciais SSH configuradas individualmente.</Warn>
      </div>
    ),
  },

  // ── CONFIGURAÇÕES ─────────────────────────────────────────────────────
  {
    id: 'settings',
    icon: Settings,
    title: 'Configurações',
    color: 'bg-slate-600/30 text-slate-300',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">VS Code e SSH</p>
          <KV items={[
            ['Caminho VS Code', 'Executável. Padrão: code (precisa estar no PATH)'],
            ['Chave SSH', 'Caminho para chave privada. Vazio usa ~/.ssh/id_rsa'],
          ]}/>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><Zap size={12}/> Provedores de IA</p>
          <p className="text-xs">Configure API Keys para o chat, AI HUB e Modo Agente.</p>
          <KV items={[
            ['Groq', 'Grátis. Llama 3.3 70B. Ótimo para começar.'],
            ['DeepSeek', 'Muito barato (~R$0,05/conversa). Excelente para código.'],
            ['Anthropic', 'Claude — melhor qualidade e Modo Agente mais confiável.'],
            ['OpenAI', 'GPT-4.1, GPT-4o, o3. Modelos dinâmicos via /models.'],
            ['Gemini', 'Google Gemini Pro / Flash. Janela de 1M tokens.'],
            ['OpenRouter', 'Uma API Key para 300+ modelos diferentes.'],
            ['Ollama', 'Local — sem API Key, sem internet, sem custo.'],
          ]}/>
          <Tip>Clique "Testar conexão" para validar a API Key antes de usar no chat.</Tip>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><ShieldCheck size={12}/> Usuários (autenticação)</p>
          <p className="text-xs">Visível apenas para admins quando há usuários cadastrados. Crie contas com role <strong>admin</strong> (acesso total) ou <strong>viewer</strong> (somente leitura).</p>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Backup e Restauração</p>
          <p className="text-xs">Exporta e importa todas as VPS, projetos e contas em JSON. API Keys, senhas SSH e usuários NÃO são exportados.</p>
        </div>
      </div>
    ),
  },

  // ── CHAVE SSH ─────────────────────────────────────────────────────────
  {
    id: 'ssh',
    icon: Key,
    title: 'Configurar chave SSH',
    color: 'bg-cyan-600/20 text-cyan-400',
    content: (
      <div className="space-y-3">
        <p>A chave SSH elimina a necessidade de digitar senha a cada conexão e é mais segura.</p>
        <Step n={1}><span>Gere uma chave no terminal do <strong className="text-slate-100">seu PC</strong>:</span><Block>{`ssh-keygen -t ed25519 -C "seu@email.com"`}</Block></Step>
        <Step n={2}><span>Copie a chave para cada VPS:</span><Block>{`ssh-copy-id root@IP_DA_VPS`}</Block></Step>
        <Step n={3}><span>Em <em>Configurações</em>, preencha o caminho da chave privada:</span><Block>{`C:\\Users\\SeuUsuario\\.ssh\\id_ed25519`}</Block></Step>
        <Step n={4}><span>Teste em <em>VPS</em> → <strong className="text-slate-100">Testar</strong>. Deve aparecer <span className="text-emerald-400">Conectado</span> sem pedir senha.</span></Step>
        <Tip>Se usar passphrase na chave, preencha o campo "Senha SSH" com a passphrase (não a senha root). O app a usa como passphrase, não como senha.</Tip>
      </div>
    ),
  },

  // ── AUTENTICAR CLAUDE CODE ────────────────────────────────────────────
  {
    id: 'claudeauth',
    icon: BotMessageSquare,
    title: 'Autenticar Claude Code na VPS',
    color: 'bg-brand-600/20 text-brand-400',
    content: (
      <div className="space-y-3">
        <p className="text-xs text-slate-400">Necessário apenas se quiser usar o Claude Code CLI na VPS via terminal. Para o chat com API direta (AI HUB e chat do IDE), configure um provedor em Configurações — não precisa de Claude Code.</p>
        <Step n={1}><span>No <em>Lançador</em>, clique em <strong className="text-slate-100">Terminal</strong> na VPS.</span></Step>
        <Step n={2}><span>Instale Node.js:</span><Block>{`curl -fsSL https://deb.nodesource.com/setup_22.x | bash -\napt-get install -y nodejs`}</Block></Step>
        <Step n={3}><span>Instale Claude Code:</span><Block>{`npm install -g @anthropic-ai/claude-code`}</Block></Step>
        <Step n={4}><span>Execute e autentique:</span><Block>{`claude`}</Block></Step>
        <Step n={5}><span>Abra a URL exibida no navegador e faça login com a conta correta para esta VPS.</span></Step>
        <Warn>Se você tem múltiplas contas Claude, use uma em cada VPS. O isolamento é garantido pelo SO Linux de cada servidor.</Warn>
      </div>
    ),
  },

  // ── TROUBLESHOOT ──────────────────────────────────────────────────────
  {
    id: 'troubleshoot',
    icon: AlertTriangle,
    title: 'Solução de problemas',
    color: 'bg-red-600/20 text-red-400',
    content: (
      <div className="space-y-4">
        {[
          {
            problem: 'Erro "column sshHostFingerprint does not exist" ao criar VPS',
            solutions: [
              'Os pacotes internos do app precisam ser atualizados. Use pnpm dev em vez do app empacotado.',
              'Ou delete o banco de dados antigo em %APPDATA%\\NEX-ALS IDE\\cwm.db (perde dados existentes).',
              'O app empacotado (.exe) precisa ser regeado com pnpm package:win após atualizações de schema.',
            ],
          },
          {
            problem: 'Erro "no such table: ai_conversations" no AI HUB',
            solutions: [
              'Mesmo motivo: app empacotado desatualizado. Use pnpm dev.',
              'O banco é criado com todas as tabelas ao iniciar — verifique se initializeDatabase() rodou.',
            ],
          },
          {
            problem: 'Chat mostra "claude -p (SSH)" após configurar provedor',
            solutions: [
              'Feche e reabra o IDE — o provedor é detectado ao montar a página.',
              'Confirme que marcou "Habilitado" e clicou "Salvar" no card do provedor.',
              'Use "Testar conexão" para verificar se a API Key é válida.',
            ],
          },
          {
            problem: 'Modo Agente não funciona (botão 🤖 não aparece)',
            solutions: [
              'Configure um provedor de IA em Configurações → Provedores de IA.',
              'Gemini não suporta Modo Agente — use Anthropic, DeepSeek ou OpenAI.',
            ],
          },
          {
            problem: 'Fingerprint SSH mudou — acesso bloqueado',
            solutions: [
              'Se reinstalou a VPS legitimamente: VPS → clique no botão ShieldOff âmbar → Limpar fingerprint.',
              'Se NÃO reinstalou: investigue antes de limpar — pode ser ataque MITM.',
            ],
          },
          {
            problem: 'Docker/PM2 mostra "não encontrado"',
            solutions: [
              'Verifique se Docker/PM2 está instalado: docker --version ou pm2 --version',
              'O usuário SSH precisa ter permissão docker: usermod -aG docker $USER',
            ],
          },
          {
            problem: 'Incident Mode / Deploy Assistant não abre',
            solutions: [
              'Verifique se o provedor de IA está configurado em Configurações.',
              'Incident Mode: diagnóstico automático requer provedor ativo para funcionar.',
              'Deploy Assistant: gera plano via IA — sem provedor configurado não funciona.',
            ],
          },
          {
            problem: 'Autenticação SSH falhou',
            solutions: [
              'Preencha o campo Senha SSH no cadastro da VPS.',
              'Ou configure uma chave SSH (ver seção acima).',
              'Confirme o usuário correto — geralmente root.',
            ],
          },
        ].map(({ problem, solutions }) => (
          <div key={problem} className="space-y-1.5">
            <p className="text-slate-100 text-xs font-medium flex gap-1.5 items-start">
              <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5"/>{problem}
            </p>
            <ul className="space-y-1 ml-4">
              {solutions.map(s => (
                <li key={s} className="text-xs text-slate-400 flex gap-2">
                  <span className="text-slate-600">→</span>{s}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    ),
  },

  // ── CLAUDE CODE (CONTA) ───────────────────────────────────────────────
  {
    id: 'claude-code-account',
    icon: Terminal,
    title: 'Claude Code — Usar conta Pro sem API Key',
    color: 'bg-brand-600/20 text-brand-400',
    content: (
      <div className="space-y-4">
        <p>Use sua assinatura Claude Pro diretamente na IDE — sem API Key separada, sem cobrança por token. A IDE detecta o Claude Code CLI instalado no seu PC e usa a autenticação existente.</p>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-slate-800/60 rounded-lg p-3 space-y-1">
            <p className="text-slate-300 font-semibold">Modo API Key</p>
            <p className="text-slate-500">Chave gerada no console</p>
            <p className="text-amber-400">Cobra por token usado</p>
          </div>
          <div className="bg-brand-900/20 border border-brand-800/30 rounded-lg p-3 space-y-1">
            <p className="text-brand-300 font-semibold">Claude Code (conta)</p>
            <p className="text-slate-500">Login com conta Claude.ai</p>
            <p className="text-emerald-400">Incluído no plano Pro ✓</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Configuração — uma única vez</p>
          <Step n={1}><span>Instale o Claude Code CLI no seu PC:</span><Block>{`npm install -g @anthropic-ai/claude-code`}</Block></Step>
          <Step n={2}><span>Execute e autentique com sua conta Pro:</span><Block>{`claude`}</Block><span className="text-xs text-slate-500">Abre o browser automaticamente. Faça login com a conta Claude.ai do plano Pro.</span></Step>
          <Step n={3}><span>Na IDE → <strong className="text-slate-100">Configurações → Provedores de IA</strong> → card <strong className="text-slate-100">Claude Code</strong> → clique <strong className="text-slate-100">Usar como padrão</strong>.</span></Step>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">O que muda após ativar</p>
          <KV items={[
            ['AI Hub', 'Usa conta Pro em todas as conversas — sem API Key'],
            ['IDE chat', 'Mesmo comportamento, zero custo extra'],
            ['Squad', 'Todos os 8 agentes usam a conta Pro automaticamente'],
            ['Streaming', 'Texto aparece em tempo real igual ao modo API'],
          ]}/>
          <Info>O Claude Code v2.1+ já vem autenticado se você usou antes no VS Code. A IDE detecta automaticamente.</Info>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Solução de problemas</p>
          <KV items={[
            ['"Não encontrado"', 'Claude Code não está no PATH. Instale com npm install -g @anthropic-ai/claude-code e clique ↺'],
            ['"Não autenticado"', 'Execute claude no terminal e faça login novamente'],
            ['Resposta lenta', 'Normal na primeira mensagem — o CLI inicializa. As seguintes são rápidas'],
          ]}/>
        </div>
      </div>
    ),
  },

  // ── SQUAD ─────────────────────────────────────────────────────────────
  {
    id: 'squad',
    icon: Users,
    title: 'Squad — Equipe de 10 agentes + Pipeline autônomo',
    color: 'bg-indigo-600/20 text-indigo-400',
    content: (
      <div className="space-y-4">
        <p>O Squad substitui o chat com um único agente por uma <strong className="text-slate-100">equipe completa de especialistas</strong>. Cada agente tem papel, personalidade e provedor de IA próprios. Acesse pelo botão <strong className="text-slate-100">Squad</strong> na sidebar.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Os 10 agentes</p>
          <KV items={[
            ['🎯 Jarvis  (Claude)',  'PM / Orquestrador — coordena o time e delega tarefas'],
            ['👩‍💻 Friday  (GPT)',    'Desenvolvedora Sênior — escreve e refatora código'],
            ['🔍 Fury    (Gemini)', 'Pesquisa de Mercado — analisa concorrência e dados'],
            ['🎨 Shuri   (Claude)', 'UX / Design — cria specs de interface e fluxos'],
            ['📣 Pepper  (GPT)',    'Marketing / Brand — copy, posicionamento e comunicação'],
            ['📊 Vision  (Gemini)', 'Growth / Métricas — funil, conversão e estratégia'],
            ['📋 Requis  (Claude)', 'Documentação — requisitos técnicos com critério de aceite'],
            ['🧪 Tester  (GPT)',    'QA / Testes — escreve e executa testes unitários e integração'],
            ['🔎 Reviewer (Claude)', 'Code Review — lê código implementado, avalia OWASP, emite [APROVADO] ou [BLOQUEADO]'],
            ['🚀 DevOps  (Claude)', 'Entrega — cria commits Conventional Commits, git push, abre PR com template Markdown'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Como usar — modo manual</p>
          <KV items={[
            ['Selecionar agente', 'Clique no nome do agente no painel esquerdo'],
            ['@mencionar', 'Digite @friday no início da mensagem para direcionar a um agente específico'],
            ['Delegação automática', 'Quando um agente menciona @outro na resposta, aquele agente responde automaticamente'],
            ['Exec auto', 'Toggle ⚡ no header — executa blocos de ação automaticamente após cada resposta'],
            ['Modo autônomo', 'Toggle 🤖 — loop contínuo de ação → resultado → próxima ação até [PRONTO]'],
            ['Histórico', 'Conversas salvas por sessão — painel direito'],
          ]}/>
          <Tip>Use <Code>@jarvis planeje o projeto X</Code> para o Jarvis coordenar e delegar automaticamente para Friday, Shuri ou outros agentes.</Tip>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">🚀 Modo Pipeline — execução autônoma completa</p>
          <p className="text-xs">Clique em <strong className="text-slate-100">Pipeline</strong> (botão índigo no header), descreva a tarefa e pressione Enter. A equipe executa as 6 fases automaticamente, sem intervenção manual.</p>
          <Block>{`🎯 Fase 1 — Jarvis planeja (arquivos, stack, ordem)
👩‍💻 Fase 2 — Friday implementa arquivo por arquivo
🔎 Fase 3 — Reviewer lê e avalia o código
       ↳ se [BLOQUEADO] → Fase 3b: Friday corrige issues
🧪 Fase 4 — Tester escreve e executa testes
🚀 Fase 5 — DevOps faz commit + push + PR
✅ Concluído`}</Block>
          <KV items={[
            ['Stepper visual', 'Barra de fases no header mostra qual etapa está ativa em tempo real'],
            ['[APROVADO]', 'Reviewer aprova → pipeline avança para Tester automaticamente'],
            ['[BLOQUEADO]', 'Reviewer bloqueia → Friday recebe a lista de issues e corrige → Reviewer revisa novamente'],
            ['Parar', 'Botão ✕ interrompe o pipeline a qualquer momento'],
            ['Sem remote git', 'DevOps verifica git remote -v antes do push — se não houver remote, informa o comando para adicionar e encerra com [PRONTO]'],
          ]}/>
          <Info>O Pipeline usa o modo Local por padrão. Defina a pasta do projeto em "Pasta local" antes de clicar Pipeline.</Info>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Blocos de ação — a IA executa no PC ou VPS</p>
          <p className="text-xs">Os agentes geram blocos executáveis. Com <strong className="text-slate-100">Exec auto ⚡</strong> ativo, são executados sem clicar.</p>
          <KV items={[
            ['SHELL  (amarelo)', 'Executa um comando no terminal (local ou VPS)'],
            ['WRITE  (azul)',    'Cria ou sobrescreve um arquivo'],
            ['READ_FILE  (cinza)',   'Lê o conteúdo de um arquivo'],
            ['READ_DIR  (cinza)',  'Lista o conteúdo de uma pasta'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><GitBranch size={12}/> Pipeline Homolog → Produção (modo VPS)</p>
          <p className="text-xs">Modo de segurança para quem tem dois servidores. Testa no Homolog, pede confirmação, depois vai para Produção.</p>
          <Step n={1}><span>Ative o toggle <strong className="text-slate-100">PIPELINE</strong> no painel direito do Squad.</span></Step>
          <Step n={2}><span>Selecione <strong className="text-slate-100">VPS Alvo</strong> (seletor superior) = seu Homolog.</span></Step>
          <Step n={3}><span>Selecione <strong className="text-slate-100">VPS Prod</strong> = seu servidor de Produção.</span></Step>
          <Step n={4}><span>Clique <strong className="text-slate-100">Executar</strong> em qualquer bloco → roda no Homolog → gate âmbar aparece.</span></Step>
          <Step n={5}><span><strong className="text-emerald-400">Aprovar</strong> → executa em Produção. <strong className="text-slate-400">Rejeitar</strong> → produção intocada.</span></Step>
          <Warn>Se "— VPS Prod —" estiver selecionado (sem VPS escolhida), o Aprovar não executa nada. Selecione o servidor de produção antes de usar.</Warn>
        </div>
      </div>
    ),
  },

  // ── SOBRE ─────────────────────────────────────────────────────────────
  {
    id: 'about',
    icon: Monitor,
    title: 'Sobre o NEX-ALS IDE',
    color: 'bg-slate-700/30 text-slate-400',
    content: (
      <div className="space-y-4 text-xs">
        <div className="flex flex-col gap-1">
          <p className="text-slate-100 font-semibold text-sm">NEX-ALS IDE</p>
          <p className="text-slate-400">IDE desktop para gerenciar múltiplas VPS, projetos e contas IA — com AI HUB integrado, Incident Mode e Deploy Assistant.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Versão', '3.34.0'],
            ['Runtime', 'Electron + Node.js 22'],
            ['Interface', 'React 18 + Tailwind CSS'],
            ['Banco de dados', 'SQLite local (Prisma ORM)'],
            ['SSH/SFTP', 'ssh2 (nativo Windows/Linux)'],
            ['Editor', 'Monaco Editor (VS Code engine)'],
            ['Terminal', 'xterm.js multi-abas'],
            ['Segurança', 'AES-256, contextIsolation, fingerprint SSH'],
            ['IA', 'Anthropic · OpenAI · Gemini · DeepSeek · OpenRouter · Ollama'],
            ['Repositório', 'github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-slate-500 w-28 shrink-0">{k}</span>
              <span className="text-slate-300">{v}</span>
            </div>
          ))}
        </div>
        <Tip>Os dados ficam em <Code>%APPDATA%\NEX-ALS IDE\cwm.db</Code>. Nenhum dado é enviado a servidores externos, exceto as chamadas às APIs de IA que você configurar.</Tip>
        <div className="border-t border-slate-800 pt-3 text-center space-y-1">
          <p className="text-slate-300 font-semibold">NEX-ALS</p>
          <p className="text-slate-500">Copyright © 2026 NEX-ALS. Todos os direitos reservados.</p>
        </div>
      </div>
    ),
  },
]

export default function Help() {
  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <BookOpen size={22} className="text-brand-400"/>
          <h1 className="text-2xl font-bold text-slate-100">Manual de Uso</h1>
        </div>
        <p className="text-slate-400">Guia completo do NEX-ALS IDE <strong className="text-slate-300">v3.34.0</strong> — gerencie VPS, projetos e contas de IA numa interface integrada com editor, terminal SSH, AI HUB, Agente Autônomo, Squad de 10 agentes com <strong className="text-slate-300">Pipeline autônomo</strong> (Jarvis → Friday → Reviewer → Tester → DevOps), Claude Code (conta Pro sem API Key), Incident Mode e Deploy Assistant.</p>
      </div>

      {/* Cards de acesso rápido */}
      <div className="mb-6 grid grid-cols-5 gap-3">
        {[
          { icon: Code2,     label: 'IDE Integrado',  desc: 'Lançador → IDE',       color: 'text-brand-400' },
          { icon: Sparkles,  label: 'AI HUB',         desc: 'Sidebar → AI HUB',     color: 'text-purple-400' },
          { icon: Users,     label: 'Squad',           desc: 'Sidebar → Squad',      color: 'text-indigo-400' },
          { icon: Siren,     label: 'Incident Mode',  desc: 'Lançador → 🚨',         color: 'text-red-400' },
          { icon: Rocket,    label: 'Deploy',         desc: 'Lançador → 🚀',         color: 'text-emerald-400' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <Icon size={20} className={`mx-auto mb-2 ${color}`}/>
            <p className="text-slate-100 text-sm font-medium">{label}</p>
            <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      {/* Mapa do app — redesigned */}
      <div className="mb-6 space-y-3">
        <div className="flex items-baseline gap-3">
          <p className="text-slate-100 font-semibold text-sm">Como o app está organizado</p>
          <p className="text-slate-600 text-xs">Encontre qualquer funcionalidade em segundos</p>
        </div>

        {/* Linha 1: Gerenciamento + Desenvolvimento */}
        <div className="grid grid-cols-5 gap-3">

          {/* Gerenciamento — 3 colunas */}
          <div className="col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="flex items-center gap-2 text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"/>
              Gerenciamento
            </p>
            <div className="grid grid-cols-3 gap-1">
              {([
                [LayoutDashboard, 'Dashboard',    'Visão geral'],
                [Server,          'VPS',           'Seus servidores'],
                [FolderOpen,      'Projetos',      'Aplicações'],
                [BarChart3,       'Monitor',       'CPU · RAM · Disco'],
                [Settings,        'Configurações', 'SSH · IA · Backup'],
                [History,         'Histórico',     'Registro de acessos'],
              ] as [React.ElementType, string, string][]).map(([Icon, name, desc]) => (
                <div key={name} className="flex items-start gap-2 p-2 rounded-lg hover:bg-slate-800/60 transition-colors cursor-default group">
                  <Icon size={13} className="text-blue-400 shrink-0 mt-0.5"/>
                  <div className="min-w-0">
                    <p className="text-slate-200 text-xs font-medium leading-tight">{name}</p>
                    <p className="text-slate-600 text-[10px] leading-tight mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desenvolvimento — 2 colunas */}
          <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="flex items-center gap-2 text-[10px] font-semibold text-brand-400 uppercase tracking-wider mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0"/>
              Desenvolvimento
            </p>
            <div className="space-y-1">
              {([
                [Rocket, 'Lançador',    'Acesse qualquer VPS em um clique.'],
                [Code2,  'IDE — VPS',   'Desenvolva diretamente no servidor.'],
                [Monitor,'IDE — Local', 'Edite arquivos locais com segurança.'],
              ] as [React.ElementType, string, string][]).map(([Icon, name, desc]) => (
                <div key={name} className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800/60 transition-colors cursor-default">
                  <Icon size={14} className="text-brand-400 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-slate-200 text-xs font-medium leading-tight">{name}</p>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-tight">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Linha 2: IA · Squad · Deploy · Incident */}
        <div className="grid grid-cols-4 gap-3">
          {([
            {
              icon: Sparkles,
              tag:  'Inteligência Artificial',
              name: 'AI Hub',
              desc: 'Converse com IA usando o contexto real do seu servidor.',
              dot:  'bg-purple-400', accent: 'text-purple-400',
              card: 'bg-purple-950/25 border-purple-800/30',
            },
            {
              icon: Users,
              tag:  'Equipe de Agentes',
              name: 'Squad',
              desc: '8 agentes especializados com pipeline homolog → prod.',
              dot:  'bg-indigo-400', accent: 'text-indigo-400',
              card: 'bg-indigo-950/25 border-indigo-800/30',
            },
            {
              icon: Rocket,
              tag:  'Deploy',
              name: 'Deploy Assistant',
              desc: 'Planeje e execute deploys com rollback automático.',
              dot:  'bg-emerald-400', accent: 'text-emerald-400',
              card: 'bg-emerald-950/25 border-emerald-800/30',
            },
            {
              icon: Siren,
              tag:  'Incidentes',
              name: 'Incident Mode',
              desc: 'Resolva incidentes em produção em uma única tela.',
              dot:  'bg-red-500', accent: 'text-red-400',
              card: 'bg-red-950/25 border-red-800/30',
            },
          ]).map(({ icon: Icon, tag, name, desc, dot, accent, card }) => (
            <div key={name} className={`border rounded-xl p-4 hover:brightness-110 transition-all cursor-default ${card}`}>
              <p className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider mb-3 ${accent} opacity-80`}>
                <span className={`w-1.5 h-1.5 rounded-full ${dot} shrink-0`}/>
                {tag}
              </p>
              <div className="flex items-start gap-3">
                <Icon size={18} className={`${accent} shrink-0 mt-0.5`}/>
                <div>
                  <p className="text-slate-100 text-sm font-semibold leading-tight">{name}</p>
                  <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Accordion sections={sections}/>
    </div>
  )
}
