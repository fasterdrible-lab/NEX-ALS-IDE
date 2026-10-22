# CHANGELOG — Zeus IDE (antes NEX-ALS IDE)

## [3.82.2] — 2026-10-22

### Corrigido — indicador mostrava a conta Claude com o nome errado

O usuário viu "fasterdrilbe · 98%" no Zeus enquanto o claude.ai da fasterdrible mostrava 14% na semana. A entrada "fasterdrilbe" aponta para `C:\Users\phpos\.claude` — a **mesma pasta do Claude Code do VS Code**; quando o usuário trocou de conta lá (hoje 07:33), o login da pasta passou a ser a **phpos40**, e o Zeus continuou chamando pelo apelido do cadastro. O login da pasta própria da phpos40 ficou recusado (401).

- O nome mostrado vem da **conta de verdade** do login (`/api/oauth/profile`), com o apelido do cadastro entre parênteses quando difere.
- Aviso quando **duas entradas são a mesma conta** e nota fixa na entrada da pasta padrão (`~/.claude`): "Pasta compartilhada com o Claude Code do VS Code/terminal — muda de conta quando você troca lá".
- Resposta **429** (consultas demais) mostra a última leitura boa em vez de "Resposta 429".

**Verificado:** `pnpm typecheck` (6 pacotes); perfil real das duas pastas pela API: `.claude` → php***@gmail.com (30% / 98%), pasta da phpos40 → login recusado.

## [3.82.1] — 2026-10-21

### Corrigido — exclusões sem confirmação

A conta Claude `phpos40` sumiu do Zeus logo depois de o usuário refazer o login dela (o login na pasta continuava válido): a lixeira em Configurações → Claude Code apagava a conta **na hora, sem perguntar**. Tarefas (telas Tarefas e Planejar) tinham o mesmo problema — pode explicar as tarefas que sumiram em 2026-10-20.

- Remover conta Claude, excluir tarefa (Tarefas e Planejar) agora pedem confirmação, com o nome. Projetos já pediam.
- Texto do cartão Claude Code: "Suas contas Claude Pro/Max — o saldo de cada uma aparece na barra lateral" (antes: "para contornar o limite de 5h").
- (Dados, sem código) cadastro da `phpos40` recriado com o mesmo id, apontando para a pasta com o login novo; cópia do banco antes em `backups/cwm-antes-religar-phpos40-2026-10-21.db`. Conferido que as duas contas são distintas (conta, organização e token diferentes).

**Verificado:** `pnpm --filter @cwm/web typecheck`; login da `phpos40` lido pela API (200, 59% / 89%).

## [3.82.0] — 2026-10-21

### Alterado — o indicador de saldo mostra todos os provedores de IA ativos

O usuário pediu que o indicador não fosse só do Claude: deve acompanhar o provedor que estiver ativo (DeepSeek, OpenAI, Claude…).

- A barra lateral mostra **só os provedores com "ativo" ligado** em Configurações; fechado, o **padrão** (o que o Squad / AI Hub usam) e "+N" com os outros.
- Cada um do jeito que o provedor permite: **Claude Code** por conta (5 h / semana, "Usar esta"); **DeepSeek** e **OpenRouter** com o saldo em dinheiro; **OpenAI, Anthropic por chave, Gemini, Groq, Mistral, xAI** como "ativo — não informa saldo pela API" (não há consulta de saldo com chave comum). Todos com **Ver cobrança** (abre a página do provedor; domínios liberados no `shell:openExternal`).
- Saldo abaixo de 2 (na moeda do provedor) → notificação "saldo acabando", uma por dia.
- A chave de API é lida só no main (`KeyStore`, agora exportado do core) e nunca vai para a tela. Canais: `ai:usage:all` / `ai:usage:update` (substituem `claude:usage:*` da 3.81.0); `apps/desktop/src/ai-usage.ts` (`AiUsageMonitor`), `AiUsageBadge.tsx`.

**Verificado:** `pnpm typecheck` (6 pacotes). Testado contra as APIs reais: Claude Code `fasterdrilbe` 36% / 86%, `phpos40` com login vencido; a chave do **DeepSeek** salva no Zeus é **recusada** pela API (401, "api key ****a9a8 is invalid") — o indicador mostra isso. **Não testado clicando no app.**

## [3.81.0] — 2026-10-21

### Adicionado — saldo das contas Claude e troca em um clique

O usuário alterna entre duas contas Claude quando o limite de 5 h ou o semanal acaba; precisava acompanhar o saldo e trocar sem ir até as Configurações.

- **Barra lateral** → indicador "Claude: <conta> · N%" (o limite mais apertado da conta em uso). Abrindo: todas as contas cadastradas com as barras de **5 h** e **semana**, quando cada uma volta, e **Usar esta**. Conta com login vencido aparece com o aviso em vez de porcentagem.
- O Zeus lê o uso de **todas** as contas a cada 5 min (mesma API do "Conta & Uso"; só lê o login de cada conta, não renova token).
- **Perto do limite (≥ 90%)** da conta em uso: notificação do Windows dizendo qual outra conta tem saldo — **clicar troca** para ela. Um aviso por conta e por ciclo do limite; respeita a chave Notificações das Configurações.
- A troca é sempre do usuário (botão ou clique na notificação), não automática: trocar sozinho para escapar do limite pode ir contra os termos da Anthropic.
- Vale para o Squad e o AI Hub do PC (provedor Claude Code), que já usam a conta ativa a cada mensagem.

**Verificado:** `pnpm typecheck` (6 pacotes); leitura real das duas contas: `fasterdrilbe` 36% (5 h) / 86% (semana); `phpos40` com login expirado desde 06/2026 (API 401). **Não testado clicando no app.**

## [3.80.1] — 2026-10-21

### Removido — tudo que abria ou mencionava o VS Code

O Zeus não usa mais o VS Code: o trabalho é na IDE própria e no Hermes. A pedido do usuário, depois de o botão "Abrir no VS Code (Remote SSH)" falhar na VPS nova.

- Botões: "Abrir no VS Code (Remote SSH)" (página do projeto), "VS Code" (projetos no Lançador), "Abrir no VS Code Insiders" (explorador do Squad). Removidos também o canal `launcher:openProject` e o `LauncherService.openProject`.
- Diagnósticos não verificam mais VS Code / VS Code Insiders (só SSH, Git, Node.js).
- Textos do Dashboard, Projetos locais e Manual de Uso sem comparações com o VS Code; seção "Caminho VS Code" das Configurações no Manual removida. (As colunas `vscodePath` da tabela `settings` ficam no banco, sem uso.)

### Corrigido

- `zeus-hermes/config.json` gravado com BOM (PowerShell 5.1) fazia o Zeus ignorar o serviço da VPS sem aviso — o BOM agora é ignorado.

### Infra (sem código) — VPS dedicada ao Hermes

- Hermes, Claude Code e o serviço `zeus-hermes` migrados para a VPS **ZEUS** (`200.141.20.12`, Tailscale `vps-hermes`), só do Hermes: SSH só por chave, firewall só SSH, atualizações automáticas. ACESSIBILIDADE migrado com tarefas, logs e git; serviço da VPS-1 desligado (arquivos ficam como cópia).

**Verificado:** `pnpm typecheck` (6 pacotes); config 17/17, core 61/61; nenhuma menção a VS Code nas telas (busca no código).

## [3.80.0] — 2026-10-21

### Adicionado — trabalho do Hermes salvo no GitHub

Antes, os commits do Hermes ficavam só no git da pasta na VPS — se a VPS se perdesse, o trabalho ia junto.

- Painel Agent (projetos que rodam no serviço da VPS) → seção **GitHub** → **Ligar ao GitHub**: cria um repositório **privado** na conta do GitHub logada no PC (ou usa um existente) e cadastra nele a **chave do projeto na VPS** como deploy key — ela só grava naquele repositório, não dá acesso à conta.
- A partir daí, **cada tarefa concluída e conferida** é enviada pelo serviço ao branch **`hermes`** (remoto próprio `github`, sem `--force`); o `main` fica para juntar por Pull Request. Quem envia é o serviço; o Hermes continua proibido de dar push. Envio que falha não desfaz a tarefa — aparece na saída e vai na próxima.
- Serviço: `POST /api/projects/:id/github/key` e `/github/link` (nome do repositório validado: `dono/nome`); pushes do mesmo projeto em fila.

**Verificado:** `pnpm typecheck` (6 pacotes); core 61/61; na VPS-1: chave gerada com permissão só do root, nome com comando embutido recusado, status do projeto com o campo `gitRepo`. **Não testado ligando a um repositório de verdade.**

## [3.79.1] — 2026-10-21

### Corrigido — QR de pareamento aparecia quebrado

O QR era uma imagem `data:`, e o CSP do `index.html` do Zeus (sem `img-src`, cai em `default-src 'self'`) bloqueia esse tipo de imagem. Agora o QR é desenhado num `<canvas>`, sem afrouxar o CSP.

**Verificado:** `pnpm --filter @cwm/web typecheck`. Não testado lendo o QR no celular.

## [3.79.0] — 2026-10-21

### Adicionado — app do celular (Zeus Mobile, Passo 3 — primeira versão)

- O serviço `zeus-hermes` passa a servir uma página para o celular em `https://vps-1.tailfd24ac.ts.net:8443` (só pela rede do Tailscale), instalável na tela inicial. Mostra os projetos e, em cada um: situação do loop, Hermes no ar, nível de autonomia, tarefas, saída ao vivo e atividade (atualizam sozinhas). Ações: **Autorizar/Negar** (com confirmação), responder **decisão**, **liberar tarefa de risco alto**, **Continuar loop/Próxima**, **Retomar**, **Parar após a tarefa** e **Cancelar**. Objetivo novo continua pelo Zeus no PC.
- **Pareamento**: Configurações → **Celular (Zeus Mobile)** → **Mostrar QR de pareamento**. O link leva o token no fragmento (`#t=`), que o navegador não envia ao servidor; o app guarda o token só no aparelho e o tira do endereço. O QR some em 2 minutos.
- Segurança da página: arquivos estáticos fixos (nada fora da lista é servido), CSP só `'self'`, sem embutir em outros sites, sem referrer; tudo que vem do Hermes entra como texto, nunca como HTML; os dados continuam exigindo o token.
- Notificações no celular ficam para a próxima leva.

**Verificado:** `pnpm typecheck` (6 pacotes); na VPS-1 pelo Tailscale: os 6 arquivos do app com tipo certo, cabeçalhos de segurança, `/api` sem token → 401, `server.cjs` não é servido. **Não testado no celular.**

## [3.78.0] — 2026-10-21

### Adicionado — Hermes da VPS-1 como serviço (Passos 1 e 2 do Zeus Mobile)

O loop do Hermes passa a poder rodar num serviço sempre ligado na VPS, para continuar com o PC desligado (`docs/ZEUS_MOBILE_PLAN.md`).

- **Serviço `zeus-hermes`** (`apps/server`) instalado na VPS-1: o mesmo `HermesAgentRunner`, banco próprio, systemd (reinicia sozinho), só escutando em `127.0.0.1` e publicado **só na rede privada do Tailscale** em `https://vps-1.tailfd24ac.ts.net:8443`. Toda rota pede token (o serviço guarda só o sha256); entrada validada com Zod; 10 tentativas erradas bloqueiam o IP por 15 min.
- **Zeus usa o serviço** nos projetos migrados: o main repassa ao serviço tudo o que o painel Agent pede (loop, Autorizar/Negar, tarefas, status, DoD, entrega, logs, regras, contexto) e retransmite os eventos ao vivo para as janelas. O painel não muda. Projetos não migrados seguem com o loop no PC.
- `scripts/deploy-zeus-hermes.mjs` (instala/atualiza o serviço) e `scripts/migrate-to-zeus-hermes.mjs` (leva os projetos da VPS do banco do PC para o serviço — exige o Zeus fechado; não apaga nada do PC; desfazer = apagar `%APPDATA%\@cwm\desktop\zeus-hermes\config.json`).
- Criação das tabelas do Hermes movida para `ensureHermesSchema()` no core (usada pelo Zeus e pelo serviço).
- Segurança: a primeira instalação deixava a pasta do app gravável por qualquer usuário da VPS (permissões do Windows no tar) — corrigido na VPS e no script.

**Verificado:** `pnpm typecheck` (6 pacotes); core 61/61; serviço na VPS-1: health pelo Tailscale com HTTPS válido, 401 sem token, validação, portas 8443/8790 fechadas no IP público, reinstalação mantém as permissões. **Migração e uso pelo painel ainda não testados.**

## [3.77.1] — 2026-10-20

### Adicionado — cópia de segurança automática do banco

Em 2026-10-20 os projetos (de manhã) e depois todas as tarefas do Hermes (à tarde: 42 do ACESSIBILIDADE + 26 do teste-hermes) sumiram do `cwm.db`. As linhas foram apagadas uma a uma (o texto continua nas páginas livres do arquivo); nada no código, na build, no instalador ou nos testes E2E apaga em massa, e a causa não foi encontrada.

- Ao abrir o Zeus e a cada hora: cópia consistente (`VACUUM INTO`) em `%APPDATA%\@cwm\desktop\backups\`, guardando as 20 últimas.
- `backups.log` anota, em cada cópia, quantas linhas havia em VPS, projetos, tarefas e tabelas do Hermes — se algo sumir de novo, mostra entre quais horários.
- Guardada à mão uma cópia bruta do banco de hoje (`cwm-forense-2026-10-20-paginas-livres.db`), com as páginas livres onde ainda está o texto das tarefas apagadas; a limpeza automática não toca nela.

**Verificado:** `VACUUM INTO` e a contagem pelo Prisma numa cópia do banco real; `pnpm --filter @cwm/desktop typecheck`.

## [3.77.0] — 2026-10-20

### Alterado — loop do Hermes no processo principal (Passo 0 do Zeus Mobile)

O loop de tarefas do Hermes rodava dentro do painel Agent: fechar o painel ou a janela no meio de uma tarefa a interrompia (aconteceu com a T1 do ACESSIBILIDADE). Primeiro passo do plano em `docs/ZEUS_MOBILE_PLAN.md`.

- O loop inteiro (plano, tarefas, conferência de commit, Decision Request, Autorizar/Negar, tarefas paralelas, fechamento da entrega e correções automáticas) foi para o `HermesAgentRunner`, no core, executado pelo processo principal. **Fechar o painel ou uma janela não interrompe mais nada**; só fechar o Zeus inteiro.
- O painel só mostra o estado e manda comandos. Ao reabrir, mostra a saída ao vivo, a atividade, as aprovações e a decisão pendente de onde estavam. Duas janelas no mesmo projeto mostram o mesmo loop.
- Uma operação por projeto, conferida no main (antes cada painel tinha sua trava).
- O runner não depende do Electron — é o mesmo código que vai rodar como serviço na VPS-1 para o Zeus funcionar com o PC desligado.
- Política de autonomia (avançar, parar em risco alto, paralelo, classificar risco) movida para `@cwm/config`, usada pelo loop; a tela guarda só os rótulos (o renderer não importa valores do config). Prompts e leitura das tags em `agent-prompts.ts`.

**Verificado:** `pnpm typecheck` (5 pacotes); core 61/61 (novos: 4 cenários do runner com um Hermes falso — plano → loop → entrega fechada sozinha; comando bloqueado → Negar → tarefa concluída; Parar; uma operação por projeto — e 5 de prompts/tags); config 17/17. **Não testado com o Hermes real nem clicando no app.**

## [3.76.3] — 2026-10-20

### Corrigido — selo do agente e "Retomar sessão" no painel do Hermes

Com o projeto ACESSIBILIDADE religado, o painel mostrava **Erro** em vermelho enquanto o loop já rodava a T1, e nunca ofereceu "Retomar sessão".

- O selo do agente mostra **Executando** enquanto o painel está rodando plano/tarefa/loop (o status do banco só é relido ao fim de cada execução).
- Execução interrompida aparece como **Interrompida** (âmbar), não Erro; demais erros mostram a mensagem ao passar o mouse.
- "Retomar sessão" só reconhecia a interrupção gravada pelo boot do Zeus ("…interrompida…"); a do próprio Hermes chega como `Interrupted` e o aviso não aparecia. Agora reconhece as duas.

**Verificado:** `pnpm --filter @cwm/web typecheck`. Não testado clicando no app.

## [3.76.2] — 2026-10-20

### Corrigido — projeto local enviado antes não podia ser retomado

O usuário reabriu a pasta ACESSIBILIDADE (enviada à VPS-1 em 3.70.0) e o botão Agent mostrou de novo o formulário de envio, que recusava: "/root/acessibilidade já existe na VPS e não está vazia". Causa: o cadastro do projeto tinha sumido de Projetos (os três projetos do banco, inclusive o criado às 11:36 — origem não identificada; nenhum código apaga projetos em massa, só o excluir da tela Projetos), e ao abrir a pasta o Zeus **apagava a ligação** junto com o registro do que estava sincronizado. A pasta e o histórico do Hermes (42 tarefas) continuavam na VPS e no banco.

- A ligação da pasta não é mais apagada quando o projeto some.
- O envio recusado por pasta já existente oferece **Ligar a esta pasta existente**: não copia nada; arquivos iguais nos dois lados ficam sincronizados, os diferentes aparecem em Trazer/Enviar alterações (conflito quando existem nos dois). Reaproveita o projeto da mesma pasta ou, se ele foi apagado e o Hermes tem histórico ali, recria o projeto com o mesmo id — tarefas e estado do agente voltam.

**Verificado:** `pnpm typecheck`; core 52/52; a busca do histórico do Hermes rodada no banco real (somente leitura) acha o projeto antigo de `/root/acessibilidade`. Não testado clicando no app.

## [3.76.1] — 2026-10-20

### Corrigido — janela não encaixava na tela do Windows

O usuário viu que a janela do Zeus não se ajustava: encaixada ao lado do VS Code, passava da borda da tela, com o botão de fechar escondido. Monitor de 1536 px úteis (125%): a metade da tela no Snap do Windows tem 768 px, mas toda janela tinha largura mínima de 960 px (Incident Mode 1100 × 700) — o Windows não conseguia encolher e ela transbordava.

- Mínimo de todas as janelas (principal, IDE/projeto, Incident Mode, Deploy Assistant) baixou para 600 × 400 — cabe na metade e no quarto de tela.
- Tamanho inicial limitado à área útil do monitor onde a janela abre (o do cursor), para nunca nascer maior que a tela.

**Verificado:** `pnpm --filter @cwm/desktop typecheck`. Não testado no app (encaixe na metade da tela).

## [3.76.0] — 2026-10-19

### Adicionado — terminal na IDE local

A IDE local não tinha terminal (só a remota, via SSH): para `npm install`, `npm run dev`, testes ou git era preciso outro programa.

- Botão de terminal no topo da IDE local (e **Ctrl+`**) abre o painel de baixo com **Terminal** — PowerShell num pseudo-terminal (ConPTY) **já na pasta do projeto**, cores e edição de linha como no VS Code, várias abas (**+**) — e **Problemas** (erros/avisos do editor), que também estava escondido no modo local. Logs continua só no remoto.
- Mesmos canais do terminal SSH (`terminal:data/exit/input/resize/close`); só a abertura é nova (`terminal:local:open`, pasta validada). Fechar a janela do projeto encerra os PowerShell dela (sem processo órfão). `ELECTRON_RUN_AS_NODE` é removido do ambiente do terminal — senão qualquer app Electron iniciado nele (ex.: `pnpm dev` de outro projeto) rodaria como Node puro.
- Motor: `@lydell/node-pty@1.1.0` — o node-pty do VS Code com binário pronto (N-API) para Windows x64, sem compilador nem `electron-rebuild`. `LocalTerminalSession` em `apps/desktop/src/terminal/local-terminal.ts`.

**Verificado:** PowerShell aberto, comando executado, redimensionado e encerrado pelo node-pty no Node e **dentro do Electron 33 do app empacotado** (`win-unpacked`, com `conpty.node` no pacote); `pnpm typecheck` (5 pacotes). Não testado clicando no app.

## [3.75.0] — 2026-10-19

### Alterado — Hermes: commit por tarefa testada passa a ser conferido

O usuário perguntou se o Hermes faz commit a cada tarefa testada. O prompt de cada tarefa já pedia um commit (ETAPA 25), mas só como pedido: não dizia "com os testes passando" e o NEX não conferia — um modelo gratuito podia esquecer, e a tarefa ficava Concluída com trabalho fora do histórico.

- **Prompt da tarefa:** rodar os testes e só commitar com eles passando; garantir `.gitignore` (node_modules, dist, .next, .env) antes do commit; aviso de que o NEX confere.
- **Conferência no fechamento** (`completeTask`, usado pelo loop, pela resposta a Decision Request e pelo Autorizar/Negar): ao `[TAREFA_CONCLUIDA]`, o NEX lê `git status` da pasta do projeto na VPS (ignora o `.hermes.md` que ele mesmo escreve). Limpo → Concluída. Sobrou alteração → pede **uma vez**, na mesma sessão da tarefa, para rodar os testes, ajustar o `.gitignore` e commitar (linha "[NEX] …" na saída ao vivo); decide pelo estado do repositório depois disso, não pela tag. Ainda sujo → **Bloqueada** com a lista dos arquivos. Sem conseguir conferir (erro de SSH) a tarefa não é travada.
- **Tarefas paralelas:** o merge leva só o que foi commitado no worktree e depois o apaga — alteração sem commit sumiria. Agora, nesse caso, não há merge: worktree e branch ficam preservados e a tarefa fica Bloqueada com o caminho.

**Verificado:** `pnpm typecheck`; a regra de conferência contra o git real da VPS-1 numa pasta temporária (repositório sem commit → cobra; só `.hermes.md` → concluída; alterado + novo → cobra os dois). **Não testado com o Hermes num loop real** (precisa do painel).

## [3.74.0] — 2026-10-19

### Adicionado — Publicar no GitHub (IDE local) e pasta .git fora da árvore

O usuário fez o primeiro commit na IDE local e perguntou se tinha ido para o GitHub — não: o projeto não tinha remoto, e ligar um exigia o terminal.

- **Publicar no GitHub** na aba Git (projeto local sem `origin`, depois do 1º commit): **Criar no GitHub e enviar** cria o repositório na conta do usuário (privado por padrão; nome sugerido a partir da pasta, sem acentos) e faz `push -u origin HEAD`; **Já tenho o repositório** liga uma URL `https://github.com/<dono>/<repo>` (ou `git@github.com:…`) e envia. Depois disso o **Push** funciona normalmente.
- O login usado é o que o **Git Credential Manager** já guarda no Windows (`git credential fill`), lido no main só para a chamada à API (`POST /user/repos`) — nunca vai para o renderer, log ou banco. Nome já existente na conta, login expirado, sem login, URL inválida, projeto sem commit e projeto já ligado viram mensagens claras; se o push falhar, a ligação é desfeita para tentar de novo.
- A pasta **`.git` não aparece mais na árvore** de arquivos (local e VPS), como no VS Code — mexer nela à mão estraga o repositório.

**Verificado:** 3 testes unitários novos (nome do repositório, sugestão de nome, URL) — core 52/52; integração com o git real e a API do GitHub sem criar nada (8 casos: status sem remoto/sem commits, recusa sem commit, URL de outro serviço, nome inválido, login + API respondendo "já existe" para `NEX-ALS-IDE`, nada ligado após a recusa, recusa quando já há origin); `pnpm typecheck` (5 pacotes). A criação de verdade fica provada no primeiro uso.

## [3.73.0] — 2026-10-19

### Adicionado — Git na IDE local

O painel **Git** (Source Control) só existia na IDE da VPS; os projetos locais já nascem com git (Novo projeto), mas commit/push exigiam outro programa.

- Aba **Git** na IDE local, com o git do PC: branch e ↑/↓ em relação ao remoto, preparados / não preparados / novos, diff no editor, preparar/despreparar (por arquivo ou todos), descartar alteração, commit, push e pull; branch e contagem na barra de status; badges M/A/D/? na árvore. Atualiza ao salvar um arquivo e depois de "Trazer alterações" do Hermes.
- Funciona em **projeto sem nenhum commit** (branch via `git branch --show-current`; despreparar usa `git rm --cached` quando não há HEAD), com **nomes acentuados** (`core.quotepath=off`), renomeados e pasta aberta **dentro** de um repositório maior (caminhos relativos à pasta).
- Mensagens do git que pedem ação viram instrução em português: identidade não configurada, branch sem upstream (`git push -u …`), repositório sem remoto, login do GitHub. Push/pull nunca travam esperando senha no terminal (`GIT_TERMINAL_PROMPT=0`; o Git Credential Manager do Windows usa a própria janela).
- **Repositório na pasta pessoal é ignorado.** Achado nesta máquina: `C:\Users\phpos` é um repositório git (324 arquivos de outro projeto, remoto apontando para o GitHub do Zeus). Toda pasta do OneDrive sem git próprio ficava "dentro" dele — o painel varreria a pasta pessoal inteira e um push iria para esse remoto. Agora essa pasta aparece como "sem repositório", com a explicação, e commit/push/pull são recusados nela.

**Como funciona:** `LocalGitService` (`packages/core/src/git/local-git.service.ts`) — `execFile('git', [...])` com argumentos em lista, sem shell (caminhos e mensagem sem escape); `parsePorcelain` e `explainGitError` puros. IPC `git:local:status|diff|add|restore|commit|push|pull` (Zod `LocalGitRequestSchema`; leitura com `requireAuth`, alteração com `requireAdmin`). IDEPage usa um adaptador `gitApi` (local ou VPS) no mesmo painel. `GitStatus.outerRepo` (opcional) explica o caso da pasta pessoal.

**Verificado:** 5 testes unitários novos (leitura do status, renomeado/acentos/aspas, prefixo de subpasta, mensagens) — core 49/49; integração com o git real num repositório descartável (12 casos: repo sem commits, add, despreparar sem HEAD, commit com aspas e `$`, diff, descartar, push sem remoto, subpasta, pasta no repositório pessoal ignorada e commit bloqueado, cwd inválido); `pnpm typecheck` (5 pacotes).

## [3.72.0] — 2026-10-19

### Alterado — Projetos: "Novo projeto" cria a pasta no PC; VPS é opcional

Reportado pelo usuário (print da tela Projetos): a tela só listava projetos remotos e "Novo Projeto" exigia caminho na VPS e VPS — o contrário do fluxo dele, em que o projeto nasce no OneDrive e só vai à VPS (produção) ao publicar.

- **Novo projeto** (botão principal): nome + "Criar dentro de" (padrão: a pasta do OneDrive, `%OneDrive%`; "Escolher…" para outra) + "Iniciar repositório git" (marcado; cria `.gitignore` com node_modules, .next, dist, .env). Cria a pasta com `README.md`, abre na janela própria e entra nos recentes. Nada é criado na VPS. Nome validado para o Windows (`< > : " / \ | ? *`, nomes reservados como `con`/`nul`, ponto ou espaço no fim); pasta existente é recusada.
- **Manual de uso atualizado para o fluxo "local primeiro"** (3.70 → 3.72): no app, Início Rápido reescrito (criar projeto local → IA → VPS → publicar com o Agent), "Dois modos de operação", nova seção **Janelas — um projeto por janela** (abrir pasta, recentes, reabrir ao iniciar, Fechar janela/🏠, instância única, por que não há Ctrl+W) e 3 casos novos em Solução de problemas; `docs/GUIA_INICIANTE.md` com o nome Zeus IDE, telas Dashboard/Projetos/Lançador, "uma janela por projeto", passos 1–7 (inclui publicar e Trazer alterações) e FAQ.
- A tela mostra **Projetos locais** primeiro e **Projetos na VPS** depois; o formulário antigo virou **Cadastrar projeto da VPS** (secundário) — para projetos que já existem numa VPS.

- **Reabrir não falha mais quando o app inteiro fecha de uma vez** (instalador, desligar o Windows, fechar a última janela): cada janela que fechava tirava a sua pasta da lista na hora, então só sobrava a última. Agora a gravação espera 1,5s e o encerramento do app chega antes.

**Verificado:** no app instalado, duas pastas abertas + fechamento como o do instalador → as duas continuam na lista para reabrir; criação testada fora do app (com e sem git, `.gitignore`/`README`, pasta existente recusada, pasta-mãe inválida recusada, 8 nomes inválidos/válidos); `pnpm typecheck` (5 pacotes).

## [3.71.0] — 2026-10-19

### Adicionado — projetos locais em janelas próprias, como no VS Code

Pedido do usuário: projetos não começam na VPS (produção) — começam numa pasta local e cada um deve ficar aberto na sua janela, como no VS Code; as janelas novas iam todas para a VPS e "Abrir pasta local" trocava a tela da janela principal.

- **Uma janela por pasta.** "Abrir pasta…" (Dashboard, Lançador, menu **Arquivo → Abrir pasta…** / **Ctrl+O**, e dentro da IDE local) abre a pasta numa janela nova; abrir de novo uma pasta já aberta só traz a janela dela para frente.
- **Projetos locais** no topo do Dashboard e do Lançador: recentes (até 20) com "aberta" / "não encontrada", um clique para abrir e × para tirar da lista. Menu **Arquivo → Abrir recente**.
- **Reabre ao iniciar** as pastas que estavam abertas quando o Zeus fechou (pelo menu Sair ou fechando a última janela).
- **Título da janela = nome do projeto** (`acessibilidade — Zeus IDE`, `VPS-1 (VPS) — Zeus IDE`). Antes o `<title>` da página sobrescrevia o título e todas as janelas apareciam como "Zeus IDE" na barra de tarefas.
- Menu do app em português: Arquivo (Abrir pasta, Abrir recente, Janela principal, Fechar janela, Sair), Editar, Exibir, Janela. "Fechar janela" sem Ctrl+W de propósito — no VS Code ele fecha a aba.
- Lançador: "Terminais SSH" → **VPS**; "Projetos" → **Projetos na VPS**.

**Verificado no app instalado:** com duas pastas registradas como abertas, o Zeus reabriu as duas em janelas próprias (`projeto-alfa — Zeus IDE`, `projeto-beta — Zeus IDE`) além da principal; `pnpm typecheck` (5 pacotes).

**Como funciona:** `apps/desktop/src/local-folders.ts` (`LocalFolderStore`, JSON em `%APPDATA%\@cwm\desktop\local-folders.json` — recentes + pastas abertas na saída); `main.ts` mantém `localWindows` (chave = caminho normalizado) e `openLocalFolderWindow`; IPC `local:openFolderWindow`, `local:recent:list|open|remove`. Componente `LocalProjects.tsx`.

## [3.70.2] — 2026-10-19

### Alterado — Lançador: nova janela visível e projetos abrem na IDE

Reportado pelo usuário: não encontrava o botão de nova janela — no Lançador ele era só um ícone (⎋) sem texto, ao lado de outros dois ícones soltos; e o cartão do projeto só tinha "Abrir no VS Code".
- Botões da VPS com nome: **Nova janela**, **Incidente**, **Deploy**.
- Cartão do projeto: **IDE ⎋** (janela própria já na pasta do projeto — vários projetos abertos ao mesmo tempo), **Agent** (Hermes do projeto), **Projeto** (página do projeto) e **VS Code**.

## [3.70.1] — 2026-10-19

### Corrigido — vários projetos e várias janelas ao mesmo tempo

