# VolleyIQ — Plataforma de Analytics para Voleibol

VolleyIQ é uma plataforma moderna de **scouting, estatística e analytics**
de voleibol pensada para treinadores, analistas e equipas técnicas. Funciona
como **PWA** em desktop, tablet e telemóvel e posiciona‑se como alternativa
moderna ao DataVolley — com fluxo de scout ao vivo, dashboards reativos e
uma camada de IA que ajuda a interpretar o que está a acontecer no jogo.

## Como funciona a app

O fluxo típico de uma equipa em VolleyIQ é:

1. **Onboarding (< 10 min)** — login com Firebase (email/password ou Google),
   criação da equipa via *Setup Guide* e adição do plantel (manual ou import
   por Excel). Equipas podem ser partilhadas com staff via **invite code**.
2. **Pré‑jogo** — criação do jogo em `Matches`, definição do adversário
   (`Opponents`) e preparação tática em `MatchDay` / `ScoutingReport`
   (relatório do adversário gerado com apoio de IA).
3. **Scouting ao vivo (`LiveScout`)** — interface otimizada para tablet
   com **campo interativo**, rotações, líbero marcado, registo de cada ação
   (saque, receção, ataque, bloco, defesa), log de ações e *painel de
   sugestões em tempo real* (incluindo recomendações de substituição).
   Suporta scout só da equipa da casa, **dual‑team** (ambas as equipas)
   ou modo observação. O `SecondScreen` espelha o jogo para o banco.
4. **Pós‑jogo (`PostMatch`)** — agregação automática de stats por jogador,
   por set e por fase do rally; **deteção de padrões por IA** (Anthropic
   Claude) com pontos fortes/fracos e recomendações.
5. **Análise contínua** — `Dashboard` com KPIs e gráficos, `Players` /
   `PlayerDetail` com agregados individuais, `Scenario` para simular
   situações táticas e `Pricing` para planos.

## Funcionalidades principais

- **Live Scout** rápido, tocável e responsivo (cabe num viewport, zero
  scroll na área principal).
- **Agregação real de stats** por jogador, equipa, set e adversário
  (endpoints dedicados em `server/stats.ts`).
- **IA integrada** — deteção de padrões (`server/ai/patterns.ts`) e
  sugestões de treino (`server/ai/training.ts`) com Claude. Modo `AI_MOCK`
  para desenvolvimento sem chave.
- **Import / Export** — diálogos para importar jogadores, jogos e ficheiros
  **DVW** do DataVolley; export via `xlsx`.
- **Multi‑utilizador por equipa** — *invite codes* + Firestore para
  partilha entre staff técnico.
- **PWA** — instalável em desktop e mobile, com layout adaptado a
  telemóveis também em landscape.

## Stack técnica

- **Frontend** — React 18 + TypeScript, Vite, Tailwind + shadcn/ui,
  Recharts, Framer Motion, Wouter (hash routing), TanStack Query, Sonner.
- **Backend** — Node.js + Express, Drizzle ORM (SQLite em dev, Postgres
  em produção via `postgres`), Zod para validação.
- **Auth & sync** — Firebase Auth + Firebase Admin; Firestore para
  estado partilhado entre membros da equipa.
- **IA** — `@anthropic-ai/sdk` (Claude) para análise tática.
- **Deploy** — client em Vercel, server em Railway (ver `DEPLOY.md`).

## Estrutura do repositório

```
client/    Frontend React (Vite) — páginas em client/src/pages
server/    API Express — rotas, storage Drizzle, adaptadores IA, stats
shared/    Schema Drizzle + Zod + tipos partilhados client/server
drizzle/   Migrações geradas pelo drizzle-kit
```

Páginas principais (`client/src/pages`): `Dashboard`, `LiveScout`,
`Matches`, `MatchDay`, `Players`, `PlayerDetail`, `Opponents`,
`OpponentDetail`, `PostMatch`, `ScoutingReport`, `Scenario`,
`SecondScreen`, `TeamSettings`, `Pricing`, `Onboarding`, `Login`.

## Começar

```bash
cp .env.example .env          # defaults correm com Firebase real e AI mockada
npm install
npm run db:push               # cria SQLite local e aplica o schema
npm run db:seed               # (opcional) popula com equipa demo
npm run dev                   # server:3000 + client:5173
```

Abre `http://localhost:5173`. Para desenvolver sem Firebase, define
`VITE_USE_DEV_AUTH=true` e `DEV_AUTH_BYPASS=true` no `.env`.

### Variáveis de ambiente

| Variável | Função |
|--|--|
| `DATABASE_URL` | Caminho SQLite (dev) ou URL Postgres (prod) |
| `AI_MOCK` | `true` para respostas de IA simuladas |
| `ANTHROPIC_API_KEY` | Chave Claude para IA real |
| `ALLOWED_ORIGINS` | CORS para o client em produção |
| `VITE_FIREBASE_*` | Configuração Firebase no client |
| `VITE_API_URL` | URL da API consumida pelo client |
| `VITE_USE_DEV_AUTH` / `DEV_AUTH_BYPASS` | Saltar Firebase em dev |

## Scripts

| Comando | Efeito |
|--|--|
| `npm run dev` | Server + client em paralelo (hot reload) |
| `npm run build` | Build do client (Vite) |
| `npm start` | Server em produção (serve API + estáticos) |
| `npm run typecheck` | TS strict em client e server |
| `npm run db:push` | Aplica o schema Drizzle à BD |
| `npm run db:generate` | Gera nova migração a partir do schema |
| `npm run db:seed` | Popula dados demo |

## Deploy

Configuração de produção e checklists em [`DEPLOY.md`](./DEPLOY.md).
Client publicado em Vercel (`vercel.json`), API em Railway.

## Roadmap

- **Fase 1** ✅ Fundação, auth, layout, schema, Dashboard.
- **Fase 2** ✅ CRUD de equipas, jogadores e jogos + imports.
- **Fase 3** ✅ Live Scout, agregação de stats, dual‑team, SecondScreen.
- **Fase 4** ✅ IA (patterns, scenario, training), PostMatch, ScoutingReport.
- **Próximo** — sugestões em tempo real mais ricas, multi‑equipa avançado,
  exports táticos e integrações de vídeo.
