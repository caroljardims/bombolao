# Bombolão

Plataforma web de bolões entre amigos — React, Firebase (Auth, Firestore, Storage, Hosting) e ranking em tempo real.

App publicado: **https://bombolao-9ea22.web.app**

## Setup

```bash
npm install
cp .env.example .env   # preencher VITE_FIREBASE_* e, opcionalmente, FOOTBALL_DATA_TOKEN
```

Para scripts Node (seed, sync, import), coloque a service account na raiz (`*-firebase-adminsdk-*.json`) ou use `firebase login`.

**Firebase Storage** precisa estar ativado no console para upload de foto de perfil. Depois:

```bash
firebase deploy --only storage
```

## Desenvolvimento

```bash
npm run dev
npm test    # testes do merge de status das APIs de placar
```

## Deploy

```bash
npm run deploy              # hosting + firestore rules/indexes + auth
firebase deploy --only storage   # regras de avatar (após ativar Storage)
npm run deploy:functions    # Cloud Functions (plano Blaze)
```

## Scripts úteis

| Comando | Descrição |
|---------|-----------|
| `npm test` | Testa merge de status/placar entre WorldCup26 e football-data.org |
| `npm run seed` | Popula Firestore a partir de `src/data/seed.json` |
| `npm run sync-scores` | Busca placares (WorldCup26 + football-data.org), atualiza Firestore e ranking |
| `npm run sync-scores:recalc` | Recalcula pontos com placares já no Firestore |
| `npm run import-partidas` | Importa partidas da Copa via football-data.org |
| `npm run sync-participant-photos` | Copia `photoURL` do Auth para docs de participante |
| `npm run link-participante` | Vincula participante legado ao Firebase Auth por e-mail |

## Estrutura do app

### Rotas globais

- **`/`** — Lobby (meus bolões)
- **`/criar`** — Criar bolão
- **`/convite/:code`** — Entrar por convite
- **`/conta`** — Login (Google / e-mail) e edição de perfil (nome + foto)

### Rotas por bolão (`/b/:bolaoId/...`)

- **Ranking** — classificação ao vivo, carrossel “Jogos do dia” com apostas, `+X` roxo com pontos do jogo em andamento
- **Jogos** — gráfico de evolução do ranking + partidas em mosaico (desktop)
- **Palpites** — apostas do usuário, agrupadas por dia (colapsável); palpites de adversários ocultos até 15 min antes do apito
- **Admin** — convites e gestão (só admin do bolão)

## Regras de pontuação

| Acerto | Pontos |
|--------|--------|
| Na mosca (placar exato) | 9 |
| Vencedor + gol | 6 |
| Empate | 6 |
| Vencedor | 4 |
| Gol | 1 |
| Nada | 0 |

Prazo: **15 minutos** antes do kickoff (horário de Brasília).

Legenda do ranking: **Cravou** (verde) · **Acertou o resultado** (amarelo) · **Não apostou** (vermelho).

## Sync de placares

O sync combina duas fontes:

1. **[WorldCup26 API](https://worldcup26.ir)** (gratuita, primária)
2. **[football-data.org](https://www.football-data.org)** (fallback, requer `FOOTBALL_DATA_TOKEN`)

Regra de merge (`scripts/lib/mergeApiMatches.ts`): se **qualquer** API reportar `FINISHED`/`AWARDED`, esse status prevalece sobre `IN_PLAY`. A UI confia no `status_api` gravado no Firestore — sem heurísticas de tempo ou ordem de jogos.

## Automação (GitHub Actions)

- **`sync-scores.yml`** — placares a cada 5 min (com gate ao vivo)
- **`import-partidas.yml`** — importação diária de partidas da Copa

## Bolão principal

O bolão **Colorados do Inter** (`colorados-do-inter`) usa dados em `src/data/seed.json` e e-mails em `src/data/participant-emails.json`.
