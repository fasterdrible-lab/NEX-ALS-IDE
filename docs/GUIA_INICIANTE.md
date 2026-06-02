# HEXAGON IDE — Guia para Iniciantes

**Para quem está começando na programação e quer entender o que este app faz.**

---

## O que é o HEXAGON IDE?

Imagine que você tem um ou mais servidores na internet — computadores que ficam ligados 24 horas por dia rodando seus sites, APIs ou aplicações. O problema é: como você edita os arquivos dentro desses servidores? Como você vê o que está acontecendo lá dentro? Como você pede ajuda à inteligência artificial sem sair do contexto do seu projeto?

O **HEXAGON IDE** resolve tudo isso numa única janela no seu computador.

É um **programa de desktop para Windows** que permite:

- conectar em servidores remotos (VPS) pelo seu computador
- editar código nesses servidores como se fosse um editor normal
- abrir um terminal dentro do servidor sem precisar de outros programas
- usar inteligência artificial (Claude, GPT, Gemini, DeepSeek, entre outros) para ajudar no código
- fazer deploys com segurança, com rollback automático se algo der errado
- diagnosticar problemas de produção com IA em modo de emergência

---

## Conceitos importantes — explicados de forma simples

### O que é uma VPS?

VPS significa *Virtual Private Server* (Servidor Privado Virtual). É basicamente um computador que fica em um datacenter, ligado o tempo todo, conectado à internet. Você paga uma mensalidade para alugar esse computador.

```
Seu PC em casa  ──(internet)──►  VPS no datacenter
                                  Seu site roda aqui
                                  24h por dia, 7 dias por semana
```

Exemplos de onde você pode alugar uma VPS: DigitalOcean, Vultr, Hetzner, AWS, Google Cloud.

### O que é SSH?

SSH é o protocolo que permite você "entrar" dentro de um servidor remoto pelo terminal. É como se você abrisse um controle remoto do servidor e digitasse comandos nele. O HEXAGON IDE usa SSH internamente para tudo — você nem precisa saber os detalhes, o app cuida disso.

### O que é SFTP?

SFTP é o protocolo para transferir arquivos entre seu computador e o servidor. Quando você salva um arquivo no editor do HEXAGON IDE, ele usa SFTP para enviar o arquivo para a VPS automaticamente.

### O que é uma API Key?

Quando você usa um serviço de inteligência artificial (como Claude da Anthropic ou GPT da OpenAI), você precisa de uma "chave" para se identificar e pagar pelo uso. Essa chave é chamada de API Key. No HEXAGON IDE, você cadastra essa chave nas Configurações uma única vez e ela é salva com criptografia no seu computador.

---

## O que o app tem — explicado por telas

### 1. Dashboard
A página inicial. Mostra um resumo rápido: quantas VPS você tem, projetos recentes e ações rápidas.

### 2. VPS
Aqui você cadastra seus servidores. Para cada servidor você informa:
- o endereço IP (ex: `204.168.180.25`)
- a porta SSH (quase sempre é `22`)
- o usuário (normalmente `root`)
- a senha ou chave SSH

O app também salva uma "impressão digital" do servidor para detectar se alguém tentou trocar o servidor por outro (proteção MITM).

### 3. Projetos
Aqui você registra as pastas dos seus projetos dentro de cada VPS. Por exemplo: `/var/www/meusite` na VPS de produção.

### 4. Lançador
A página mais usada no dia a dia. Mostra todas as suas VPS e projetos com botões de ação:

```
VPS: Servidor Prod (204.168.180.25)
 ├─ [IDE]          ← abre o editor integrado nessa VPS
 ├─ [⎋ Nova janela] ← abre em monitor separado
 ├─ [🚨 Incident]  ← modo de emergência
 └─ [🚀 Deploy]    ← assistente de deploy
```

### 5. Monitor
Mostra em tempo real o uso de CPU, RAM e Disco de todas as suas VPS. Atualiza a cada 30 segundos. Se o disco estiver acima de 85%, fica vermelho como alerta.

### 6. Configurações
Onde você configura as API Keys dos provedores de IA (Anthropic, OpenAI, Gemini, DeepSeek, etc.) e o caminho para a chave SSH do seu computador.

---

## O coração do app: o HEXAGON IDE

Quando você clica em **IDE** para uma VPS, abre uma janela de editor completa — parecida com o VS Code, mas conectada diretamente ao servidor.