Reportado pelo usuário: ao abrir um projeto só havia "Sair", e abrir outra janela "interrompia".

- **Abrir o Zeus de novo criava um segundo app no mesmo banco** — não havia trava de instância única. O segundo processo rodava a recuperação de boot e marcava como **"Sessão interrompida"** os agentes do Hermes que o primeiro estava executando (tarefas em andamento voltavam para Pendente, execuções viravam erro nos Logs, diagnósticos de incidente falhavam), além de subir um segundo monitor de alertas e um segundo agendador (automações rodando duas vezes, notificações em dobro). Agora `requestSingleInstanceLock`: abrir de novo só traz a janela principal para frente, ou a recria se tinha sido fechada.
- **Nova janela perdia a pasta** — o ⎋ da IDE remota abria a nova janela em `/root`; agora leva a pasta aberta (`?path=`). A IDE local ganhou o ⎋ (mesma pasta, sem abrir o seletor — `?folder=`). Pedido validado no main (`parseIdeTarget`: id da VPS, caminho remoto absoluto sem `..`/aspas, pasta local existente).
- **Página do projeto → IDE abre em janela própria**, deixando a janela principal livre para abrir outro projeto; "IDE nesta janela" mantém o comportamento antigo.
- **"Sair" travado em janela separada** — era `navigate(-1)` e uma janela nova não tem tela anterior. Novo `useWindowExit` (IDE, Terminal, Explorer, Incident, Deploy, Hermes, AI Hub, Planejar, Workspace): volta se houver tela anterior na própria janela; senão, numa janela independente, **fecha só ela** ("Fechar janela"), e na principal vai para o início. Botão 🏠 na IDE independente traz a janela principal (reabre se fechada). IPC `window:info|closeSelf|focusMain`.
- **Diálogos e eventos presos à janela principal** — "abrir pasta", exportar/importar configurações e os eventos `squad:fs:change`/`squad:shell:line` usavam a janela principal fixa: numa IDE separada o seletor abria na janela errada, e com a principal fechada dava erro. Agora vão para a janela que pediu.

- **`pnpm test` falhava depois de qualquer build** — o `tsc` do build emite os `.test.js` em `dist/` e o vitest (sem config) também os carregava, como CommonJS ("Vitest cannot be imported in a CommonJS module"): 7 arquivos falhando com todos os testes reais passando. `@cwm/core` e `@cwm/config` passam a rodar `vitest run --dir src`.

**Verificado:** `pnpm typecheck` (5 pacotes), `pnpm build` e `pnpm test` com `dist/` presente (17/17 config, 44/44 core). Instância única e janelas ainda não testadas no app instalado.

## [3.70.0] — 2026-10-19

### Adicionado — Hermes para projeto que começa no OneDrive (IDE local → VPS → de volta)

Pedido do usuário: os projetos começam numa pasta do OneDrive e só depois vão para a VPS, mas o painel Agent só existia no modo remoto — o Hermes roda na VPS e não alcança a pasta do PC.

- **Botão Agent na IDE local.** Sem ligação: escolher a VPS, uma pasta **nova ou vazia** lá e o nome do projeto → **Enviar e abrir o Hermes**. A pasta é empacotada com o `tar` do Windows (sem `node_modules`, `.next`, `.nuxt`, `dist`, `.turbo`, `.cache`, `coverage`, `.venv`, `__pycache__`; `build/` vai), enviada por SFTP e extraída na VPS; o projeto é cadastrado e o painel do Hermes abre já nele. Sem `.git`, a VPS ganha um repositório com o commit "Importado do OneDrive pelo Zeus IDE" (fechamento da entrega e tarefas paralelas usam git). Com `.git` vindo de um Windows com `core.autocrlf=true`, o repositório da VPS recebe `core.autocrlf input` — senão o git de lá mostraria todo arquivo como modificado.
- **Trazer alterações / Enviar alterações.** Cada arquivo é comparado com a última versão igual nos dois lados (sha1 guardado em `hermes_local_links.manifest`): mudou só na VPS → aparece em Trazer; só no PC → em Enviar; igual nos dois → só atualiza a base; diferente nos dois → **conflito**, nas duas listas, desmarcado (marcar substitui a versão do outro lado). O botão Trazer mostra quantos arquivos mudaram na VPS quando uma execução do Hermes termina. Enviar é recusado com o Hermes rodando no projeto.
- **Segurança:** caminho remoto validado (absoluto, ≥ 2 níveis, só `[A-Za-z0-9._@+-/]`, fora de `/root`, `/etc`, `/var`…); pasta remota precisa estar vazia; o diff é recalculado no main a cada aplicação (o renderer só escolhe caminhos); caminho vindo da VPS só é gravado se for válido no Windows e ficar dentro da pasta local. `.git` não volta (commits do Hermes ficam na VPS) e o `.hermes.md` do NEX é ignorado.
- **IDE:** depois de Trazer, a árvore e as abas sem edição pendente recarregam; aba com edição não salva que mudou no disco só avisa.
- **Backend:** `HermesLocalSync` (`packages/core/src/hermes/local-sync.ts`), `SftpSession.readFileBuffer/writeFileBuffer/uploadFile/mkdirp` (as leituras/escritas antigas eram só UTF-8), IPC `hermes:local:link|publish|status|pull|push` com Zod (`HermesLocalPublishSchema`, `HermesLocalSyncApplySchema`). UI em `LocalHermesPanel.tsx`; Manual de Uso com a seção "Projeto que começa no OneDrive".

**Verificado:** `pnpm typecheck` (5 pacotes); 44/44 testes no core (12 novos: diff dos 3 lados, conflitos, validação de caminho, nomes inválidos no Windows, leitura do `sha1sum`) e 17/17 no config; **integração real na VPS-1** numa cópia do banco do app, em pasta descartável apagada no fim — envio sem `node_modules` com `build/` e binário byte a byte iguais, git init, segunda publicação recusada, modificado/novo/apagado trazidos, conflito detectado e preservado até ser escolhido, `.hermes.md` ignorado, `../fora.txt` recusado, envio PC → VPS, `/root` recusado; repositório clonado no Windows com CRLF enviado → `git status` limpo na VPS. **Não testado pela UI** (botões e formulário na IDE local).

## [3.69.2] — 2026-10-19

### Corrigido — diagnóstico do Hermes "não respondeu no formato esperado", ações sumindo e "Error" solto

Reportado no Incident Mode (VPS-1): o diagnóstico aparecia como texto bruto, sem ações, com um "Error" sem detalhe embaixo.

**1. "Error" vazio — e Logs/diagnóstico ao vivo que nunca carregavam (bug da 3.67.0/3.69.0):** o `invoke` do renderer trata como falha do IPC **qualquer** resposta com a chave `error`. Os registros de execução (`HermesRunSummary`) e de incidente (`HermesIncident`) tinham um campo `error` (normalmente vazio) → `hermes:runs:get`, `hermes:incident:get/diagnose/resolve` lançavam `Error('')`. Efeitos: o detalhe da aba **Logs** ficava girando, a saída ao vivo do diagnóstico não aparecia e as ações do Incident Mode mostravam "Error". O campo passa a se chamar **`failure`** nos objetos (a coluna no banco continua `error`, sem migração), com comentário explicando a colisão. Os testes de integração chamavam o core direto e não passavam por essa camada.

**2. JSON do Hermes com erro de sintaxe:** o modelo gratuito escreveu `"…sem reinicição"),"Load…"` (parêntese sobrando) e o `JSON.parse` recusou o diagnóstico inteiro. Nova leitura tolerante `extractJsonObject` (`packages/core/src/hermes/json-loose.ts`): tenta o JSON como veio e, se falhar, conserta parêntese sobrando depois de string e vírgula antes de `]`/`}`. Usada pelo diagnóstico de incidente e pela revisão de fechamento da entrega.

**3. Ações fora do JSON:** no mesmo diagnóstico, o Hermes pôs as ações numa tabela markdown depois do JSON — mesmo lido, ficava sem nenhuma ação para executar. JSON sem o campo `actions` agora é **incompleto** (`"actions": []` continua válido: nada a corrigir).

**4. Segunda chance:** JSON ilegível ou incompleto → o NEX pede ao Hermes, **na mesma sessão e uma única vez**, que reenvie só o JSON corrigido sem rodar comandos (`buildJsonFixPrompt`). No incidente isso acontece no main; na revisão de entrega, o painel confere antes de fechar (`hermes:delivery:checkReview`), para a correção não gastar uma das 3 rodadas.

**Documentação atualizada para 3.62 → 3.69:** Manual de Uso no app (`Help.tsx` — seção Hermes: níveis de autonomia, regras, checkpoints, fechamento da entrega, Quadro/Logs, painel na IDE; seção Incident Mode: incidentes, aba Hermes, reparo confirmado, trava de segurança; versão do guia), `AGENTE.md` (módulo `hermes/`, IPC novos, estado atual, armadilhas do IPC e do BIGINT), `CLAUDE.md` (nome Zeus IDE, versão, botão Agent nos atalhos).

**Verificado:** o texto real que falhou agora é lido (status, 11 evidências); a segunda chance testada na VPS-1 na sessão de um diagnóstico real — 0 comandos executados, só o JSON, 3 ações dentro; 32/32 testes no core (7 novos de leitura tolerante/incompleto); testes de integração do log e dos incidentes refeitos com `failure`; `pnpm typecheck` (5 pacotes).

## [3.69.1] — 2026-10-19

### Corrigido — Incident Mode caía com "Minified React error #31" ao carregar as métricas

**Sintoma reportado:** "Algo deu errado nesta página" no Incident Mode, logo depois de abrir.

**Causa (antiga, não da 3.69.0):** `monitor:getStats` devolve `cpu`, `ram` e `disk` como objetos (`{ usagePercent, loadAvg1, cores… }`), mas o Incident Mode lia como número (`s.cpu ?? 0`) e jogava o objeto no JSX (`CPU {stats.cpu}%`) — o React derruba a página ao tentar renderizar um objeto, assim que as métricas chegam. A tela só abria porque o erro acontecia depois da primeira carga.

**Fix:** `IncidentModePage` e o contexto "Métricas da VPS" do AI Hub passam a ler `usagePercent` (aceitando número também). No AI Hub não havia queda, mas a IA recebia `CPU: [object Object]%` como contexto.

## [3.69.0] — 2026-10-18

### Adicionado — Hermes FASE 7: incidentes de VPS com diagnóstico do Hermes e reparo confirmado (ETAPAS 31/32)

**Alerta → incidente:** cada alerta do NotificationMonitor (disco ≥ 85%, CPU ≥ 90%, RAM ≥ 90%) vira um incidente gravado (`hermes_incidents`). Alerta repetido do mesmo tipo na mesma VPS, com o incidente ainda aberto, atualiza o valor em vez de duplicar. **Clicar na notificação abre o Incident Mode** daquela VPS (antes o clique não fazia nada).

**Diagnóstico automático:** se o Hermes está rodando na VPS, o primeiro alerta do incidente dispara um diagnóstico **no main, sem depender de janela aberta** — o alerta pode chegar com o app minimizado. Ao terminar, notificação "Diagnóstico pronto — VPS (CRÍTICO/degradado/OK)" com resumo e quantidade de ações; clique abre o Incident Mode. Um diagnóstico por VPS por vez; o que estava rodando quando o app fechou é marcado como interrompido.

**Somente leitura:** o Hermes roda numa pasta própria (`~/.hermes-nex/incidents`, fora de qualquer projeto), com prompt que proíbe alterar/apagar/reiniciar/instalar e lista comandos de inspeção (`df`, `du`, `free`, `ps`, `docker ps/system df`, `journalctl -p err`, `systemctl --failed`…). Comando bloqueado pelo Hermes vai para o log, não vira Autorizar/Negar. Resposta em JSON: status (ok/degradado/crítico), resumo, causa provável, evidências e ações sugeridas.

**Reparo seguro ("auto-repair" sempre com o usuário):** no Incident Mode, cada ação sugerida tem "Executar…" com confirmação; **risco alto exige digitar CONFIRMO**. O renderer manda só o índice da ação — o comando vem do diagnóstico guardado no main. `isForbiddenRepair` recusa sempre (mesmo confirmado) `rm -rf` amplo, `mkfs`/`dd` em disco, `reboot`/`shutdown`, firewall, usuários, `chmod -R 777 /`, `docker volume rm`/`prune --volumes`/`compose down -v`, `DROP DATABASE`, `curl | sh`, `git reset --hard`, `killall`… Execução auditada em `tool_execution_log` (`hermes:incident_repair`) e o resultado fica no histórico do incidente.

**Incident Mode:** a célula de diagnóstico ganha as abas **Hermes** (incidentes da VPS, "Diagnóstico geral" sob demanda, diagnóstico ao vivo, ações, "Marcar resolvido") e **Chat IA** (a de antes). Corrigido: o diagnóstico automático do Chat IA rodava 1,5s após abrir com os painéis ainda vazios (lia o estado do primeiro render); agora espera a primeira carga de stats/Docker/PM2/logs.

**Outras mudanças:** `NotificationMonitor` aceita vários ouvintes (antes um `onAlert` substituía o outro) e passa a rodar mesmo sem suporte a notificação do sistema; nova execução `incident` no log por execução (aparece nos Logs). IPC `hermes:incident:list|get|diagnose|runAction|resolve` + evento `hermes:incident:updated`.

**Verificado:** `pnpm typecheck` (5 pacotes); 25/25 testes no core (5 novos: prompt, leitura do diagnóstico, trava de reparo com 10 comandos permitidos e 21 recusados); armazenamento testado num SQLite temporário com o Prisma real (registro, dedupe, resolvido → novo incidente, órfão); **diagnóstico real na VPS-1** com o prompt gerado pelo código e o mesmo formato de comando do NEX — o Hermes usou só comandos de leitura e o `parseDiagnosis` leu status, 9 evidências e 3 ações (todas liberadas pela trava). Não testado pela UI (clique na notificação, executar ação).

## [3.68.0] — 2026-10-18

### Adicionado — painel Agent (Hermes) dentro da IDE (ETAPA 16)

- **Botão "Agent"** na barra do topo da IDE, ao lado de "IA" — só no modo remoto (o Hermes roda na VPS). Abre um painel lateral redimensionável (360–960 px) com o mesmo painel do AI Hub: objetivo, níveis de autonomia, regras, tarefas, entrega e as abas Ao vivo / Quadro / Logs.
- **Já no projeto certo:** o painel escolhe o projeto cadastrado **desta VPS** cuja pasta contém a pasta aberta na IDE (o de caminho mais longo, se houver mais de um). Sem correspondência, avisa e deixa escolher — a lista só mostra projetos dessa VPS. Botão para abrir o mesmo projeto no AI Hub em tela cheia.
- **Modo compacto** do `HermesAgentPanel` (`compact`): as duas colunas ficam empilhadas (tarefas em cima, Ao vivo / Quadro / Logs embaixo); `vpsId` filtra a lista de projetos. O AI Hub continua com o layout de duas colunas.
- **A IDE acompanha o Hermes:** quando uma execução termina, a árvore de arquivos (raiz + pastas abertas) e o Git são recarregados na hora, em vez de esperar o polling de 30s. Um arquivo já aberto no editor não é recarregado sozinho (para não sobrescrever edição em andamento).

**Verificado:** `pnpm typecheck` (5 pacotes) e `pnpm build`. **Não testado pela UI contra a VPS.**

## [3.67.0] — 2026-10-18

### Adicionado — Hermes: quadro de tarefas, painel de agentes e logs separados por execução (ETAPAS 12, 13, 37)

A coluna direita do painel Agent ganha abas **Ao vivo / Quadro / Logs**:
- **Quadro (ETAPA 12):** colunas Pendente / Em andamento / Bloqueada / Concluída; cada cartão mostra risco, "paralelo", número de execuções, duração e ferramentas da última, erros, e um indicador quando está rodando. Clicar abre os logs da tarefa.
- **Agentes em execução (ETAPA 13):** faixa no topo do quadro com tudo que o Hermes está executando no projeto agora — tarefa, tarefa paralela, revisão da entrega ou plano/mensagem —, com tempo corrido, ferramentas usadas e erros.
- **Logs (ETAPA 37):** cada execução do Hermes fica separada, filtrável por tarefa ou "plano, mensagens e revisões": lista à esquerda (status, início, duração, ferramentas, erros) e, à direita, o erro final, a atividade (ferramentas, falhas, comandos bloqueados) e a saída completa. Execução em andamento atualiza a cada 3s.

**Como é gravado:** `HermesRunLog` (`packages/core/src/hermes/run-log.ts`) é alimentado pelo **main** em `wireHermesStream` — o registro continua certo mesmo se o painel for fechado e reaberto no meio. A execução é atribuída à tarefa pelo nome da sessão (`nex-task-<id>`; `nex-review-…` = revisão; sem nome = plano/mensagem) ou pelo `taskId` da tarefa paralela. Tabela `hermes_task_runs` (raw SQL): grava ao começar, atualiza a cada 15s e ao terminar; saída limitada aos últimos 200 mil caracteres e 400 eventos de atividade; execução que sobrevive a um restart do app é marcada como interrompida. IPC `hermes:runs:list` / `hermes:runs:get` (auth).

**Achado no caminho:** datas em ms numa coluna `INTEGER` quebram o `$queryRawUnsafe` do Prisma (lê como i32 → `P2010`); a tabela usa `BIGINT`.

**Verificado:** `pnpm typecheck` (5 pacotes); 20/20 testes no core (3 novos para a atribuição sessão → tarefa); teste de integração do `HermesRunLog` num SQLite temporário com o Prisma real (gravar, ler durante e depois, filtrar por tarefa, recuperar órfã). **Não testado pela UI contra a VPS.**

## [3.66.0] — 2026-10-18

### Adicionado — Hermes: fechamento da entrega (DoD como gate, revisão de código e segurança, checkpoints, relatório final — ETAPAS 9, 24, 27, 28, 40)

Quando todas as tarefas de um objetivo terminam, o painel Agent mostra a seção **Entrega** → **Revisar e fechar entrega**:
1. **Revisão (ETAPAS 24/27):** o Hermes, numa sessão própria (`nex-review-…`), lê o diff do objetivo (`git diff <base>..HEAD` — o HEAD é guardado quando o objetivo começa), roda build e testes e revisa código e segurança (secrets, injeção, auth, dados em log), **sem alterar arquivos**, devolvendo JSON com checks e achados por severidade.
2. **Evidência conferida pelo NEX:** os comandos de build/teste que o Hermes informou são **reexecutados pelo próprio NEX** na VPS e o resultado vem do exit code — mas só se estiverem numa lista segura (`npm/pnpm/yarn/bun test|build|typecheck|lint|check`, `npx tsc --noEmit`, `pytest`, `go test ./...`, `cargo test`, `make test`…) e sem nenhum metacaractere de shell. Fora da lista, fica "informado pelo Hermes" e vira ressalva.
3. **DoD como gate (ETAPA 9):** build/testes da DoD são marcados pela evidência; a entrega só é **Aprovada** com build e testes passando, sem achado crítico nem de segurança alto, revisão no formato esperado e **todos** os itens da DoD marcados. Senão: **Bloqueada** com os motivos, ou **Aprovada com ressalvas** (testes não executados, achados altos/médios não-segurança, check não conferido). **Reavaliar DoD** recalcula depois de marcar itens manuais, sem refazer a revisão.
4. **Correções:** o que bloqueia e é corrigível (check falhando, achado crítico/segurança alto) vira tarefa nova. No Semi-autônomo/Autônomo isso é automático ao fim do loop — revisão → correções → loop → revisão — com teto de **3 rodadas** para não virar ciclo infinito; no Assistido, botão "Criar N tarefa(s) de correção".
5. **Relatório final (ETAPA 40):** markdown com veredito, objetivo, tarefas, commits do objetivo, verificações (e quem conferiu), DoD, achados, motivos e ressalvas; recolhível no painel, com **Copiar**.

**Checkpoints (ETAPA 28):** toda execução do Hermes passa a usar `--checkpoints` (snapshot do diretório antes de cada escrita/comando, num repo git "sombra" em `~/.hermes/checkpoints`). Restaurar: rodar `hermes` interativo na pasta do projeto → `/rollback`. Verificado na VPS-1 que a flag convive com `-Q --format stream-json --query-file` sem alterar a saída.

**Backend:** módulo puro `packages/core/src/hermes/delivery.ts` (`parseReview`, `isSafeCheckCommand`, `evaluateDelivery`, `correctionTasks`, `buildDeliveryReport`) + 12 testes; `HermesService.closeDelivery/reevaluateDelivery/getDelivery`; `setObjective` guarda `baseCommit` e zera o fechamento anterior; colunas `hermes_project_agents.baseCommit` e `delivery` (JSON); IPC `hermes:delivery:get|close|reevaluate` (texto da revisão validado com Zod, ≤ 200 KB).

**Verificado:** `pnpm typecheck` (5 pacotes); testes 17/17 no core e 17/17 no config; na VPS-1, o script de reexecução do NEX devolveu exit 0 para `npm test` passando e 3 para `npm run build` falhando. **Não testado pela UI de ponta a ponta** (revisão real do Hermes num projeto).

## [3.65.0] — 2026-10-18

### Alterado — paleta e cabeçalho no visual do logo Zeus

- **Cores:** dourado NEX (`#D9A441`/`#F2C879` e escala `brand`) → azul elétrico do logo (`#1A8CFF`/`#7CC0FF`, escala `brand` 50–950); fundos roxo-escuros (`slate` customizado, `#080612`/`#0D0A24`/`#151038`…) → azul-marinho do fundo do logo (`#050B16`/`#08111F`/`#0E1B30`…). Trocado na origem (`tailwind.config.ts`, `index.css`) e nos valores fixos de 11 componentes/páginas (hex e `rgba()`), com um mapeamento único — nenhuma cor dourada ou roxo-escura fixa restante. O roxo de acento (`nex.purple`, AI HUB) foi mantido.
- **Cabeçalho da barra lateral:** "ZEUS" em branco + "IDE" em azul, como no logo; subtítulo "Intelligence" → "Intelligent Development Environment".
- Nomes de classes/variáveis (`brand-*`, `--nex-gold`, `glow-gold`) mantidos para não mexer em todos os componentes — agora resolvem para o azul.

## [3.64.0] — 2026-10-18

### Alterado — app renomeado para **Zeus IDE**

Todo texto visível passa de "NEX-ALS IDE" para **Zeus IDE**: barra lateral, título das janelas (`Zeus IDE — <VPS>`), tela de login, `<title>`, diálogos (abrir pasta, exportar/importar configurações, debug), "Zeus AI HUB" e o Manual de Uso. `productName` e `shortcutName` → `Zeus IDE`: o app instala em `%LOCALAPPDATA%\Programs\Zeus IDE\Zeus IDE.exe`, e o instalador passa a ser `Zeus IDE Setup <versão>.exe`.

**Mantidos de propósito:** `appId` `com.nexals.ide` (identidade do instalador — o Zeus IDE atualiza a instalação antiga em vez de virar um segundo app), a pasta de dados `%APPDATA%\@cwm\desktop` (vem do nome interno do pacote, não do nome exibido — banco e configurações intactos), o repositório `NEX-ALS-IDE` no GitHub e "NEX-ALS" como empresa no copyright.

**Corrigido no Manual:** o caminho do banco aparecia como `%APPDATA%\NEX-ALS IDE\cwm.db`; o real é `%APPDATA%\@cwm\desktop\cwm.db`.

**`scripts/install-local.js`:** lê o `productName` do `package.json` e fecha tanto o `Zeus IDE.exe` quanto o `NEX-ALS IDE.exe` antigo antes de instalar.

## [3.63.0] — 2026-10-18

### Alterado — logo Zeus IDE + ícone próprio do app (antes: ícone padrão do Electron)

Primeiro passo do rebranding NEX-ALS IDE → **Zeus IDE** (logo fornecido pelo usuário). O nome do app ainda não mudou.
- **Barra lateral:** `logo-nexals.png` → `logo-zeus.png` (símbolo Z recortado do logo; o texto "ZEUS IDE" ficaria ilegível em 36 px). Logo completo guardado em `apps/web/public/logo-zeus-full.png`.
- **Ícone do app:** não existia `apps/desktop/build/icon.ico`, então o electron-builder usava o ícone padrão do Electron (barra de tarefas, atalho, instalador). Agora tem `icon.ico` (16–256 px) e `icon.png`, configurados em `win.icon` e nos ícones do instalador/desinstalador do NSIS.
- **Janelas:** `BrowserWindow` recebe `icon` (`resources/icon.png` instalado, `build/icon.png` em dev) e `app.setAppUserModelId('com.nexals.ide')` agrupa as janelas sob o ícone do atalho.
- **`.gitignore`:** `apps/desktop/build/` deixa de ser ignorada (era pega por `build/`) — o ícone e o `LICENSE.txt` exigido pelo instalador agora vão para o repositório.

## [3.62.0] — 2026-10-18

### Adicionado — Hermes: AutonomyPolicy com 3 níveis + Regras de desenvolvimento por projeto (ETAPAS 21/22/23)

**3 níveis de autonomia** (substituem o toggle Manual/Autônomo) — `apps/web/src/lib/autonomy-policy.ts`:
- **Assistido** (`manual`, valor antigo mantido): você libera cada tarefa com "Próxima".
- **Semi-autônomo** (`semi`, novo): o loop avança sozinho, mas **para antes de tarefa de risco alto** e mostra o cartão "Tarefa de risco alto" → **Liberar e continuar**. Tarefa de risco alto também fecha o lote paralelo.
- **Autônomo**: avança por todas.
- Nos 3 níveis os comandos perigosos continuam passando por Autorizar/Negar — a política só decide quando o loop avança sem o usuário.

**Risco por tarefa:** o prompt do plano pede `"risk":"low|medium|high"` (alto = deploy/produção, migração/remoção de dados, secrets, pagamentos, infra do servidor). Como rede de segurança, `classifyTaskRisk()` também detecta por palavras-chave no título/descrição e fica com o **maior** entre o declarado e o detectado — um modelo barato subestimando o risco não passa batido. Nova coluna `agent_tasks.risk` (`ALTER TABLE` incremental, padrão `low`); selo "risco médio"/"risco alto" na lista de tarefas. É separado de `priority`, que ordena a fila — usar `priority` mudaria a ordem do plano.

**Regras de desenvolvimento (ETAPA 21):** seção recolhível no painel Agent, com texto por projeto (até 20.000 caracteres) e botão **Usar modelo** (7 regras padrão). Salvar grava em `hermes_project_agents.devRules` e regrava o `.hermes.md` na hora; as regras vão no início do arquivo, antes da KB Global e da memória do projeto. Apagar as regras regrava o arquivo sem elas (não fica a versão antiga).

**Backend:** `HermesService.setDevRules()`; `syncProjectContext()` inclui as regras; novo IPC `hermes:agent:setDevRules` (admin). `hermes:agent:setAutonomy` e `setDevRules` validam com Zod no main (`HermesAutonomyLevelSchema`, `HermesDevRulesSchema` em `@cwm/config`) — antes o nível chegava sem validação.

**Verificado:** `pnpm typecheck` (5 pacotes) e `pnpm build` limpos; 4 testes novos em `@cwm/config` (17/17); verificação da política de risco/gate (níveis, nível desconhecido → Assistido, 13 casos de classificação, gate por nível). **Não testado pela UI contra a VPS.**

## [3.61.0] — 2026-10-18

### Adicionado — página do projeto: clicar num projeto abre tudo dele já na pasta certa

Pedido do usuário: ao clicar num projeto em **Projetos**, ir direto para o projeto. Escolhido "escolher na hora": o card agora é clicável e abre `/projects/:projectId` (`ProjectHubPage.tsx`), com:
- **Atalhos:** **Agent** (AI HUB já na aba Agent com o projeto selecionado), **IDE** e **Explorer** (abrem na pasta do projeto — antes sempre em `/root`), **Terminal** (SSH já com `cd` na pasta) e **Abrir no VS Code** (Remote SSH, o mesmo do Lançador).
- **Resumo:** status do Hermes e do agente, progresso das tarefas (barra + tarefa em andamento), branch, alterações sem commit e os últimos 5 commits.
- Editar/excluir no card continuam funcionando (não abrem a página).

**Suporte nas telas de destino:** `IDEPage` aceita `?path=` como raiz da árvore (os 12 usos de `'/root'` passaram a `remoteRoot`); `FileExplorerPage` aceita `?path=`; `TerminalPage` aceita `?cwd=` (envia `cd '<cwd>' && clear` ao conectar); `AIHubPage` aceita `?mode=agent&project=<id>` e repassa `initialProjectId` ao `HermesAgentPanel`.

**Segurança:** todo caminho vindo da URL passa por `safeRemotePath()` (`apps/web/src/lib/remote-path.ts`) — só absoluto, sem `..`, aspas, `$()`, crases ou quebra de linha (testado com essas injeções; todas recusadas, caem no padrão `/root`).

## [3.60.1] — 2026-10-18

### Corrigido — loop autônomo continuava "invisível" depois de Voltar, sem botão Parar

**Sintoma reportado:** "não tem botão parar" — o loop seguia entregando tarefas (03 commitada, 04 em andamento), mas o painel mostrava só "Continuar loop" travado.

**Causa:** `runLoop` é uma função async que continua viva depois que o painel desmonta; `looping` e `loopStopRef` eram do componente, então o painel reaberto não sabia do loop e não tinha como sinalizar parada.

**Fix — `HermesAgentPanel.tsx`:** registro de loops ativos em nível de módulo (`activeLoops: Map<projectId, { stop }>` + listeners de re-render). Qualquer instância do painel mostra **Parar** ("Parando após a tarefa atual…" depois do clique), o loop checa `handle.stop` a cada iteração, e um segundo loop no mesmo projeto não pode começar. Os botões do painel ficam travados enquanto houver loop ativo do projeto.

O loop que já estava rodando era da versão anterior em memória — o único jeito de pará-lo foi fechar o app (instalação); a tarefa em andamento terminou na VPS (reconhecida como execução órfã, v3.59.7).

## [3.60.0] — 2026-10-18

### Melhorado — uma sessão do Hermes por tarefa do loop autônomo

**Problema (MUSA AI, VPS-1):** todas as tarefas rodavam na mesma sessão do projeto (`--resume latest`). Depois de 2 tarefas o histórico já passava de **160k tokens** e cada chamada ao modelo levava ~40s (`API call #40 in=159855 latency=38.0s` no log do Hermes) — com 26 tarefas, estouraria a janela de contexto.

**Fix:** cada tarefa roda numa sessão nomeada `nex-task-<id>` via `hermes chat -c <nome> --create-if-missing --in <workspace>` (`HermesClient.streamObjective` → `sessionName`; `hermes:agent:send` aceita `sessionName`, validado `^[A-Za-z0-9_-]{1,80}$` no main e no core). O lembrete de tag, a resposta a uma Decision Request e o follow-up de Autorizar/Negar continuam **na sessão da própria tarefa**; o plano inicial e a mensagem livre seguem na sessão do projeto. O contexto entre tarefas vem do repositório (código + commits por tarefa, v3.59.4) e do `.hermes.md`.

**Verificado na VPS-1:** sessão nomeada continua a mesma conversa (lembrou a palavra-código); outro nome abre sessão limpa (não lembrou). Linha de comando capturada do código compilado: tarefa → `-c "nex-task-…" --create-if-missing`; livre → `--resume latest`; nome inválido (`a"; rm -rf /`) → descartado, cai no padrão.

