import { useState } from 'react'
import {
  BookOpen, Server, FolderOpen, User, Rocket, Settings,
  ChevronDown, ChevronRight, Terminal, Key, AlertTriangle,
  BotMessageSquare, CheckCircle, Monitor, HelpCircle, Code2,
  BarChart3, History, Box, Cpu, FileText, Bot, Zap,
  Sparkles, Siren, Globe, ShieldCheck, ExternalLink,
  Play, RotateCcw, Database, Layers, LayoutDashboard,
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
        <Step n={3}><strong className="text-slate-100">Abra o IDE</strong> — vá em <em>Lançador</em> → clique em <strong>IDE</strong> na VPS desejada. O HEXAGON IDE abre em tela cheia com explorer, editor e terminal SSH.</Step>
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
        <p className="text-xs text-slate-400">O HEXAGON IDE opera em dois modos distintos. Entender qual usar evita erros e reduz o risco de modificar produção por acidente.</p>

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
              <p className="text-slate-500">✗ Sem terminal SSH</p>
              <p className="text-slate-500">✗ Sem Git integrado</p>
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
    title: 'HEXAGON AI HUB — Central de IA',
    color: 'bg-purple-600/20 text-purple-400',
    content: (
      <div className="space-y-4">
        <p>O AI HUB é a central de inteligência artificial do HEXAGON IDE. Acesse pelo botão <strong className="text-slate-100">AI HUB</strong> (ícone Sparkles roxo) na sidebar principal.</p>

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

  // ── HEXAGON IDE ────────────────────────────────────────────────────────
  {
    id: 'ide',
    icon: Code2,
    title: 'HEXAGON IDE — Editor integrado',
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
            ['Ctrl+S', 'Salvar arquivo via SFTP'],
            ['Ctrl+`', 'Abrir/fechar terminal'],
            ['Ctrl+Shift+F', 'Busca em arquivos (grep SSH) — resultados clicáveis'],
            ['Ctrl+Shift+P', 'Paleta de comandos Monaco'],
            ['Ctrl+H', 'Find & Replace no arquivo'],
            ['Ctrl+G', 'Ir para linha específica'],
            ['Botão ⊟ (Columns2)', 'Ativar/desativar split editor (dois painéis)'],
            ['Botão Claude (roxo)', 'Abrir painel de chat IA'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Botões na top bar</p>
          <KV items={[
            ['🔴 PRODUÇÃO / 🟢 LOCAL', 'Badge de modo — vermelho = VPS real, verde = local seguro'],
            ['⎋ (ExternalLink)', 'Abre esta VPS em nova janela independente (multi-monitor)'],
            ['🚨 (Siren)', 'Abre Incident Mode para esta VPS'],
            ['🚀 (Rocket)', 'Abre Deploy Assistant para esta VPS'],
            ['Claude (roxo)', 'Painel de chat + Modo Agente'],
          ]}/>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Abas do painel esquerdo</p>
          <KV items={[
            ['Arquivos', 'Explorer SFTP: criar, renomear, deletar, duplicar, arrastar'],
            ['Busca', 'grep SSH em todo o projeto com preview de linha'],
            ['Git', 'Status, diff inline, stage, commit, push, pull, log'],
            ['Portas', 'Port forwarding SSH: acessar porta da VPS como localhost'],
            ['Docker', 'Listar containers, Start/Stop/Logs/Remover'],
            ['PM2', 'Listar processos, Restart/Stop/Logs/Excluir'],
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
            ['Split editor', 'Dois painéis lado a lado com abas independentes'],
            ['Preview de imagem', 'PNG/JPG abrem como preview embutido na aba'],
            ['TypeScript LSP', 'Clique "TS LSP" na status bar (requer tunel 6009 na VPS)'],
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
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">🤖 Modo Agente</p>
          <p className="text-xs">Ative o botão <strong className="text-slate-100">🤖 Agente</strong> no header do chat. Claude usa ferramentas reais — lê, escreve e executa arquivos por conta própria.</p>
          <div className="bg-slate-800 rounded-lg p-3 text-xs font-mono space-y-0.5">
            <p className="text-slate-400">Você: "Adicione validação Zod no formulário de usuário"</p>
            <p className="text-yellow-400">⟳ list_directory src/schemas</p>
            <p className="text-emerald-400">✓ read_file src/components/UserForm.tsx</p>
            <p className="text-emerald-400">✓ write_file src/schemas/user.schema.ts</p>
            <p className="text-emerald-400">✓ write_file src/components/UserForm.tsx</p>
            <p className="text-slate-300">Claude: "Adicionei UserSchema com validação de email..."</p>
          </div>
          <KV items={[
            ['50 iterações', 'O agente pode encadear até 50 chamadas de ferramentas'],
            ['Botão ▶ Continuar', 'Aparece ao atingir 50 iter — retoma sem perder histórico'],
            ['📦 Snapshots', 'Antes de cada write_file, o conteúdo original é salvo. Clique ↩ Restaurar.'],
          ]}/>
          <Warn>Comandos destrutivos (docker stop, rm -rf, git reset --hard) no Modo Agente exigem digitar CONFIRMO no modal antes de executar.</Warn>
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
          ['Título da janela', 'Mostra "HEXAGON IDE — {nome da VPS}" para identificação fácil'],
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
        <p>Na primeira conexão com uma VPS, o HEXAGON IDE salva automaticamente o <strong className="text-slate-100">fingerprint SHA-256</strong> da chave pública do servidor. Em todas as conexões seguintes, o fingerprint é comparado.</p>
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
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Backup e Restauração</p>
          <p className="text-xs">Exporta e importa todas as VPS, projetos e contas em JSON. API Keys e senhas SSH NÃO são exportadas.</p>
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
              'Ou delete o banco de dados antigo em %APPDATA%\\HEXAGON IDE\\cwm.db (perde dados existentes).',
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

  // ── SOBRE ─────────────────────────────────────────────────────────────
  {
    id: 'about',
    icon: Monitor,
    title: 'Sobre o HEXAGON IDE',
    color: 'bg-slate-700/30 text-slate-400',
    content: (
      <div className="space-y-4 text-xs">
        <div className="flex flex-col gap-1">
          <p className="text-slate-100 font-semibold text-sm">HEXAGON IDE</p>
          <p className="text-slate-400">IDE desktop para gerenciar múltiplas VPS, projetos e contas IA — com AI HUB integrado, Incident Mode e Deploy Assistant.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Versão', '3.3.1'],
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
        <Tip>Os dados ficam em <Code>%APPDATA%\HEXAGON IDE\cwm.db</Code>. Nenhum dado é enviado a servidores externos, exceto as chamadas às APIs de IA que você configurar.</Tip>
        <div className="border-t border-slate-800 pt-3 text-center space-y-1">
          <p className="text-slate-300 font-semibold">HEXAGON TECNOLOGIA</p>
          <p className="text-slate-500">Copyright © 2026 HEXAGON TECNOLOGIA. Todos os direitos reservados.</p>
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
        <p className="text-slate-400">Guia completo do HEXAGON IDE <strong className="text-slate-300">v3.3.1</strong> — gerencie VPS, projetos e contas de IA numa interface integrada com editor, terminal SSH, AI HUB, Incident Mode e Deploy Assistant.</p>
      </div>

      {/* Cards de acesso rápido */}
      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { icon: Code2,     label: 'IDE Integrado',  desc: 'Lançador → IDE',       color: 'text-brand-400' },
          { icon: Sparkles,  label: 'AI HUB',         desc: 'Sidebar → AI HUB',     color: 'text-purple-400' },
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

        {/* Linha 2: IA · Deploy · Incident */}
        <div className="grid grid-cols-3 gap-3">
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