```
┌──────────────────────────────────────────────────────────────────┐
│ PRODUÇÃO  VPS-Prod   [split ⊟]  [Claude]  [🚨]  [🚀]  [⎋]     │  ← barra superior
├─────────────┬────────────────────────────────────────────────────┤
│             │                                                     │
│  📁 Arquivos│  Aqui você edita o código (Monaco Editor —         │
│  (explorer) │  o mesmo motor usado pelo VS Code)                 │
│  src/       │                                                     │
│    app.ts   │  Você salva com Ctrl+S e o arquivo vai             │
│    config/  │  automaticamente para a VPS via SFTP               │
│             │                                                     │
│  🔍 Busca   ├────────────────────────────────────────────────────┤
│  🌿 Git     │  Terminal SSH (Ctrl+`)                             │
│  🔌 Portas  │  É um terminal real dentro da VPS.                 │
│  🐳 Docker  │  Você pode rodar qualquer comando.                 │
│  ⚙️ PM2     │                                                     │
└─────────────┴────────────────────────────────────────────────────┘
```

### O que cada aba do painel esquerdo faz

| Aba | O que é |
|-----|---------|
| **Arquivos** | Mostra a estrutura de pastas e arquivos da VPS. Você pode criar, renomear e deletar arquivos aqui. |
| **Busca** | Pesquisa uma palavra em todos os arquivos do projeto de uma vez. |
| **Git** | Controle de versão. Mostra o que mudou, permite fazer commit e enviar para o GitHub. |
| **Portas** | Permite acessar uma porta do servidor como se fosse local. Ex: acessar `localhost:3000` que na verdade está rodando na VPS. |
| **Docker** | Gerencia containers Docker direto pelo app — Start, Stop, Logs. |
| **PM2** | Gerencia processos Node.js — reiniciar, parar, ver logs. |

---

## A IA do app: o AI HUB

O **AI HUB** é onde você conversa com qualquer modelo de inteligência artificial. Acesse pelo botão roxo **AI HUB** na barra lateral.

### Por que usar o AI HUB em vez do ChatGPT no browser?

Porque o AI HUB pode **ver o contexto do seu servidor automaticamente**. Antes de enviar sua mensagem, você pode marcar checkboxes para incluir:

- os logs do servidor (para a IA ver o que está dando erro)
- o estado dos containers Docker
- os processos PM2
- as métricas de CPU e RAM
- blocos de contexto que você salvou sobre o projeto

Ou seja, em vez de copiar e colar logs no ChatGPT, você só marca "incluir logs" e a IA já recebe tudo automaticamente.

### Os 6 provedores disponíveis

| Provedor | Qual usar |
|----------|-----------|
| **Groq** | Grátis para começar. Modelo Llama 3. Bom para perguntas gerais. |
| **DeepSeek** | Muito barato. Excelente para código. Recomendado para uso no dia a dia. |
| **Anthropic (Claude)** | O mais inteligente. Melhor para tarefas complexas. |
| **OpenAI (GPT)** | GPT-4o, o3. Boa qualidade geral. |
| **Gemini** | Google. Janela de contexto gigante (1 milhão de tokens). |
| **OpenRouter** | Uma única API Key para acessar 300+ modelos diferentes. |
| **Ollama** | Roda modelos de IA no **seu próprio computador**, sem internet, sem custo. |

---

## Modo Agente — a IA que age sozinha

Quando você ativa o **Modo Agente** (botão 🤖 no chat do IDE), a IA pode:

- ler arquivos do servidor por conta própria
- escrever e modificar arquivos
- executar comandos no terminal
- listar pastas e buscar conteúdo

Você descreve o que quer, a IA executa os passos. Exemplo:

```
Você:  "Adicione validação de email no formulário de cadastro"

IA:    → lendo src/components/RegisterForm.tsx...
       → escrevendo src/schemas/user.ts com Zod...
       → atualizando src/components/RegisterForm.tsx...
       → "Pronto! Adicionei validação com Zod. O campo email agora..."
