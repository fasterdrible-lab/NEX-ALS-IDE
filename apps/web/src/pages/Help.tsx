import { useState } from 'react'
import {
  BookOpen, Server, FolderOpen, User, Rocket, Settings,
  ChevronDown, ChevronRight, Terminal, Key, Wifi, AlertTriangle,
  BotMessageSquare, CheckCircle, Monitor, HelpCircle,
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

const sections: Section[] = [
  {
    id: 'quickstart',
    icon: CheckCircle,
    title: '🚀 Início Rápido — 4 passos',
    color: 'bg-emerald-600/20 text-emerald-400',
    content: (
      <div className="space-y-3">
        <Step n={1}><strong className="text-slate-100">Cadastre sua VPS</strong> — vá em <em>VPS</em> → Nova VPS. Preencha IP, porta, usuário e senha (ou configure chave SSH).</Step>
        <Step n={2}><strong className="text-slate-100">Crie um Projeto</strong> — vá em <em>Projetos</em> → Novo Projeto. Informe o caminho remoto (ex: <Code>/root/meu-projeto</Code>) e associe à VPS.</Step>
        <Step n={3}><strong className="text-slate-100">Instale e autentique o Claude Code na VPS</strong> — vá em <em>Lançador</em> → Terminal → execute <Code>claude</Code> e siga as instruções de login.</Step>
        <Step n={4}><strong className="text-slate-100">Abra no VS Code</strong> — vá em <em>Lançador</em> → clique em <em>Abrir no VS Code</em>. O VS Code Remote SSH abrirá o projeto diretamente na VPS.</Step>
        <Tip>A primeira abertura do VS Code Remote pode ser mais lenta — ele instala o servidor remoto automaticamente.</Tip>
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
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Campos do formulário</p>
          <div className="grid gap-2">
            {[
              ['Nome', 'Apelido livre. Ex: VPS Dev, Servidor Prod'],
              ['Host / IP', 'Endereço IP público da VPS. Ex: 204.168.180.25'],
              ['Porta', 'Porta SSH. Padrão: 22'],
              ['Usuário SSH', 'Usuário de acesso. Geralmente root em VPS Linux'],
              ['Senha SSH', 'Opcional. Use se não tiver chave SSH configurada. A senha é salva criptografada.'],
              ['Caminho padrão', 'Pasta que abre por padrão. Ex: /root ou /home/user/projetos'],
            ].map(([f, d]) => (
              <div key={f} className="flex gap-2 text-xs">
                <span className="text-slate-100 font-medium w-24 shrink-0">{f}</span>
                <span className="text-slate-400">{d}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Autenticação SSH</p>
          <div className="space-y-1.5">
            <div className="flex gap-2 text-xs"><Key size={12} className="text-emerald-400 mt-0.5 shrink-0" /><span><strong className="text-slate-100">Chave SSH (recomendado)</strong> — configure o caminho em Configurações → Chave SSH. Sem digitar senha toda vez.</span></div>
            <div className="flex gap-2 text-xs"><Key size={12} className="text-amber-400 mt-0.5 shrink-0" /><span><strong className="text-slate-100">Senha</strong> — preencha o campo Senha SSH no formulário. Salva criptografada no banco local.</span></div>
          </div>
        </div>
        <Tip>Use o botão <strong>Testar</strong> para verificar a conexão antes de criar projetos.</Tip>
      </div>
    ),
  },
  {
    id: 'projects',
    icon: FolderOpen,
    title: 'Projetos — Ambientes de trabalho',
    color: 'bg-purple-600/20 text-purple-400',
    content: (
      <div className="space-y-3">
        <p>Um Projeto é um diretório remoto numa VPS que você quer abrir no VS Code.</p>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Campos</p>
          <div className="grid gap-2">
            {[
              ['Nome', 'Nome do projeto. Ex: API Backend, Frontend React'],
              ['Caminho remoto', 'Caminho absoluto na VPS. Ex: /root/api ou /home/user/app'],
              ['VPS', 'Qual servidor remoto hospedam este projeto'],
              ['Conta Claude', 'Opcional. Indica qual conta Claude usar neste projeto'],
              ['Repositório Git', 'Opcional. URL do repositório para referência'],
            ].map(([f, d]) => (
              <div key={f} className="flex gap-2 text-xs">
                <span className="text-slate-100 font-medium w-28 shrink-0">{f}</span>
                <span className="text-slate-400">{d}</span>
              </div>
            ))}
          </div>
        </div>
        <Tip>O caminho remoto precisa existir na VPS. O VS Code Remote SSH não cria pastas automaticamente.</Tip>
      </div>
    ),
  },
  {
    id: 'accounts',
    icon: User,
    title: 'Contas Claude — Isolamento de sessões',
    color: 'bg-rose-600/20 text-rose-400',
    content: (
      <div className="space-y-3">
        <p>O propósito central do app: <strong className="text-slate-100">isolar autenticações do Claude Code</strong> entre diferentes contas.</p>
        <div className="space-y-2 text-xs">
          <p className="text-slate-400">Como funciona o isolamento:</p>
          <div className="flex gap-2"><BotMessageSquare size={12} className="text-purple-400 mt-0.5 shrink-0" /><span><strong className="text-slate-100">VPS 1</strong> → Conta Claude A (autenticada dentro da VPS 1)</span></div>
          <div className="flex gap-2"><BotMessageSquare size={12} className="text-blue-400 mt-0.5 shrink-0" /><span><strong className="text-slate-100">VPS 2</strong> → Conta Claude B (autenticada dentro da VPS 2)</span></div>
        </div>
        <p className="text-xs">Cada VPS tem seu próprio sistema operacional Linux, então o Claude Code de cada VPS é completamente independente. Sem conflito de tokens.</p>
        <Warn>O app nunca armazena senhas ou tokens do Claude. A autenticação ocorre exclusivamente dentro de cada VPS.</Warn>
      </div>
    ),
  },
  {
    id: 'launcher',
    icon: Rocket,
    title: 'Lançador — Abrir VS Code remoto',
    color: 'bg-orange-600/20 text-orange-400',
    content: (
      <div className="space-y-3">
        <p>O Lançador centraliza tudo: abre o VS Code remoto e verifica o status do Claude Code em cada VPS.</p>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Badge de status Claude</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex gap-2"><span className="text-emerald-400">●</span><span>Claude Code vX.X.X • Logado — pronto para uso</span></div>
            <div className="flex gap-2"><span className="text-yellow-400">●</span><span>Instalado • Não logado — execute <Code>claude</Code> no terminal</span></div>
            <div className="flex gap-2"><span className="text-amber-400">●</span><span>Não instalado — execute o comando de instalação abaixo</span></div>
            <div className="flex gap-2"><span className="text-slate-400">●</span><span>Verificando… — aguarde alguns segundos</span></div>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">Pré-requisitos para "Abrir no VS Code"</p>
          <div className="space-y-1.5 text-xs">
            <div className="flex gap-2"><CheckCircle size={12} className="text-emerald-400 mt-0.5 shrink-0" /><span>VS Code instalado com extensão <strong className="text-slate-100">Remote - SSH</strong></span></div>
            <div className="flex gap-2"><CheckCircle size={12} className="text-emerald-400 mt-0.5 shrink-0" /><span>Conexão SSH funcionando (teste em <em>VPS</em> → Testar)</span></div>
            <div className="flex gap-2"><CheckCircle size={12} className="text-emerald-400 mt-0.5 shrink-0" /><span>Caminho do projeto existindo na VPS</span></div>
          </div>
        </div>
        <Tip>Se o VS Code não abre, vá em <em>Configurações</em> e verifique o caminho do executável.</Tip>
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
        <p>Passo a passo para instalar e autenticar o Claude Code em uma VPS:</p>
        <Step n={1}>
          <span>No <em>Lançador</em>, clique em <strong className="text-slate-100">Terminal</strong> na VPS desejada. Um PowerShell vai abrir conectado via SSH.</span>
        </Step>
        <Step n={2}>
          <span>Instale o Node.js se não tiver:</span>
          <Block>{`curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs`}</Block>
        </Step>
        <Step n={3}>
          <span>Instale o Claude Code:</span>
          <Block>{`npm install -g @anthropic-ai/claude-code`}</Block>
        </Step>
        <Step n={4}>
          <span>Execute o Claude para autenticar:</span>
          <Block>{`claude`}</Block>
          <span className="text-xs text-slate-400">Uma URL vai aparecer no terminal.</span>
        </Step>
        <Step n={5}>
          <span>Abra a URL no navegador, faça login com a <strong className="text-slate-100">conta Claude correta</strong> para esta VPS.</span>
        </Step>
        <Step n={6}>
          <span>Feche e reabra o app. O badge vai mudar para <span className="text-emerald-400">● Logado</span>.</span>
        </Step>
        <Warn>Se você tem 2 contas Claude, use contas diferentes em VPS diferentes. O isolamento é garantido pelo SO de cada VPS.</Warn>
      </div>
    ),
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Configurações',
    color: 'bg-slate-600/30 text-slate-300',
    content: (
      <div className="space-y-3">
        <div className="space-y-2">
          {[
            {
              field: 'Caminho do VS Code',
              desc: 'Executável do VS Code. Padrão: code (precisa estar no PATH)',
              examples: ['code', 'C:\\Users\\user\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code'],
            },
            {
              field: 'VS Code Insiders',
              desc: 'Para quem usa a versão Insiders do VS Code.',
              examples: ['code-insiders'],
            },
            {
              field: 'Chave SSH',
              desc: 'Caminho para sua chave SSH privada. Se vazio, usa ~/.ssh/id_rsa.',
              examples: ['C:\\Users\\user\\.ssh\\id_rsa'],
            },
          ].map(({ field, desc, examples }) => (
            <div key={field} className="space-y-1">
              <p className="text-slate-100 text-xs font-medium">{field}</p>
              <p className="text-slate-400 text-xs">{desc}</p>
              <div className="flex flex-wrap gap-1">
                {examples.map(e => <Code key={e}>{e}</Code>)}
              </div>
            </div>
          ))}
        </div>
        <Tip>Se o botão "Abrir no VS Code" não funcionar, execute <Code>code --version</Code> no terminal do seu PC para confirmar que o VS Code está no PATH.</Tip>
      </div>
    ),
  },
  {
    id: 'ssh',
    icon: Key,
    title: 'Configurar chave SSH (sem senha toda vez)',
    color: 'bg-cyan-600/20 text-cyan-400',
    content: (
      <div className="space-y-3">
        <p>A chave SSH elimina a necessidade de digitar senha a cada conexão.</p>
        <Step n={1}>
          <span>Gere uma chave (se não tiver) no terminal do <strong className="text-slate-100">seu PC</strong>:</span>
          <Block>{`ssh-keygen -t ed25519 -C "seu@email.com"`}</Block>
          <span className="text-xs text-slate-400">Pressione Enter para aceitar o caminho padrão.</span>
        </Step>
        <Step n={2}>
          <span>Copie a chave pública para cada VPS:</span>
          <Block>{`ssh-copy-id root@IP_DA_VPS`}</Block>
          <span className="text-xs text-slate-400">Ou manualmente: cole o conteúdo de <Code>~/.ssh/id_ed25519.pub</Code> no arquivo <Code>~/.ssh/authorized_keys</Code> da VPS.</span>
        </Step>
        <Step n={3}>
          <span>No app, vá em <em>Configurações</em> e preencha o caminho da chave privada:</span>
          <Block>{`C:\\Users\\SeuUsuario\\.ssh\\id_ed25519`}</Block>
        </Step>
        <Step n={4}>
          <span>Teste a conexão em <em>VPS</em> → <strong className="text-slate-100">Testar</strong>. Deve aparecer <span className="text-emerald-400">Conectado</span>.</span>
        </Step>
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
            problem: 'Autenticação falhou — verifique usuário/chave SSH',
            solutions: [
              'Preencha o campo Senha SSH no cadastro da VPS',
              'Ou configure uma chave SSH (ver seção acima)',
              'Confirme o usuário correto (geralmente root)',
            ],
          },
          {
            problem: 'VS Code não abre ao clicar em "Abrir no VS Code"',
            solutions: [
              'Instale a extensão "Remote - SSH" no VS Code',
              'Verifique o caminho do VS Code em Configurações',
              'Execute code --version no terminal do PC para confirmar',
            ],
          },
          {
            problem: 'Claude Code não está instalado (badge âmbar)',
            solutions: [
              'Abra o terminal SSH da VPS e execute: npm install -g @anthropic-ai/claude-code',
              'Feche e reabra o app para atualizar o badge',
            ],
          },
          {
            problem: 'Badge mostra "não instalado" mas Claude está na VPS',
            solutions: [
              'Claude pode estar em caminho não-padrão (instalado via nvm)',
              'Abra o terminal da VPS e execute: which claude',
              'Se o caminho for diferente de /usr/local/bin/claude, faça um symlink: ln -s $(which claude) /usr/local/bin/claude',
            ],
          },
          {
            problem: 'Timeout ao testar conexão',
            solutions: [
              'Verifique se o IP e porta estão corretos',
              'Confirme que a VPS está ligada e acessível',
              'Verifique o firewall da VPS (porta 22 aberta)',
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
    title: 'Sobre o app',
    color: 'bg-slate-700/30 text-slate-400',
    content: (
      <div className="space-y-4 text-xs">
        <div className="flex flex-col gap-1">
          <p className="text-slate-100 font-semibold text-sm">Claude Workspace Manager</p>
          <p className="text-slate-400">App desktop para gerenciar múltiplas VPS e contas Claude Code sem conflito de autenticação.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Versão', '1.3.2'],
            ['Runtime', 'Electron + Node.js'],
            ['Interface', 'React + Tailwind CSS'],
            ['Banco de dados', 'SQLite (local)'],
            ['SSH', 'ssh2 (nativo, sem OpenSSH)'],
            ['Segurança', 'Senhas criptografadas AES-256'],
            ['Repositório', 'github.com/fasterdrible-lab'],
            ['Licença', 'Proprietário'],
          ].map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-slate-500 w-28 shrink-0">{k}</span>
              <span className="text-slate-300">{v}</span>
            </div>
          ))}
        </div>
        <Tip>Os dados ficam em <Code>%APPDATA%\Claude Workspace Manager\cwm.db</Code>. Nenhum dado é enviado para servidores externos.</Tip>
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
        <p className="text-slate-400">Guia completo para usar o Claude Workspace Manager.</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { icon: Terminal, label: 'Terminal SSH', desc: 'Lançador → Terminal', color: 'text-blue-400' },
          { icon: Rocket, label: 'Abrir VS Code', desc: 'Lançador → Projeto', color: 'text-orange-400' },
          { icon: Wifi, label: 'Testar conexão', desc: 'VPS → Testar', color: 'text-emerald-400' },
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
