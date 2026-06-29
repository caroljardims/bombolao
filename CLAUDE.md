# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos principais

```bash
npm run dev              # servidor de desenvolvimento (Vite)
npm run build            # tsc + vite build
npm run lint             # ESLint
npm test                 # testes do merge de status das APIs (mergeApiMatches)
npm run deploy           # build + firebase deploy (hosting, rules, indexes, auth)
firebase deploy --only storage   # regras de avatar (Storage precisa estar ativo no console)
npm run deploy:functions # build functions + firebase deploy --only functions

# Scripts de dados (requerem service account ou firebase login)
npm run sync-scores            # WorldCup26 + football-data.org → Firestore + ranking
npm run sync-scores:all        # idem, força todos os bolões
npm run sync-scores:recalc     # só recalcula pontos com placares já no Firestore
npm run import-partidas        # importa partidas da Copa (football-data.org) para um bolão
npm run sync-participant-photos # copia photoURL do Firebase Auth → docs participante (backfill)
npm run seed                   # popula Firestore a partir de src/data/seed.json
npm run grant-admin            # concede papel admin a um usuário
npm run link-participante      # vincula participante legado ao Auth por e-mail
npm run import-palpites        # importa palpites de bolão legado
npm run migrate                # migração de estrutura single → multi-bolão
```

## Arquitetura

### Frontend

React 19 + Vite + TypeScript. Estilos em CSS custom (`src/styles/design-base.css`, `design-screens.css`) com fonte Hanken Grotesk — **não** depender só de Tailwind para telas novas. Componentes UI em `src/components/ui/` (Icon, Avatar, Pill, StatTrio, TeamBadge).

Roteamento via React Router v7:

- `Layout` — rotas globais: `/`, `/criar`, `/convite/:code`, `/conta`
- `BolaoLayout` — rotas por bolão em `/b/:bolaoId/*` (ranking, partidas, palpites, admin)

`BolaoProvider` (`src/contexts/BolaoContext.tsx`) mantém via `onSnapshot`: documento do bolão, participante do usuário logado e membrosia. Detecta participantes legados pelo e-mail e executa `claimLegacyParticipante`.

`AuthProvider` (`src/contexts/AuthContext.tsx`) expõe snapshot plano `AuthUser` (nova referência a cada `refreshUser()`) — necessário para React detectar mudanças de `photoURL` após `user.reload()`.

### Firestore — estrutura de coleções

```
boloes/{bolaoId}
  partidas/{partidaId}
  participantes/{participanteId}   # uid ou slug legado; inclui photoURL opcional
  palpites/{palpiteId}

convites/{code}
users/{uid}/membrosias/{bolaoId}
```

Firebase Storage: `avatars/{uid}/profile.jpg` — fotos de perfil customizadas.

Funções auxiliares em `src/lib/paths.ts` centralizam referências de doc/collection.

### Ranking ao vivo vs. persistido

- **Persistido**: `participantes/{id}.total_pontos` etc. — Cloud Function (`functions/src/index.ts`) + `sync-scores`.
- **Ao vivo** (`src/lib/liveRanking.ts`): calculado no navegador via `onSnapshot`. Usado no ranking e palpites durante jogos.
- **`pontos_ao_vivo`**: pontos do jogo em andamento exibidos como `+X` roxo ao lado do total no ranking (`RankingCard`).

### Próximo jogo / Jogos do dia

`src/lib/nextPartida.ts`:

- `findProximaPartida` — próximo jogo para destaque
- `resolveJogosDoDia` — jogos do dia; inclui jogos de dias anteriores ainda não encerrados (ex.: virou meia-noite com jogo ao vivo)
- `jogosPendentesDiasAnteriores` — helper para partidas pendentes de dias passados
- `NextGameBets` — carrossel com setas entre jogos do dia no ranking

### Aba Jogos (`PartidasPage`)

- **`RankingEvolutionChart`** (`src/components/RankingEvolutionChart.tsx`) — gráfico SVG de posição × jogo (ordem temporal); avatar no fim de cada linha. Dados em `src/lib/rankingHistory.ts`.
- **Mosaico desktop** — `.jogos-screen .match-list` em grid (`min-width: 881px`).