```

**Segurança do Modo Agente:** Antes de cada escrita, o conteúdo original é salvo (Snapshot). Se a IA estragar algo, você clica em **↩ Restaurar** e o arquivo volta ao que era.

Comandos perigosos (como `rm -rf`, `docker stop`, `git reset --hard`) exigem que você digite **CONFIRMO** num modal antes de executar.

---

## Incident Mode — quando algo quebra em produção

Sabe quando algo para de funcionar de madrugada e você não sabe por onde começar? O **Incident Mode** abre uma janela com tudo que você precisa ao mesmo tempo:

```
┌──────────────────────┬──────────────────────┐
│  IA analisa tudo     │  Logs em tempo real  │
│  automaticamente     │  (journalctl/tail)   │
│  e dá diagnóstico    │                      │
├──────────────────────┼──────────────────────┤
│  Docker + PM2        │  Terminal livre      │
│  Estado dos serviços │  Para rodar comandos │
│  CPU%, RAM, restarts │  de emergência       │
└──────────────────────┴──────────────────────┘
```

Ao abrir, a IA já analisa o estado de tudo e diz o que encontrou de errado e qual ação tomar. Depois você pode continuar conversando com ela.

---

## Deploy Assistant — fazer deploy com segurança

**Deploy** é o processo de colocar uma nova versão do seu código no servidor de produção. Se algo der errado durante o deploy, o site pode ficar fora do ar.

O **Deploy Assistant** funciona assim:

1. Você descreve o deploy em linguagem normal:
   > "Fazer deploy da versão 2.1 — git pull, instalar dependências, reiniciar o servidor"

2. A IA gera um **plano numerado** com cada comando a executar

3. Você revisa e clica **Executar** — passo a passo ou tudo de uma vez

4. Se qualquer passo falhar, a IA gera automaticamente um **plano de rollback** para desfazer o que foi feito

5. Após o deploy, você informa a URL do seu site e o app faz um **Smoke Test** — verifica se o site está respondendo

---

## Por onde começar (passo a passo para iniciantes)

### Passo 1 — Instale o app
Execute o instalador `HEXAGON IDE Setup.exe` (ou o portátil). Siga o wizard normal.

### Passo 2 — Configure um provedor de IA
Vá em **Configurações → Provedores de IA**. Para começar sem custo, use o **Groq** (grátis) ou o **Ollama** (local). Cole a API Key e marque como Padrão.

### Passo 3 — Cadastre sua VPS
Vá em **VPS → Nova VPS**. Preencha:
- **Nome:** um apelido (ex: "Servidor Prod")
- **Host:** o IP da sua VPS (ex: `204.168.180.25`)
- **Porta:** `22`
- **Usuário:** `root`
- **Senha SSH:** a senha do servidor

Clique em **Testar Conexão** para confirmar que funciona.

### Passo 4 — Abra o IDE
Vá em **Lançador** → clique no botão **IDE** da sua VPS. O editor abre conectado ao servidor.

### Passo 5 — Converse com a IA
No IDE, clique no botão roxo **Claude** no canto superior direito. O painel de chat abre. Pergunte qualquer coisa sobre o projeto — a IA já recebe o contexto dos arquivos abertos.

### Passo 6 — Explore o AI HUB
Clique em **AI HUB** na sidebar. Aqui você tem histórico de conversas, streaming em tempo real e pode selecionar dados do servidor para incluir no contexto.

---

## Perguntas frequentes

**Preciso saber programar para usar o app?**
Sim, o app é voltado para desenvolvedores. Mas você não precisa ser experiente — um iniciante que tem uma VPS já consegue se beneficiar do IDE e do chat com IA.

**O app armazena minhas senhas?**
As senhas SSH e as API Keys de IA são armazenadas criptografadas (AES-256) no seu computador. Nunca são enviadas para nenhum servidor do app. O único dado que sai do app são as mensagens que você envia às APIs de IA que configurar.

**Precisa de internet?**
Para conectar nas VPS e para as chamadas às APIs de IA, sim. Se usar Ollama (modelos locais), a IA funciona offline.

**O app funciona sem VPS?**
Sim. Você pode usar o **Modo Local** (Lançador → "Abrir pasta local no IDE") para editar arquivos do seu computador, e o **AI HUB** para conversar com IA — sem precisar de VPS.

**E se eu quebrar algo na VPS?**
O Modo Agente salva snapshots antes de cada modificação. Você pode restaurar individualmente. Além disso, o Git integrado permite reverter commits. Para deploys, use o Deploy Assistant que tem rollback automático.

---

## Glossário rápido

| Termo | Significado simples |
|-------|---------------------|
| VPS | Servidor na internet que você aluga |
| SSH | Protocolo para "entrar" no servidor pelo terminal |
| SFTP | Protocolo para enviar/receber arquivos do servidor |
| API Key | Chave de acesso a um serviço (como a IA) |
| Deploy | Publicar uma nova versão do código no servidor |
| Rollback | Desfazer um deploy e voltar para a versão anterior |
| Container | "Caixa" isolada que roda uma aplicação (Docker) |
| PM2 | Gerenciador de processos Node.js — mantém seu app rodando |
| Fingerprint | "Impressão digital" do servidor para verificar autenticidade |
| Snapshot | Cópia de segurança de um arquivo antes de modificar |
| Streaming | Resposta da IA aparecendo palavra por palavra, em tempo real |

---

*HEXAGON IDE v3.3.1 — HEXAGON TECNOLOGIA*
*github.com/fasterdrible-lab/HEXAGON-WORKSPACE-MANAGER*
