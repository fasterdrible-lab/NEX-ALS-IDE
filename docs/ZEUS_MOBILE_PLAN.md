# Zeus Mobile — plano

**Data:** 2026-10-20 · **Status:** proposta, nada implementado · **Base:** Zeus IDE 3.76.3

## Objetivo

Usar o Zeus pelo celular **só para o que trava o fluxo longe do PC**, sem levar o editor:

1. Receber alertas: comando aguardando aprovação, VPS em alerta, incidente diagnosticado, entrega aprovada/bloqueada, tarefa bloqueada.
2. **Autorizar/Negar** os comandos do Hermes, para o loop não ficar parado.
3. Ver incidentes e executar uma ação sugerida, com a mesma confirmação do PC.
4. Ver o quadro, os logs e o status das VPS (só leitura).

Fora do escopo: editor, terminal, Git, Squad, AI Hub, criar projetos.

## Decisão de arquitetura

**O servidor roda dentro do próprio Zeus, no PC, e só é alcançável pela rede privada do Tailscale.** O celular abre um app instalável pelo navegador (PWA).

Por quê:
- **Credenciais ficam onde estão:** as chaves SSH, a senha das VPS e o banco continuam no PC. Um servidor na VPS exigiria levar tudo isso para lá.
- **Reaproveita o código:** o servidor chama os mesmos serviços que o IPC já usa (`hermesSvc`, `hermesRunLog`, incidentes, `TasksService`). Não é uma segunda implementação.
- **Nada fica exposto na internet:** sem porta aberta no roteador. O Tailscale cria uma rede privada entre o PC e o celular, e o `tailscale serve` dá HTTPS com certificado válido.

Alternativas descartadas:
- **Servidor na VPS:** duplicaria a lógica e espalharia as credenciais.
- **Porta pública ou túnel aberto (ex.: Cloudflare Tunnel):** vira uma porta de entrada para as VPS na internet.
- **Bot do Telegram:** não exige porta aberta, mas o texto dos comandos e dos diagnósticos passaria pelos servidores do Telegram, e a interface fica limitada a botões.

### Consequência importante: o PC precisa estar ligado e com o Zeus aberto