## [3.59.7] — 2026-10-17

### Corrigido — execução do Hermes "órfã" segurava a sessão; Cancelar não parava o Hermes na VPS

**Sintoma reportado:** "Erro" no painel Agent com `hermes-refusal-reason: SESSION_NOT_OWNED · This chat is open in another Hermes window/terminal … session opened by cli 16m ago`. A API (Nous) estava ok — respondeu em 3s; houve só um 429 *fair-share rate limit* temporário do modelo gratuito, com retry automático.

**Causa:** uma execução enviada às 02:10 UTC (resposta a uma aprovação) seguiu rodando na VPS depois que o NEX foi fechado e reaberto — sem pty, fechar o canal SSH não manda SIGHUP; o processo ficou sob o systemd (PPID 1) segurando a sessão. O app novo não sabia dela (a trava da 3.59.5 é em memória) e mandou outra execução, recusada pelo Hermes. O mesmo mecanismo fazia o botão **Cancelar** só cortar o SSH, sem parar o Hermes.

**Fix:**
- `HermesClient.findRunsInWorkspace()` acha execuções do Hermes **na VPS** pelo diretório atual do processo (`/proc/<pid>/cwd` = pasta do projeto; `pgrep -f "[q]uery-file"`), inclusive órfãs; worktrees paralelos não são atingidos. `killRunsInWorkspace()` encerra a árvore inteira (inclui `claude -p`).
- `hermes:agent:send` recusa com mensagem clara se houver execução rodando na VPS no projeto.
- `hermes:agent:cancel` encerra de fato a execução na VPS.
- `hermes:agent:active` informa `orphanRunning`; o painel mostra um aviso, trava os botões, confere a cada 20s e libera sozinho quando ela termina — ou o usuário clica **Encerrar execução na VPS** (novo IPC `hermes:agent:stopRemote`).
- Verificado na VPS-1: detecção acha exatamente `bash`+`hermes` da execução órfã real; encerramento testado num processo isolado (pai + filho encerrados, execução real intacta).

### Ferramentas — `pnpm install:local` / `pnpm release:local`

Novo `scripts/install-local.js`: fecha o NEX-ALS IDE aberto, roda o instalador da versão atual em modo silencioso (`/S`, NSIS por usuário, sem UAC), confere a versão instalada e reabre o app. `release:local` = `package:win` + `install:local`. Reabre **sem `ELECTRON_RUN_AS_NODE`** — terminais dentro do VS Code herdam essa variável e, com ela, o executável do Electron roda como Node puro e fecha na hora (`bad option: …`), o mesmo motivo de `scripts/dev.js` já apagá-la. Atenção: fechar o app interrompe o loop autônomo do painel Agent.

## [3.59.6] — 2026-10-17

### Corrigido — loop autônomo rodava tarefas paralelas fora de ordem e sobre a base errada

**Observado no MUSA AI (VPS-1):** com as Tarefas 01–04 por concluir, o loop disparou 05, 06, 07 e 21 em paralelo. Os worktrees nasceram do último commit (`1075b86`, teste `hello.py`) — o trabalho das Tarefas 01/02 (fundação do monorepo) não estava commitado, então as 4 execuções trabalhavam sem a base que pressupõem e gastavam cota do Claude Code num trabalho que daria conflito no merge. As 4 foram encerradas na VPS (worktrees preservados) e as tarefas devolvidas a Pendente.

**Causa 1 — ordem:** `runLoop` pegava **todas** as tarefas `parallelizable` da fila inteira, à frente das sequenciais anteriores. Agora só agrupa paralelizáveis **consecutivas no início da fila**, na ordem do plano; a primeira não paralelizável é sempre feita antes.

**Causa 2 — base:** `git worktree add` parte do HEAD. Agora o loop checa `git status` da pasta principal antes do lote: com qualquer alteração não commitada, roda em sequência (que vê o diretório real) em vez de criar worktrees.

**Causa 3 — tarefa "Em andamento" fantasma:** quando a execução da tarefa não acontece (ex.: barrada pela trava de sessão da 3.59.5 — que funcionou e impediu uma segunda execução simultânea), a tarefa volta para Pendente em vez de ficar "Em andamento" sem nada rodando.

## [3.59.5] — 2026-10-17

### Corrigido — painel Agent "esquecia" a execução em andamento e disparava uma segunda na mesma sessão

**Sintoma reportado:** status "Erro" no painel Agent (projeto MUSA AI), com `hermes encerrou sem resultado (código 0)`; Tarefas 01, 02 e 03 presas em "Em andamento".

**O que aconteceu (logs do Hermes na VPS-1):** (1) na Tarefa 01 o Hermes bloqueou `python -e …` (dangerous) → o painel pausou a tarefa aguardando Autorizar/Negar; (2) "Próxima" iniciou a Tarefa 02; (3) o usuário usou Voltar e reabriu o painel — o estado (`sending`/`looping`/aprovações) é do componente React e foi zerado, então "Próxima" ficou liberado no meio da execução; (4) a Tarefa 03 foi enviada na mesma sessão e o Hermes recusou: `Refused active session 20261018_012126_a4e8f8: already held by pid=1652854`. Sem evento `result`, o NEX só dizia "sem resultado". Os cartões Autorizar/Negar da Tarefa 01 também sumiram ao reabrir.

**Fix:**
- **Trava por projeto no main (`hermes:agent:send`):** `hermesActiveByProject` rejeita uma segunda execução da sessão do projeto enquanto houver uma em andamento — o main sobrevive à navegação, o componente não.
- **Reconexão (`hermes:agent:active`):** ao abrir o painel/trocar de projeto, ele retoma a execução em andamento (saída ao vivo a partir dali, botão Cancelar, botões travados) e os cartões de aprovação pendentes.
- **Motivo real do erro:** `HermesEventStream.strayOutput` guarda as últimas linhas não-JSON; quando o Hermes aborta sem `result`, a mensagem de erro (painel e cron) inclui o motivo dele.

## [3.59.4] — 2026-10-17

### Melhorado — loop autônomo do Hermes commita ao fim de cada tarefa

Primeiro projeto real pela UI (MUSA AI, VPS-1): após a Tarefa 01 concluída, 22 arquivos e 58 testes passando, mas **nenhum commit** — todo o trabalho fora do histórico git. O prompt de tarefa sequencial (`buildTaskPrompt` em `HermesAgentPanel.tsx`) não pedia commit; só o de tarefa paralela pedia.

Agora toda tarefa (sequencial e paralela) instrui: antes de `[TAREFA_CONCLUIDA]`, `git add -A && git commit -m "<tipo>(<escopo>): <descrição>"` (Conventional Commits, ETAPA 25 do brief), `git init` se ainda não houver repositório, e nunca push/reset --hard/force — só commits locais. O prompt paralelo passou a reaproveitar a instrução comum (antes duplicava).

## [3.59.3] — 2026-10-17

### Corrigido — "Iniciar" do Hermes falhava com gateway já rodando; versão e conta Claude erradas; cards do Lançador

**1. "hermes gateway encerrou logo após iniciar: The host gateway already serves profile 'default'" — `hermes-client.ts`:** o `hermes setup` instala o gateway como serviço systemd (`hermes-gateway.service`, enabled), e o Hermes só aceita um gateway por host. O NEX tentava subir um segundo via `nohup`. Agora:
- `findGatewayPid()` acha o gateway vivo venha de onde vier (PID do NEX, serviço systemd ou manual) via `pgrep -f "hermes.*[g]ateway( run)?$|[g]ateway run$"` — o `[g]` evita casar com a própria linha do bash.
- **Iniciar:** adota o gateway existente → senão `hermes gateway start` (serviço) → senão o `nohup` antigo.
- **Parar:** `hermes gateway stop` antes do kill (senão o systemd religa); o `pkill -f "hermes gateway"` antigo nem casava com o processo real (`… gateway run`).
- **Status** (`getStatus`) também reconhece gateway iniciado fora do NEX.
- Verificado na VPS-1: detecção → PID do serviço; Parar → nenhum processo; Iniciar → serviço `active`, PID novo vivo.

**2. Versão "Up to date":** o Hermes v0.22 imprime várias linhas em `--version` e o NEX pegava a última. Agora extrai `vX.Y.Z` da linha "Hermes Agent v…".

**3. Lançador mostrava "Logado (support@anthropic.com)" — `vps.service.ts` (`checkClaudeCode`):** o e-mail vinha de `grep -r "email" ~/.claude/` — o primeiro e-mail de qualquer arquivo (era o manifesto do marketplace de plugins). Agora usa `claude auth status` (JSON: `loggedIn` + `email`); fallback para CLI antigo lê só `oauthAccount.emailAddress` de `~/.claude.json`. Comando capturado do código compilado e executado nas VPS: VPS-1 → fasterdrible@gmail.com, VPS-2 → phpos40@gmail.com.

**4. Cards de VPS do Lançador com botões por cima do texto — `Launcher.tsx`:** 7 botões `shrink-0` na mesma linha das informações estouravam o card de meia largura. Botões agora numa linha própria, com `flex-wrap`.

## [3.59.2] — 2026-10-17

### Corrigido — tela Hermes: "Could not convert value … of the field `lastSeen` to type `DateTime`"

**Sintoma reportado:** ao abrir Lançador → Hermes (VPS-1), status "Desconhecido" e `Invalid this.db.hermesInstance.findUnique() … Inconsistent column data: Could not convert value "1786651509353" of the field lastSeen to type DateTime`.

**Causa raiz (desde a FASE 1, v3.52.0):** `hermes_instances` e `hermes_project_agents` são criadas por DDL raw em `handlers.ts` com as colunas de data como `TEXT`. O Prisma grava `DateTime` no SQLite como inteiro (ms); numa coluna de afinidade TEXT o SQLite converte para o texto `'1786651509353'`, que o Prisma não consegue ler de volta. A primeira escrita funcionava; toda leitura posterior falhava. Nunca tinha aparecido porque a tela nunca foi usada contra uma VPS real com o banco já populado. As demais tabelas usam `DATETIME` (afinidade NUMERIC) e guardam inteiro.

**Fix — `apps/desktop/src/ipc/handlers.ts`:**
- DDL das duas tabelas com `DATETIME … DEFAULT CURRENT_TIMESTAMP`, igual ao resto do schema.
- `migrateHermesDateColumns()`: em instalações existentes, se alguma coluna de data ainda for `TEXT` (via `PRAGMA table_info`), reconstrói a tabela numa transação (rename → create → `INSERT … SELECT` convertendo texto numérico para inteiro e `datetime('now')` para ms → drop), preservando os dados.
- Criação, `ALTER`s incrementais, migração e o recovery de sessões do boot agora rodam **em sequência** (antes eram `void` paralelos sem ordem garantida — o recovery podia ler a tabela no meio da migração).

**Verificado numa cópia do banco real do usuário, com o Prisma:** antes → exatamente o erro reportado; depois → leitura ok com as datas originais preservadas (13/08), escrita/leitura nova ok, `typeof(lastSeen)` = `integer`.

## [3.59.1] — 2026-10-17

### Corrigido — app instalado mostrava 0 VPS / 0 projetos (abria o banco errado)

**Sintoma reportado:** após instalar a 3.59.0, Dashboard com "0 VPS cadastradas". Dados do usuário intactos em `%APPDATA%\@cwm\desktop\cwm.db` (3 VPS) — o app simplesmente não abria esse arquivo.

**Causa raiz (introduzida na 3.58.0):** `hermes.service.ts` passou a importar `toolExecutor` (auditoria do comando aprovado). Esse módulo instancia `new ToolExecutor()` no import, e a classe criava o PrismaClient num **campo** (`private db = getPrismaClient()`). Como `main.ts` importa `@cwm/core` antes de `setDatabasePath()`, o PrismaClient nascia sem `DATABASE_URL` e o Prisma caía no `.env` de desenvolvimento empacotado em `@cwm/db` → `resources/app/node_modules/@cwm/db/prisma/cwm-dev.db` (vazio). Nada era escrito no banco real.

**Fix — `packages/core/src/ai/hub/tool-executor.ts`:** `db` virou getter (`private get db() { return getPrismaClient() }`), o mesmo padrão dos demais serviços. Era a única instância criada em nível de módulo no core. **Verificado:** importar `@cwm/core` sem `DATABASE_URL` → PrismaClient não é criado na versão corrigida; o mesmo teste contra o core da 3.59.0 instalada → criado (reproduz o bug).

## [3.59.0] — 2026-10-17

### Adicionado — Hermes coordena, Claude Code implementa (usa a conta Claude do usuário)

Pedido do usuário: usar a conta Claude em vez do modelo gratuito do Hermes. Plugar a assinatura Pro como "cérebro" do Hermes não é permitido (credencial de assinatura em ferramenta de terceiros; e a regra do projeto proíbe o NEX de tocar em token Claude). Solução: o Hermes (modelo gratuito) só coordena e **delega a implementação ao Claude Code CLI** já instalado e logado na própria VPS — o código sai do Claude Code, com a assinatura do usuário, do jeito previsto pelo produto.

**`packages/core/src/hermes/hermes-client.ts` (`streamObjective`):** o round-trip SSH que já existia (`echo $HOME` + `mkdir`) agora também detecta `command -v claude`. Se existir: pré-carrega a skill nativa do Hermes `-s claude-code` e anexa ao objetivo uma instrução fixa (`CLAUDE_DELEGATION_NOTE`): coordenar e delegar via `claude -p … --allowedTools "Read,Edit,Write,Bash" --max-turns 30`, `timeout=600` (teto foreground do terminal do Hermes — acima disso vira background e não volta num one-shot), dividir trabalho grande, revisar `git diff` e rodar testes por conta própria, nunca `--dangerously-skip-permissions`, e fazer sozinho se o Claude Code falhar por autenticação/limite. Sem `claude` na VPS, nada muda.

**Watchdogs:** inatividade 300s → 900s (`wireHermesStream` e `runObjectiveUnattended`) — um `claude -p` pode trabalhar vários minutos sem o Hermes emitir evento. Teto da execução não-assistida 20 → 45min.

**Governança no lado do Claude Code (VPS-1, operacional):** `/etc/claude-code/managed-settings.json` (precedência máxima — nem o Hermes nem flags sobrescrevem) com 44 regras `deny` (rm -rf/-r, find -delete/-exec rm, xargs rm, git reset --hard/push --force/clean -f, docker rm/prune/volume rm/compose down -v, dropdb, mkfs, dd, shutdown/reboot, systemctl stop, iptables/ufw/nft, chmod -R 777, kill -9/pkill…) e `disableBypassPermissionsMode: "disable"`. Verificado: `rm -rf` negado com `--allowedTools Bash` **e** com `--dangerously-skip-permissions`; `cd x && rm -rf y` negado (o Claude Code analisa cada parte); `find -delete` passava → adicionado à lista e retestado; comandos seguros funcionam.

**Teste ponta a ponta (VPS-1):** objetivo "hello.py + teste unittest + commit", enviado exatamente como o NEX monta → Hermes conferiu o `claude`, delegou com `claude -p`, revisou `git log/diff`, rodou os testes ele mesmo (3 passaram) e entregou o commit. 108s.

`pnpm typecheck` limpo.

## [3.58.0] — 2026-10-17

### Adicionado — Hermes FASE A: governança (Autorizar/Negar) + activity feed estruturado

Implementa as ETAPAS 7, 14 e 30 do brief de Autonomous Development sobre o comportamento **real** do Hermes v0.22 verificado na VPS-1: em headless ele bloqueia sozinho comandos perigosos, e `--format stream-json` emite eventos JSONL.

**Novo — `packages/core/src/hermes/hermes-events.ts` (`HermesEventStream`):** embrulha o `ExecStream` do `hermes chat --format stream-json`, parseia JSONL linha a linha (bufferizando linhas partidas entre chunks SSH) e expõe `'data'` só com o texto (contrato antigo preservado — loop por tags, cron e execução paralela não mudaram) + `'event'` com `init`/`tool_use`/`tool_result`/`blocked`/`result`. Validado com JSONL real capturado da VPS, cortado em pedaços de 37 bytes.

**Governança — comando bloqueado vira decisão do usuário:** `wireHermesStream` (`handlers.ts`) registra cada bloqueio `terminal` num Map do main e envia `approval_request` ao renderer. Novo IPC `hermes:approval:resolve` (admin) recebe **só o id** — o comando nunca vem da UI. Autorizar → `HermesService.runApprovedCommand` executa no workspace do projeto (validado contra `remotePath`/worktrees) e registra em `tool_execution_log` como `exec_dangerous` confirmado; o painel então avisa o Hermes do desfecho na mesma sessão (reenviando a tarefa e lendo a tag, como no Decision Request). Negar → o Hermes é instruído a não contornar. `execute_code` bloqueado só pode ser negado. O NEX nunca usa `--yolo` nem `approvals.single_query_mode: approve`.

**UI — `HermesAgentPanel.tsx`:** cartão vermelho "Hermes deseja executar" (comando exato + motivo + Autorizar/Negar); faixa "Atividade" com cada ferramenta usada e falhas em âmbar; loop autônomo pausa enquanto houver aprovação pendente.

**Corrigido — sucesso/erro decidido pelo `result` do Hermes:** antes era `code === 0 || hasData`, mas o comando SSH termina em `; rm -f <arquivo>`, então o exit code era sempre 0 — erros como "créditos esgotados" viravam uma resposta vazia "concluída". Agora o erro real do Hermes aparece no painel e no cron.

**Operacional (VPS-1):** `hermes setup` havia gravado `model.base_url` do OpenRouter com `provider: auto`, deixando o Hermes "sem provider" mesmo logado no Nous → `hermes config set model.provider nous`. Credencial Nous também ficou em pausa após uma tentativa de modelo pago → `hermes auth reset nous`. Ambos documentados no troubleshooting.

`pnpm typecheck` limpo (5 pacotes).

## [3.57.6] — 2026-10-17

### Corrigido — 3 bugs que impediam o Agent Mode do Hermes de funcionar numa VPS real

Primeiro teste de ponta a ponta contra VPS real (VPS-1, Hermes Agent **v0.22.2**). Nenhum dos bugs aparecia em `typecheck`/`build` — só rodando de verdade.

**1. Agent Mode quebrava a partir da 2ª mensagem — `packages/core/src/hermes/hermes-client.ts` (`streamObjective`):** o comando era `hermes -Q chat -q --resume latest --in "<ws>" "$(cat arquivo)"`. Com `resume`, o argparse do Hermes consumia `--resume` como valor de `-q` e abortava com `error: argument -q/--query: expected one argument`. Agora usa `hermes chat -Q --query-file "<arquivo>" [--resume latest --in "<ws>"] </dev/null` — `--query-file` (v0.22+) lê o objetivo direto do arquivo sem passar por shell, eliminando também o `"$(cat …)"`. Verificado na VPS com texto contendo aspas, `$(...)` e crases.

**2. Hermes instalado como root não era detectado — `PATH_PREFIX`:** o installer antigo (v0.20) instalava em `/usr/local/lib/hermes-agent/` sem symlink no PATH. Adicionado `/usr/local/lib/hermes-agent/venv/bin` (o comando real). A raiz do repo **não** entra no PATH de propósito: o `hermes` dali é um launcher que quebra (`ModuleNotFoundError`) quando o venv está incompleto — instalação incompleta deve continuar aparecendo como "não instalado". O installer atual (v0.22) usa `~/.local/bin`, já coberto.

**3. "Iniciar" reportava `running` mesmo com o processo morto — `startGateway`:** `$!` existe mesmo quando o `nohup` falha na hora (ex.: `nohup: failed to run command 'hermes'`, encontrado no log real da VPS-1). Agora espera 2s, confirma com `kill -0` e, se o processo morreu, lança erro com as últimas linhas do `gateway.log`.

**Operacional (fora do código):** VPS-2 sem espaço (80%) → limpeza segura (build cache, imagens órfãs, journal, caches npm/apt, instalação quebrada do Hermes): 15 GB → 38 GB livres, 20/20 containers ativos. Hermes v0.22.2 instalado na VPS-1, login Nous Portal, modelo padrão `poolside/laguna-s-2.1:free`.

**Descoberta para a próxima fase:** em modo headless o Hermes **bloqueia sozinho** comandos perigosos (`BLOCKED: Command flagged as dangerous … single-query mode (-q) runs without a user present`), inclusive tentativas de contorno via `execute_code`. E `--format stream-json` emite eventos JSONL (`system/init`, `text`, `tool_use`, `tool_result`, `result`). Base para o fluxo Autorizar/Negar e o activity feed estruturado — ver `docs/HERMES_INTEGRATION.md`.

## [3.57.5] — 2026-10-17

### Corrigido — VPS que aceita só chave SSH falhava com "Autenticação falhou"

**Sintoma reportado:** VPS-1 (`root@204.168.180.25`) mostrava "Autenticação falhou — verifique usuário/chave/senha SSH" no botão Testar, enquanto `ssh root@204.168.180.25` pelo terminal do Windows conectava normalmente.

**Causa raiz:** a VPS tem `PasswordAuthentication no` (só aceita `publickey`). Os 5 serviços SSH (`VpsService`, `TerminalService`, `SftpService`, `GitService`, `TunnelService`) usavam **ou** a chave **ou** a senha: com `settings.sshKeyPath` vazio, tentavam o default `~/.ssh/id_rsa` (inexistente nesta máquina) e caíam para a senha cadastrada — recusada pelo servidor. Configurar uma chave global também não resolvia, porque aí a senha virava só passphrase e VPS que aceitam apenas senha passariam a falhar. O OpenSSH do terminal funcionava porque lê `~/.ssh/config` (que define `IdentityFile` por host); o ssh2 não lê.

**Fix — `packages/core/src/ssh/ssh-connect.ts`:** novo helper `applySshAuth(config, sshKeyPath, password)` que monta um `authHandler` do ssh2 tentando em ordem: chave de Configurações (se definida) → chaves padrão de `~/.ssh` (`id_ed25519`, `id_ecdsa`, `id_rsa`) → senha da VPS. A senha continua sendo passada como passphrase das chaves; chaves que não decifram são puladas. Sem chave nem senha, mantém o fallback para SSH agent. Os 6 pontos de conexão dos 5 serviços passam a usar o helper (removida a lógica duplicada).

**Operacional:** chave `id_ed25519` adicionada ao `authorized_keys` da VPS-1.

Testado com ssh2 real contra as 3 VPS (só-chave, chave+senha, só-senha) e no app instalado. `tsc --noEmit` do `@cwm/core` limpo.

## [3.57.4] — 2026-08-13

### Corrigido — watchdog de 90s curto demais para tarefas reais do Squad + dois timeouts sobrepostos

Usuário reautenticou a conta Claude Code (resolveu o caso anterior de sessão expirada), mas um deploy real via DevOps ainda bateu timeout — e a mensagem ainda era a genérica antiga (`⏱ Timeout: claude CLI não respondeu em 90s... Tente novamente`), sem o hint de stderr adicionado em 3.57.3.

**Causa 1 — dois watchdogs de 90s competindo:** além do watchdog do main process (`handlers.ts`), o `SquadPage.tsx` tem um watchdog **no renderer** que também cancelava o stream em 90s de inatividade. Como os dois timers rodam em processos diferentes sem garantia de ordem, o watchdog do renderer podia disparar primeiro e mostrar sua mensagem genérica — mascarando a mensagem melhorada do backend (com stderr) da 3.57.3.

**Causa 2 — 90s é curto para o caso real:** `claude -p` é spawnado do zero a cada chamada do Squad, com todo o contexto (KB Global + memórias + tarefas + histórico da sessão) injetado no prompt — bem mais pesado que o `"oi"` de teste manual. 90s de inatividade antes do primeiro token é otimista para isso.

**Fix — `apps/desktop/src/ipc/handlers.ts`:** os 3 watchdogs (`ai:stream:start` claude-code, `squad:stream:start` claude-code, `squad:stream:start` rota API Key) sobem de `90_000` para `180_000` ms.

**Fix — `apps/web/src/pages/SquadPage.tsx`:** watchdog do renderer sobe de `90_000` para `200_000` ms — de propósito **acima** do watchdog do backend (180s), para que o erro mais informativo do main process sempre chegue primeiro; o watchdog do renderer vira só uma rede de segurança final caso o processo trave sem nem sequer emitir o evento de erro.

`pnpm typecheck` limpo. Instalador `NEX-ALS IDE Setup 3.57.4.exe` regenerado.

## [3.57.3] — 2026-08-13

### Melhorado — mensagem de timeout do claude CLI mostra stderr capturado

**Investigação:** usuário reportou timeout `⏱ Timeout: claude CLI não respondeu em 90s` no Tester (Squad). Confirmado via teste manual que `claude -p "oi"` também trava/demora rodado direto no terminal, fora do NEX — ou seja, **não é um bug do código do NEX**, e sim algo externo (limite de uso da conta Claude Code, rede, ou a própria CLI). Nenhuma mudança de comportamento foi feita no processo em si.

**O que mudou:** `apps/desktop/src/ipc/handlers.ts` — nos dois pontos que spawnam `claude -p` com watchdog de inatividade de 90s (`ai:stream:start` e `squad:stream:start`), o `stderrBuf` já era capturado mas descartado silenciosamente quando o timeout matava o processo. Agora a mensagem de erro inclui até 300 chars do stderr capturado (se houver), ou uma dica de diagnóstico (checar Configurações → Conta & Uso, ou testar `claude -p "oi"` direto no terminal) quando não há stderr — para o próximo timeout já vir com pista da causa em vez de só "tente novamente".

`pnpm typecheck` limpo.

## [3.57.2] — 2026-08-13

### Corrigido — Squad ignorava Claude Code marcado como Padrão

**Sintoma reportado:** com Claude Code (conta, sem API Key) marcado como "Padrão" em Configurações → Provedores de IA, o Squad respondia com erro de outro provider (ex.: `deepseek 402: Insufficient Balance`) em vez de usar Claude Code.

**Causa raiz:** `apps/desktop/src/ipc/handlers.ts` — o handler `squad:stream:start` resolve o provider padrão com `SELECT provider FROM ai_providers WHERE isDefault=1 AND enabled=1 AND apiKey!='' LIMIT 1`. O provider `claude-code` é salvo com `apiKey: ''` de propósito (é uma conta, não uma API key — `SettingsPage.tsx` → `setAsDefault()`), então o filtro `apiKey!=''` excluía Claude Code da consulta mesmo estando marcado como padrão. A query caía no fallback (`SELECT provider FROM ai_providers WHERE enabled=1 AND apiKey!='' LIMIT 1`), que silenciosamente escolhia qualquer outro provider com key configurada — no caso relatado, DeepSeek, sem saldo.

**Fix:** removido o filtro `apiKey!=''` da consulta principal, alinhando com o mesmo padrão já correto usado em `ai:stream:start` (AI Hub) e no helper `callAIOneShot` (Operador/Workspace/Aprendizado/Memórias do Squad) — nenhum dos dois tinha esse filtro. O fallback (usado só quando nenhum provider está marcado como padrão) manteve o filtro, já que nesse caso faz sentido exigir uma key configurada.

`pnpm typecheck` limpo. Instalador `NEX-ALS IDE Setup 3.57.2.exe` regenerado.

## [3.57.1] — 2026-08-13

### Corrigido — Manual de Uso desatualizado

`apps/web/src/pages/Help.tsx` ainda mostrava `v3.50.0` e não mencionava nenhuma feature adicionada desde então (Skills, Workspace Intelligence, Planning Mode, Automações, Busca global, e toda a integração Hermes das FASEs 1-6).

- Versão corrigida para `3.57.0` (cabeçalho + card "Sobre")
- Parágrafo de introdução passa a mencionar Hermes Agent, Skills, Workspace Intelligence e Planning Mode
- Cards de acesso rápido ganham **Hermes** (6 cards em vez de 5)
- Novo cartão "Produtividade & Automação" no mapa do app: Conhecimento, Skills, Tarefas, Busca, Automações, Planejar — nenhum desses tinha entrada visível no manual
- Nova seção de accordion **"Hermes Agent — desenvolvimento autônomo"**: como instalar/iniciar na VPS, ativar o modo Agent no AI Hub, Manual vs. Autônomo, execução paralela, Decision Request, Definition of Done, sincronizar contexto, automações via cron e recovery de sessão interrompida
- Linha "IA · Squad · Deploy · Incident" do mapa do app ganha o card **Hermes Agent** (5 cards em vez de 4)

`pnpm typecheck && pnpm build` limpos.

## [3.57.0] — 2026-08-13

### Adicionado — HERMES-06: Automação (FASE 6)

Sexta e última etapa planejada da integração Hermes: cron (objetivos agendados sem abrir o AI Hub), execução não-assistida (o objetivo roda até o fim sem uma janela do renderer consumindo o stream) e recovery de sessão interrompida (o NEX detecta e retoma sessões órfãs deixadas por um fechamento abrupto do app). Nenhuma peça nova de infraestrutura — as três reaproveitam mecanismos já existentes (`scheduled_jobs`/`JobExecutor` do Ponto 7, `streamObjective`/`ExecStream` da FASE 2, `sessionStarted`/`--resume` da FASE 2).

**Cron — `scheduled_jobs` ganha `projectId`:**
- `packages/db/src/index.ts` / `apps/desktop/src/ipc/handlers.ts`: coluna `projectId TEXT` (nullable) em `scheduled_jobs`, com `ALTER TABLE` incremental para instalações existentes — mesmo padrão de `parallelizable` em `agent_tasks` (FASE 4)
- `packages/core/src/jobs/jobs.service.ts`: `ScheduledJob`/`ScheduledJobInput` ganham `projectId`; `create()`/`update()` persistem a coluna
- Em vez de uma tabela de agendamento dedicada ao Hermes, uma automação existente agora pode ter `agentName: 'hermes'` + `projectId` — o mesmo formulário de "Nova automação" cobre Squad e Hermes

**Execução não-assistida — `HermesService.runObjectiveUnattended()`:**
- Reaproveita `streamObjective()` (mesma marcação de status/`--resume` da FASE 2), mas bufferiza a saída completa no próprio `HermesService` em vez de repassar por `hermes:agent:chunk` — não depende de nenhuma `BrowserWindow` viva
- Mesmo watchdog de inatividade de 300s do `wireHermesStream()` do handlers.ts, mais um teto duro (padrão 20min): sem UI para o usuário cancelar manualmente, uma execução de cron travada não pode rodar pra sempre

**`apps/desktop/src/jobs/job-executor.ts`:**
- `JobExecutor` passa a receber `HermesService` no construtor (`new JobExecutor(hermesSvc)` em `handlers.ts`, que agora cria `hermesSvc` antes do `jobExecutor`)
- `executeJob()` decide entre o fluxo existente (`AiService.chatAgent` com um agente do Squad) e o novo `executeHermesJob()` (`runObjectiveUnattended`) com base em `job.agentName === 'hermes'`; notificação desktop ao final igual ao fluxo original

