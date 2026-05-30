# HEXAGON IDE MULTI-IA

Aplicação desktop para gerenciar múltiplos ambientes Claude Code em VPS separadas.

## Requisitos

- Node.js 22 LTS
- pnpm 9+
- VS Code com extensão Remote - SSH
- OpenSSH no sistema (ou Git Bash no Windows)

## Início rápido

```bash
# 1. Instalar dependências
pnpm install

# 2. Gerar Prisma client
pnpm db:generate

# 3. Criar banco SQLite
pnpm db:push

# 4. Rodar em modo desenvolvimento
pnpm dev
```

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `pnpm dev` | Inicia Vite (web) + Electron |
| `pnpm build` | Build de produção |
| `pnpm typecheck` | Verifica tipos TypeScript |
| `pnpm db:generate` | Gera Prisma client |
| `pnpm db:push` | Sincroniza schema com banco |
| `pnpm db:studio` | Abre Prisma Studio |

## Estrutura

```
apps/desktop/   → Electron main process
apps/web/       → React + Vite (renderer)
packages/config → Zod schemas e tipos
packages/core   → Serviços de negócio
packages/db     → Prisma + SQLite
```

Ver `docs/ARCHITECTURE.md` para detalhes completos.
