import { useState } from 'react'
import {
  BookOpen, Server, FolderOpen, User, Rocket, Settings,
  ChevronDown, ChevronRight, Terminal, Key, Wifi, AlertTriangle,
  BotMessageSquare, CheckCircle, Monitor, HelpCircle, Code2,
  BarChart3, History, Box, Cpu, FileText, Bot, Zap,
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
              <div className={`p-1.5 rounded-lg ${s.color}`}>
                <Icon size={15} />
              </div>
              <span className="font-medium text-slate-100 flex-1">{s.title}</span>
              {isOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
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
      <HelpCircle size={13} className="shrink-0 mt-0.5 text-brand-400" />
      <span>{children}</span>
    </div>
  )
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-900/20 border border-amber-800/30 rounded-lg px-3 py-2.5 text-amber-300 text-xs">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
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
          <span className="text-slate-100 font-medium w-32 shrink-0">{k}</span>
          <span className="text-slate-400">{v}</span>
        </div>
      ))}
    </div>
  )
}

const sections: Section[] = [
  {
    id: 'quickstart',
    icon: CheckCircle,
    title: '🚀 Início Rápido',
    color: 'bg-emerald-600/20 text-emerald-400',
    content: (
      <div className="space-y-3">
        <Step n={1}><strong className="text-slate-100">Cadastre sua VPS</strong> — vá em <em>VPS</em> → Nova VPS. Preencha IP, porta, usuário e senha.</Step>
        <Step n={2}><strong className="text-slate-100">Crie um Projeto</strong> — vá em <em>Projetos</em> → Novo Projeto. Informe o caminho remoto (ex: <Code>/root/meu-projeto</Code>) e associe à VPS.</Step>
        <Step n={3}><strong className="text-slate-100">Abra o IDE</strong> — vá em <em>Lançador</em> → clique em <strong className="text-slate-100">IDE</strong>. O HEXAGON IDE abre em tela cheia com explorer, editor e terminal SSH.</Step>
        <Step n={4}><strong className="text-slate-100">Configure a IA</strong> — vá em <em>Configurações</em> → Provedores de IA → escolha DeepSeek, Groq (grátis) ou Anthropic → salve a API Key.</Step>
        <Step n={5}><strong className="text-slate-100">Use o chat</strong> — no IDE, clique no botão roxo <strong className="text-slate-100">Claude</strong> (canto superior direito). Para o agente autônomo, ative o botão 🤖.</Step>
        <Tip>Para edição local (sem VPS), clique em "Abrir pasta local no IDE" no Lançador.</Tip>
      </div>
    ),
  },
  {
    id: 'ide',
    icon: Code2,
    title: 'HEXAGON IDE — Editor integrado',
    color: 'bg-brand-600/20 text-brand-400',
    content: (
      <div className="space-y-4">
        <p>IDE completo que roda diretamente na VPS via SSH/SFTP. Sem precisar do VS Code.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Layout</p>
          <Block>{`┌─ Arquivos │ Busca │ Git │ Portas │ Docker │ PM2 ─┐
│                                                  │
│  Monaco Editor (com split opcional Ctrl+⊟)       │
│                                                  │
├─ Terminal │ Problemas │ Logs ────────────────────┤
│  xterm.js SSH multi-abas                         │
└──────────────────────────────────────────────────┘`}</Block>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Atalhos</p>
          <KV items={[
            ['Ctrl+S', 'Salvar arquivo via SFTP'],
            ['Ctrl+`', 'Abrir/fechar terminal'],
            ['Ctrl+Shift+F', 'Busca em arquivos (grep SSH)'],
            ['Ctrl+Shift+P', 'Paleta de comandos Monaco'],
            ['Ctrl+H', 'Find & Replace no arquivo'],
            ['Ctrl+G', 'Ir para linha'],
            ['Botão ⊟', 'Ativar/desativar split editor'],
            ['Botão Claude (roxo)', 'Abrir painel de chat IA'],
          ]} />
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Dois modos</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex gap-2"><span className="text-red-400 font-mono">PRODUÇÃO</span><span>Badge vermelho — editando na VPS. Cuidado com arquivos de produção.</span></div>
            <div className="flex gap-2"><span className="text-emerald-400 font-mono">LOCAL</span><span>Badge verde — editando pasta local (OneDrive, C:\, etc.). Seguro.</span></div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Abas do painel esquerdo</p>
          <KV items={[
            ['Arquivos', 'Explorer SFTP com create/rename/delete/duplicate'],
            ['Busca', 'grep SSH em todo o projeto com resultados clicáveis'],
            ['Git', 'Status, diff, stage, commit, push, pull'],
            ['Portas', 'Port forwarding SSH: localhost:X → VPS:Y'],
            ['Docker', 'Listar containers, Start/Stop/Logs/Remover'],
            ['PM2', 'Listar processos Node.js, Restart/Stop/Logs'],
          ]} />
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Abas do painel inferior</p>
          <KV items={[
            ['Terminal', 'SSH interativo multi-abas (xterm.js)'],
            ['Problemas', 'Erros e warnings do Monaco Editor'],
            ['Logs', 'tail de arquivos + presets (syslog, nginx, PM2) + modo Watch'],
          ]} />
        </div>
      </div>
    ),
  },
  {
    id: 'ai-chat',
    icon: Bot,
    title: 'Chat IA — Modos de uso',
    color: 'bg-purple-600/20 text-purple-400',
    content: (
      <div className="space-y-4">
        <p>O botão <strong className="text-slate-100">Claude</strong> (roxo) na top bar do IDE abre o painel de chat à direita.</p>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Modo Chat (padrão)</p>
          <p className="text-xs">Claude recebe o contexto do projeto (árvore de arquivos + código-fonte + arquivo aberto) e responde com sugestões. Você aplica manualmente.</p>
          <KV items={[
            ['Copiar', 'Copia o bloco de código para o clipboard'],
            ['▶ arquivo.ts', 'Aplica o bloco no arquivo aberto no editor'],
            ['Salvar como…', 'Salva o bloco como um novo arquivo'],
            ['Revisar N alterações', 'Aparece quando há 2+ blocos — review em lote com nomes automáticos'],
            ['▶ Executar na VPS', 'Roda blocos bash/sh direto na VPS e mostra output inline'],
          ]} />
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">🤖 Modo Agente</p>
          <p className="text-xs">Ative o botão <strong className="text-slate-100">🤖 Agente</strong> no header do chat. Claude passa a usar ferramentas reais — lê, escreve e executa arquivos por conta própria, sem você precisar copiar/colar nada.</p>
          <div className="bg-slate-800 rounded-lg p-3 text-xs font-mono space-y-0.5">
            <p className="text-slate-400">Você: "Adicione validação de e-mail no formulário"</p>
            <p className="text-yellow-400">⟳ list_directory src/components</p>
            <p className="text-emerald-400">✓ read_file src/components/Form.tsx</p>
            <p className="text-emerald-400">✓ write_file src/components/Form.tsx</p>
            <p className="text-emerald-400">✓ write_file src/utils/validators.ts</p>
            <p className="text-slate-300">Claude: "Adicionei validação usando regex RFC 5322..."</p>
          </div>
          <KV items={[
            ['read_file', 'Lê qualquer arquivo do projeto'],
            ['write_file', 'Cria ou edita arquivo (abre no editor automaticamente)'],
            ['list_directory', 'Lista pasta'],
            ['execute_command', 'Executa comando bash na VPS'],
            ['search_files', 'Busca padrão com grep'],
          ]} />
          <Warn>Modo Agente requer provedor configurado em Configurações (não funciona com claude -p SSH). Gemini não suporta tool use.</Warn>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Configurar provedores</p>
          <p className="text-xs">Vá em <em>Configurações → Provedores de IA</em>. Configure a API Key do provedor desejado, marque "Habilitado" e "Definir como padrão". Clique "Testar conexão" para validar.</p>
          <KV items={[
            ['Groq', 'Grátis. Modelos Llama e DeepSeek R1. Ótimo para começar.'],
            ['DeepSeek', 'Muito barato (~R$0,05/conversa). Excelente para código.'],
            ['Anthropic', 'Claude — melhor qualidade de raciocínio e Modo Agente.'],
            ['OpenAI', 'GPT-4o e o1-mini.'],
            ['Gemini', 'Google Gemini (sem suporte a Modo Agente).'],
            ['Mistral', 'Codestral — especializado em código.'],
          ]} />
        </div>
      </div>
    ),
  },
  {
    id: 'docker-pm2',
    icon: Box,
    title: 'Docker e PM2',
    color: 'bg-blue-600/20 text-blue-400',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><Box size={12}/> Docker Explorer</p>
          <p className="text-xs">Aba "Docker" no painel esquerdo do IDE. Lista todos os containers da VPS com status, imagem e portas.</p>
          <KV items={[
            ['Start', 'Inicia container parado'],
            ['Stop', 'Para container em execução'],
            ['Logs', 'Exibe últimas 150 linhas de log no painel'],
            ['Remover', 'Remove container parado (pede confirmação)'],
            ['Badge N', 'Número de containers rodando exibido na aba'],
          ]} />
          <Tip>Requer Docker instalado na VPS. Clique em "Atualizar" para recarregar a lista.</Tip>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><Cpu size={12}/> PM2 Process Manager</p>
          <p className="text-xs">Aba "PM2" no painel esquerdo do IDE. Lista processos Node.js gerenciados pelo PM2 com CPU%, RAM e número de reinicializações.</p>
          <KV items={[
            ['Restart', 'Reinicia processo (online ou parado)'],
            ['Stop', 'Para processo online'],
            ['Start', 'Inicia processo parado'],
            ['Logs', 'Exibe últimas 120 linhas de log (pm2 logs)'],
            ['Excluir', 'Remove processo do PM2 (apenas parado)'],
          ]} />
          <Tip>Requer PM2 instalado na VPS: <Code>npm install -g pm2</Code></Tip>
        </div>
      </div>
    ),
  },
  {
    id: 'logs-monitor',
    icon: FileText,
    title: 'Logs Viewer e Monitor',
    color: 'bg-emerald-600/20 text-emerald-400',
    content: (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><FileText size={12}/> Logs Viewer</p>
          <p className="text-xs">Aba "Logs" no painel inferior do IDE. Execute qualquer comando que retorne texto (tail, journalctl, pm2 logs) e veja o output aqui.</p>
          <KV items={[
            ['Campo de comando', 'Qualquer comando bash válido na VPS'],
            ['▶ Executar', 'Executa o comando uma vez e exibe o output'],
            ['▶ Watch', 'Executa automaticamente a cada 3 segundos (auto-refresh)'],
            ['Limpar', 'Limpa o output atual'],
          ]} />
          <p className="text-xs text-slate-400">Presets rápidos: <strong className="text-slate-300">syslog</strong> · <strong className="text-slate-300">nginx err</strong> · <strong className="text-slate-300">nginx acc</strong> · <strong className="text-slate-300">PM2 all</strong> · <strong className="text-slate-300">journald</strong></p>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><BarChart3 size={12}/> Monitor de VPS</p>
          <p className="text-xs">Página "Monitor" na sidebar. Exibe cards com métricas de todas as VPS cadastradas: CPU, RAM, disco e uptime. Auto-refresh a cada 30s.</p>
          <KV items={[
            ['CPU %', 'Load average / núcleos. Verde < 60%, amarelo 60-84%, vermelho ≥ 85%'],
            ['RAM', 'Usado / Total em MB ou GB'],
            ['Disco (/)', 'Uso percentual do disco raiz'],
            ['Uptime', 'Tempo que a VPS está ligada'],
          ]} />
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mt-3">Analisador de disco</p>
          <p className="text-xs">Botão <strong className="text-slate-100">Analisar disco</strong> em cada card (fica vermelho com ⚠ quando ≥ 85%). Abre modal com breakdown completo:</p>
          <KV items={[
            ['Maiores diretórios', 'Top 20 por tamanho em / (du -sh)'],
            ['Docker', 'Espaço de images, containers e volumes (docker system df)'],
            ['PM2 logs', 'Tamanho total dos logs em ~/.pm2/logs/'],
            ['Logs do sistema', 'Top arquivos em /var/log ordenados por tamanho'],
          ]} />
          <Tip>Cores no modal: verde &lt; 1GB · amarelo 1-5GB · vermelho &gt; 5GB. Útil para encontrar o que está lotando o disco.</Tip>
        </div>

        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><History size={12}/> Histórico de Lançamentos</p>
          <p className="text-xs">Página "Histórico" na sidebar. Registra cada vez que um projeto foi aberto via Lançador, com data, VPS, projeto e resultado (sucesso/erro).</p>
          <KV items={[
            ['Filtro por VPS', 'Mostra só lançamentos de uma VPS específica'],
            ['Filtro por Projeto', 'Mostra só lançamentos de um projeto'],
            ['Filtro por Status', 'Todos / Sucesso / Erro'],
            ['Taxa de sucesso', 'Percentual de lançamentos bem-sucedidos'],
          ]} />
        </div>
      </div>
    ),
  },
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
          ['Host / IP', 'Endereço IP público da VPS. Ex: 204.168.180.25'],
          ['Porta', 'Porta SSH. Padrão: 22'],
          ['Usuário SSH', 'Usuário de acesso. Geralmente root'],
          ['Senha SSH', 'Opcional. Salva criptografada AES-256.'],
          ['Caminho padrão', 'Pasta que abre por padrão. Ex: /root'],
        ]} />
        <Tip>Use o botão <strong>Testar</strong> para verificar a conexão antes de criar projetos.</Tip>
      </div>
    ),
  },
  {
    id: 'projects',
    icon: FolderOpen,
    title: 'Projetos',
    color: 'bg-purple-600/20 text-purple-400',
    content: (
      <div className="space-y-3">
        <p>Um Projeto é um diretório remoto numa VPS que você quer abrir no IDE ou no VS Code.</p>
        <KV items={[
          ['Nome', 'Nome do projeto. Ex: API Backend, Frontend React'],
          ['Caminho remoto', 'Caminho absoluto na VPS. Ex: /root/api'],
          ['VPS', 'Qual servidor remoto hospeda este projeto'],
          ['Conta Claude', 'Opcional. Indica qual conta Claude usar'],
          ['Repositório Git', 'Opcional. URL do repositório para referência'],
        ]} />
        <Tip>O caminho remoto precisa existir na VPS.</Tip>
      </div>
    ),
  },
  {
    id: 'accounts',
    icon: User,
    title: 'Hexagon — Isolamento de sessões IA',
    color: 'bg-rose-600/20 text-rose-400',
    content: (
      <div className="space-y-3">
        <p>O propósito central do app: <strong className="text-slate-100">isolar autenticações do Claude Code</strong> entre diferentes contas.</p>
        <div className="space-y-2 text-xs">
          <div className="flex gap-2"><BotMessageSquare size={12} className="text-purple-400 mt-0.5 shrink-0" /><span><strong className="text-slate-100">VPS 1</strong> → Conta Claude A (autenticada dentro da VPS 1)</span></div>
          <div className="flex gap-2"><BotMessageSquare size={12} className="text-blue-400 mt-0.5 shrink-0" /><span><strong className="text-slate-100">VPS 2</strong> → Conta Claude B (autenticada dentro da VPS 2)</span></div>
        </div>
        <p className="text-xs">Cada VPS tem seu próprio SO Linux — o Claude Code de cada VPS é independente. Sem conflito de tokens.</p>
        <Warn>O app nunca armazena senhas ou tokens do Claude. A autenticação ocorre exclusivamente dentro de cada VPS.</Warn>
      </div>
    ),
  },
  {
    id: 'launcher',
    icon: Rocket,
    title: 'Lançador',
    color: 'bg-orange-600/20 text-orange-400',
    content: (
      <div className="space-y-3">
        <p>Centraliza tudo: abre o IDE, o VS Code remoto e o terminal SSH.</p>
        <KV items={[
          ['IDE', 'Abre o HEXAGON IDE integrado na VPS selecionada'],
          ['Explorer', 'Abre o explorador de arquivos SFTP fullscreen'],
          ['Terminal', 'Abre terminal SSH em janela separada (PowerShell → SSH)'],
          ['Abrir pasta local', 'Abre uma pasta do seu PC no IDE (modo local)'],
        ]} />
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Badge Claude Code</p>
          <div className="space-y-1 text-xs">
            <div className="flex gap-2"><span className="text-emerald-400">● Logado</span><span>Claude Code pronto</span></div>
            <div className="flex gap-2"><span className="text-yellow-400">● Não logado</span><span>Execute <Code>claude</Code> no terminal</span></div>
            <div className="flex gap-2"><span className="text-amber-400">● Não instalado</span><span><Code>npm install -g @anthropic-ai/claude-code</Code></span></div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'claudeauth',
    icon: BotMessageSquare,
    title: 'Autenticar Claude Code na VPS',
    color: 'bg-brand-600/20 text-brand-400',
    content: (
      <div className="space-y-3">
        <Step n={1}><span>No <em>Lançador</em>, clique em <strong className="text-slate-100">Terminal</strong> na VPS. Um SSH vai abrir.</span></Step>
        <Step n={2}><span>Instale Node.js se necessário:</span><Block>{`curl -fsSL https://deb.nodesource.com/setup_20.x | bash -\napt-get install -y nodejs`}</Block></Step>
        <Step n={3}><span>Instale Claude Code:</span><Block>{`npm install -g @anthropic-ai/claude-code`}</Block></Step>
        <Step n={4}><span>Execute e siga o login:</span><Block>{`claude`}</Block></Step>
        <Step n={5}><span>Abra a URL exibida no navegador e faça login com a <strong className="text-slate-100">conta correta</strong> para esta VPS.</span></Step>
        <Warn>Se você tem 2 contas Claude, use uma em cada VPS. O isolamento é garantido pelo SO da VPS.</Warn>
      </div>
    ),
  },
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
            ['VS Code Insiders', 'Para quem usa a versão Insiders'],
            ['Chave SSH', 'Caminho para chave privada. Vazio usa ~/.ssh/id_rsa'],
          ]} />
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5"><Zap size={12}/> Provedores de IA</p>
          <p className="text-xs">Configure API Keys para usar o chat com API direta e o Modo Agente.</p>
          <KV items={[
            ['Habilitado', 'Ativa o provedor para uso no chat'],
            ['Definir como padrão', 'Este provedor será usado automaticamente'],
            ['Modelo', 'Modelo específico do provedor'],
            ['Testar conexão', 'Valida a API Key enviando uma mensagem curta'],
          ]} />
          <Tip>Groq tem plano gratuito. DeepSeek é o mais barato para código. Anthropic tem o melhor Modo Agente.</Tip>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Backup e Restauração</p>
          <p className="text-xs">Exporta e importa todas as VPS, projetos e contas em JSON. API Keys e senhas SSH não são exportadas.</p>
        </div>
      </div>
    ),
  },
  {
    id: 'ssh',
    icon: Key,
    title: 'Configurar chave SSH',
    color: 'bg-cyan-600/20 text-cyan-400',
    content: (
      <div className="space-y-3">
        <p>A chave SSH elimina a necessidade de digitar senha a cada conexão.</p>
        <Step n={1}><span>Gere uma chave no terminal do <strong className="text-slate-100">seu PC</strong>:</span><Block>{`ssh-keygen -t ed25519 -C "seu@email.com"`}</Block></Step>
        <Step n={2}><span>Copie a chave para cada VPS:</span><Block>{`ssh-copy-id root@IP_DA_VPS`}</Block></Step>
        <Step n={3}><span>Em <em>Configurações</em>, preencha o caminho da chave privada:</span><Block>{`C:\\Users\\SeuUsuario\\.ssh\\id_ed25519`}</Block></Step>
        <Step n={4}><span>Teste em <em>VPS</em> → <strong className="text-slate-100">Testar</strong>. Deve aparecer <span className="text-emerald-400">Conectado</span>.</span></Step>
      </div>
    ),
  },
  {
    id: 'troubleshoot',
    icon: AlertTriangle,
    title: 'Solução de problemas',
    color: 'bg-red-600/20 text-red-400',
    content: (
      <div className="space-y-4">
        {[
          {
            problem: 'Chat ainda mostra "claude -p (SSH)" após configurar provedor',
            solutions: [
              'Feche o IDE e reabra — o provedor é carregado uma vez ao montar a página',
              'Confirme que marcou "Habilitado" e clicou "Salvar" no card do provedor',
              'Use "Testar conexão" para verificar se a API Key é válida',
            ],
          },
          {
            problem: 'Modo Agente não funciona (botão 🤖 não aparece)',
            solutions: [
              'Configure um provedor de IA em Configurações → Provedores de IA',
              'Gemini não suporta Modo Agente — use Anthropic, DeepSeek ou OpenAI',
              'Verifique se o provedor está habilitado e com API Key válida',
            ],
          },
          {
            problem: 'Docker/PM2 mostra "não encontrado"',
            solutions: [
              'Verifique se Docker/PM2 está instalado na VPS: docker --version ou pm2 --version',
              'O usuário SSH precisa ter permissão para executar docker (sudo ou grupo docker)',
              'Clique em "Atualizar" após instalar',
            ],
          },
          {
            problem: 'Arquivos não salvos com "Aplicar todas as alterações"',
            solutions: [
              'Abra uma pasta ou arquivo no IDE antes de usar o agente',
              'Verifique se os caminhos dos arquivos foram preenchidos no modal',
              'No modo VPS, a sessão SFTP precisa estar ativa — tente reabrir o IDE',
            ],
          },
          {
            problem: 'Autenticação SSH falhou',
            solutions: [
              'Preencha o campo Senha SSH no cadastro da VPS',
              'Ou configure uma chave SSH (ver seção acima)',
              'Confirme o usuário correto (geralmente root)',
            ],
          },
          {
            problem: 'VS Code não abre ao clicar no botão',
            solutions: [
              'Instale a extensão "Remote - SSH" no VS Code',
              'Verifique o caminho do VS Code em Configurações',
              'Execute code --version no terminal do PC para confirmar',
            ],
          },
        ].map(({ problem, solutions }) => (
          <div key={problem} className="space-y-1.5">
            <p className="text-slate-100 text-xs font-medium flex gap-1.5 items-start">
              <AlertTriangle size={12} className="text-red-400 shrink-0 mt-0.5" />{problem}
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
  {
    id: 'about',
    icon: Monitor,
    title: 'Sobre o HEXAGON IDE',
    color: 'bg-slate-700/30 text-slate-400',
    content: (
      <div className="space-y-4 text-xs">
        <div className="flex flex-col gap-1">
          <p className="text-slate-100 font-semibold text-sm">HEXAGON IDE</p>
          <p className="text-slate-400">IDE desktop para gerenciar múltiplas VPS, múltiplos projetos e múltiplas contas IA — tudo em um lugar.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Versão', '2.4.0'],
            ['Runtime', 'Electron + Node.js 22'],
            ['Interface', 'React 18 + Tailwind CSS'],
            ['Banco de dados', 'SQLite local (Prisma)'],
            ['SSH/SFTP', 'ssh2 (nativo Windows)'],
            ['Editor', 'Monaco Editor (VS Code engine)'],
            ['Terminal', 'xterm.js multi-abas'],
            ['Segurança', 'AES-256, contextIsolation'],
            ['IA', 'Anthropic, DeepSeek, OpenAI, Gemini, Groq, Mistral, xAI'],
            ['Repositório', 'github.com/fasterdrible-lab/HEXAGON-IDE'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-slate-500 w-28 shrink-0">{k}</span>
              <span className="text-slate-300">{v}</span>
            </div>
          ))}
        </div>
        <Tip>Os dados ficam em <Code>%APPDATA%\HEXAGON IDE\cwm.db</Code>. Nenhum dado é enviado a servidores externos (exceto as chamadas às APIs de IA que você configurar).</Tip>
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
          <BookOpen size={22} className="text-brand-400" />
          <h1 className="text-2xl font-bold text-slate-100">Manual de Uso</h1>
        </div>
        <p className="text-slate-400">Guia completo do HEXAGON IDE v2.2.0.</p>
      </div>

      <div className="mb-6 grid grid-cols-4 gap-3">
        {[
          { icon: Code2, label: 'IDE Integrado', desc: 'Lançador → IDE', color: 'text-brand-400' },
          { icon: Bot, label: 'Chat + Agente', desc: 'IDE → botão Claude', color: 'text-purple-400' },
          { icon: BarChart3, label: 'Monitor VPS', desc: 'Sidebar → Monitor', color: 'text-emerald-400' },
          { icon: Zap, label: 'Provedores IA', desc: 'Configurações → IA', color: 'text-yellow-400' },
        ].map(({ icon: Icon, label, desc, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <Icon size={20} className={`mx-auto mb-2 ${color}`} />
            <p className="text-slate-100 text-sm font-medium">{label}</p>
            <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      <Accordion sections={sections} />
    </div>
  )
}