**Recovery de sessão interrompida — `HermesService.recoverInterruptedSessions()`:**
- Chamada uma vez no boot (`setupIpcHandlers` em `handlers.ts`, logo após `hermesSvc` ser criado): qualquer `HermesProjectAgent` com `status === 'running'` naquele momento é necessariamente órfão — o processo Electron acabou de (re)iniciar, então nenhum `ExecStream` da execução anterior pode estar vivo (eram objetos em memória do processo antigo)
- Marca esses agentes como `status: 'error'` com uma mensagem reconhecível pela UI (`lastError.includes('interrompida')`); **não** toca em `sessionStarted` — por isso o próximo `streamObjective()` já usa `--resume latest` sozinho, sem lógica nova de resume
- Também devolve para `TODO` qualquer tarefa `agent_tasks` de dono `hermes` que ficou `IN_PROGRESS` no meio de um loop autônomo interrompido (FASE 3), para que "Continuar loop" a retome do zero em vez de ficar presa

**UI:**
- `apps/web/src/components/HermesAgentPanel.tsx`: banner âmbar quando `agentInfo.status === 'error' && lastError.includes('interrompida')`, com botão "Retomar sessão" (`resumeInterrupted()`) que reenvia pelo fluxo de mensagem livre existente — o resume funciona automaticamente porque `sessionStarted` nunca foi tocado pelo recovery
- `apps/web/src/pages/AutomationsPage.tsx`: `'hermes'` adicionado à lista de agentes do formulário (emoji 🪽); ao selecioná-lo, um seletor de projeto (`ipc.projects.list()`) aparece e passa a ser obrigatório para criar a automação; card do job mostra o nome do projeto quando `agentName === 'hermes'`

**Escopo consciente:** sem sistema de cron novo (reaproveita `scheduled_jobs`/`JobExecutor` do Ponto 7); sem parsing de causa-raiz da interrupção (crash vs. fechamento normal vs. `kill -9`) — todo `status: 'running'` sobrevivente ao boot é tratado como interrompido, o que é sempre verdade dado que `ExecStream` nunca sobrevive a um restart do processo; Decision Requests pendentes no momento da interrupção não são recuperados automaticamente (o usuário precisa reabrir o objetivo/tarefa manualmente após "Retomar sessão").

**Sem teste de ponta a ponta contra VPS real** — validado via `pnpm typecheck && pnpm build` limpos + revisão manual do fluxo (buffer de stream sem UI, migração de coluna, reordenação de construção de serviços em `handlers.ts`).

Com a FASE 6, as 6 fases da integração Hermes planejadas em `docs/HERMES_INTEGRATION.md` estão entregues.

## [3.56.0] — 2026-08-12

### Adicionado — HERMES-05: Memory + Skills (FASE 5)

Quinta etapa da integração Hermes: visibilidade (só leitura) das skills e sessões do Hermes, e um adapter de contexto NEX→Hermes. Diferente das fases 3/4, a pesquisa aqui confirmou uma base sólida: `hermes skills list` é um comando externo real, skills vivem em `~/.hermes/skills/*/SKILL.md` (markdown com frontmatter YAML documentado), `hermes sessions list/stats` são reais, e o Hermes **já injeta automaticamente** `.hermes.md`/`AGENTS.md`/`CLAUDE.md`/`.cursorrules` do diretório do projeto no system prompt — sem flag nenhuma.

**`packages/core/src/hermes/hermes-client.ts`:**
- `listSkillFiles(vpsId)` — concatena todos os `SKILL.md` instalados via `cat` (só leitura, nunca cria/edita/apaga — ETAPA 19 do brief)

**`packages/core/src/hermes/hermes.service.ts`:**
- Construtor agora injeta também `KnowledgeService` e `ProjectMemoryService` (padrão posicional das 4 fases anteriores)
- `getSkills(vpsId)` — parseia o frontmatter YAML de cada `SKILL.md` (regex sobre chaves flat `name`/`description`/`version`, sem dependência YAML nova)
- `getSessionsSummary(vpsId)` — concatena `hermes sessions stats` + `hermes sessions list` (texto bruto — formato de saída não confirmado pela doc)
- `syncProjectContext(projectId)` — **o adapter da ETAPA 18**: monta `KnowledgeService.buildContext()` (KB Global) + `ProjectMemoryService.buildBlock()` (memória do projeto) e escreve em `<remotePath>/.hermes.md` via SFTP. Não duplica nada — só disponibiliza o que o NEX já tem onde o Hermes já procura sozinho. Escolhido `.hermes.md` em vez de `AGENTS.md` para não arriscar sobrescrever um `AGENTS.md` que o usuário já mantenha para outras ferramentas.

**IPC novo:** `hermes:skills:list`, `hermes:sessions:summary` (ambos `requireAuth`, só leitura), `hermes:agent:syncContext` (`requireAdmin`)

**UI:**
- `HermesPage.tsx` — abas Console/Skills/Sessões no painel direito; Skills mostra cards (nome, versão, descrição, caminho); Sessões mostra saída bruta
- `HermesAgentPanel.tsx` — botão "Sincronizar contexto"; chamado automaticamente (best-effort) uma vez no início de cada novo objetivo autônomo, não a cada mensagem

**Escopo consciente:** promoção de skill de projeto→global não é orquestrada pelo NEX — o próprio Hermes já faz gerenciamento procedural de skills sozinho (ETAPA 20 já satisfeita pelo comportamento nativo do Hermes); as 3 categorias do brief (Global/Project/System Skills) não são forçadas — a UI mostra a categoria real (pasta) do Hermes.

**Sem teste de ponta a ponta contra VPS real** — validado via `pnpm typecheck && pnpm build` + revisão manual dos comandos gerados (todos read-only, exceto a escrita determinística do `.hermes.md`).

## [3.55.0] — 2026-08-12

### Adicionado — HERMES-04: Execução Paralela via Git Worktrees (FASE 4)

Quarta etapa da integração Hermes. Pesquisa confirmou que o Hermes **não expõe** um comando externo de "spawn subagente" — é uma capacidade interna e opaca da `AIAgent`. A flag `hermes -w`/`--worktree` existe ("isolated git worktree for parallel-agent workflows") mas está pouco documentada (sem local em disco, sem estratégia de merge, sem confirmação de segurança concorrente).

**Decisão de arquitetura:** em vez de depender da flag `-w` (opaca), o NEX gerencia os git worktrees ele mesmo via comandos git padrão (100% documentados, sob controle total do NEX) — `git worktree add`/`merge`/`worktree remove` reaproveitando o `GitService` já existente do Source Control do IDE — e só usa o Hermes para rodar a tarefa dentro do worktree já preparado.

**`packages/core/src/git/git.service.ts`:**
- `worktreeAdd(vpsId, cwd, worktreePath, branch)` — `mkdir -p` do diretório pai + `git worktree add -b`
- `worktreeRemove(vpsId, cwd, worktreePath)` — só chamado após merge bem-sucedido (nada a perder)
- `merge(vpsId, cwd, branch)` — `git merge --no-ff`; em conflito, nunca força — `git merge --abort` e preserva o branch para revisão manual

**`packages/core/src/hermes/hermes.service.ts`:**
- Construtor agora injeta também `GitService`
- `startParallelTask(projectId, taskId, objective)` — cria worktree isolado (`<remotePath>-worktrees/task-<id>`, branch `nex/task-<id>`) e roda `hermes chat -q` dentro dele, sem `--resume` (execução one-shot, não conversacional)
- `finishParallelTask(projectId, worktreePath, branch, merge)` — se solicitado, faz merge cauteloso e só remove o worktree em caso de sucesso

**`packages/db/src/index.ts` / `packages/core/src/tasks/tasks.service.ts`:**
- Coluna `parallelizable` em `agent_tasks` (o próprio Hermes decide, durante a geração do plano, quais tarefas são seguras para rodar em paralelo — default `false` se ausente/inválido)

**IPC novo:** `hermes:parallel:start`, `hermes:parallel:finish` — reaproveitam o canal `hermes:agent:chunk` (streaming) e `hermes:agent:cancel` (cancelamento), sem novos canais de evento

**Refactor:** lógica de wiring de stream (~50 linhas duplicadas entre `hermes:agent:send` e o novo `hermes:parallel:start`) extraída para `wireHermesStream()` em `handlers.ts`

**UI — `HermesAgentPanel.tsx`:**
- `runLoop()` agora separa tarefas `TODO` paralelizáveis das sequenciais; roda lotes de até 3 tarefas paralelas simultaneamente (cada uma em seu worktree) antes de continuar com as sequenciais
- Painel "Agentes ativos" — mostra tarefa + branch de cada execução paralela em andamento
- Badge "paralelo" nos itens de tarefa marcados como `parallelizable`
- `sendAndWait` refatorado em `waitForChunkStream(streamId)` + `sendAndWait(prompt)` — reaproveitado tanto pelo fluxo sequencial quanto pelo paralelo

**Escopo consciente:** Decision Requests não são resolvidos interativamente em execução paralela (sem sessão para retomar num worktree one-shot) — a tarefa fica `BLOCKED` com o branch preservado para revisão manual. Conflitos de merge nunca são forçados — o branch/worktree fica intacto e a tarefa é marcada `DONE` (o trabalho foi concluído) com uma nota anexada pedindo merge manual.

**Sem teste de ponta a ponta contra VPS real** — é a fase com maior incerteza prática até agora (múltiplos streams SSH concorrentes, git worktree em produção); validado via `pnpm typecheck && pnpm build` + revisão manual dos comandos git/SSH gerados.

## [3.54.0] — 2026-08-12

### Adicionado — HERMES-03: Autonomous Loop (FASE 3)

Terceira etapa da integração Hermes: quebra de objetivo em tarefas, loop autônomo de execução, Definition of Done (checklist) e Decision Requests. O motor de orquestração roda inteiramente no renderer, reaproveitando o primitivo `hermes:agent:send` da FASE 2 — sem novo backend de agent loop, no mesmo espírito do `autonomousLoop()`/`runAgentUntilDone()` já existentes no Squad (`SquadPage.tsx`).

**Decisão de escopo (autonomia):** os 3 níveis do brief original (Assistido/Semi-autônomo/Autônomo) foram simplificados para um toggle binário **Manual/Autônomo** nesta fase, por escolha explícita do usuário — refinamento em 3 tiers fica para quando houver mais sinal do que o Hermes expõe.

**Protocolo de tags** (mesma convenção de `[PRONTO]`/`[APROVADO]`/`[BLOQUEADO]` já usada pelo Squad): cada tarefa enviada inclui instrução para o Hermes finalizar com `[TAREFA_CONCLUIDA]`, `[TAREFA_BLOQUEADA: motivo]` ou `[DECISAO_NECESSARIA pergunta="..." opcoes="A|B|C"]`. Parsing tolerante — texto sem nenhuma tag gera 1 lembrete antes de marcar a tarefa como bloqueada.