### UI ao vivo (dados em tempo real)

- **`LiveTag`** — pill roxa (`tone="realtime"`) com placar; bolinha com animação irradiada.
- Cores realtime: `--realtime` em `design-base.css`. Não confundir com `--live` (vermelho, legado).

### Perfil e fotos

`src/lib/profile.ts` — upload para Storage, `updateProfile` no Auth, sync para docs de participante via `participanteDocsForUser` (`src/lib/linkParticipante.ts`) que resolve uid **e** IDs legados por e-mail.

Ranking/NextGameBets leem `participante.photoURL` do Firestore (visível para todos). Auth `photoURL` só complementa o usuário logado.

### Palpites por dia

`PalpitesList` agrupa partidas com `groupPartidasByDay` (`src/lib/dates.ts`). `PalpitesDaySection` — `<details>` colapsável.

- Palpites de adversários ocultos até `palpitesAdversariosVisiveis` (15 min antes do apito) — `src/lib/scoring.ts`.
- `PalpiteInput` aceita digitação no teclado (0–20) além dos botões −/+.

### Lógica de pontuação

`src/lib/scoring.ts` é a fonte canônica. Duplicada em `functions/src/scoring.ts`. Alterar regras em **ambos**.

#### Tabela de pontuação

| Resultado | Pontos |
|-----------|--------|
| Na mosca (placar exato) | 9 |
| Vencedor + gol | 6 |
| Empate acertado (sem placar exato) | 6 |
| Vencedor (só quem vence) | 4 |
| Gol (só um placar) | 1 |
| Nada | 0 |

Badges no ranking (`StatTrio`): **Cravou** / **Acertou o resultado** / **Não apostou**.

#### Ordem de desempate

1. `total_pontos`
2. `na_mosca`
3. `acerto_resultado`
4. `sem_aposta` (menor é melhor)

#### Status de partida (UI)

- `partidaAoVivo` — `status_api` em `IN_PLAY`, `PAUSED`, `LIVE`, `EXTRA_TIME`, `PENALTY_SHOOTOUT`
- `partidaEncerrada` — `status_api` em `FINISHED` ou `AWARDED` (com placar)
- **Sem heurísticas de tempo ou ordem cronológica na UI** — confiar no `status_api` gravado pelo sync

### Sincronização de placares

`scripts/sync-scores.ts` + GitHub Actions (`sync-scores.yml`, gate `should-sync-scores.mjs`).

**Merge de APIs** (`scripts/lib/mergeApiMatches.ts`):

- Combina WorldCup26 (`scripts/lib/worldcup26Api.ts`) e football-data.org
- Se qualquer fonte reportar `FINISHED`/`AWARDED`, esse status vence `IN_PLAY`
- Entre duas fontes ao vivo, prefere placar mais informativo
- **Data UTC:** prefere a data terminada em `Z` (football-data) à do WorldCup26 (horário do estádio, naive) — jogos de madrugada BRT caíam no dia errado e quebravam o matching
- **Etapa (`duration`):** propaga a mais avançada (`REGULAR` < `EXTRA_TIME` < `PENALTY_SHOOTOUT`); só a football-data informa
- **Placar congelado no tempo regulamentar:** ao detectar `EXTRA_TIME`/`PENALTY_SHOOTOUT`, `buildPartidaPatch` mantém o placar dos 90 min e não grava gols da prorrogação (ainda grava `status_api`, `vencedor` e pênaltis)
- Testes: `scripts/lib/mergeApiMatches.test.ts` (`npm test`)
- Matching de partida: data + times, ou kickoff ±3h (fuso Brasília vs UTC)

Importação de partidas: `scripts/import-partidas-from-api.ts` + workflow `import-partidas.yml` (1×/dia).

### Autenticação

Google Sign-In e e-mail/senha via Firebase Auth. Participantes legados vinculados por e-mail (`src/lib/linkParticipante.ts`).

### Variáveis de ambiente

`.env` (`VITE_FIREBASE_*`, opcional `FOOTBALL_DATA_TOKEN`). Scripts Node: service account JSON na raiz ou `firebase login`.