O loop do Hermes roda **no painel Agent** (renderer), não no processo principal:
- O comando pendente fica no main, em `hermesApprovals` ([handlers.ts:145](../apps/desktop/src/ipc/handlers.ts#L145)).
- O que acontece depois de autorizar (avisar o Hermes, ler a tag da tarefa, seguir o loop) está no painel, em `resolveApproval` ([HermesAgentPanel.tsx:835](../apps/web/src/components/HermesAgentPanel.tsx#L835)).

Por isso o celular não substitui o PC: ele controla o Zeus que está aberto. Levar o loop inteiro para o main e rodar sem nenhuma janela é outra fase, maior (ver Fase 4).

## Segurança (requisitos, não opcionais)

1. **Escuta só no IP do Tailscale** (100.x.y.z), nunca em `0.0.0.0`. Com o Tailscale desligado, o servidor não sobe. Desligado por padrão: liga em Configurações → Celular.
2. **Pareamento por QR code:**
   - Configurações → Celular → "Parear celular" mostra um QR com um código de uso único, válido por 5 minutos.
   - O celular troca esse código por um token de dispositivo.
   - No banco fica só o **hash** do token, numa tabela nova `mobile_devices` (nome, criado em, último uso, revogado).
   - Cada aparelho pode ser revogado individualmente.
3. **Login do Zeus continua valendo:** se houver usuários (`app_users`), o pareamento exige login de admin no celular.
4. **Ação perigosa pede confirmação na hora:**
   - Autorizar comando e executar ação de incidente pedem um toque de confirmação no celular.
   - Ação de risco alto exige digitar **CONFIRMO**, como no PC.
   - Comando destrutivo continua recusado sempre: a regra é do main, não da tela.
5. **Mesmas regras do IPC:**
   - toda entrada validada com Zod;
   - erros sem stack trace;
   - tudo auditado (`tool_execution_log` com origem "celular" e nome do aparelho);
   - limite de tentativas por IP e por token.
6. **Nada de segredo no push:** a notificação diz "Comando aguardando aprovação — ACESSIBILIDADE", sem o texto do comando. O conteúdo só aparece depois de abrir o app, autenticado.

## Fases

### Fase 1 — Notificações + Autorizar/Negar (MVP)

**Servidor** (`apps/desktop/src/mobile/`):
- HTTP no main (`node:http`, sem framework novo), atrás do `tailscale serve`.
- Rotas:
  - `POST /pair`
  - `GET /approvals`
  - `POST /approvals/:id` (autorizar/negar)
  - `GET /events` (SSE, para a tela atualizar sozinha)
  - `POST /push/subscribe`

**Refatoração necessária:**
- **Lógica de aprovação no main:** `hermes:approval:resolve` passa a ser uma função do main, chamada tanto pelo IPC quanto pelo servidor.
- **Aviso ao painel:** quando a decisão vem do celular, o main envia `hermes:approval:resolved` à janela dona da execução. O painel tira o cartão e roda a mesma continuação de hoje (aviso ao Hermes → tag → loop). Para isso, `resolveApproval` é dividido em "decidir" e "continuar".
- **Painel fechado:** se nenhuma janela estiver com o painel aberto, o comando autorizado roda e o desfecho fica guardado. A continuação acontece quando o painel abrir, como o "Retomar sessão" de hoje.

**Notificações push:**
- Web Push com chaves VAPID geradas no primeiro uso.
- Envio pelo main com a lib `web-push`. O envio é só de saída, não precisa de porta aberta.
- Os eventos já existem no main: `approval_request`, alertas do `NotificationMonitor`, diagnóstico pronto.

**PWA** (`apps/mobile/`, Vite + React + Tailwind, como o `apps/web`):
- Telas: parear, lista de aprovações (projeto, tarefa, comando, motivo, Autorizar/Negar) e histórico do dia.

**Configurações no Zeus:** ligar/desligar o servidor, parear, lista de aparelhos com revogar, endereço do Tailscale.

### Fase 2 — Incidentes

- Lista de incidentes por VPS: status, causa, evidências e ações sugeridas.
- Executar ação com a mesma confirmação do PC (risco alto → CONFIRMO).
- Botão "Diagnóstico geral" e "Marcar resolvido".

### Fase 3 — Quadro, logs e VPS (só leitura)

- Quadro do projeto (Pendente / Em andamento / Bloqueada / Concluída) e agentes em execução.
- Logs de uma execução (texto + atividade), atualizando por SSE.
- Status das VPS (CPU/RAM/disco do monitor) e do Hermes em cada uma.
- Responder um Decision Request (`[DECISAO_NECESSARIA]`) pelo celular.

### Fase 4 — opcional, decidir depois

- **Loop no main:** mover o loop do Hermes do painel para o processo principal, para ele seguir sem nenhuma janela aberta. Aproveita o `runObjectiveUnattended` da FASE 6. É a mudança grande: hoje plano, loop, entrega e paralelas vivem no `HermesAgentPanel.tsx`.
- Iniciar um objetivo ou retomar uma sessão pelo celular.

## Verificação por fase

- **Testes unitários:** pareamento (código expira, uso único, hash), autenticação das rotas, validação Zod, recusa de comando destrutivo pela rota do celular.
- **Roteiro manual no celular real:**
  - parear;
  - receber o push de um comando perigoso do Hermes na VPS-1;
  - Negar e depois Autorizar, e ver o loop continuar no PC;
  - revogar o aparelho e ver as rotas recusarem.
- **Segurança:** confirmar que a porta não responde fora do Tailscale (outra rede, ou `curl` do próprio PC pelo IP da LAN).

## Respostas do usuário (2026-10-20)

- **Celular: Android.** O Web Push funciona direto no Chrome, sem precisar instalar o app na tela inicial (diferente do iPhone).
- **PC ligado ou desligado:** o usuário quer saber se dá para usar com o PC desligado. Dá, mudando onde o loop roda:
  - **PC ligado:** este plano como está (servidor dentro do Zeus no PC).
  - **PC desligado:** um "Zeus Server" na **VPS-1**, onde o Hermes já roda, sempre ligado e só pelo Tailscale (instalado também na VPS-1). O Zeus do PC e o celular viram clientes dele.
    - Dados do Hermes (tarefas, logs, aprovações) passam a ficar na VPS-1.
    - Trazer/Enviar dos projetos do OneDrive continua precisando do PC.
    - Incidentes da VPS-2 (produção) ficam só no PC, para a chave dela não ir para a VPS-1.

## Passo 0 recomendado (vale para os dois caminhos)

**Mover o loop do Hermes do painel (renderer) para o processo principal / `packages/core`:**
- plano, execução de tarefa, conferência de commit, Decision Request, Autorizar/Negar, entrega, paralelas.
- O painel passa só a mostrar e mandar comandos.

Ganho imediato, mesmo sem celular: fechar o painel não interrompe mais a tarefa. Em 2026-10-20 a T1 do ACESSIBILIDADE foi interrompida assim.

Depois disso, o mesmo módulo roda atrás do servidor do celular (PC ligado) ou como serviço na VPS-1 (PC desligado), sem reescrever.

## Decisão: os dois (2026-10-20)

O usuário quer usar com o PC ligado **e** desligado. Arquitetura escolhida:

```
celular ──► Zeus Server (VPS-1, sempre ligado) ◄── Zeus no PC (quando ligado, conexão de saída)
                    │
                 Hermes
```

- **O loop do Hermes de todos os projetos roda no Zeus Server da VPS-1:** plano, tarefas, Autorizar/Negar, entrega, quadro, logs. Um lugar só por projeto, sem dois donos do loop.
- **O Zeus do PC é cliente:** o painel Agent mostra e comanda o loop do servidor. Fechar o app ou desligar o PC não interrompe nada.
- **O celular fala sempre com o servidor:** funciona com o PC ligado ou desligado.
- **O que só existe no PC** (incidentes da VPS-2/VPS-3, Trazer/Enviar do OneDrive) aparece no celular só com o PC ligado.
  - O PC abre uma conexão de saída com o servidor e publica alertas e ações por ela.
  - O PC não abre porta, e a chave da VPS-2 não sai dele.
- **Única porta de entrada:** o Zeus Server, só pela rede do Tailscale (celular, VPS-1 e PC).

Isso substitui a "Decisão de arquitetura" do início (servidor dentro do Zeus no PC). Os requisitos de segurança e as telas das fases continuam valendo.

### Ordem

0. ✅ **Loop do Hermes como módulo independente** (sai do `HermesAgentPanel.tsx`). Primeiro roda no main do Zeus do PC: fechar o painel já não interrompe. **Feito na v3.77.0** (`HermesAgentRunner`, sem dependência do Electron); falta validar pela UI com o Hermes real.
1. 🔶 **Em andamento (2026-10-21)** — serviço `zeus-hermes` (`apps/server`) escrito e testado na VPS-1 sem instalar; Tailscale nos 3 aparelhos. Detalhes em ARCHITECTURE.md → "Serviço zeus-hermes". **Zeus Server na VPS-1:**
   - o mesmo módulo como serviço (systemd), com banco próprio para tarefas/logs/aprovações do Hermes;
   - migração dos dados atuais do PC para lá;
   - acesso só pelo Tailscale.
2. **Zeus do PC como cliente do servidor** (painel Agent, quadro, logs).
3. **App do celular (PWA):** pareamento, push, Autorizar/Negar → depois quadro, logs e Decision Request.
4. **Ponte do PC:** incidentes das outras VPS e avisos de Trazer/Enviar, via conexão de saída do PC.

## Perguntas em aberto

1. **Tailscale está ok?** É gratuito para uso pessoal; vai no celular, na VPS-1 e no PC.