**Geração de plano:** um prompt específico pede ao Hermes uma lista de tarefas em JSON (```` ```json ````); parsing com fallback para "tarefa única" se o JSON não vier bem formado — nunca quebra o fluxo.

**`packages/core/src/tasks/tasks.service.ts`:**
- `list()` ganha filtro opcional `projectId` (reaproveitando a tabela `agent_tasks` existente do Squad em vez de criar uma tabela nova; tarefas do Hermes usam `ownerAgent: 'hermes'`)

**`packages/core/src/hermes/`:**
- `hermes.service.ts`: `setObjective`, `setAutonomyLevel`, `getDodChecklist` (lazy-init com 7 itens padrão), `toggleDodItem`, `runDodAutoChecks` (2 checks determinísticos via SSH direto — `.env.example` existe, há commit no git — sem LLM, sem falso-positivo/negativo de build arbitrário)
- `HermesService` agora também guarda uma referência a `TerminalService` (além de `HermesClient`) para rodar os checks de DoD fora do CLI `hermes`

**`packages/db/prisma/schema.prisma`:**
- `HermesProjectAgent` ganha `objective`, `autonomyLevel` (`manual`/`autonomous`), `dodChecklist` (JSON); `handlers.ts` aplica `ALTER TABLE ADD COLUMN` para instalações que já tinham a tabela da FASE 2

**IPC novo:** `hermes:agent:setObjective`, `hermes:agent:setAutonomy`, `hermes:dod:get/toggle/runChecks` — mesmo padrão `wrapHandler` + `requireAuth`/`requireAdmin`

**UI — `HermesAgentPanel.tsx` (expansão da FASE 2):**
- Nova coluna esquerda: campo de objetivo autônomo + toggle Manual/Autônomo + botão "Iniciar desenvolvimento"; lista de tarefas com badges de status e contador "X/N concluídas"; card de Decision Request (opções + resposta livre); painel DoD colapsável com 2 itens auto-verificáveis
- Mensagem livre (FASE 2) preservada na coluna direita, agora desabilitada durante o loop autônomo para evitar duas streams simultâneas

**Definition of Done — decisão de escopo:** checklist informativo, não é gate automático do loop. Auto-detectar e rodar build/test de qualquer stack de forma confiável é fora de escopo (risco de falso-positivo/negativo); os outros 5 itens ficam manuais para o usuário revisar.

**Sem teste de ponta a ponta contra VPS real** — validado via `pnpm typecheck && pnpm build` + revisão manual do parsing de tags/JSON.

## [3.53.0] — 2026-08-10

### Adicionado — HERMES-02: Agent Mode (FASE 2)

Segunda etapa da integração com o Hermes Agent: envio de objetivo a um projeto, com resposta em streaming via SSH. O NEX ainda não interpreta nem quebra o objetivo em etapas — isso é escopo da FASE 3 ("Autonomous Loop"); aqui o objetivo é simplesmente entregue ao Hermes, que já é agentic por conta própria.

**Pesquisa que desbloqueou esta fase:** a documentação real do Hermes (`docs/reference/cli-commands`, `docs/user-guide/cli`) confirma um modo headless: `hermes -z "prompt"` (resposta final limpa) e `hermes chat -q "prompt"` (inclui saída de tools no transcript — melhor para activity feed); `-Q`/`--quiet` suprime banners; `--resume latest --in <dir>` retoma sessão por diretório de trabalho. Isso resolve o risco registrado ao final da FASE 1.

**`packages/core/src/terminal/terminal.service.ts`:**
- Nova classe `ExecStream` (EventEmitter: `data`/`close`/`error`) e método `TerminalService.execStream(vpsId, cmd)` — exec SSH one-shot com dados incrementais (em vez do buffer completo de `exec()`); erros de conexão pós-`resolve()` são repassados via evento `error` em vez de silenciosamente descartados

**`packages/core/src/hermes/`:**
- `HermesClient` agora recebe também `SftpService`; novo `streamObjective(vpsId, { workspace, objective, resume })` — escreve o objetivo num arquivo remoto via SFTP e o lê de volta com `"$(cat arquivo)"` no comando SSH (evita escapar aspas/quebras de linha do texto do usuário — mesma técnica do "Chat Claude" do IDE-21); comando final: `hermes -Q chat -q [--resume latest --in "<workspace>"] "$(cat …)"`
- `HermesService` novo: `getAgentStatus(projectId)` (resolve Project→VPS, upsert de `HermesInstance`/`HermesProjectAgent`, sem checagem SSH ao vivo), `streamObjective(projectId, objective)` (exige instância `running`, decide `--resume` por `sessionStarted`), `markAgentActivity(projectId, patch)`

**`packages/db/prisma/schema.prisma`:**
- Novo model `HermesProjectAgent` (`hermes_project_agents`): `projectId` (único), `hermesInstanceId`, `workspace`, `status` (idle/running/error), `sessionStarted`, `lastActivity`, `lastError`; relações com `Project` e `HermesInstance`
- `handlers.ts` cria a tabela via `CREATE TABLE IF NOT EXISTS` (mesmo padrão de `hermes_instances`) para instalações existentes

**IPC `hermes:agent:*` (mesmo padrão de streaming do bloco `claude-code`/`squad:stream:start`):**
- `hermes:agent:status` (auth), `hermes:agent:send` (admin, abre `ExecStream`, streaming via `hermes:agent:chunk`, watchdog de inatividade 300s), `hermes:agent:cancel` (admin)

**UI:**
- `apps/web/src/components/HermesAgentPanel.tsx` (novo) — seletor de projeto, badges de status (instância Hermes + sessão do agente), textarea de objetivo, painel de saída ao vivo, cancelar durante streaming
- `apps/web/src/pages/AIHubPage.tsx` — header persistente com toggle **Chat / Agent**; em modo Agent, todo o corpo (sidebar de conversas + chat) é substituído por `HermesAgentPanel`; fluxo de chat existente inalterado

**Limitações conhecidas desta fase:**
- Sem parsing estruturado de eventos (tool_started/tool_completed) — o adaptador ACP do Hermes daria isso, mas sua página de documentação retornou 404 no momento da pesquisa; o activity feed é texto corrido por enquanto
- NEX não persiste transcript de conversa — o Hermes já guarda isso em `~/.hermes/state.db` (FTS5) na própria VPS; NEX só guarda status/`sessionStarted`/última atividade
- Sem teste de ponta a ponta contra VPS real nesta sessão — validado via `pnpm typecheck && pnpm build` + revisão manual do comando SSH gerado

## [3.52.0] — 2026-08-10

### Adicionado — HERMES-01: Hermes Manager (FASE 1 — base do Autonomous Development)

Primeira etapa da integração com o **Hermes Agent** (Nous Research) como runtime agentic externo para o futuro modo "Autonomous Development". Esta fase entrega apenas o gerenciador de ciclo de vida do Hermes numa VPS — nenhum agent loop novo, nenhuma orquestração de tarefas. O Squad continua sendo o único agent loop do NEX nesta versão.

**Novo módulo `packages/core/src/hermes/`:**
- `hermes.types.ts` — `HermesStatus`, `HermesInstanceInfo`, `HermesInstallResult`, `HermesCommandResult`
- `hermes-client.ts` — comandos SSH brutos via `TerminalService.exec` (reuso, sem novo transporte); todo comando reexporta o PATH (`$HOME/.local/bin`, `$HOME/.hermes/bin`) porque `ssh2.exec` não roda shell de login — mesmo problema já resolvido para o Claude CLI em `vps.service.ts`
- `hermes-installer.ts` — roda `curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash` e confirma o binário no PATH pós-instalação
- `hermes.service.ts` — orquestrador: `getStatus`/`install`/`update`/`start`/`stop`/`restart`/`execCommand`/`getLogs`; persiste em `HermesInstance` (Prisma)
- "Iniciar/Parar/Reiniciar" gerenciam o processo `hermes gateway` em background via PID file (`~/.hermes-nex/gateway.pid`) — não há systemd garantido em toda VPS, e o Hermes não expõe HTTP API própria ainda

**`packages/db/prisma/schema.prisma`:**
- Novo model `HermesInstance` (`hermes_instances`): `vpsServerId` (único), `status`, `version`, `installPath`, `pid`, `lastSeen`, `lastError`; relação 1:1 com `VpsServer`
- `apps/desktop/src/ipc/handlers.ts` cria a tabela via `CREATE TABLE IF NOT EXISTS` (mesmo padrão de `squad_memories`) para instalações existentes sem `pnpm db:push`

**IPC `hermes:*` (8 handlers, mesmo padrão `wrapHandler` + `requireAuth`/`requireAdmin` de `vps:*`):**
- `hermes:status` (auth), `hermes:logs` (auth)
- `hermes:install`, `hermes:update`, `hermes:start`, `hermes:stop`, `hermes:restart`, `hermes:exec` (admin)
- Sem streaming SSE nesta fase — `install`/`update` retornam o log completo ao final (mesmo modelo de `git:*`/`diagnostics:run`)

**UI — `apps/web/src/pages/HermesPage.tsx`:**
- Nova rota fullscreen `/hermes/:vpsId/:vpsName`
- Card de status (versão, installPath, PID, última verificação), botões Instalar/Atualizar/Iniciar/Parar/Reiniciar/Ver logs, painel de saída e campo para executar subcomandos `hermes <args>` arbitrários
- Botão "Hermes" adicionado à linha de ações por VPS em `Launcher.tsx` (ao lado de IDE/Explorer/Terminal/Incident/Deploy)

**Correção incidental:** `callAIOneShot` em `handlers.ts` tinha um erro de tipo pré-existente (`effectiveProvider` com tipo literal estreito não comportava `'claude-code'`); anotado como `string` — mesmo padrão já usado em outro ponto do arquivo. Erro não relacionado ao Hermes, mas bloqueava `pnpm typecheck` limpo.

**Limitações conhecidas desta fase (documentadas em `docs/HERMES_INTEGRATION.md`):**
- Sem modo headless confirmado (`hermes -p "..."` tipo `claude -p`) — investigar na FASE 2 antes de implementar envio de objetivo/streaming
- `hermes gateway` é a aproximação usada para "serviço"; pode ser revisado quando existir o "Hermes Bridge" dedicado
- Instalação de ponta a ponta não foi testada contra uma VPS real nesta sessão (sem acesso a infraestrutura ao vivo neste ambiente) — verificado apenas `pnpm typecheck && pnpm build` e revisão manual dos comandos shell

## [3.51.0] — 2026-06-21

### Corrigido — SQUAD-04: Autonomia — push com contexto de tarefa

**Causa raiz identificada:** quando um agente delegado (ex: Friday) respondia com texto em vez de ACTION tags, o `autonomousLoop` e o `runAgentUntilDone` enviavam um push genérico `"EXECUTE AGORA"` sem incluir qual tarefa o agente deveria executar. O agente recebia o push sem saber o que fazer, repetia o comportamento textual e esgotava as iterações sem concluir nada.

**Fix em `apps/web/src/pages/SquadPage.tsx`:**

- **`agentTaskContextRef`** — novo `useRef<Map<AgentName, string>>` que persiste o objetivo de cada agente durante a sessão autônoma; limpo a cada nova mensagem do usuário via `agentTaskContextRef.current.clear()`
- **Preenchimento do map** — populado em 4 pontos:
  - `handleSend` → agente raiz recebe a mensagem original do usuário
  - Delegações estruturadas `[DELEGAÇÃO]` → cada `item.objective` gravado antes do `streamAgent`
  - Delegações por `@mention` → `extractTask()` gravado antes do `streamAgent`
  - `runPipeline` → contexto curto por fase (`"Implementar: ..."`, `"Revisar código para: ..."`, `"Escrever e executar testes para: ..."`, `"Criar commit e PR para: ..."`) gravado antes de cada `runAgentUntilDone`
- **`autonomousLoop` — push atualizado** — inclui `"Sua tarefa (lembre-se): ${taskCtx.slice(0, 400)}"` quando o agente não-root responde sem ACTION tags
- **`runAgentUntilDone` — pushMsg atualizado** — inclui `"Sua tarefa: ${taskCtx.slice(0, 350)}"` na linha imediatamente após `"⚠️ EXECUTE AGORA"`
- **TypeScript zero erros** — `pnpm --filter @cwm/web exec tsc --noEmit` passa sem erros após o fix

## [3.50.0] — 2026-06-16

### Adicionado — SQUAD-03: Expansão do SQUAD com 12 Agentes Especializados (ECC)

Baseado na análise do repositório [affaan-m/ECC](https://github.com/affaan-m/ECC) (Agent Harness Operating System), 12 novos agentes especializados foram adicionados ao SQUAD, cobrindo gaps de segurança, arquitetura, performance, diagnóstico SSH e qualidade de código.

**`packages/core/src/squad/agents.ts`:**

**Agentes de revisão e segurança:**
- `natasha` 🛡️ — Segurança / Vulnerabilidades: OWASP Top 10, secrets hardcoded, configuração Electron (nodeIntegration, sandbox, contextIsolation), IPC sem validação Zod. Emite [CRÍTICO]/[ALTO]/[MÉDIO]/[BAIXO]/[INFO], termina com [APROVADO] ou [BLOQUEADO]
- `reviewer` já existia; Natasha foca exclusivamente em segurança
- `riri` 🧠 — TypeScript Estrito: floating promises, async forEach, any sem justificativa, non-null assertions sem guard, module-level mutable state
- `hope` ⚛️ — React / Hooks: dependências de useEffect, cleanup de effects, dangerouslySetInnerHTML, prop drilling. Pair com Riri para audits .tsx completos
- `wanda` 🔮 — Cobertura de Testes em PRs: detecta funções modificadas sem teste atualizado, edge cases ausentes, assertions sem valor comportamental real

**Agentes de arquitetura e design:**
- `hank` 🏛️ — Arquitetura de Software: read-only, produz ADRs (Architecture Decision Records), detecta Big Ball of Mud, God Object, acoplamento entre camadas Electron
- `bruce` 🔬 — Análise de Tipos TypeScript: avalia encapsulamento, invariantes, estados impossíveis; detecta branded types ausentes, union types com estados impossíveis, as any sem justificativa
- `ghost` 👻 — Falhas Silenciosas: caça empty catch blocks, fallbacks perigosos (.catch(() => [])), I/O SSH/SFTP sem timeout, propagação quebrada de erros. Emite [FANTASMA] por ocorrência, termina com [LIMPO] ou [FANTASMAS: N]

**Agentes de performance e diagnóstico:**
- `rhodey` ⚡ — Performance & Otimização: React re-renders, bundle size, startup Electron, vazamentos de memória, conexões SSH/SFTP não reutilizadas. Métricas alvo: FCP <1.8s, LCP <2.5s, Bundle <200KB
- `sam` 🌐 — SSH / VPS / Diagnóstico de Rede: diagnóstico OSI-layer de SSH/SFTP/tunnel, read-only, checklist por camada (L1-L4, DNS, autenticação, port-forward)
- `scott` 🔧 — Erros de Build / Compilação TS: faz APENAS o build passar com mínima mudança de código; proibido refatorar, renomear ou mudar arquitetura

**Agentes de supervisão e qualidade:**
- `thor` 🌩️ — Supervisor de Loops Autônomos: monitora modo autônomo do SQUAD, detecta stalls, escalona ao @jarvis quando mesmo erro repete 2x, previne loops infinitos
- `carol` ⭐ — Avaliadora de Qualidade do SQUAD: scorecard em 5 eixos (Acurácia, Completude, Clareza, Acionabilidade, Concisão) com veredicto estruturado [APROVADO/CORRIGIR/REEXECUTAR]

**SQUAD antes:** 10 agentes | **SQUAD depois:** 22 agentes

### Infraestrutura
- Remote git migrado de `HEXAGON-WORKSPACE-MANAGER` para `NEX-ALS-IDE` (`https://github.com/fasterdrible-lab/NEX-ALS-IDE.git`)
- CLAUDE.md atualizado com novo repositório

### Corrigido — Erro 401 no Operador e em análises de IA (`callAIOneShot`)

**`apps/desktop/src/ipc/handlers.ts`:**
- Adicionado helper `callAIOneShot(userMessage, systemPrompt, maxTokens)`: resolve o provider padrão da tabela `ai_providers WHERE isDefault=1` (igual ao `squad:stream:start`); para `claude-code` spawna subprocess `claude -p --output-format text` com `getActiveClaudeEnv()`; watchdog 60s; para outros providers chama `aiSvc.chatAgent`
- `infra:analyze` atualizado: de `aiSvc.chatAgent({ provider: AGENTS.devops.preferredProvider })` → `callAIOneShot(...)` — elimina erro 401 no Operador ao usar conta Claude Code
- `workspace:analyze` atualizado: de `aiSvc.chatAgent({ provider: AGENTS.friday.preferredProvider })` → `callAIOneShot(...)` — análise de workspace sem API key
- `learning:analyzeFile` atualizado: de `aiSvc.chatAgent({ provider: AGENTS.friday.preferredProvider })` → `callAIOneShot(...)` — aprendizado contínuo sem API key
- `squad:memory:extract` atualizado: de `aiSvc.chatAgent({ provider: AGENTS.friday.preferredProvider })` → `callAIOneShot(...)` — extração de memórias sem API key

**`apps/web/src/pages/Help.tsx`:**
- Versão na seção "Sobre": `3.34.0` → `3.50.0`; repositório: `HEXAGON-WORKSPACE-MANAGER` → `NEX-ALS-IDE`
- Cabeçalho: `v3.34.0` + "10 agentes" → `v3.50.0` + "22 agentes especializados"
- Lista de agentes expandida de 10 para 22 (adicionados Natasha, Hank, Ghost, Rhodey, Bruce, Sam, Scott, Thor, Riri, Hope, Carol, Wanda)
- Cards SQUAD: "8 agentes" → "22 agentes especializados com pipeline autônomo completo"

**`apps/web/src/components/Layout.tsx`:**
- Badge de versão no footer da sidebar: `v3.49.0` → `v3.50.0`

**Resultado:** botão "Analisar com DevOps" no Operador, análise de Workspace, Aprendizado Contínuo e extração de Memórias do Squad funcionam corretamente com conta Claude Code — sem necessidade de API key separada.

### Adicionado — Conta & Uso com API real de utilização

**`apps/desktop/src/ipc/handlers.ts`:**
- `fetchClaudeUsage(accessToken)` corrigida: endpoint real `GET https://api.anthropic.com/api/oauth/usage` (Bearer token); campos `five_hour.utilization`, `five_hour.resets_at`, `seven_day.utilization`, `seven_day.resets_at`
- Handler `claude:usage` reescrito: lê `~/.claude/.credentials.json → claudeAiOauth.accessToken` (campo real — antes lia `claudeAiOauthToken` que não existe); lê `~/.claude.json → oauthAccount` para email, `organizationName`, `organizationType`
- 3 erros TypeScript pré-existentes corrigidos: `local:lsp:stop` e `local:lsp:status` precisavam de lambda `async` para satisfazer `wrapHandler`; `$queryRawUnsafe` no `search:global` corrigido com cast pattern ao invés de generic inválido

**`apps/web/src/lib/ipc.ts`:**
- Tipo de retorno de `ipc.claude.usage()` atualizado: `{ email?, organization?, plan?, usage?: { five_hour?, seven_day? } | null, error? }`

**`apps/web/src/pages/SquadPage.tsx`:**
- Helpers de módulo: `formatResetIn(isoDate)` (converte ms → "Xmin/Xh/Xd") + `usageBarColor(pct)` (≥90% vermelho, ≥70% âmbar, demais verde)
- Modal "Conta & Uso" (w-96) reconstruído:
  - Seção **CONTA**: Auth method "Claude AI", Email, Organização, Plano (`.replace(/_/g, ' ')`)
  - Seção **USO**: barra de progresso **Sessão (5h)** com %, barra de progresso **Semanal (7 dias)** com % + "Reinicia em Xd"
  - Link para `claude.ai/settings/usage`; botão "Gerenciar em claude.ai"
- Estado `usageInfo` tipado com nova interface

**Comportamento resultante:**
- Botão "Uso" no Squad → modal exibe email, organização, plano e barras de consumo reais ✅
- Cores adaptativas: verde <70% · âmbar 70-89% · vermelho ≥90% ✅
- "Reinicia em Xd" calculado dinamicamente a partir de `resets_at` da API ✅
- Instalador `NEX-ALS IDE Setup 3.50.0.exe` + portable regenerados com todas as mudanças ✅

---

## [3.49.0] — 2026-06-14

### Adicionado — SQUAD-02: Fury com Busca Web em Tempo Real

**`packages/core/src/squad/agents.ts`:**
- `FURY_ACTION_INSTRUCTIONS` — novo bloco de instrução exclusivo para Fury com regras de uso da ACTION SEARCH
- `ACTION_INSTRUCTIONS` — adicionada ACTION SEARCH a todos os agentes com ACTION tags (`[ACTION:SEARCH query="..."][/ACTION]`)
- System prompt de Fury atualizado: nunca inventa dados, sempre executa buscas reais antes de afirmar qualquer coisa, cita URL da fonte

**`apps/desktop/src/ipc/handlers.ts`:**
- DDL `ALTER TABLE settings ADD COLUMN braveApiKey TEXT NOT NULL DEFAULT ''` (silencioso se coluna já existir)
- Handler `settings:brave:get()` — retorna `{ braveApiKey }` da tabela settings
- Handler `settings:brave:set(key)` — upsert do `braveApiKey` na tabela settings
- Handler `search:web({ query, count? })` — lê `braveApiKey` do banco, chama `GET https://api.search.brave.com/res/v1/web/search` com header `X-Subscription-Token`, retorna `{ output }` formatado como markdown (título, URL, descrição)
- Timeout de 15s; retorna erro amigável se chave não configurada

**`apps/desktop/src/preload.ts`:** canais `search:web`, `settings:brave:get`, `settings:brave:set`

**`apps/web/src/lib/ipc.ts`:**
- `ipc.search.web({ query, count? })` → `{ output: string }`
- `ipc.settings.brave.get()` → `{ braveApiKey: string }`
- `ipc.settings.brave.set(key)` → `{ saved: boolean }`

**`apps/web/src/pages/SquadPage.tsx`:**
- `ActionType` expandido com `'search'`
- `executeActionsAuto`: branch para `action.type === 'search'` — executa `ipc.search.web` diretamente (sem VPS), registra no activity log com ícone 🌐
- Display de ACTION tag: badge **WEB** laranja para SEARCH
- Activity log: ícone `🌐` para entradas de busca

**`apps/web/src/pages/SettingsPage.tsx`:**
- Seção **Busca Web (Brave Search)**: campo de API key com toggle show/hide, botão Salvar, link para registro, mensagem de feedback

**Comportamento resultante (SQUAD-02 fechado):**
- Fury pesquisa a internet automaticamente antes de emitir qualquer dado de mercado ✅
- Qualquer agente pode usar `[ACTION:SEARCH query="..."]` para buscar docs, pacotes, soluções ✅
- Badge **WEB** laranja no chat + ícone 🌐 no Activity log ✅
- Chave configurada uma vez em Configurações → Busca Web ✅
- Plano gratuito Brave: 2.000 buscas/mês ✅

---

## [3.48.0] — 2026-06-14

### Adicionado — SQUAD-01: Memória Persistente entre Sessões

**`packages/db/prisma/schema.prisma`:**
- Novo modelo `SquadMemory`: campos `id`, `projectKey` (localPath ou `__global__`), `content`, `category` (decisão/arquitetura/padrão/correção/outro), `sessionId?`, `agentName`, `createdAt`; index em `projectKey`

**`apps/desktop/src/ipc/handlers.ts`:**
- DDL `CREATE TABLE IF NOT EXISTS squad_memories` executado na inicialização (auto-migração para instâncias sem db:push)
- Handler `squad:memory:list(projectKey)` — lista memórias do projeto em ordem cronológica
- Handler `squad:memory:save({ projectKey, content, category, sessionId?, agentName? })` — salva uma memória manualmente
- Handler `squad:memory:delete(id)` — remove memória por id
- Handler `squad:memory:extract({ sessionId, projectKey })` — lê até 40 mensagens da sessão, monta contexto de conversa, chama Friday via `chatAgent` pedindo 1-6 memórias em JSON, salva e retorna lista

**`apps/desktop/src/preload.ts`:** canais `squad:memory:list`, `squad:memory:save`, `squad:memory:delete`, `squad:memory:extract`

**`apps/web/src/lib/ipc.ts`:**
- Tipo `SquadMemory` exportado
- `ipc.squad.memory.list(projectKey)`, `.save(data)`, `.delete(id)`, `.extract({ sessionId, projectKey })`

**`apps/web/src/pages/SquadPage.tsx`:**
- `MEM_CAT_STYLE` — mapa de estilos por categoria (azul/roxo/verde/vermelho/cinza)
- Estado `memories: SquadMemory[]` + `extracting: boolean`
- `projectContext` (useMemo) injeta as 20 memórias mais recentes como `## MEMÓRIAS DO PROJETO` antes do KB manual
- `useEffect([localPath])` carrega memórias do projeto via `ipc.squad.memory.list`
- `extractMemories()` — chama `squad:memory:extract`, adiciona resultado ao estado, navega para aba Memórias
- `deleteMemory(id)` — remove do backend e atualiza estado
- Aba **Memórias** (4ª, ícone `Brain`, badge roxo com contagem) no painel direito:
  - Header com projeto atual + botão "Extrair da sessão" (habilitado quando há sessão + ≥3 mensagens)
  - Cards por memória: badge de categoria colorido, conteúdo, data, botão excluir (hover)
  - Empty state com ícone Brain e instrução

**Comportamento resultante (SQUAD-01 fechado):**
- Agentes têm acesso automático às decisões de sessões anteriores ✅
- Extração com 1 clique: Friday analisa a conversa e gera 1-6 memórias estruturadas ✅
- Memórias injetadas no `projectContext` → todos os agentes recebem como contexto ✅
- Escopo por projeto (localPath) — projetos diferentes têm memórias separadas ✅
- Sem nova coluna de dados sensíveis — apenas fatos técnicos extraídos pela IA ✅

---

## [3.47.0] — 2026-06-14

### Adicionado — Phase C: Planning Mode

**`apps/web/src/pages/PlanningPage.tsx`** (NOVO — fullscreen):
- **Coluna esquerda — Fila de tarefas**: lista de tarefas com agente-dono, prioridade (critical/high/medium/low), status (pending/running/done/blocked), filtro por agente + status, ordenação por urgência; clicar no status avança o ciclo; botão ▶ executa a tarefa navegando para `/squad` com `autoMessage` e `agent` no `location.state`
- **Coluna direita — Automações**: espelha automações do `AutomationsPage` (toggle ativo/inativo, próximo disparo calculado, botão "Executar agora")
- **Faixa inferior — Contexto por agente**: aba por agente (`jarvis`, `friday`, `fury`, `shuri`, `pepper`, `vision`, `requis`, `tester`, `reviewer`, `devops`), textarea de instruções específicas, persistido em `localStorage` (`planning_agent_contexts`)
- Botão "+ Nova Tarefa" com modal completo (título, agente, prioridade, descrição)

**`apps/web/src/pages/SquadPage.tsx`:**
- `useLocation` adicionado ao import de `react-router-dom`
- `useEffect` on mount lê `location.state as { autoMessage?, agent? }` → pré-preenche input e seleciona agente automaticamente; limpa state com `window.history.replaceState` para evitar re-trigger no back
- Injeção de contexto por agente: lê `planning_agent_contexts` do `localStorage` e mescla com `projectContext` antes de `stream.start`

**`apps/web/src/components/Layout.tsx`:**
- Botão **PLANEJAR** (amber, ícone `CalendarClock`, acima de WORKSPACE) → `/planning`
- Versão → `v3.47.0`

**`apps/web/src/App.tsx`:** rota `/planning` → `PlanningPage` (fullscreen, fora do Layout)

**Comportamento resultante (Phase C fechada):**
- Sidebar → PLANEJAR → fila visual de tarefas + automações + contextos por agente ✅
- Clicar ▶ numa tarefa → SquadPage com agente certo + mensagem pré-preenchida ✅
- Contexto específico por agente é injetado automaticamente em cada sessão Squad ✅
- Automações visíveis e executáveis sem sair do Planning ✅

---

## [3.46.0] — 2026-06-14

### Adicionado — Phase 2: LSP Auto-start Local

**`apps/desktop/src/lsp/local-lsp.ts`** (NOVO):
- Classe `LocalLspBridge`: detecta `typescript-language-server` (spawn com `--version`), spawna o servidor com `--stdio`, faz bridge Content-Length ↔ WebSocket em porta dinâmica (OS-assigned via `listen(0)`)
- Parsing de protocolo LSP: loop de `Content-Length: N\r\n\r\n{body}` no buffer stdout → mensagem JSON enviada via WebSocket; sentido inverso: JSON do WS → `Content-Length: N\r\n\r\n` no stdin
- Múltiplos clientes WS suportados via `Set<{ readyState, send, close }>`
- Erro amigável se servidor não instalado: "Instale com: npm install -g typescript-language-server typescript"

**`apps/desktop/src/ipc/handlers.ts`:**
- Handlers `local:lsp:start(workspacePath)`, `local:lsp:stop()`, `local:lsp:status()` → instância única de `LocalLspBridge`

**`apps/desktop/src/preload.ts`:** canais `local:lsp:start`, `local:lsp:stop`, `local:lsp:status`

**`apps/desktop/package.json`:** dep `ws@^8.18.0`, devDep `@types/ws@^8.5.12`

**`apps/web/src/lib/ipc.ts`:** `ipc.lsp.start(workspacePath)`, `ipc.lsp.stop()`, `ipc.lsp.status()`

**`apps/web/src/lib/lsp.ts`:** `connectLSP(monaco, langKey, portOverride?)` — aceita porta dinâmica local

**`apps/web/src/pages/IDEPage.tsx`:**
- `toggleLSP` detecta modo local (`isLocal`) → chama `ipc.lsp.start(localRootRef.current)` e passa porta retornada para `connectLSP` via `portOverride`
- Toast diferenciado: "TS LSP conectado (local)" vs "(remoto via túnel)"

**Comportamento resultante (Phase 2 fechada):**
- IDE local: clicar "TS LSP" na status bar → conecta TypeScript LSP sem abrir túnel SSH ✅
- IDE remoto: comportamento original preservado (túnel porta 6009) ✅
- Sem conflito de porta: local usa porta aleatória do OS ✅

---

## [3.45.0] — 2026-06-14

### Adicionado — Ponto 11: Workspace Intelligence

**`apps/desktop/src/ipc/handlers.ts`:**
- Handler `workspace:analyze({ vpsId, projectPath })` — coleta dados do projeto via SSH (`find`, `cat` de manifests, `head` de arquivos-fonte), valida `projectPath` contra regex de segurança (`/^[/~]?[a-zA-Z0-9_./-]+$/`), monta contexto de até 7.000 chars e chama Friday via `chatAgent` para retornar `WorkspaceReport` JSON estruturado
- Execução em paralelo (`Promise.allSettled`) para todos os manifests; depois lê até 6 arquivos-fonte (700 chars cada)
- Sanitização de saída: verifica campos `summary`, `stack`, `architecture.layers`, `architecture.patterns`, `modules`, `flows`, `risks` antes de retornar

**`apps/desktop/src/preload.ts`:** adicionado canal `workspace:analyze`

**`apps/web/src/lib/ipc.ts`:**
- Tipos: `WsArchLayer`, `WsModule`, `WsFlow`, `WsRisk`, `WorkspaceReport`
- `ipc.workspace.analyze({ vpsId, projectPath })` → `WorkspaceReport`

**`apps/web/src/pages/WorkspacePage.tsx`** (NOVO — fullscreen):
- **Modo seletor** (sem query params): VPS dropdown + path input + botão "Analisar Projeto"
- **Modo análise** (com `?vpsId=X&path=Y`): auto-analisa ao montar
- **Top bar**: back, VPS/projeto breadcrumb, badges de risco (crítico/alto), botão Reanalisar
- **Left rail** (visível com relatório): tabs de navegação + mini painel de contagem de riscos por severidade
- **Tabs de conteúdo:**
  - *Resumo*: parágrafo de summary + stack badges + patterns checklist
  - *Arquitetura*: layer cards com nome, descrição e arquivos
  - *Módulos*: cards com nome, path, role badge (controller/service/model/utility/config), imports count, risks count
  - *Fluxos*: accordion expandível com etapas numeradas
  - *Riscos*: cards coloridos por severidade (critical/high/medium/low), ordenados do mais grave
- Risco zero → card verde "Projeto em boas condições"

**`apps/web/src/components/Layout.tsx`:**
- Botão **WORKSPACE** (azul, acima de OPERADOR) na sidebar → `/workspace`
- Versão → `v3.45.0`

**`apps/web/src/App.tsx`:** rota `/workspace` → `WorkspacePage` (fullscreen, fora do Layout)

**`apps/web/src/pages/IDEPage.tsx`:**
- Botão **Workspace** na status bar (ao lado de Aprender, somente VPS remota) → abre `/workspace?vpsId=X&path={activeDir}&name={vpsName}`

**Comportamento resultante (Ponto 11 fechado):**
- Clicar "WORKSPACE" na sidebar → selector de VPS + path ✅
- Clicar "Workspace" na status bar do IDE → análise imediata do diretório aberto ✅
- IA mapeia camadas, módulos, fluxos e riscos em ~30s ✅
- Reanalisar a qualquer momento para atualizar o mapa ✅
- Segurança: path validado com regex; sem injeção de shell possível ✅

---

## [3.44.0] — 2026-06-14

### Adicionado — Ponto 10: Aprendizado Contínuo

**`apps/desktop/src/ipc/handlers.ts`:**
- Handler `learning:analyzeFile({ name, content, language })` — usa Friday (claude-opus) para extrair título, conteúdo resumido, categoria e tags de qualquer arquivo de código; responde em JSON puro (máx 512 tokens); sanitiza categoria contra lista allowlist

**`apps/desktop/src/preload.ts`:** adicionado canal `learning:analyzeFile`

**`apps/web/src/lib/ipc.ts`:** adicionado `ipc.learning.analyzeFile(data)`

**`apps/web/src/pages/IDEPage.tsx`:**
- Função `analyzeManifest(name, content)` (módulo-nível, sem IA): parseia heuristicamente `package.json`, `requirements.txt`, `go.mod`, `Cargo.toml`, `docker-compose.yml` e retorna `KbSuggestion` ou `null`
- Estado: `kbSuggestion`, `aiLearning`, `aiLearnResult`
- Hook em `openFile()`: após carregar conteúdo, chama `analyzeManifest` → se retornar sugestão → `setKbSuggestion()` (sem IA, sem latência)
- **Banner KB** (entre tabs e breadcrumbs): aparece dourado quando `kbSuggestion` ativo — ícone BookMarked + título truncado + botão "Salvar na KB" + dismiss
- **Botão "💡 Aprender"** na status bar (rightmost): chama `ipc.learning.analyzeFile()` com arquivo ativo → abre modal de resultado
- **Modal de aprendizado IA**: exibe título/conteúdo/categoria/tags extraídos pela IA com botões "Ignorar" e "Salvar na KB"
- `handleSaveToKb(s)`: chama `ipc.knowledge.create()` + toast de confirmação + fecha banner/modal

**Comportamento resultante (Ponto 10 fechado):**
- Abrir `package.json` → banner dourado aparece instantaneamente com stack detectada ✅
- Botão Aprender na status bar analisa qualquer arquivo via IA → propõe entrada KB ✅
- Um clique para salvar padrão detectado na Knowledge Base ✅
- Zero latência para manifests (heurística local); IA sob demanda para código ✅

---

## [3.43.0] — 2026-06-14

### Adicionado — Ponto 9: Operador de Infraestrutura

**`apps/desktop/src/ipc/handlers.ts`:**
- Handler `infra:analyze(report: string)` — chama `AiService.chatAgent()` com AGENTS.devops + prompt de análise de infraestrutura; retorna análise textual

**`OperatorPage` (`apps/web/src/pages/OperatorPage.tsx`) — fullscreen, sem sidebar:**
- Top bar: breadcrumb "← Operador de Infraestrutura" + badges (N críticos / N atenção / N ok) + botão "Analisar com DevOps" + botão "Verificar Tudo"
- Auto-load: busca VPS list ao montar; reseta status para 'checking' e chama `ipc.monitor.getStats(vpsId)` para TODOS em paralelo (Promise.all)
- Auto-refresh: `setInterval` de 5 minutos
- **Thresholds:** CPU ≥80% warn / ≥95% critical; RAM ≥85% warn / ≥95% critical; Disco ≥80% warn / ≥90% critical
- **VPS grid** (auto-fill minmax 280px): cards coloridos por status (verde/amarelo/vermelho/cinza), mini progress bars para CPU/RAM/Disco, uptime, lista de alertas por card
- **Alert feed** (painel direito): acumula alertas por nível (critical/warn) com timestamp e nome da VPS — até 50 entradas
- **AI panel**: botão "Analisar com DevOps" formata relatório completo (todas VPS + métricas + alertas) e chama `infra:analyze` → exibe análise no painel direito acima do feed
- `StatusDot` component: dot colorido com glow + label texto (Online/Atenção/Crítico/Offline)
- `MiniBar`: progress bar compacta com cor dinâmica baseada nos thresholds

**`Layout.tsx`:** botão "OPERADOR" destacado em vermelho na sidebar (acima de SQUAD), estilo idêntico aos outros botões de acesso rápido

**Rota:** `/operator` fullscreen (fora do bloco Layout, como `/ai-hub` e `/squad`)

**Comportamento resultante (Ponto 9 fechado):**
- Visão unificada de TODAS as VPS em um único painel ✅
- Health checks automáticos na abertura e a cada 5 minutos ✅
- Alertas proativos com threshold configurado (CPU/RAM/Disco) ✅
- Análise IA com @devops para interpretar o estado da infraestrutura ✅
- Sem nova tabela no DB — alertas em memória, métricas via SSH existente ✅

---

## [3.42.0] — 2026-06-14

### Adicionado — Ponto 7: Automações naturais

**DB (`packages/db/src/index.ts`):**
- Tabela `scheduled_jobs`: id, title, instruction, agentName, schedule (JSON), isActive, lastRunAt, lastResult, nextRunAt, vpsId, createdAt, updatedAt

**`packages/core/src/jobs/jobs.service.ts`** (novo):
- `JobSchedule` — union type: `interval | hourly | daily | weekly`
- `parseSchedule(text)` — parser NL em PT/EN: detecta "todo dia às 8h", "toda segunda", "a cada 30 min", "de manhã", "à noite", extrai hora com regex flexível
- `describeSchedule(schedule)` — "Diariamente às 08:00", "Toda Seg às 09:00", "A cada 30 min"
- `computeNextRunAt(schedule, from?)` — calcula próxima execução para cada tipo de schedule
- `ScheduledJobsService`: `list()`, `get()`, `getDue()`, `create()`, `update()`, `delete()`, `markRan()` — raw SQL em `scheduled_jobs`
- `create()` detecta schedule automaticamente da instruction; `update()` re-parseia se instruction mudar

**`apps/desktop/src/jobs/job-executor.ts`** (novo):
- `JobExecutor` — executa no main process (Electron)
- `start()` — `setInterval(60s)` + execução imediata
- `checkDueJobs()` — consulta `getDue()`, usa Set interno para evitar execuções duplicadas
- `executeJob(job)` — chama `AiService.chatAgent()` com system prompt do agente + contexto do ContextBuilder; retorna resposta textual
- Após execução: `Notification.show()` com título do job e primeiros 150 chars da resposta
- `markRan()` chamado antes da execução para avançar nextRunAt (evita re-execução em reinícios lentos)
- `runNow(id)` — execução imediata sob demanda via IPC

**IPC (6 handlers):** `jobs:list`, `jobs:create`, `jobs:update`, `jobs:delete`, `jobs:toggle`, `jobs:runNow` — todos com `requireAuth()`

**`AutomationsPage` (`apps/web/src/pages/AutomationsPage.tsx`):**
- Header com contador: "N jobs · N ativos"
- Cards com: emoji do agente, título, badge ativo/pausado, schedule description, próxima execução (relativa), último run
- Expandir card: exibe instruction completa + último resultado
- Ações por card: ▶ Executar agora · ToggleRight ativar/pausar · Trash excluir
- Modal "Nova automação": textarea com instrução NL + preview live do schedule detectado + select do agente
- Auto-refresh a cada 30s (atualiza nextRunAt / lastRunAt sem reload completo)
- Rota `/automations` + nav item "Automações" com ícone `Timer`

**Comportamento resultante (Ponto 7 fechado):**
- Usuário escreve "Verifique esta VPS todo dia às 8h" → schedule detectado automaticamente ✅
- Executor roda em background no main process mesmo sem interação do usuário ✅
- Resultado aparece como notificação desktop + salvo em lastResult ✅
- Cada agente pode ter suas próprias automações com KB context relevante ✅

---

## [3.41.0] — 2026-06-14

### Adicionado — Ponto 5: Delegação estruturada (hierarquia de sub-agentes)

**`packages/core/src/squad/agents.ts` — Jarvis system prompt:**
- Jarvis agora conhece o formato `[DELEGAÇÃO]...[/DELEGAÇÃO]` para criar planos multi-agente
- Instrução: cada linha `agentName: <objetivo autocontido>` — sub-agente receberá APENAS essa linha como contexto
- Mantém delegação simples `@agente task` para casos de agente único

**`apps/web/src/pages/SquadPage.tsx`:**
- `DelegationItem { agent, objective }` + `DelegationPlan { items }` — interfaces locais
- `parseDelegationPlan(text)` — parser do bloco `[DELEGAÇÃO]...[/DELEGAÇÃO]`; valida agent names; retorna `null` se bloco ausente
- `streamAgent` — novo parâmetro `isolatedHistory?`: quando fornecido, substitui `bubblesRef.current` como histórico enviado ao backend → sub-agentes recebem `history: []` (contexto zerado)
- Delegação estruturada (prioridade alta):
  - Sistema exibe: `"🎯 @jarvis criou um plano com N sub-tarefas"`
  - Por sub-tarefa: `"⚙ Delegando para @agent: objetivo truncado…"` → `streamAgent(agent, objective, sid, 'jarvis', 1, undefined, [])`
  - Após todas: `"✓ Delegações concluídas — sintetizando resultados…"` → Jarvis recebe síntese com histórico completo (vê resultados de todos os sub-agentes)
- Delegação simples `@mention` — mantida como fallback quando não há bloco estruturado

**Comportamento resultante (Ponto 5 fechado):**
- Jarvis decompõe tarefas complexas em sub-objetivos isolados ✅
- Sub-agentes trabalham sem "ruído" da conversa completa — apenas seu objetivo específico ✅
- Jarvis sintetiza os resultados automaticamente após todas as delegações ✅
- Backward compatible: delegação por `@mention` continua funcionando ✅

---

## [3.40.0] — 2026-06-14

### Adicionado — Ponto 4: Busca semântica em conversas

**DB (`packages/db/src/index.ts`):**
- `squad_messages_fts` — FTS5 virtual table indexando `content` e `agentName` de `squad_messages`
- 4 triggers de sincronização: `smsg_ai` (INSERT), `smsg_ad` (DELETE), `smsg_au_del` / `smsg_au_ins` (UPDATE)
- Migration idempotente: `INSERT INTO squad_messages_fts(squad_messages_fts) VALUES ('rebuild')`

**`search:global` IPC handler:**
- Agora retorna `{ knowledge, skills, conversations }` — terceiro campo com resultados de squad_messages
- Query FTS5 com `snippet(squad_messages_fts, 0, '[[', ']]', '…', 24)` para highlight de trechos relevantes
- Filtra mensagens `role != 'system'`, ordena por relevância FTS5 (`rank`), limite 15 resultados

**`apps/web/src/lib/ipc.ts`:**
- Interface `ConversationResult { id, sessionId, agentName, role, snippet, createdAt }` exportada
- `ipc.search.global()` atualizado com tipo `conversations: ConversationResult[]`

**`SearchPage` (`apps/web/src/pages/SearchPage.tsx`) — nova página:**
- Input com debounce 350ms chamando `ipc.search.global()`
- Resultados agrupados por categoria: Conversas (roxo) · Conhecimento (dourado) · Skills (verde)
- Highlight automático dos termos encontrados — delimitadores `[[...]]` renderizados como `<mark>` estilizado
- Cards de conversa mostram: emoji do agente, @nome, role, data, prefixo do sessionId
- Empty state com ícones por categoria; estado "nenhum resultado" com sugestão
- Rota `/search` adicionada ao Layout com ícone `Search`

**Comportamento resultante (Ponto 4 fechado):**
- Usuário pesquisa "erro nginx", "refactor", "deploy" e encontra mensagens antigas do Squad ✅
- Resultados de KB e Skills aparecem na mesma tela ✅
- Índice FTS5 mantido sincronizado automaticamente via triggers ✅
- Conversas antigas indexadas via rebuild na inicialização ✅

---

## [3.39.0] — 2026-06-14

### Adicionado — Ponto 6: Planejamento Persistente

**TasksService (`packages/core/src/tasks/tasks.service.ts`):**
- `AgentTask` interface: `id, title, description, status (TODO|IN_PROGRESS|BLOCKED|DONE), ownerAgent, priority (low|medium|high), projectId, sessionId, createdAt, updatedAt`
- `list(filters?)`, `listActive()`, `get(id)`, `create(input)`, `update(id, input)`, `delete(id)` — queries raw SQLite em `agent_tasks` (tabela já existia desde v3.35.0)
- `buildContext(tasks)` — formata tarefas pendentes como bloco `## TAREFAS PENDENTES DO SQUAD` com prioridade e status por extenso

**IPC (5 handlers):** `tasks:list`, `tasks:get`, `tasks:create`, `tasks:update`, `tasks:delete` — todos com `requireAuth()`

**ContextBuilder P3:** `this.tasks.listActive()` adicionado como terceira camada de contexto — até 20 tarefas não-DONE são injetadas automaticamente em todo stream do Squad

**TasksPage (`apps/web/src/pages/TasksPage.tsx`):**
- Kanban com 4 colunas: A fazer (cinza) · Em andamento (azul) · Bloqueada (vermelho) · Concluída (verde)
- Cards com dot de prioridade colorido, emoji do agente dono, descrição truncada
- Hover: botão "Iniciar / Concluir / Resetar" (avança status) + botão delete
- Click no card: modal de edição com título, descrição, status, prioridade e agente
- Botão "+ Nova tarefa" no header abre modal de criação
- Counter no header: total de tarefas e quantas concluídas
- Rota `/tasks` adicionada ao Layout com ícone `ClipboardList`

**Comportamento resultante (Ponto 6 fechado):**
- O usuário gerencia tarefas via Kanban visual ✅
- Os agentes do Squad veem automaticamente as tarefas pendentes antes de responder ✅
- Jarvis (e outros) podem criar/mover tarefas via IPC no futuro ✅

---

## [3.38.0] — 2026-06-14

### Adicionado — Ponto 1: Memória Persistente (loop completo)

**ContextBuilder — busca por relevância (FTS5):**
- `KnowledgeService.buildContextFromEntries(entries, header?)` — novo método que formata um array de entradas como bloco de contexto; reutilizado por `buildContext()` e pelo novo fluxo FTS
- `ContextBuilder.build()` atualizado: quando `query` é fornecido, chama `knowledge.search(query, 8)` (FTS5) para obter APENAS as entradas relevantes para a tarefa atual; fallback para `buildContext()` (todas as ativas) se a busca retornar vazio; quando sem query, comportamento original (todas as ativas)
- `knowledgeCount` agora retorna o número real de entradas encontradas (antes era sempre 0 ou 1)

**Loop de aprendizado — banner "Salvar Memória":**
- Após pipeline completar: exibe banner dourado "Salvar esta solução na Memória do projeto?" junto ao banner de Skills
- Após modo autônomo completar: mesmo banner disparado com task + último conteúdo do agente (até 600 chars) como resolução
- Salva `knowledge_entry` com `category: 'geral'`, `tags: 'squad,auto'`, `isActive: true` via `ipc.knowledge.create()`
- O usuário pode dispensar (X) ou confirmar — a entrada fica imediatamente pesquisável via FTS5 e é injetada nos próximos streams como memória relevante

**Comportamento resultante (Ponto 1 fechado):**
- Agente consulta memória automaticamente (v3.37.0 — ContextBuilder no stream) ✅
- Memória consultada é filtrada por relevância à tarefa (FTS5) ✅
- Novas memórias podem ser salvas automaticamente após tarefas ✅
- Memória é pesquisável (FTS5 — v3.35.1) ✅

---

## [3.37.0] — 2026-06-14

### Adicionado — Ponto 8: Contexto Inteligente Automático no Squad

**ContextBuilder agora alimenta todos os streams do Squad:**
- `ctxBuilder.build({ query: data.message })` substituiu a chamada direta a `knowledgeSvc.buildContext()` no handler `squad:stream:start`
- O contexto injetado agora inclui dois níveis automáticos:
  - **P1 — Knowledge Base ativa:** todas as entradas `isActive=true` de `knowledge_entries`, montadas por `KnowledgeService.buildContext()`
  - **P2 — Skills matched:** `SkillsService.matchTriggers(message)` compara a mensagem do usuário contra os gatilhos de cada skill e inclui apenas as skills relevantes
- Budget de 12 000 chars com truncamento automático (`[...contexto truncado]`) — evita inflação de contexto
- Fallback gracioso: se o banco estiver indisponível ou FTS falhar, `ctxResult.text` fica vazio e o stream continua sem contexto (sem quebrar o fluxo)
- O `projectContext` manual (formulário KB da sidebar) continua sendo injetado depois do contexto automático — o usuário mantém controle total sobre o contexto do projeto

**Comportamento resultante:**
- Todo agente do Squad (Jarvis, Friday, Tester, etc.) recebe automaticamente o conhecimento acumulado na KB e as skills relevantes para a tarefa atual
- Não requer nenhuma ação do usuário — funciona em background a cada mensagem enviada

---

## [3.36.0] — 2026-06-14

### Adicionado — Phase B: Delegação Inteligente (Agent Operating System)

**Roteamento automático de tarefas no Squad:**
- `ROUTING_RULES` — 11 regras com regex e score por agente: `friday` (implementação/código), `tester` (QA/testes), `reviewer` (code review/segurança), `devops` (deploy/infra), `shuri` (UX/design), `pepper` (marketing/copy), `vision` (métricas/growth), `requis` (documentação), `fury` (pesquisa), `jarvis` (planejamento)
- `routeTask(text)` — score acumulativo por RegExp pattern, retorna `{ agent, confidence: 'high'|'medium', reason }` — confidence 'high' quando score ≥ 3
- **Badge "🎯 Sugestão"** no Squad — aparece acima do textarea quando o texto digitado corresponde a um agente diferente do ativo; clique no badge muda o agente ativo; badge oculto quando input começa com `@agente` ou isStreaming
- **Auto-route on send** — quando `confidence === 'high'` e não há `@mention` explícito, `handleSend` troca `targetAgent` e `activeAgent` automaticamente antes de enviar
- Routing limpo no `handleSend` — `setSuggestedRoute(null)` após o envio, evita re-exibição do badge
- Detecção debounced 500ms via `useEffect` — não bloqueia typing; reseta ao detectar `^@\w+`

---

## [3.35.1] — 2026-06-14

### Adicionado — FTS5 virtual tables: busca semântica real

**SQLite FTS5 para knowledge_entries e agent_skills:**
- `CREATE VIRTUAL TABLE knowledge_fts USING fts5(...)` com `content_rowid="rowid"` — índice FTS5 externo sincronizado com a tabela de conteúdo
- `CREATE VIRTUAL TABLE skills_fts USING fts5(...)` — mesmo padrão para skills
- 8 triggers SQLite (`*_ai`, `*_ad`, `*_au_del`, `*_au_ins`) criados com `CREATE TRIGGER IF NOT EXISTS` — UPDATE split em 2 triggers separados para evitar BEGIN...END multi-statement
- `INSERT INTO *_fts(*_fts) VALUES ('rebuild')` na seção de migrations — rebuild idempotente do índice ao inicializar (seguro para DBs existentes)
- `buildFtsQuery(raw)` — helper que sanitiza input, split em palavras, adiciona `*` para prefix matching e retorna query FTS5 segura
- `KnowledgeService.search(query, limit?)` — busca FTS5 com JOIN em `knowledge_entries` + `ORDER BY rank`; fallback LIKE automático se FTS indisponível
- `SkillsService.search(query, limit?)` — mesma abordagem para `agent_skills` / `skills_fts`
- `search:global` atualizado para usar `knowledgeSvc.search()` + `skillsSvc.search()` (FTS) ao invés de LIKE em memória
- `knowledge:search` — novo IPC handler expondo `knowledgeSvc.search()` diretamente
- `ipc.knowledge.search(query)` — novo método client-side em `ipc.ts`
- **KnowledgePage** — busca agora usa FTS via `ipc.knowledge.search()` com debounce 400ms; spinner durante busca; fallback LIKE no cliente se FTS falhar
- **SkillsPage** — busca agora usa FTS via `ipc.skills.search()` com debounce 400ms; spinner durante busca

---

## [3.35.0] — 2026-06-14

### Adicionado — Phase A: Skills + Context Builder (Agent Operating System)

**Sistema de Skills:**
- Nova tabela `agent_skills` no SQLite — skills com título, descrição, categoria, gatilhos, conteúdo e exemplos
- `SkillsService` em `packages/core/src/skills/` — CRUD completo, busca por LIKE, detecção por gatilhos (`matchTriggers`)
- IPC handlers: `skills:list`, `skills:get`, `skills:create`, `skills:update`, `skills:delete`, `skills:search`, `skills:match`, `skills:incrementUsage`
- **SkillsPage** (`/skills`) — lista, busca, criação, edição e exclusão de skills com UI dark

**Integração Squad:**
- Badge de skills pré-tarefa: quando o input do usuário dispara gatilhos de uma skill, exibe chips `⚡ NomeSkill` acima do textarea
- Banner pós-pipeline: após pipeline concluído, pergunta "Deseja salvar esta solução como uma Skill reutilizável?" com botão de salvar automático
- Detecção debounced (600ms) para não sobrecarregar

**Context Builder:**
- `ContextBuilder` em `packages/core/src/context/` — monta contexto priorizado: KB global → Skills por gatilho
- IPC `context:build` retorna `{ text, knowledgeCount, skillCount }` com budget de 12.000 chars
- IPC `search:global` retorna `{ knowledge, skills }` com busca unificada

**Banco de dados:**
- Novos campos em `knowledge_entries`: `source`, `projectId`, `relevanceScore`, `autoGenerated`, `usageCount`
- Nova tabela `agent_tasks` para rastreamento de tarefas por agente (futuro)
- Migrações incrementais aplicadas ao inicializar o banco

**Navegação:**
- Item "Skills" adicionado ao sidebar com ícone `BookOpenCheck`
- Rota `/skills` registrada no App.tsx

---

## [3.34.0] — 2026-06-13

### Corrigido — Pipeline completava prematuramente sem fazer nada

**Problema:** Pipeline percorria todas as fases (Planejar → Implementar → Revisar → Testar → PR) em segundos sem que nenhum agente executasse trabalho real no projeto.

**Causa raiz 1 — `runAgentUntilDone` saía quando agente respondia com texto:**
- Quando Friday recebia os resultados de um READ_DIR e respondia com um plano em texto (sem ACTION tags), a função quebrava o loop com `if (!lastBubble.actions?.length) break`
- O pipeline imediatamente avançava para Reviewer mesmo com nenhum arquivo criado
- **Fix:** Ao invés de sair, envia um prompt de push `⚠️ EXECUTE AGORA — nenhuma ACTION foi emitida` com formato explícito, idêntico ao mecanismo do `autonomousLoop`. Máximo de 3 pushes consecutivos sem ação antes de desistir. Tracker `lastSeenId` previne loop infinito se agente não responder.

**Causa raiz 2 — Jarvis e Reviewer chamados com `depth=0`:**
- `depth=0` ativa auto-delegação ao final da stream — se Jarvis ou Reviewer mencionassem outro agente no texto, a delegação automática disparava Friday/Tester paralelamente ao pipeline, criando conflito
- **Fix:** Ambos agora chamados com `depth=1` no pipeline (sem auto-delegação). Mensagem do Jarvis inclui instrução explícita "NÃO use ACTION tags" durante a fase de planejamento.

---

## [3.33.0] — 2026-06-13

### Adicionado — Pipeline de agentes autônomo + Reviewer + DevOps

**2 novos agentes:**
- **Reviewer** (`🔎`) — revisa código com `READ_FILE`, avalia bugs/segurança (OWASP), emite `[APROVADO]` ou `[BLOQUEADO]`
- **DevOps** (`🚀`) — cria commits (Conventional Commits), `git push`, abre PR com template Markdown

**Modo Pipeline:**
- Botão "Pipeline" no header — orquestra ciclo completo automaticamente ao receber uma tarefa
- Stepper visual de fases: `🎯 Planejar → 👩‍💻 Implementar → 🔎 Revisar → 🧪 Testar → 🚀 PR → ✅ Pronto`
- Se Reviewer emite `[BLOQUEADO]`, Friday corrige automaticamente antes de avançar para testes
- Indicador de fase ativa no header durante execução

---

## [3.32.0] — 2026-06-14

### Corrigido — Agentes não progrediam: 3 causas raiz resolvidas

**Diagnóstico:** logs do SQLite (`cwm.db`) analisados — 64 mensagens da sessão revelaram 3 bugs críticos

**Bug 1 (CRÍTICO) — Resultados das ações fora do histórico de conversa**
- `streamAgent` passava o resultado como `message` para a API (correto para a iteração atual), mas nunca adicionava ao `bubblesRef` como bubble
- Na próxima iteração, o `history` reconstruído do `bubblesRef` não incluía o resultado → histórico com mensagens consecutivas do assistente sem user turn entre elas → agentes sem contexto do que aconteceu
- **Fix:** antes de chamar `streamAgent(agent, result, ...)` em `autonomousLoop` e `autoExecRound`, o resultado é adicionado como bubble oculto (`type:'user', isActionResult:true`) e salvo no DB com `role:'result'`
- `streamAgent` recebe `excludeFromHistoryId` para evitar duplicação na API call atual, mas preserva o bubble para iterações futuras
- `handleSend` também passa o ID do bubble do usuário como `excludeFromHistoryId`
- `loadSession` mapeia `role:'result'` → `{ type:'user', isActionResult:true }` para restaurar contexto ao reabrir sessão
- Chat UI filtra `isActionResult:true` (invisível para o usuário, só existe para o histórico do LLM)

**Bug 2 (CRÍTICO) — `next dev` / `npm start` nunca terminavam**
- SHELL action com `npx next dev` nunca saía → watchdog de 90s matava → agente recebia "Timeout" e travava
- **Fix:** `handlers.ts` detecta comandos de servidor (`next dev`, `vite dev`, `npm run dev`, etc.) e usa lógica especial: captura os primeiros 8s de output, mata o processo, retorna output + mensagem "Servidor iniciado em background — acesse http://localhost:PORT"
- O servidor CONTINUA rodando em background até a app fechar

**Bug 3 — Agentes declaravam [PRONTO] sem evidência real**
- Shuri declarou "aplicação rodando em localhost" apenas após criar diretórios (nenhum servidor foi iniciado)
- **Fix:** `agents.ts` — adicionadas regras E9 (nunca [PRONTO] sem output REAL) e E10 (comportamento esperado de servidores em background)

- Versão: `3.31.0` → `3.32.0`

---

## [3.31.0] — 2026-06-13

### Corrigido — Travamentos + Agentes mais autônomos (soluções validadas pelo mercado)

**Investigação:** 4 causas raiz de travamento mapeadas além das já corrigidas

**Fix 1 — Watchdog para API provider no servidor (mesmo padrão do claude-code)**
- Streams de GPT/Anthropic/DeepSeek não tinham timeout — se a API parasse de responder, travava para sempre
- `handlers.ts`: watchdog de 90s por chunk adicionado ao path de API key (idêntico ao já existente para claude-code)

**Fix 2 — Watchdog no renderer (padrão Cursor: 60s por chunk no cliente)**
- Backup independente: se o evento `done` do IPC for perdido, o renderer auto-cancela após 90s sem chunks
- `lastChunkAtRef` atualizado a cada chunk recebido; `setInterval` de 15s verifica inatividade

**Fix 3 — Chunk batching (padrão VS Code Copilot: atualização de estado em batch)**
- Cada chunk do LLM causava um `setState` individual → centenas de re-renders por segundo em respostas grandes
- Buffer acumula deltas por `bubbleId` e aplica em batch a cada 80ms → UI significativamente mais fluida

**Fix 4 — Cancel signal em `executeActionsAuto` (padrão Devin: cancel por ferramenta)**
- Clicar ✕ não interrompia ações já em execução na fila (READ_FILE, WRITE_FILE, SHELL em sequência)
- Agora verifica `stopRequestedRef` antes de cada ação individual

**Fix 5 — Agentes mais proativos: recovery de erros explícito (padrão Aider)**
- `buildErrorHint()`: analisa o output de erro e injeta dica de correção específica para ENOENT, npm peers, robocopy, timeout, permissão negada
- Feedback reformatado: `❌ ERRO — LEIA E CORRIJA` com instrução obrigatória de não repetir o mesmo comando
- `EXECUTOR_RULES` em `agents.ts`: 8 regras de recovery (E1-E8) com correções concretas por tipo de erro

- Versão: `3.30.0` → `3.31.0`

---

## [3.30.0] — 2026-06-13

### Adicionado — Configurações: botão "Limpar histórico do Squad"

- Nova seção "Squad" na página de Configurações
- Botão **Limpar histórico do Squad** apaga todas as sessões e mensagens do Squad (`DELETE FROM squad_sessions` + `DELETE FROM squad_messages`) via confirmação
- Novo IPC handler `squad:session:clearAll` no main process
- Versão: `3.29.0` → `3.30.0`

---

## [3.29.0] — 2026-06-13

### Corrigido — Squad: tela travada na Friday e agentes usando provider errado

**Bug 1 (causa raiz do travamento na Friday): `ResponseStreamer.cancel()` nunca enviava `done`**
- Quando `squadSvc.cancelStream(streamId)` era chamado, o `AbortController` abortava o fetch mas **nunca enviava `{ type: 'done' }` para o renderer**
- O renderer esperava o evento `done` para chamar `resolve()` — sem ele, `await streamAgent(...)` ficava preso para sempre
- Fix em `response-streamer.ts`: salva o callback `sendDone` junto com o controller; `cancel()` agora chama `entry.sendDone()` após abortar

**Bug 2: agentes usando provider hardcoded, ignorando configuração do usuário**
- Friday usava `openai`, Fury usava `gemini`, Tester usava `openai` — mesmo que o usuário só tivesse `anthropic` configurado nas Settings
- Fix em `handlers.ts`: provider resolution agora prioriza o **isDefault** habilitado nas Settings; `preferredProvider` do agente é último recurso

- Versão: `3.28.0` → `3.29.0`

---

## [3.28.0] — 2026-06-12

### Corrigido — 3 bugs que causavam tela travada no modo autônomo

**Bug 1 (crítico): `autonomousLoop` resetava o flag de cancel**
- `autonomousLoop` chamava `stopRequestedRef.current = false` ao iniciar — apagava o cancel do usuário se clicasse ✕ durante o `streamAgent` inicial
- Fix: removido o reset interno; adicionado `if (stopRequestedRef.current) return` logo no início

**Bug 2: `activeStreamId` era React state com leitura stale**
- `cancelStream()` e `stopAutonomous()` liam `activeStreamId` via closure — se o usuário clicasse ✕ antes da re-render confirmar o novo stream ID, o cancel não ocorria
- Fix: adicionado `activeStreamIdRef` (useRef) atualizado sincronicamente; cancel usa `activeStreamIdRef.current ?? activeStreamId`

**Bug 3: loop de delegação ignorava cancel**
- Ao delegar entre agentes (depth=0), o loop não verificava `stopRequestedRef`
- Fix: adicionado `if (stopRequestedRef.current) break` antes de cada delegação

- Versão: `3.27.0` → `3.28.0`

---

## [3.27.0] — 2026-06-12

### Corrigido — Squad: botão ✕ agora para realmente o autoExecRound

**Raiz do problema:**
- `autoExecRound` tem um loop de até 20 rodadas mas nunca verificava `stopRequestedRef` — ao clicar ✕, o stream atual era cancelado mas o loop JS reiniciava um novo stream imediatamente, deixando a tela presa indefinidamente
- `cancelStream()` não setava `stopRequestedRef.current = true` (apenas `stopAutonomous()` fazia isso), então o flag que os loops usam para parar nunca era ativado ao clicar ✕ no modo Exec auto

**Fixes:**
- `cancelStream()` agora seta `stopRequestedRef.current = true` — unifica comportamento com `stopAutonomous()`
- `autoExecRound`: verifica `stopRequestedRef.current` **antes de cada rodada** e **após `executeActionsAuto`** — para imediatamente quando o usuário cancela, mesmo no meio de uma execução
- `handleSend`: reseta `stopRequestedRef.current = false` ao enviar nova mensagem — sem esse reset, clicar ✕ uma vez bloquearia todos os loops seguintes permanentemente
- Versão: `3.26.0` → `3.27.0`

---

## [3.26.0] — 2026-06-12

### Corrigido — Squad + AI Hub: stream congelado + cancelamento que não funcionava

**Watchdog de timeout (Squad e AI Hub):**
- Sem timeout, o processo `claude` CLI podia travar indefinidamente → UI congelada por 15+ minutos sem forma de sair
- Agora: verificação a cada 15s — se nenhum chunk chegar em **90 segundos**, o processo é morto e uma mensagem de erro é exibida no chat: `⏱ Timeout: claude CLI não respondeu em 90s`
- `lastChunkAt` resetado a cada chunk recebido (evita falsos positivos em respostas lentas mas contínuas)
- `clearInterval(watchdog)` chamado em `sendErr` e `sendDone` — sem timer órfão

**Cancelamento real do processo (Squad):**
- `squad:stream:cancel` chamava apenas `squadSvc.cancelStream(streamId)` que não tem efeito no subprocesso do Claude Code
- Fix: mesma lógica de `ai:stream:cancel` — verifica `claudeProcs.get(streamId)` primeiro; se encontrar, mata o processo (`proc.kill()`) e remove do mapa; senão cai para `squadSvc.cancelStream()`
- O botão ✕ no chat agora realmente encerra o CLI em vez de deixá-lo rodando em segundo plano
- Versão: `3.25.0` → `3.26.0`

---

## [3.25.0] — 2026-06-12

### Melhorado — IDE: tecnologia VS Code Phase 1 + Squad: robocopy robusto

**Semantic Highlighting (Monaco + TypeScript worker):**
- `monacoSetup.ts` reescrito: workers locais configurados (offline/Electron); TypeScript language service via type cast (`MonacoTsDefaults`/`MonacoTsLang`) — contorna `monaco.languages.typescript` tipado como `{ deprecated: true }` no Monaco 0.55 sem `@ts-ignore`
- Compiler options completos: ESNext, JSX ReactJSX, allowJs, esModuleInterop, strict: false
- **Inlay hints** — dicas de tipo inline idênticas ao VS Code: nomes de parâmetros, tipos de retorno, declarações de propriedade, valores de enum; via `setInlayHintsOptions` com optional chaining
- `'semanticHighlighting.enabled': true` nos editor options — Monaco usa o TypeScript worker para coloração semântica além da sintática

**Breadcrumbs bar (acima do Monaco Editor):**
- Barra fina `bg-[#161b22]` mostrando últimos 4 segmentos do caminho do arquivo ativo
- Símbolo atual (função/classe/variável sob o cursor) exibido em roxo `text-brand-500`; atualizado em tempo real via `editor.onDidChangeCursorPosition`
- `outlineRef = useRef<OutlineSymbol[]>([])` sincronizado via `useEffect` — evita closure stale no handler de cursor registrado uma vez no mount

**Outline View (painel esquerdo — aba "Outline"):**
- Nova aba "Outline" (`List` icon) no painel esquerdo, sempre visível (local e remoto)
- TypeScript/JS: `getTypeScriptWorker()` → `getNavigationBarItems(fileName)` → `NavigationBarItem[]` convertido para `OutlineSymbol[]` com hierarquia (classes → métodos) e kind-to-icon mapping
- Outras linguagens: regex fallback para classes, funções, variáveis em Python, Ruby, PHP etc.
- `OutlineTree` component: ícones coloridos por tipo (◆ classe, ⊕ método, ƒ função, ◎ variável…); entrada ativa realçada; clique navega com `revealLineInCenter`
- Auto-refresh: `useEffect` com debounce 450ms ao trocar arquivo; botão manual de refresh

**Squad: robocopy `/XD node_modules` (fix freeze crítico):**
- Robocopy copiando `node_modules` travava o app por 10+ minutos (30k+ arquivos)
- `handlers.ts` e `agents.ts` EXECUTOR_RULES regra 9 atualizados: `/XD node_modules .next` obrigatório; `npm install --prefix "<destino>"` após robocopy; timeout de `robocopy` adicionado ao regex de 600s
- Regra explícita: "NUNCA copie node_modules com robocopy"
- Versão: `3.24.0` → `3.25.0`

---

## [3.22.0] — 2026-06-12

### Adicionado — IDE: badges git na SFTP tree + Squad: painel arquivos modificados

**IDEPage: badges git estilo VS Code na SFTP tree:**
- `gitFileMap` (Map<path, {letter, color}>) e `dirtyDirSet` (Set de prefixos de pastas sujas) via `useMemo`
- Nome do arquivo colorido com `gitInfo.color`; badge letra (M/A/D/?) à direita; ponto âmbar para pastas com filhos sujos
- Auto-load git status quando tree carrega pela primeira vez

**SquadPage: painel "Arquivos modificados" estilo VS Code Explorer:**
- Ícone `FileCheck2` colorido por extensão (ts/tsx/js/py/json/css…), nome em negrito, path pai em `text-slate-600`, badge 'W' verde
- Paleta `extColor` com 12 extensões mapeadas
- Versão: `3.21.0` → `3.22.0`

---

## [3.21.0] — 2026-06-12

### Adicionado — Squad: parser 2-pass + staging seguro + monitoramento de atividade

**Parser de ACTION 2 passes:**
- Pass 1: regex `\[\/ACTION\]?` — aceita fechamento sem `]` final
- Pass 2: lookahead `(?=\[ACTION:|$)` captura blocos truncados antes de `[/ACTION`
- `Set<number>` evita duplicatas; `makeBlock`/`extractParams` extraídos como funções auxiliares
- `stripActions` atualizado para limpar ambas as formas

**Staging seguro:**
- `EXECUTOR_RULES` regra 9: usa `C:\Temp\squad-scaffold` como staging fixo (sem variáveis de ambiente); OneDrive bloqueia scaffolds em pastas sincronizadas

**Painel de monitoramento de atividade:**
- Interfaces `ActivityEntry` e `SessionStats`; refs para evitar closures stale
- `pushActivity`/`updateActivity`/`clearActivity` instrumentados em `executeAction` e `executeActionsAuto`
- Painel direito: tab Atividade com stats bar (R/W/⚡/✗), arquivos modificados, log com status e duração
- Versão: `3.20.0` → `3.21.0`

---

## [3.20.0] — 2026-06-12

### Adicionado — Squad: regras npm corretas para Friday

- `EXECUTOR_RULES` regra 8: nomes npm sempre lowercase; `--ts` em vez de `--typescript`; aspas em `--import-alias "@/*"`; `npx --yes` para evitar prompt interativo
- Versão: `3.19.0` → `3.20.0`

---

## [3.19.0] — 2026-06-12

### Corrigido — Squad: parser robusto + Exec auto com feedback + fluxo de leitura Jarvis

**Parser de ACTION tolerante a tags malformadas:**
- `parseActions`: regex primário aceita `[/ACTION` sem `]` final; segundo passo captura tags sem nenhum fechamento (truncamento do modelo)
- `stripActions`: remove ambas as formas malformadas do texto exibido

**Exec auto com feedback real (autoExecRound):**
- Antes: executava as ações mas não enviava os resultados ao agente → agente repetia a mesma ação em loop
- Agora: `autoExecRound()` — executa actions → envia `[RESULTADO DAS AÇÕES]` ao root agent → recebe nova resposta → se houver novas actions, repete (até 6 rodadas por mensagem)
- `handleSend`: chama `autoExecRound(sid)` quando Exec auto está ON e modo autônomo está OFF

**Fluxo de leitura obrigatório para Jarvis:**
- `JARVIS_ACTION_INSTRUCTIONS` reescrito com fluxo a/b/c: READ_DIR → READ_FILE (um por resposta) → delegação
- Regra explícita: nunca misturar ação + texto de delegação na mesma resposta
- Regra explícita: nunca repetir ação já executada
- Versão: `3.18.0` → `3.19.0`

---

## [3.18.0] — 2026-06-12

### Corrigido — Jarvis somente leitura + Exec auto no Squad

**Jarvis restrito a leitura (fix comportamento incorreto):**
- `JARVIS_ACTION_INSTRUCTIONS` separado em `packages/core/src/squad/agents.ts` — Jarvis só pode usar `READ_DIR` e `READ_FILE`
- SHELL e WRITE_FILE **removidos** do arsenal do Jarvis; essas ações pertencem exclusivamente a `@friday`, `@tester` e agentes executores
- System prompt reforçado: "VOCÊ NÃO ESCREVE CÓDIGO, NÃO EXECUTA COMANDOS, NÃO CRIA ARQUIVOS. Esse trabalho pertence a @friday."
- Jarvis agora lê contexto (README, CURRENT_STATE) e delega imediatamente — não implementa nada diretamente

**Toggle "Exec auto" — execução automática de actions:**
- Novo botão **"Exec auto"** (ícone Zap, cor âmbar) no cabeçalho do chat ao lado do botão "Auto"
- **Padrão ON** — ativo por padrão em todas as sessões novas
- Persistência via `localStorage['squad_auto_execute']`
- Quando ON (sem modo autônomo): após cada resposta do agente, as actions geradas são executadas automaticamente via `executeActionsAuto` — sem precisar clicar em "Executar" por bloco
- Quando ON + modo autônomo: comportamento do loop autônomo original (sem mudança)
- Quando OFF: comportamento anterior — clicar "Executar" manualmente em cada action
- Versão: `3.17.0` → `3.18.0`

---

## [3.17.0] — 2026-06-11

### Adicionado — KB Global do Desenvolvedor + Rebrand NEX-ALS Dark Luxury

**Base de Conhecimento Global (KB Global) — SQLite + IPC:**
- Novo modelo `KnowledgeEntry` no schema Prisma (`knowledge_entries`): `id`, `title`, `content`, `category` (8 categorias), `tags`, `isActive`, `createdAt`, `updatedAt`
- `KnowledgeService` em `packages/core/src/knowledge/knowledge.service.ts` com `list()`, `listActive()`, `create()`, `update()`, `delete()` e `buildContext()` (formata por categoria em markdown)
- 5 IPC handlers em `handlers.ts`: `knowledge:list`, `knowledge:create`, `knowledge:update`, `knowledge:delete`, `knowledge:context`
- Preload e `ipc.ts` atualizados com namespace `knowledge.*`
- **Injeção automática em Squad e AI HUB**: `buildContext()` chamado antes de cada stream start — KB injetada no topo do system prompt de todos os agentes e do AI HUB sem necessidade de modificar cada agente individualmente
- `KNOWLEDGE_CATEGORIES`, `KnowledgeEntrySchema`, `KnowledgeEntry`, `KnowledgeEntryInput` exportados de `@cwm/config`

**Página Conhecimento (KnowledgePage.tsx):**
- CRUD completo: busca full-text, filtro por categoria (8 cores distintas), toggle ativo/inativo, edição inline, formulário lateral para novos itens
- Suporte a tags separadas por vírgula
- Rota `/knowledge` adicionada ao App.tsx e sidebar

**Rebrand NEX-ALS Dark Luxury:**
- Paleta oficial: `#080612` (fundo), `#0D0A24` (card), `#D9A441`/`#F2C879` (dourado), `#B78DFF` (roxo)
- `tailwind.config.ts` reescrito: override do `slate` com cores NEX-ALS, namespace `brand` (dourado), namespace `nex` (purple/gold/bg/card/border), sombras e gradientes customizados
- `index.css` reescrito: Inter via Google Fonts, CSS custom properties `--nex-*`, scrollbar dourada, componentes `.card`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-ghost`, `.input`, `.glass`, `.badge-gold`, utilitários `text-gold`, `glow-gold`, `glow-purple`
- `Layout.tsx` redesenhado: sidebar gradiente escuro, faixa dourada à esquerda, logo `logo-nexals.png` com fallback `⬡`, nome "NEX-ALS IDE" dourado, tagline "Intelligence", botões AI HUB (roxo) e SQUAD (dourado) com glow no hover, nav items com borda dourada ativa, footer com versão dourada
- Versão: `3.16.1` → `3.17.0`

---

## [3.16.1] — 2026-06-11

### Adicionado — Squad: Sincronizar KB, iterações configuráveis, relatório final

**Sincronizar KB do projeto (Task 1):**
- Botão "Sincronizar" na Base de Conhecimento (aparece quando há pasta local selecionada)
- Lê automaticamente: `README.md` → seção Projeto; `docs/CURRENT_STATE.md` ou `CURRENT_STATE.md` → Status atual; `docs/TASKS.md` → appenda no Status; `docs/ARCHITECTURE.md` ou `ARCHITECTURE.md` → Estrutura de arquivos
- Ícone giratório durante carregamento; ignora arquivos ausentes silenciosamente
- Trunca conteúdo em 3000 chars por seção

**Iterações configuráveis (Task 3):**
- Input numérico (5–200) aparece ao lado do botão "Auto" quando modo autônomo está ativo
- Valor padrão: 30; persiste no estado da sessão
- `maxAutoIterRef` garante que o valor correto é usado mesmo dentro de loops async

**Relatório final do ciclo (Task 2):**
- Bubble de sistema ao fim de cada ciclo autônomo: N iterações · arquivos criados · leituras · comandos · erros
- Exibido para qualquer razão de parada (concluído, limite atingido, sem ações)
- Versão: `3.16.0` → `3.16.1`

---

## [3.16.0] — 2026-06-11

### Melhorado — Squad: KB por projeto + delegação autônoma corrigida

**Base de Conhecimento por projeto:**
- KB agora é isolada por projeto: cada `localPath` tem seu próprio slot no localStorage (`squad_knowledge_bases`)
- Ao trocar de pasta (localPath), a KB carrega automaticamente o contexto daquele projeto
- Badge com nome da pasta ativa exibido no cabeçalho da KB
- Sem localPath selecionado → usa slot global `__global__`

**Delegação autônoma corrigida:**
- `rootAgentRef` agora armazena o agente que iniciou a sessão (ex: Jarvis)
- Após qualquer ação executada (mesmo de agente delegado), o resultado SEMPRE retorna ao agente raiz
- Quando agente delegado finaliza sem ações → mensagem de síntese enviada ao agente raiz ao invés de parar o loop
- O orquestrador (Jarvis) permanece no controle durante todo o ciclo autônomo
- Versão: `3.15.9` → `3.16.0`

---

## [3.15.9] — 2026-06-11

### Adicionado — Squad: Base de Conhecimento estruturada

- **"Contexto do Projeto" substituído por "Base de Conhecimento"** — painel com 8 seções estruturadas em accordion:
  - Projeto, Stack, Estrutura de arquivos, Status atual, Convenções, Regras do squad, Habilidades dos agentes, Notas técnicas
- **Templates prontos** — 3 templates pré-preenchidos com um clique: Next.js SaaS, Node.js API, React + Vite
- **Persistência em localStorage** — base de conhecimento salva entre sessões (sem banco, sem sync)
- **Indicador visual por seção** — ponto violeta se a seção tem conteúdo; badge "ativo" verde no cabeçalho
- **Anti-loop por design** — seção "Status atual" e "Estrutura de arquivos" eliminam a necessidade dos agentes explorarem o projeto do zero a cada iteração
- **Seção "Habilidades dos agentes"** — instruções por agente (ex: "Jarvis: lê CURRENT_STATE.md primeiro") injetadas no system prompt
- Versão: `3.15.8` → `3.15.9`

---

## [3.15.8] — 2026-06-11

### Corrigido — Squad modo autônomo: READ_DIR + anti-loop

- **`read_dir` como action type** — agentes agora podem usar `[ACTION:READ_DIR path="..."][/ACTION]` para listar o conteúdo de uma pasta antes de tentar ler arquivos específicos
- **Auto-detecção de diretório em `read_file`** — se o agente chamar `READ_FILE` em um caminho que é uma pasta, o sistema detecta automaticamente via `fs.stat` e lista o conteúdo ao invés de retornar erro
- **Instruções do modo autônomo melhoradas** — adicionadas regras anti-loop: PROIBIDO reler arquivos já no histórico; cada iteração deve produzir progresso concreto; SHELL só aceita comandos reais
- **`READ_DIR` no system prompt** — instruções de execução local e modo autônomo agora ensinam o agente a usar `READ_DIR` para explorar a estrutura antes de READ_FILE
- **`ACTION_INSTRUCTIONS` adicionadas a Jarvis e Shuri** — esses agentes também podem executar ações de leitura/escrita agora
- Versão: `3.15.7` → `3.15.8`

---

## [3.15.7] — 2026-06-11

### Adicionado — Squad: botão "Conta Claude" com modal de uso

- Novo botão 👤 no cabeçalho do painel "Histórico" (lado direito do Squad)
- Abre modal **Conta Claude** com:
  - Email e plano lidos do `.credentials.json` da conta ativa
  - Botão "Atualizar" para recarregar os dados
  - Botão "Abrir claude.ai" que abre `claude.ai/settings` no navegador padrão (via `shell.openExternal`)
- Handler IPC `claude:usage` no main process: lê conta ativa do banco → lê credentials → tenta buscar dados adicionais via `claude.ai/api/bootstrap` com o token OAuth
- Handler IPC `shell:openExternal` com allowlist de domínios permitidos (`claude.ai`, `anthropic.com`)
- Versão: `3.15.6` → `3.15.7`

---

## [3.15.2] — 2026-06-11

### Corrigido — Squad/AI HUB: "Erro ao processar resposta" com Claude Code

- **Causa raiz**: a regex `/authentication/i` no handler de stderr do claude CLI correspondia a mensagens de progresso legítimas (ex: "Initializing authentication context…"), fazendo o processo ser morto antes de produzir qualquer resposta
- **Fix em `ai:stream:start` e `squad:stream:start`** — stderr é agora acumulado em buffer; o erro só é enviado ao renderer **após** o processo fechar com código != 0 **e sem nenhum output em stdout
- Se houve stdout (resposta parcial), envia `done` normalmente
- Mensagem de erro exibe o conteúdo real do stderr (até 200 chars) para facilitar diagnóstico
- Regex de auth refinada: `/not logged in|session expired|please log in|unauthorized/i` (sem `authentication` isolado)

### Adicionado — Squad: botão excluir conversa

- Botão 🗑 aparece ao passar o mouse sobre qualquer sessão no painel "Histórico" (lado direito)
- Clique exclui a sessão do banco e remove da lista; se era a sessão ativa, limpa o chat
- Não interfere com o clique principal (carregar sessão) graças a `stopPropagation`
- Desabilitado durante streaming para evitar conflitos

---

## [3.15.1] — 2026-06-11

### Adicionado — Testes E2E Playwright para página Squad

- Novo arquivo `e2e/tests/05-squad.spec.ts` com **14 testes** cobrindo a SquadPage fullscreen
- **Navegação** — botão SQUAD na sidebar navega para a página Squad (sem Layout)
- **Painel de agentes** — verifica presença dos 8 agentes (Jarvis, Friday, Fury, Shuri, Pepper, Vision, Requis, Tester)
- **Agente ativo** — header mostra Jarvis por padrão; troca de agente atualiza o `h2` do header
- **Chat vazio** — mensagem placeholder "Selecione um agente e envie sua mensagem" visível
- **Input e botão enviar** — textarea visível com placeholder correto; botão Send desabilitado quando vazio e habilitado ao digitar
- **Nova sessão** — botão visível e funcional; reinicia o chat
- **Toggle Execução** — botões VPS e Local visíveis; modo Local exibe campo de pasta
- **Contexto do Projeto** — painel collapsível; textarea aparece ao abrir; indicador verde "Contexto ativo" ao preencher
- **Histórico** — mensagem "Nenhuma sessão ainda." em DB limpo
- **Botão Voltar** — navega de volta ao Dashboard (Layout com `<main>`)

---

## [3.15.0] — 2026-06-10

### Corrigido — Claude Code: continuidade de conversa restaurada

- **`ai:stream:start` e `squad:stream:start`** — prompt com histórico da conversa agora é passado via **stdin** ao processo `claude -p` em vez de argumento CLI
- Antes: `spawn('claude', ['-p', prompt, ...], { shell: true })` — qualquer caractere especial no histórico (aspas, backticks, barras, newlines de blocos de código) era corrompido pelo shell do Windows, fazendo o Claude receber um prompt mutilado e responder sem contexto
- Após o fix: `spawn('claude', ['-p', ...], { shell: false })` + `proc.stdin.write(prompt)` — o conteúdo chega intacto independente de qualquer caractere especial
- DeepSeek e outros providers via API não eram afetados (histórico trafegava em JSON HTTP)

---

## [3.14.0] — 2026-06-10

### Adicionado — Squad: Contexto de Projeto + Execução Local

#### Contexto do Projeto
- Novo campo "Contexto do Projeto" (collapsível) no painel direito do Squad
- Cole README, arquitetura, stack técnica ou qualquer descrição do projeto
- Todos os agentes da sessão recebem esse contexto automaticamente no system prompt
- Indicador verde mostra quando o contexto está ativo (com contagem de caracteres)

#### Execução Local (sem VPS)
- Toggle **VPS / Local** no painel direito do Squad (seção "Execução")
- Modo Local: ações SHELL, READ_FILE e WRITE_FILE rodam no PC local via `child_process` / `node:fs` — sem precisar de VPS
- Botão "Selecionar pasta" abre dialog nativo para escolher a pasta de trabalho (ex: OneDrive/projeto)
- O `cwd` padrão das ações SHELL é a pasta selecionada; `path` em READ/WRITE usa o caminho absoluto do ACTION tag
- `vpsId: '__local__'` como sentinel — detectado no handler `squad:action:execute` para rotear para execução local

---

## [3.13.0] — 2026-06-10

### Corrigido — Autenticação real de contas Claude Code + comando PowerShell

- `claude:accounts:check` agora verifica existência de `.credentials.json` / `credentials.json` no `configDir` em vez de usar `--version` (que sempre retornava OK independente do login)
- Contas não autenticadas mostram status âmbar e o comando correto para PowerShell: `$env:CLAUDE_CONFIG_DIR="..."; claude`
- Botão 📋 de cópia ao lado do comando — evita copiar texto extra acidentalmente
- Versão bumped para 3.13.0

---

## [3.12.0] — 2026-06-10

### Adicionado — Múltiplas contas Claude Code com alternância rápida

Suporte a N contas Claude Pro na mesma máquina. Cada conta tem seu próprio diretório de configuração isolado (`CLAUDE_CONFIG_DIR`). Trocar de conta é um clique — sem logout/login manual.

#### Como funciona
- Cada conta fica em `~/.claude-<nome>-<id>/` — completamente isolada
- O spawn do CLI recebe `CLAUDE_CONFIG_DIR=<dir>` no ambiente, apontando para a conta ativa
- `getActiveClaudeEnv()` — helper centralizado que resolve configDir da conta ativa e monta PATH correto; usado por `claude:check`, `ai:stream:start` e `squad:stream:start`
- Tabela `claude_code_accounts` no SQLite: `id`, `name`, `configDir`, `isActive`, `createdAt`

#### Fluxo para adicionar segunda conta
1. Configurações → Claude Code → **Adicionar conta** → digitar nome (ex: "Conta 2")
2. A IDE gera o `configDir` automaticamente e mostra o comando de autenticação
3. No terminal: `CLAUDE_CONFIG_DIR="<dir>" claude` → fazer login com a segunda conta
4. Clicar **Usar esta** para alternar — todos os streams (AI Hub, IDE chat, Squad) passam a usar a conta selecionada

#### Arquivos modificados
- `packages/db/src/index.ts` — tabela `claude_code_accounts`
- `apps/desktop/src/ipc/handlers.ts` — `getActiveClaudeEnv()`, handlers `claude:accounts:*`, spawns atualizados
- `apps/desktop/src/preload.ts` — novos canais autorizados
- `apps/web/src/lib/ipc.ts` — `ipc.claude.accounts.*`
- `apps/web/src/pages/SettingsPage.tsx` — `ClaudeCodeCard` redesenhado com lista de contas

---

## [3.11.0] — 2026-06-10

### Adicionado — Claude Code como provedor de conta (sem API Key)

Integração do Claude Code CLI instalado localmente como provedor de IA. Usa a conta Claude Pro do usuário via autenticação OAuth já existente no CLI — sem cobrar por token, sem precisar de API Key separada.

#### Como funciona
- O `ai:stream:start` detecta quando o provider é `claude-code` e roteia para um subprocess local em vez de chamar a API diretamente
- O subprocess executa `claude -p "<prompt>" --output-format text --no-color` e transmite stdout como chunks de streaming para o renderer
- O PATH do Electron é enriquecido com o diretório global do npm (`%APPDATA%\npm` no Windows) para garantir que o CLI seja encontrado
- Todo o AI Hub, IDE chat e Squad funcionam transparentemente com a conta Pro

#### Arquivos modificados
- `apps/desktop/src/ipc/handlers.ts`
  - `claudeProcs: Map` para rastrear subprocessos ativos
  - `ai:stream:start` — rota para subprocess quando `effectiveProvider === 'claude-code'`; detecta provider padrão no banco se não informado
  - `ai:stream:cancel` — cancela subprocess (`.kill()`) ou stream normal conforme o tipo
  - `claude:check` — detecta se `claude` CLI está instalado e autenticado; usa `spawn` com `shell: true` e PATH enriquecido
- `apps/desktop/src/preload.ts` — `claude:check` adicionado ao `ALLOWED_CHANNELS`
- `apps/web/src/lib/ipc.ts` — `ipc.claude.check()` adicionado
- `apps/web/src/pages/SettingsPage.tsx` — `ClaudeCodeCard`: detecta CLI, exibe versão e status, botão "Usar como padrão"

#### Instalação (uma vez)
```bash
npm install -g @anthropic-ai/claude-code
claude   # abre browser para login com conta Claude Pro
```

---

## [3.10.0] — 2026-06-10

### Adicionado — Squad: equipe de 8 agentes de IA com execução na VPS e Pipeline

#### Página Squad (`apps/web/src/pages/SquadPage.tsx`)
- 8 agentes especializados: Jarvis (PM/Claude), Friday (Dev/GPT), Fury (Pesquisa/Gemini), Shuri (UX/Claude), Pepper (Marketing/GPT), Vision (Growth/Gemini), Requis (Docs/Claude), Tester (QA/GPT)
- Chat com streaming em tempo real por agente; histórico de sessões persistido em SQLite
- Delegação automática: quando um agente menciona `@outro` na resposta, o segundo agente é invocado automaticamente (profundidade máxima 1, evita loops)
- Menção direta no input: `@friday implementa X` redireciona para Friday sem trocar o agente ativo manualmente
- Layout 3 painéis: lista de agentes (esquerda), chat central, configurações + histórico (direita)

#### Blocos de ação ACTION tags
- Friday e Tester podem gerar blocos executáveis: `SHELL`, `WRITE_FILE`, `READ_FILE`
- Botão "Executar" por bloco — executa via SSH/SFTP na VPS selecionada
- Resultado do comando aparece inline embaixo do bloco (verde = ok, vermelho = erro)
- Conteúdo ACTION é removido do texto da mensagem antes de exibir (fica só o bloco visual)

#### Modo Pipeline (homolog → confirmação → produção)
- Toggle "PIPELINE" no painel direito — ao ativar, exibe seletor de VPS de Produção
- Fluxo: Executar no Homolog → se OK, gate âmbar com botões Aprovar / Rejeitar → Aprovar executa em Prod
- Estados visuais do gate: âmbar (pendente), azul (executando), verde (concluído), vermelho (falha), cinza (rejeitado)
- Proteção: se o campo VPS Prod estiver vazio ("— VPS Prod —"), o Aprovar não executa nada

#### Infraestrutura
- `packages/core/src/squad/agents.ts` — personalidades, prompts e ACTION_INSTRUCTIONS dos 8 agentes
- `packages/core/src/squad/actions.ts` — `parseActions()` e `stripActions()` para processar ACTION tags
- `packages/core/src/squad/squad.service.ts` — serviço de streaming usando AiService existente
- `packages/db/src/index.ts` — tabelas `squad_sessions` e `squad_messages` criadas via DDL no `initializeDatabase()`
- `apps/desktop/src/ipc/handlers.ts` — handlers: `squad:session:*`, `squad:stream:*`, `squad:action:execute`
- `apps/desktop/src/preload.ts` — canais Squad adicionados ao `ALLOWED_CHANNELS`
- `apps/web/src/lib/ipc.ts` — namespace `ipc.squad.*` no renderer; guard null para `window.electron`
- `apps/desktop/src/main.ts` — `setupCSP()` movida para `if (app.isPackaged)` (dev mode sem bloqueio de scripts Vite)
- `apps/web/src/App.tsx` — `ErrorBoundary` adicionado para capturar erros de render sem crashar o app

#### Documentação
- `docs/GUIA_INICIANTE.md` — seção Squad adicionada: agentes, blocos de ação, Pipeline, glossário expandido

---

## [3.9.0] — 2026-06-04

### Adicionado — Melhorias incrementais no IDE

- **Rename inline com F2** — clicar em qualquer entrada no explorador a seleciona (highlight azul); pressionar `F2` abre o input de renomeação inline diretamente, sem precisar do menu de contexto. `Enter` confirma, `Esc` cancela. `selectedEntryRef` + `selectedPath` state; atualiza `onContextMenu` também.
- **Ctrl+Shift+T — Reabrir aba fechada** — `closeTab` empurra o arquivo removido para `closedTabsRef` (stack, máx 15 entradas, preserva conteúdo e estado `savedContent`). `Ctrl+Shift+T` no teclado faz pop do topo e reabre a aba; não reabre se o mesmo caminho já está aberto.
- **Busca em arquivos no Modo Local** — `handleSearch` agora funciona sem VPS: usa `ipc.local.exec('rg ... || findstr ...')` no diretório raiz da pasta aberta; ripgrep prioritário (mais rápido), findstr como fallback Windows; resultados normalizados para caminhos absolutos; display no painel mostra caminho relativo à raiz local. Guard `!vpsId` removido.
- **Diffview no Modo Local** — `handleLocalDiff` roda `git diff -- "<filePath>"` via `ipc.local.exec`; exibe no diff viewer Monaco (mesmo componente do modo VPS) com label relativo à raiz; toast quando sem alterações; botão **Diff** (ícone `GitCommit`) aparece no top bar do IDE quando em modo local e um arquivo está aberto.

---

## [3.8.0] — 2026-06-04

### Adicionado — Autenticação interna multi-usuário

- **`bcryptjs`** adicionado como dependência de `@cwm/core` (hash/verify de senha, puro JS, sem binários nativos)
- **Tabela `app_users`** no SQLite — `id`, `username` (UNIQUE), `passwordHash`, `role` (`admin`|`viewer`), `createdAt`, `updatedAt`; criada por DDL no `initializeDatabase()` existente (não quebra instalações sem usuários)
- **`AuthService`** em `packages/core/src/auth/auth.service.ts` — `createUser`, `validatePassword` (bcrypt compare), `listUsers`, `deleteUser`, `changePassword`, `countUsers`
- **IPC `auth:*`** (8 canais) — `auth:status`, `auth:setup`, `auth:login`, `auth:logout`, `auth:currentUser`, `auth:users:list`, `auth:users:create`, `auth:users:delete`, `auth:users:changePassword`
- **Sessão em memória** no main process (`handlers.ts`) — `session: AppUser | null`; `sessionRequired` inicializado assincronamente a partir do `countUsers()`
- **Modo backward-compat** — instalações sem usuários continuam funcionando sem login; auth é exigido apenas quando `sessionRequired = true` (ao menos 1 usuário no banco)
- **Guards de permissão** — `requireAdmin()` + `requireAuth()` nas operações mutantes: `vps:create/update/delete`, `projects:create/update/delete`, `accounts:create/update/delete`, `settings:update`, `config:export/import`, `notifications:setEnabled`
- **`AuthContext`** — `AuthProvider` + `useAuth()` hook; `auth:status` no mount; `login`, `logout`, `setup`, `refresh`
- **`SetupPage`** — wizard de primeiro uso; cria a conta admin; mostrada quando `needsSetup=true`
- **`LoginPage`** — formulário username + senha; botão show/hide; mostrada quando `sessionRequired && !user`
- **`App.tsx`** refatorado — `AuthProvider` envolve tudo; `AppRoutes` decide entre Setup/Login/app normal baseado no estado do `AuthContext`; spinner durante loading
- **Sidebar (`Layout.tsx`)** — card com avatar, username, role (`Administrador`/`Visualizador`), botão logout (LogOut icon); só visível quando `sessionRequired`
- **Seção "Usuários" em Configurações** — visível apenas para admins; lista usuários com role badge (`ShieldCheck`/`Shield`); botão excluir (bloqueia excluir a si mesmo); formulário criar novo usuário (username + senha + role)

---

## [3.7.0] — 2026-06-04

### Adicionado — LSP multi-linguagem (IDE-22)

- **`apps/web/src/lib/lsp.ts` refatorado** — suporta 4 language servers simultaneamente via WebSocket tunnel:
  - **TypeScript/JavaScript** — porta 6009 (`typescript-language-server`) — existente, sem alteração funcional
  - **Python** — porta 6010 (`pylsp` — `pip install python-lsp-server`)
  - **Rust** — porta 6011 (`rust-analyzer` — `rustup component add rust-analyzer`)
  - **Go** — porta 6012 (`gopls` — `go install golang.org/x/tools/gopls@latest`)
- **`LSP_CONFIGS`** — mapa exportado com `port`, `label`, `name`, `documentSelector` por linguagem
- **`monacoLangToLspKey(monacoLang)`** — helper que converte ID Monaco (`typescript`, `python`, `rust`, `go`) para chave LSP
- **`disconnectAllLSP()`** — desconecta todos os clientes ativos; chamado no unmount do IDEPage
- **Botão LSP dinâmico na status bar** — label muda conforme a linguagem do arquivo aberto: `TS LSP`, `PY LSP`, `RS LSP`, `GO LSP`; oculto para linguagens não suportadas; tooltip inclui porta do túnel necessário
- **Wrapper WebSocket** — mesmo padrão Node.js para todos os language servers (1 liner `node -e "..."` na VPS); documentado nos comentários de `lsp.ts`

---

## [3.6.0] — 2026-06-04

### Adicionado — Testes E2E com Playwright

- **`@playwright/test` + `electron`** adicionados como devDependencies no root `package.json`
- **Scripts** `test:e2e` (requer build prévio) e `test:e2e:ci` (`pnpm build &&` playwright) na raiz
- **`e2e/playwright.config.ts`** — timeout 40s, workers=1 (Electron serial), HTML report, screenshot on failure, trace on retry
- **`e2e/global-setup.ts`** — limpa `e2e/.test-db/` antes de cada run para garantir banco isolado
- **`e2e/helpers/app.ts`** — `launchApp()` inicia Electron com DB SQLite isolado por PID+timestamp + `ELECTRON_RENDERER_URL` apontando para `apps/web/dist/`; `closeApp()` encerra sem deixar processo zumbi
- **`e2e/tests/01-launch.spec.ts`** — 5 testes: título da janela, janela visível, sidebar brand, links de navegação presentes, botão AI HUB
- **`e2e/tests/02-navigation.spec.ts`** — 8 testes: navega para VPS, Projetos, Lançador, Monitor, Configurações, Manual, Diagnóstico; volta ao Dashboard
- **`e2e/tests/03-vps.spec.ts`** — 8 testes: estado vazio, abrir modal (2 formas), fechar, Salvar desabilitado sem campos, criar VPS (aparece na lista), botão Testar, editar VPS
- **`e2e/tests/04-settings.spec.ts`** — 8 testes: seção Notificações, toggle visível, toggle inicia ativado, toggle on/off, seção Provedores IA, Anthropic presente, seção Backup, botões Exportar/Importar

---

## [3.5.2] — 2026-06-04

### Alterado

- **Configurações simplificadas** — removidas as seções "VS Code" (vscodePath, vscodeInsidersPath) e "SSH" (sshKeyPath) da página de Configurações; os campos permanecem no banco com os valores padrão (`code`, `~/.ssh/id_rsa`); a página agora exibe apenas Notificações, Provedores de IA e Backup/Restauração
- **Subtítulo de Configurações** atualizado de "Caminhos, preferências e provedores de IA" para "Preferências e provedores de IA"
- **Manual de Uso atualizado** — versão corrigida para v3.5.1 em todo o Help.tsx; seção Modo Local atualizada com agente autônomo; seção Modo Agente reescrita com novos limites (500 ações, botão Parar, modo local); nova seção Notificações de Sistema adicionada

---

## [3.5.1] — 2026-06-04

### Corrigido

- **`local:writeFile` e `local:touch` criam pastas pai automaticamente** — ao salvar `api/controllers/user.js` em modo local, as pastas `api/` e `api/controllers/` são criadas com `fs.mkdir({ recursive: true })` antes de escrever o arquivo. Antes disso, o agente falhava silenciosamente ao tentar criar arquivos em subpastas inexistentes.

---

## [3.5.0] — 2026-06-04

### Adicionado — Agente Autônomo Local

- **IPC `local:exec`** — novo handler em `handlers.ts` que executa qualquer comando via `child_process.exec` no diretório do projeto local; timeout 120s; retorna `{ success, output }` com stdout+stderr combinados; adicionado ao preload e ao helper `ipc.local.exec(cmd, cwd?)`
- **`execute_command` no modo local** — a ferramenta do agente que antes retornava erro em modo local agora executa via `local:exec`; sem necessidade de VPS; suporta `npm install`, `node`, `build`, criação de pastas, qualquer comando Windows/PowerShell
- **`search_files` no modo local** — usa ripgrep (`rg`) se disponível no PATH, senão `findstr` nativo do Windows; busca em todos os arquivos do projeto sem VPS
- **Agente autônomo sem pausa** — o loop do agente passou de MAX=50 com pausa manual para MAX=500 com auto-continuar; a cada 50 ações uma mensagem de progresso é exibida automaticamente; o agente só para quando a IA retorna texto sem tool calls (conclusão natural) ou o usuário clica **Parar**
- **Botão Parar** — substitui o banner "Continuar"; visível durante execução do agente; interrompe o loop na próxima iteração sem perder o histórico; label "⏹ Parar"
- **Descrição das ferramentas atualizada** — `execute_command` não diz mais "apenas modo remoto"; deixa claro que funciona em ambos os modos

---

## [3.4.0] — 2026-06-04

### Adicionado — Notificações de Sistema

- **`NotificationMonitor`** em `packages/core/src/notifications/notification-monitor.ts` — serviço de background que roda no main process; polling a cada 60s para todas as VPS cadastradas; lê CPU/RAM/Disco via SSH; dispara callback com `NotificationAlert` quando limites ultrapassados; cooldown de 30 min por VPS × tipo para evitar spam; tolerante a VPS offline (falha silenciosa)
- **Limites de alerta** — Disco ≥ 85%, CPU ≥ 90%, RAM ≥ 90%
- **Notificação nativa de erro no AI Hub** — quando o streaming é interrompido por erro e a janela não está focada, exibe notificação nativa do SO com a mensagem do erro
- **IPC `notifications:getEnabled` / `notifications:setEnabled`** — lê e persiste preferência na coluna `notificationsEnabled` da tabela `settings` (SQLite)
- **Toggle em Configurações** — nova seção "Notificações" na página de Settings com switch liga/desliga; estado lido do banco ao carregar; persiste imediatamente ao alternar
- **Migração DDL incremental** — `ALTER TABLE "settings" ADD COLUMN "notificationsEnabled" INTEGER NOT NULL DEFAULT 1` (não quebra instalações existentes)

---

## [3.3.1] — 2026-06-02

### Melhorado

- **Manual de Uso (Help.tsx) — redesign completo** — Mapa do App refeito como grade de cards agrupados por objetivo (Gerenciamento · Desenvolvimento · IA · Deploy · Incidentes); copy orientado a benefício (máx. 1 linha por item, ~62% menos texto); hierarquia visual com dot colorido por grupo e cards destacados para AI Hub, Deploy Assistant e Incident Mode; nova seção "Dois modos de operação" com cards comparativos Remoto vs Local; novo subtítulo do cabeçalho descrevendo o app de forma completa
- **Layout.tsx** — versão na sidebar corrigida de `v3.0.0` para `v3.3.1`

### Adicionado

- **`docs/GUIA_INICIANTE.md`** — guia completo em linguagem acessível para desenvolvedores iniciantes: explica VPS, SSH, SFTP e API Key em termos simples; descreve cada tela do app; mostra o IDE, AI Hub, Modo Agente, Incident Mode e Deploy Assistant com diagramas ASCII; passo a passo do zero para configurar o app; FAQ e glossário de 13 termos técnicos

---

## [3.3.0] — 2026-06-01

### Adicionado

- **Project Memory UI** — `ProjectMemoryService` em `packages/core`; tabela `project_memory` (por VPS ou global); IPC `memory:list/save/delete/build`; aba **Memória** no painel lateral do AI Hub com CRUD inline (criar, editar, excluir blocos de contexto); filtro por VPS
- **Context Selector UI** — aba **Contexto** no painel lateral do AI Hub; seletor de VPS opcional; checkboxes: Logs, Docker, PM2, Métricas da VPS, Memória do projeto; ao enviar uma mensagem, os itens marcados são buscados em tempo real e injetados no `systemPrompt` da chamada de streaming; itens VPS-dependentes desabilitados quando nenhuma VPS está selecionada
- **Painel lateral direito** do AI Hub — colapsável (`PanelRightClose/PanelRightOpen`), duas abas: Contexto + Memória
- **ToolExecutor confirmação** no agente IDE — `execute_command` com padrões destrutivos (`docker rm/stop/restart`, `pm2 delete/stop/restart`, `git reset --hard`, `rm -rf`, `DROP TABLE`, `truncate`) exibe modal de confirmação; usuário precisa digitar **CONFIRMO** para autorizar; cancelar retorna aviso ao agente; funciona em modo VPS (não local)

---

## [3.2.0] — 2026-06-01

### Adicionado — Deploy Assistant

- **`createDeployWindow(vpsId, vpsName)`** em `main.ts` — janela 1200×800; IPC `window:openDeploy`; rota `#/deploy/:vpsId/:vpsName`
- **`DeployAssistantPage`** — layout 2 colunas:
  - **Esquerda:** formulário de descrição do deploy + campo de diretório do projeto; geração de plano via IA (streaming); lista de passos com status inline; botões "Executar Tudo" e "Executar" por passo; plano de rollback gerado automaticamente se um passo falhar
  - **Direita:** log de execução em tempo real (terminal-style); smoke test HTTP (`curl -s -o /dev/null -w "%{http_code}"`) com resultado de status code e latência
- **Parser de plano** — aceita resposta da IA em JSON (bloco ```json) ou formato markdown com `### Passo N` + `**Comando:**` + `**Risco:**`; fallback progressivo
- **Tiers de risco** — `low` executa direto; `medium` executa direto; `high` abre modal de confirmação antes de cada passo (ex: `docker stop`, `git reset --hard`, `rm -rf`)
- **Rollback automático** — ao falhar, envia os passos já executados à IA e pede plano de rollback; exibe e executa com botão "Executar Rollback"
- **Botão Rocket** no Launcher (por VPS) e na top bar do IDEPage (modo VPS)

---

## [3.1.0] — 2026-06-01

### Adicionado — Incident Mode

- **`createIncidentWindow(vpsId, vpsName)`** em `main.ts` — abre uma janela Electron dedicada (1440×900) em modo de emergência, título `🚨 INCIDENT MODE — {nome}`; IPC `window:openIncident`
- **`IncidentModePage`** (`/incident/:vpsId/:vpsName`) — layout 2×2 com 4 painéis:
  - **Diagnóstico IA** (top-left) — chat com streaming; ao montar, aguarda 1.5s para dados carregarem e dispara diagnóstico automático com contexto completo (CPU/RAM/Disco, Docker, PM2, logs recentes); continua como chat livre após o diagnóstico inicial
  - **Logs** (top-right) — campo de comando editável (default: `journalctl -n 100`); botão de refresh; auto-scroll para o final
  - **Docker + PM2** (bottom-left) — tabelas com estado de containers e processos; CPU%, RAM, restarts; cores: verde=ok, vermelho=problema
  - **Terminal de emergência** (bottom-right) — input de comando livre via `terminal:exec`; output acumulado com scroll
- **Top bar vermelha** — badge `🚨 INCIDENT MODE` pulsante; mini monitor inline (CPU/RAM/Disco/Uptime); botão Atualizar tudo; botão fechar
- **Botão `Siren`** no Launcher (por VPS) e na top bar do IDEPage (modo VPS) para abrir o Incident Mode
- **Auto-refresh 30s** para stats, docker e pm2

---

## [3.0.0] — 2026-06-01

### Adicionado — NEX-ALS AI HUB

- **Arquitetura multi-provider desacoplada** — `BaseProvider` abstrata com `sendMessage()`, `streamMessage()`, `validateKey()`, `listModels()`; providers isolados em `packages/core/src/ai/providers/`: `AnthropicProvider`, `OpenAICompatProvider` (OpenAI/DeepSeek/Groq/Mistral/xAI), `GeminiProvider`, `OpenRouterProvider`, `OllamaProvider`
- **KeyStore** (`key-store.ts`) — interface injetável para troca da implementação de armazenamento de chaves; implementação padrão em AES-256 SQLite; interface compatível com keytar para migração futura
- **ProviderManager** (`hub/provider-manager.ts`) — resolve o provider correto (padrão ou por nome), instancia a classe certa, consulta `KeyStore`
- **ModelRegistry** (`hub/model-registry.ts`) — catálogo de modelos por provider; cache 24h; `listModels()` dinâmico para OpenAI, OpenRouter e Ollama; estático para demais
- **ResponseStreamer** (`hub/response-streamer.ts`) — executa `streamMessage()` de forma assíncrona; emite chunks via callback; suporta cancelamento via `AbortController`; retorna `streamId`
- **ContextManager** (`hub/context-manager.ts`) — monta `context_block` a partir de `ContextSelection` (arquivo, seleção, árvore, código-fonte, logs, terminal, docker, pm2, vps, git diff, memória); prioridade de corte configurável quando estoura `maxChars` (80K default)
- **PromptBuilder** (`hub/prompt-builder.ts`) — templates de system prompt por modo: `chat`, `agent`, `sysadmin`, `deploy`, `incident`; injeta memória e contexto automaticamente
- **ConversationManager** (`hub/conversation-manager.ts`) — CRUD de sessões de chat persistidas em SQLite (`ai_conversations`, `ai_messages`); suporte a pin, título editável, paginação
- **ToolExecutor** (`hub/tool-executor.ts`) — tiers de autorização: `read` / `write` / `exec_safe` / `exec_dangerous`; `exec_dangerous` em PROD requer confirmação; log em `tool_execution_log`
- **AiService refatorado** — usa `ProviderManager.build()` em `chat()`, `chatAgent()`, `testProvider()`; novos métodos: `chatWithContext()`, `startStream()`, `cancelStream()`, `getModels()`; `conversations` getter para acesso ao `ConversationManager`
- **4 novas tabelas** em `initializeDatabase()`: `ai_conversations`, `ai_messages`, `project_memory`, `tool_execution_log`
- **Novos canais IPC**: `ai:models`, `ai:chatCtx`, `ai:stream:start`, `ai:stream:cancel`, `ai:stream:chunk` (push), `ai:conv:*` (8 handlers de conversa)
- **AIHubPage** (`/ai-hub`) — sidebar com histórico de conversas (pin, delete, edição de título), seletor de provider + modelo dinâmico, streaming token a token, cancelamento, cópia de mensagens
- **Botão AI HUB** na sidebar principal com destaque roxo (`Sparkles`)

---

## [2.8.0] — 2026-06-01

### Adicionado

- **Multi-monitor** — qualquer VPS pode ser aberta em uma janela Electron independente; `createIdeWindow(vpsId, vpsName)` em `main.ts` cria um `BrowserWindow` com a rota `#/ide/:vpsId/:vpsName` via HashRouter — dev: `loadURL` com hash; prod: `loadFile + { hash }`;  botão `ExternalLink` (⎋) no Lançador ao lado de cada botão IDE e na top bar do IDE (modo VPS); cada janela tem sessões SSH, SFTP, terminais e estado React completamente independentes; título da janela mostra o nome da VPS; IPC `window:openIde` registrado em `main.ts` (não em `handlers.ts` — não é serviço de negócio)

---

## [2.7.0] — 2026-06-01

### Adicionado

- **Snapshot/Rollback do Agente** — antes de cada `write_file`, o agente lê e salva o conteúdo original do arquivo em `agentSnapshotsRef` (apenas na primeira escrita por arquivo por sessão); painel laranja **📦 Snapshots** aparece no chat listando todos os arquivos modificados com botão **↩ Restaurar** por arquivo; clicar restaura o conteúdo original via SFTP ou `node:fs` e reabre o arquivo no editor; botão **✕ descartar** remove todos os snapshots da sessão; snapshots são limpos automaticamente ao iniciar nova conversa com o agente (preservados ao clicar em "Continuar"); arquivos **novos** criados pelo agente (sem conteúdo original) não geram snapshot

---

## [2.6.0] — 2026-06-01

### Adicionado

- **Modo Agente — 50 iterações + botão Continuar** — limite aumentado de 15 para 50 iterações; quando atingido, o histórico completo da conversa API (`apiMessages`) é preservado em `agentResumeRef`; um banner âmbar aparece no chat com o botão **▶ Continuar** que retoma o loop sem perder contexto; `handleAgentContinue` reabre a sessão SFTP e chama `runAgentLoop` com as mensagens salvas; o agente é marcado como não-pausado assim que termina naturalmente

---

## [2.5.0] — 2026-06-01

### Adicionado

- **Verificação de fingerprint SSH** — na primeira conexão com uma VPS, o fingerprint do host (SHA-256 da chave pública) é armazenado automaticamente no SQLite; nas conexões seguintes, o fingerprint é comparado e a conexão é **rejeitada** se mudar (possível ataque MITM); mensagem de erro clara com instrução para limpar via interface; aplica-se a todos os serviços SSH: VpsService, TerminalService, SftpService, GitService, TunnelService
- **Badge "Host verificado"** na listagem de VPS — ícone `ShieldCheck` verde quando fingerprint está armazenado; `ShieldOff` cinza quando não há fingerprint; tooltip exibe o fingerprint completo no formato `SHA256:...`
- **Botão "Limpar fingerprint"** (ícone âmbar `ShieldOff`) em cada card de VPS — abre confirmação e limpa o fingerprint armazenado; na próxima conexão, o novo fingerprint é aceito e armazenado automaticamente
- **`buildHostVerifier` helper** em `packages/core/src/ssh/ssh-connect.ts` — função centralizada que fabrica o `hostVerifier` para ssh2; usa `SHA256(rawKey).base64` para compatibilidade com ssh-keyscan
- **`VpsService.clearFingerprint(id)`** — método público para limpar o fingerprint via IPC `vps:clearFingerprint`
- **Campo `sshHostFingerprint TEXT`** na tabela `vps_servers` — adicionado via migração incremental em `initializeDatabase()`

---

## [2.4.0] — 2026-06-01

### Adicionado

- **Analisador de Disco por VPS** — botão "Analisar disco" em cada card do Monitor; abre modal com 4 seções: maiores diretórios (`du -sh /* | sort -rh | head -20`), uso Docker (`docker system df`), logs PM2 (`~/.pm2/logs/`) e logs do sistema (`/var/log/*`); cores por tamanho (verde < 1GB · amarelo 1-5GB · vermelho > 5GB); botão fica vermelho com ⚠ quando uso do disco ≥ 85%; IPC `monitor:diskUsage`; reutiliza `TerminalService.exec`

---

## [2.3.0] — 2026-05-31

### Adicionado

- **Modo Agente (AI Agent para VPS)** — ativa tool use no chat do IDE via botão 🤖; Claude pode chamar `read_file`, `write_file`, `list_directory`, `execute_command`, `search_files` por conta própria; agentic loop com até 15 iterações; display inline de cada tool call com input/output; suporte a Anthropic (tool use nativo) e todos os provedores OpenAI-compatible; Gemini não suportado; sessão SFTP aberta automaticamente durante o loop e fechada ao final
- **`AiService.chatAgent`** — novo método em `packages/core/src/ai/ai.service.ts`; normaliza formatos Anthropic e OpenAI-compatible em interface única; IPC `ai:chatAgent`; `ai:chatAgent` adicionado ao preload

### Corrigido

- **Chat idioma** — system prompt agora instrui Claude a responder sempre em português brasileiro
- **Botão "Aplicar todas as alterações"** — `root` nulo causava paths inválidos; agora valida o diretório raiz antes de salvar; mostra erro claro se não houver pasta aberta
- **Detecção de nomes de arquivos** — `extractFilenameHint` com 6 padrões (listas numeradas, bullet, hash, backtick, negrito)
- **Contexto do chat local** — incluía apenas árvore e docs; agora lê código-fonte (até 80KB, arquivos até 6KB cada)
- **"Aplicar" sobrescrevia todos os arquivos** — botões agora são "▶ arquivo.ts" + "Salvar como…" sempre visíveis e independentes

---

## [2.2.0] — 2026-05-31

### Adicionado

- **Histórico de Lançamentos** — página `/history` na sidebar; tabela com filtros por VPS, projeto e status (sucesso/erro); exibe timeAgo, data/hora, VPS, projeto e mensagem de erro; taxa de sucesso no header; IPC `history:list` com filtros via Prisma

---

## [2.1.0] — 2026-05-31

### Adicionado

- **Logs Viewer** — aba "Logs" no painel inferior do IDE; campo de comando livre; presets rápidos (syslog, nginx error, nginx access, PM2 all, journald); modo Watch com auto-refresh a cada 3 segundos; scroll automático para o final; reutiliza `terminal:exec` sem novo IPC

---

## [2.0.0] — 2026-05-31

### Adicionado

- **PM2 / Process Manager** — aba "PM2" no painel esquerdo do IDE; lista processos com nome, status, CPU%, RAM e número de reinicializações; ações: Restart, Stop, Start, Logs (overlay inline), Excluir; badge mostra N processos online; IPC `pm2:list/restart/stop/logs/delete` via `pm2 jlist` SSH exec; strip ANSI automático

---

## [1.9.0] — 2026-05-31

### Adicionado

- **Docker Explorer** — aba "Docker" no painel esquerdo do IDE; lista containers (nome, imagem, status, ports); ações: Start, Stop, Logs (overlay inline), Remover (confirmação); badge mostra N containers rodando; IPC `docker:list/start/stop/logs/remove` via SSH exec com formato JSON

---

## [1.8.0] — 2026-05-31

### Adicionado

- **Chat IA — API direta** — IDEPage detecta automaticamente se há provedor de IA configurado nas Settings; se sim, usa `ai:chat` (chamada HTTP direta, 2-5s) em vez de `claude -p` via SSH (15-30s); o histórico completo da conversa é enviado ao provedor; o cabeçalho do chat exibe o modo ativo ("Anthropic", "DeepSeek", "claude -p (SSH)", etc.); fallback transparente: sem provedor configurado, comportamento anterior é mantido; funciona sem VPS quando há provedor

### Alterado

- Tooltip do botão "Claude" na top bar passa a indicar o modo ativo
- Mensagem do estado vazio do chat diferencia API direta de SSH
- Guard `handleChatSend` permite enviar sem VPS quando há provedor IA

---

## [1.7.0] — 2026-05-31

### Adicionado

- **Provedores de IA multi-provider** — suporte a 7 provedores configuráveis: Anthropic (Claude), DeepSeek, OpenAI, Gemini, Groq, Mistral/Codestral, xAI Grok
- **AiService** — `packages/core/src/ai/ai.service.ts`; CRUD de providers + chat; usa `fetch` nativo (Node.js 22); cada provedor tem implementação separada: Anthropic (API própria), Gemini (API própria), todos os demais via formato OpenAI-compatible
- **Tabela `ai_providers`** — SQLite via DDL incremental em `initializeDatabase()`; campos: `provider` (PK), `apiKey` (AES-256), `model`, `enabled`, `isDefault`, `updatedAt`; sem migrations automáticas, sem quebrar instalações existentes
- **IPC** — `ai:list`, `ai:save`, `ai:delete`, `ai:test`, `ai:chat`; adicionados ao preload e ao `ipc.ts`
- **Settings — Provedores de IA** — nova seção na página de Configurações com cards expansíveis por provedor; cada card: toggle habilitado/padrão, seletor de modelo, input de API Key (com show/hide), botão Testar conexão, botão Remover; indicadores de status ("Configurado", "Padrão"); dica sobre custo (Groq grátis, DeepSeek o mais barato)
- **Tipos em `@cwm/config`** — `AiProviderConfig`, `AiChatMessage`, `AiChatInput`

### Segurança

- API Keys armazenadas criptografadas AES-256-CBC (mesmo sistema das senhas SSH)
- Chave mascarada na listagem (`••••••••1234`); chave plain usada apenas no momento da chamada HTTP
- Salvar sem alterar a key (campo vazio ou com mask) mantém a key existente — sem risco de apagar acidentalmente

---

## [1.6.0] — 2026-05-31

### Adicionado

- **Monitor de VPS** — nova página `/monitor` acessível pela sidebar; exibe cards por VPS com métricas coletadas via SSH exec: CPU (load average 1/5/15min + % calculado sobre núcleos), RAM (usado/total em MB), Disco (`/` — usado/total/disponível/%), Uptime; auto-refresh a cada 30s; refresh manual por card ou global; cores adaptativas: verde < 60%, amarelo 60-84%, vermelho ≥ 85%; loading skeleton durante primeira carga; estado de erro ao VPS offline
- **IPC `monitor:getStats`** — executa comando SSH único que retorna LOAD/CORES/MEM/DISK/UPTIME; parseia saída com fallbacks para comandos ausentes; reutiliza `TerminalService.exec` sem duplicar lógica SSH
- **Nav "Monitor"** com ícone `BarChart3` na sidebar

---

## [1.5.0] — 2026-05-31

### Adicionado

- **IDE-15 · Split editor** — botão `⊟` na top bar divide o editor em dois painéis horizontais (50/50); cada painel tem sua própria barra de abas; Ctrl+S salva no painel focado; clicar num painel muda o foco; abrir arquivo vai para o painel ativo; fechar split com o mesmo botão
- **IDE-16 · TypeScript LSP** — `monaco-languageclient` v10 conecta via WebSocket ao `typescript-language-server` da VPS; botão `TS LSP` na status bar (verde quando ativo); requer túnel SSH na porta 6009 e `typescript-language-server` instalado na VPS; `apps/web/src/lib/lsp.ts`
- **IDE-17 · Remote Port Forwarding** — nova aba "Portas" no painel esquerdo; cria túneis `localhost:X → VPS:Y` via `ssh2.forwardOut`; lista túneis ativos; botão "Abrir no navegador"; fechar túnel; `TunnelService` em `packages/core/src/tunnel/`; IPC `tunnel:open`, `tunnel:close`, `tunnel:list`
- **IDE-18 · Depuração remota DAP** — botão `⬡ DAP` na status bar; abre janela Electron com Chrome DevTools Protocol apontado para `ws://localhost:9229`; requer túnel 9229→9229 e `node --inspect` na VPS; `apps/web/src/lib/dap.ts`; IPC `debug:openDevTools`

### Fluxo de uso IDE-16 (LSP):
```
VPS: npm i -g typescript-language-server typescript ws websocat
     websocat --text -E tcp-l:0.0.0.0:6009 exec:typescript-language-server\ --stdio
IDE: Painel Portas → túnel 6009→6009 → status bar "TS LSP" → clique
```

### Fluxo de uso IDE-18 (DAP):
```
VPS: node --inspect=0.0.0.0:9229 server.js
IDE: Painel Portas → túnel 9229→9229 → status bar "⬡ DAP" → clique
```

---

## [1.4.0] — 2026-05-31

### Adicionado

- **Packaging Windows** — `pnpm package:win` gera instalador NSIS (`.exe`) + versão portátil (`.exe` standalone) com wizard de instalação (diretório configurável, atalho no Desktop e Start Menu, licença); config `publish` aponta para GitHub Releases (fasterdrible-lab/HEXAGON-IDE); pasta `apps/desktop/build/` com `LICENSE.txt` e instrução de ícone
- **Import/Export de configurações** — botões "Exportar backup (.json)" e "Importar backup" na página de Configurações; exporta todas as VPS, projetos e contas cadastradas em JSON com timestamp; importa de forma não-destrutiva (não sobrescreve registros existentes); senhas SSH não exportadas; IPC `config:export` e `config:import` com dialog nativo de salvar/abrir arquivo
- **SSH passphrase** — chave SSH com passphrase agora funciona: quando há chave privada configurada, o campo "Senha SSH" vira a passphrase da chave (em vez de senha do servidor); suporte ao SSH agent do Windows via named pipe `\\.\pipe\openssh-ssh-agent` (além de `SSH_AUTH_SOCK` no Unix)
- **Auto-update** — `electron-updater` instalado; em produção verifica atualizações silenciosamente ao iniciar via `autoUpdater.checkForUpdatesAndNotify()`; publicação via GitHub Releases configurada
- **Testes automatizados** — Vitest adicionado aos pacotes `@cwm/config` e `@cwm/core`; 18 testes passando: encryptPassword/decryptPassword, Zod schemas (VPS, Project, ClaudeAccount, Settings), parsing de status Git (staged/unstaged/untracked, ahead/behind)

### Alterado

- Descrição do `@cwm/desktop` atualizada para "NEX-ALS IDE — gerenciador de ambientes VPS com IDE integrado"
- Scripts `package:win` e `package:dir` adicionados ao `apps/desktop/package.json` e `pnpm package:win` na raiz
- `pnpm test` roda os testes dos pacotes

---

## [1.3.2] — 2026-05-31

### Adicionado

- **Chat · Botões Copiar e Aplicar** — mensagens do Claude com blocos de código ganham botão "Copiar" (clipboard) e "▶ Aplicar em arquivo.tsx" (substitui conteúdo do arquivo ativo no Monaco, marca como dirty para revisão com Ctrl+S)
- **Chat · Salvar como** — quando não há arquivo aberto, botão vira "▶ Salvar como…" com input inline para digitar caminho relativo; cria o arquivo no projeto, abre no editor e atualiza a tree
- **Chat · Colar print (Ctrl+V)** — textarea aceita paste de imagem; badge "📷 Print anexado" confirma recebimento; imagem enviada inline no prompt para o Claude
- **Chat · Contexto automático do projeto local** — ao usar o chat em modo local, envia automaticamente: árvore de pastas (2 níveis, ignorando `node_modules`/`.git`/etc.), arquivos-chave (`CLAUDE.md`, `README.md`, `docs/TASKS.md`, `docs/CURRENT_STATE.md`, `docs/ARCHITECTURE.md`, `CHANGELOG.md`) e conteúdo do arquivo aberto no editor
- **Chat · Instrução offline** — prompt inclui aviso explícito para Claude não tentar ler arquivos do disco e usar apenas o conteúdo fornecido inline
- **Chat · Timer de espera** — exibe "Claude pensando… Xs" com contagem durante o processamento
- **IPC `clipboard:readImage`** — main process usa `nativeImage` do Electron para ler imagem do clipboard; retorna path do arquivo temp PNG

### Corrigido

- **Chat · `stdin` warning** — adicionado `< /dev/null` no comando `claude -p` para suprimir aviso de stdin
- **Chat · Prompt via arquivo SFTP** — prompt escrito em `/tmp/hexagon_chat_<ts>.txt` via SFTP antes de executar, evitando escaping de shell e limite de tamanho de linha de comando
- **Chat · `--image` não suportado** — flag `--image` removida (não existe no `claude -p`); imagem enviada como bloco base64 inline no prompt
- **Chat · Contexto do projeto local** — adicionada instrução explícita para Claude usar conteúdo inline e não tentar acessar o filesystem da VPS
- **Botão Aplicar** — mostra nome do arquivo alvo ("Aplicar em arquivo.tsx") em vez de label genérico; exibe erro claro quando nenhum arquivo está aberto
- Timeout `terminal:exec` aumentado para 120s para respostas longas do Claude

### Limitações conhecidas

- `claude -p` não processa imagens como visão real (multimodal); para análise de imagem, prefer colar o **texto** do erro no chat
- Para suporte multimodal completo e respostas mais rápidas, seria necessário API Key da Anthropic

---

## [1.3.1] — 2026-05-30

### Corrigido / Melhorado

- **Chat Claude em modo local** — chat agora disponível ao editar pastas locais (OneDrive); seletor de VPS no header do painel permite escolher onde `claude -p` executa sem abrir a VPS no IDE
- **Botão Claude mais visível** — substituído ícone invisível por botão com label "Claude" + cor roxa na top bar de ambos os modos
- `chatVpsId` centraliza qual VPS é usada em `handleChatSend`; no modo remoto usa a VPS atual; no modo local carrega lista de VPS via `ipc.vps.list()`

---

## [1.3.0] — 2026-05-30

### Adicionado

- **IDE-19 · Badge PRODUÇÃO** — indicador vermelho pulsante na top bar sempre que o IDE estiver conectado a uma VPS remota; badge verde "Local" no modo local
- **IDE-20 · Modo Local** — nova rota `/ide/local`; botão "Abrir pasta local" no Lançador; dialog nativo do SO para escolha de pasta; IPC `local:*` completo (readdir, readFile, readFileBase64, writeFile, mkdir, delete, rename, touch); filesystem abstraction (`fsReaddir`, `fsReadFile`, etc.) que alterna entre SFTP e `node:fs/promises`; terminal e painel Git ocultos no modo local; badge verde "Local" na top bar
- **IDE-21 · Chat Claude via SSH** — painel lateral direito redimensionável (botão `Bot` na top bar, só modo remoto); contexto do arquivo ativo enviado automaticamente (até 3000 chars); executa `claude -p '...'` na VPS via `terminal:exec` com timeout de 60s; histórico de mensagens com bolhas visuais; Enter = enviar, Shift+Enter = nova linha; botão limpar histórico

### Alterado

- `terminal:exec` IPC aceita `timeout?` opcional (usado pelo chat para aguardar Claude)
- `ipc.terminal.exec()` atualizado para repassar `timeout`
- `setupIpcHandlers()` agora recebe `win?: BrowserWindow` para o dialog de pasta nativa
- `createWindow()` chamado antes de `setupIpcHandlers()` no main process

---

## [1.2.0] — 2026-05-30

### Alterado

- **Repositório renomeado** — `Claude-Workspace-Manager` → `HEXAGON-IDE` no GitHub (`https://github.com/fasterdrible-lab/HEXAGON-IDE.git`)
- Remote local atualizado (`git remote set-url origin`)
- `CLAUDE.md` e `AGENTE.md` reescritos para refletir o nome oficial **NEX-ALS IDE** e incluir a URL do repositório
- Versão bumped `1.1.1 → 1.2.0` (marco: IDE completo + rename oficial)

---

## [1.1.1] — 2026-05-30

### Adicionado

- **IDE-08 · Find/Replace (Ctrl+H)** — `addCommand` em `handleEditorMount` registra explicitamente `editor.action.startFindReplaceAction`, garantindo que o Electron não intercepte o atalho antes do Monaco
- **IDE-09 · Go to Line (Ctrl+G)** — `addCommand` em `handleEditorMount` registra explicitamente `editor.action.gotoLine`, garantindo que o atalho funcione mesmo com foco fora do editor
- **IDE-12 · Painel de Problemas** — aba "Problemas" no painel inferior (ao lado de "Terminal"); lista erros/avisos do Monaco via `onDidChangeMarkers`; badge com contagem colorido (vermelho/âmbar); clique em item navega para a linha (`jumpToLine`); ícone `Check` quando não há problemas

### Corrigido

- Import `WifiOff` não utilizado removido (TS6133)
- Parâmetro anônimo do `markers.map` tipado como `import('monaco-editor').editor.IMarker` (TS7006)

### Observação técnica

- **IDE-10 (Breadcrumbs)** — `breadcrumbs` não existe em `IStandaloneEditorConstructionOptions`; é propriedade exclusiva do VS Code completo. Tarefa marcada como N/A.

---

## [1.1.0] — 2026-05-30

### Adicionado

- **IDE-11 · Preview de imagem** — PNG, JPG, JPEG, GIF, WebP, ICO abrem no editor como `<img>` (background escuro, centralizado, max-height 75%); leitura via `sftp:readFileBase64`; MIME detectado por extensão; tab integrada ao sistema de tabs existente
- **IDE-13 · Copiar/Duplicar arquivos** — context menu expandido com "Duplicar" (`cp -rp` via SSH, nome `_copia`), "Copiar caminho" (clipboard) e separadores visuais; funciona para arquivos e diretórios
- **IDE-14 · Auto-refresh da tree** — refresh da pasta pai ao salvar (`Ctrl+S`); polling de 30s atualiza `/root` e todos os diretórios expandidos sem bloquear UI (usa `expandedFoldersRef` para evitar re-criação de interval)
- `SftpSession.readFileBase64(path)` — lê arquivo remoto como Buffer e retorna string base64
- IPC `sftp:readFileBase64` + preload whitelist + helper `ipc.sftp.readFileBase64`

### Alterado

- `BIN_EXT` removeu `png,jpg,jpeg,gif,webp,ico` (agora preview); adicionado `IMG_PREVIEW` set separado
- Context menu: 2 itens → 4 itens com separadores

---

## [1.0.9] — 2026-05-30

### Adicionado

- **IDE-02 · Tree view hierárquica** — explorer expandível inline por pasta (lazy load por pasta); chevron rotaciona ao expandir; indentação por profundidade; `activeDir` rastreia a pasta ativa para criação de arquivos/pastas; `flattenTree()` produz lista plana a partir do estado de expansão
- **IDE-03 · Find in Files (Ctrl+Shift+F)** — painel "Busca" no switcher esquerdo; input de query + filtro glob (ex: `*.ts,*.tsx`) + toggle case-sensitive; executa `grep -rn` via SSH (`terminal:exec`); resultados agrupados por arquivo com número de linha; click abre o arquivo e revela a linha no Monaco
- **IDE-05 · Múltiplas abas de terminal** — tab bar com título, indicador de status colorido (verde/vermelho/piscando), botão `+` para novo terminal, `×` para fechar; cada aba é uma sessão SSH independente (`ipc.terminal.open`); containers xterm montados via callback ref, visibilidade via `display: block/none` (preserva histórico); `switchTermTab` re-fits ao trocar
- `TerminalService.exec(vpsId, cmd, timeout)` — SSH exec one-shot para comandos não-interativos
- IPC `terminal:exec` + whitelist preload + helper `ipc.terminal.exec`

### Alterado

- IDEPage: `curPath`+`entries` substituídos por `rootEntries`+`expandedFolders`+`folderChildren`+`loadingFolders`+`activeDir` (estado de árvore hierárquica)
- IDEPage: terminal único → array `termTabs` + `termInstancesRef` Map (multi-tab)
- IDEPage: painel esquerdo tem 3 tabs (Files, Search, Git) em vez de 2
- `TerminalService.openShell` refatorado para usar `sshConnect()` privado (DRY)

---

## [1.0.8] — 2026-05-30

### Adicionado

- **IDE-07 · Paleta de comandos** — `Ctrl+Shift+P` abre a paleta nativa do Monaco; botão `⌘` na top bar; `Escape` fecha diff
- **IDE-01 · Criar arquivo** — botão `FilePlus` no explorer; input inline com `Enter`/`Escape`; arquivo aberto automaticamente após criação; IPC `sftp:touch` + `SftpSession.touch()`
- **IDE-04 · Git integrado** — painel Source Control completo no NEX-ALS IDE:
  - Tab "Git" na esquerda com badge de contagem de alterações
  - Status: branch atual, commits ahead/behind (↑↓)
  - Seções: Staged, Alterações, Não rastreados — com ícones de status (M/A/D/U)
  - Stage/Unstage por arquivo ou "Stage all" / "Unstage all"
  - Diff viewer: clique no arquivo → diff colorido no Monaco (linguagem `diff`)
  - Commit: textarea de mensagem + botão com contagem de arquivos staged
  - Push / Pull com feedback de resultado
  - Branch e contagem de alterações na **status bar** inferior
- **Status bar melhorada**: branch git (clicável → abre painel git), `Ln X, Col Y` ao editar, hint `Ctrl+Shift+P`
- **Cursor position tracking**: `editor.onDidChangeCursorPosition` atualiza status bar em tempo real
- `GitService` em `packages/core/src/git/git.service.ts` com: `status`, `diff`, `add`, `restore`, `commit`, `push`, `pull`, `log`
- IPC channels: `git:status`, `git:diff`, `git:add`, `git:restore`, `git:commit`, `git:push`, `git:pull`, `git:log`
- Tipos `GitStatus`, `GitFileStatus`, `GitCommit` adicionados ao `@cwm/config`

### Alterado

- `IDEPage.tsx`: painel esquerdo vira switcher Files/Git; adicionado `GitFileRow` sub-component
- Painel de arquivos: botão `FilePlus` ao lado do `FolderPlus`

---

## [1.0.7] — 2026-05-30

### Corrigido

- **Bloqueador crítico: `require('electron')` retornava npm stub no Windows + pnpm**
  - `app.isPackaged` acessado no nível do módulo causava crash antes de `app.whenReady()`
  - Corrigido: removida declaração `isDev` de nível de módulo; usa `ELECTRON_RENDERER_URL` env var (setada pelo electron-vite) ou fallback para `http://localhost:5173` quando `!app.isPackaged`
- **`ELECTRON_RUN_AS_NODE=1` no ambiente de execução quebrava Electron**
  - Electron verifica a EXISTÊNCIA da var (qualquer valor, inclusive `"0"`) para rodar como Node.js puro sem API Electron
  - Corrigido: `scripts/dev.js` deleta `ELECTRON_RUN_AS_NODE` do `process.env` antes de invocar o `concurrently`, eliminando a herança nos processos filhos
- `pnpm dev` substituído por `node scripts/dev.js` no package.json raiz

### Adicionado

- `cross-env ^7.0.3` como devDependency (auxílio a outras abordagens cross-platform)
- `scripts/dev.js` — launcher Node.js que limpa `ELECTRON_RUN_AS_NODE` e inicia o concurrently
- Script `dev:inner` no package.json raiz para separar lógica do launcher

---

## [1.0.6] — 2026-05-30

### Adicionado

- **NEX-ALS IDE** — layout IDE completo com três painéis integrados e redimensionáveis:
  - Explorer SFTP (esquerda) — navega, cria pastas, renomeia e exclui arquivos na VPS via SFTP
  - Monaco Editor (centro) — edição com syntax highlighting, IntelliSense, tabs múltiplas e Ctrl+S
  - Terminal SSH xterm.js (baixo, togglável com Ctrl+\`) — shell interativo full-color diretamente na VPS
- Rota `/ide/:vpsId/:vpsName` registrada no React Router
- Botão **IDE** (primário) no card de cada VPS no Lançador
- Rotas `/terminal`, `/explorer` e `/ide` movidas para fora do Layout → fullscreen sem sidebar
- `TerminalService` — sessão SSH interativa bidirecional (ssh2 shell)
- `SftpService` — sessão SFTP com readdir, readFile, writeFile, mkdir, delete, rename
- IPC channels: `terminal:*` e `sftp:*` (handler + preload whitelist)
- Monaco workers locais configurados (`monacoSetup.ts`) — funciona offline no Electron
- `@monaco-editor/react`, `monaco-editor`, `@xterm/xterm`, `@xterm/addon-fit` adicionados ao `@cwm/web`

### Alterado

- `App.tsx` reestruturado: páginas de gerenciamento com sidebar; ferramentas (terminal, explorer, IDE) fullscreen
- `Launcher.tsx`: estado `terminalStates` não usado removido

---

## [1.0.5] — 2026-05-30

### Adicionado

- Branding: **NEX-ALS** — copyright, versão e marca em toda a UI
- Página **Manual de Uso** (`/help`) com 9 seções expansíveis: início rápido, VPS, projetos, contas Claude, lançador, autenticação Claude Code, configurações, chave SSH, solução de problemas, sobre
- Botão **"Criar pasta na VPS"** / **"Clonar repositório na VPS"** no formulário de projetos — executa `mkdir -p` ou `git clone` via SSH diretamente da UI
- Modal de autenticação Claude Code reescrito com instrução de janela anônima (resolve conflito de conta já logada no browser)
- Terminal SSH corrigido para abrir janela independente via `cmd /c start` (funcionava apenas em dev, agora funciona no app empacotado)

### Alterado

- Versão global: `0.1.x` → `1.0.5`
- Sidebar mostra versão e marca NEX-ALS
- Seção "Sobre" do Manual com informações completas e copyright

---

## [0.1.2] — 2026-05-30

### Adicionado

- `ClaudeCheckResult` type em `@cwm/config`: `{ installed, version, loggedIn, message }`
- `VpsService.checkClaudeCode(vpsId)` — conecta via SSH, roda `bash -c 'command -v claude && claude --version && claude auth status'` e retorna status estruturado
- Método privado `_sshExec(vpsId, cmd)` extraído de `testConnection` para reusar a lógica SSH
- IPC channel `launcher:checkClaude` — handler no main, canal autorizado no preload
- `ipc.launcher.checkClaude(vpsId)` no helper frontend
- Launcher page: verificação automática ao montar (não-bloqueante, em paralelo para cada VPS); badge por VPS e por card de projeto exibindo: `Claude vX.X.X • Logado` | `Não logado` | `Não instalado` | spinner durante verificação

### Alterado

- `VpsService.testConnection` simplificado para delegar ao `_sshExec`
- `Launcher.tsx` reimplementado com estado `claudeStatuses` por VPS

---

## [0.1.1] — 2026-05-30

### Adicionado

- `ssh2` como dependência de `@cwm/core` com bindings nativos para Windows (crypto acelerado por hardware)

### Alterado

- `VpsService.testConnection` reescrito para usar `ssh2` em vez de `child_process.exec` — não depende mais do cliente SSH no PATH do sistema
- Timeout e erros tratados nativamente: `ECONNREFUSED`, `ETIMEDOUT`, falha de autenticação
- Verificação de host key desativada para teste de conexão (equivalente a `StrictHostKeyChecking=no`)
- `packages/core/tsconfig.json` atualizado de `moduleResolution: Node` para `Node16` para suporte ao prefixo `node:` nos imports
- `pnpm-workspace.yaml` atualizado para aprovar builds nativos de `ssh2` e `cpu-features`

### Corrigido

- Bloqueador crítico resolvido: `require("electron")` funciona corretamente via `electron-vite` (main bundado com Rollup, `electron` como external)

---

## [0.1.0] — 2026-05-29

### Adicionado

- Scaffold completo do monorepo pnpm com workspaces
- `packages/config` — Zod schemas e tipos compartilhados para VPS, Project, ClaudeAccount, Settings, LaunchHistory
- `packages/db` — Prisma schema SQLite com tabelas: vps_servers, projects, claude_accounts, settings, launch_history
- `packages/core` — Serviços de negócio: VpsService, ProjectsService, AccountsService, LauncherService, SettingsService, DiagnosticsService
- `apps/desktop` — Electron main process com BrowserWindow + contextBridge + IPC handlers completos
- `apps/web` — React + Vite + Tailwind CSS com 7 páginas: Dashboard, VPS, Projetos, Contas, Launcher, Settings, Diagnóstico
- Layout com sidebar de navegação e status bar
- Dashboard com cards de VPS, projetos recentes e ações rápidas
- CRUD completo de VPS com formulário modal e botão de teste de conexão
- CRUD completo de Projetos com associação a VPS e conta Claude
- CRUD completo de Contas Claude (sem armazenamento de credenciais)
- Launcher com grid de projetos e botão "Abrir no VS Code"
- Página de Settings (caminhos VS Code, SSH key path)
- Página de Diagnósticos (verifica VS Code, SSH, Git, Node.js, VPS)
- Todos os arquivos de documentação: CLAUDE.md, AGENTE.md, docs/, memory/
- `.gitignore` com exclusões para node_modules, dist, .env, banco SQLite local

### Decisões técnicas

- Stack: Electron + React + Vite + TypeScript + Tailwind CSS + Prisma + SQLite
- IPC via `contextBridge` com `contextIsolation: true` (segurança)
- DATABASE_URL configurado dinamicamente no main process via `app.getPath('userData')`
- Monorepo gerenciado via pnpm workspaces
- Validação de entrada via Zod em todos os handlers IPC