## Regras de negócio importantes

- **Prazo para palpites:** 15 min antes do kickoff (BRT). Sem aposta = 0 pontos.
- **Prorrogação/pênaltis:** a pontuação vale **apenas o tempo regulamentar (90 min)**. Gols na prorrogação e pênaltis **não** contam no placar (`gols_casa`/`gols_fora`). O sync congela o placar quando a API marca `EXTRA_TIME`/`PENALTY_SHOOTOUT`. Quem **avança** no mata-mata vem de `vencedor` (que considera prorrogação e pênaltis).
- **Status de partida:** UI lê apenas `status_api` do Firestore; sync é responsável por gravar status correto das APIs.
- **Scores:** inteiros 0–20.
- **Cloud Functions** exigem plano Blaze.
- **Storage** deve estar ativado no console Firebase antes do deploy de `storage.rules`.

## Dados do bolão — Colorados do Inter (Copa do Mundo 2026)

Seed em `src/data/seed.json`, e-mails em `src/data/participant-emails.json`. Bolão ID: `colorados-do-inter`.

### Palpites realizados (Primeira Fase — referência)

Placares reais (jogos 1–10) e palpites por participante documentados abaixo para validação manual.

| # | Data | Partida | Placar real |
|---|------|---------|-------------|
| 1 | 11/06 16h | México × África do Sul | 2 × 0 |
| 2 | 11/06 23h | Coreia do Sul × República Tcheca | 2 × 1 |
| 3 | 12/06 16h | Canadá × Bósnia-Herzegovina | 1 × 1 |
| 4 | 12/06 22h | Estados Unidos × Paraguai | 4 × 1 |
| 5 | 13/06 16h | Catar × Suíça | 1 × 1 |
| 6 | 13/06 19h | Brasil × Marrocos | 1 × 1 |
| 7 | 13/06 22h | Haiti × Escócia | 0 × 1 |
| 8 | 14/06 01h | Austrália × Turquia | 2 × 0 |
| 9 | 14/06 14h | Alemanha × Curaçao | 7 × 1 |
| 10 | 14/06 17h | Holanda × Japão | 2 × 1 |

| Jogo | Felipe | André | Pedro | Cacá | Maria H. | Jeanbiru | Camile | Michael |
|------|--------|-------|-------|------|----------|----------|--------|---------|
| 1 | 2×0 9 | 2×0 9 | 2×0 9 | 1×1 0 | — 0 | 2×1 6 | — 0 | 3×1 4 |
| 2 | 1×1 1 | 1×2 0 | 1×1 1 | 2×1 9 | — 0 | 1×1 1 | — 0 | 2×2 1 |
| 3 | 1×1 9 | 1×0 1 | 2×1 1 | 3×1 1 | — 0 | 1×0 1 | — 0 | 2×0 0 |
| 4 | 0×1 1 | 2×1 6 | 1×0 4 | 2×2 0 | 1×1 1 | 2×2 0 | — 0 | 1×1 1 |
| 5 | 1×1 9 | 0×3 0 | 0×1 1 | 1×2 1 | 0×3 0 | 0×2 0 | 0×2 0 | — 0 |
| 6 | 1×2 1 | 2×2 6 | 2×1 1 | 2×2 6 | 1×1 9 | 2×1 1 | 2×1 1 | 3×0 0 |
| 7 | 1×3 4 | 0×2 6 | 0×2 6 | 0×2 6 | 0×1 9 | 0×3 6 | 0×1 9 | 1×2 4 |
| 8 | 0×3 0 | 1×3 0 | 1×3 0 | 1×2 0 | 0×2 0 | 1×3 0 | 1×1 0 | — 0 |
| 9 | 4×0 4 | 5×0 4 | 6×0 4 | 5×0 4 | 5×0 4 | 4×0 4 | 7×1 9 | — 0 |
| 10 | 2×3 1 | 1×2 0 | 3×1 6 | 1×1 1 | 2×1 9 | 1×0 4 | 2×1 9 | 3×1 6 |

> `—` = sem aposta. Use `npm run seed` para popular o Firestore.
