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

Há duas modalidades de bolão (definidas na criação e ajustáveis no Admin):

### Pontos por palpite (placar por jogo)

Pontuação por acerto do placar de cada jogo:

| Acerto | Pontos |
|--------|--------|
| Na mosca (placar exato) | 9 |
| Vencedor + gol | 6 |
| Empate | 6 |
| Vencedor | 4 |
| Gol | 1 |
| Nada | 0 |

- Prazo para palpitar: **15 minutos** antes do kickoff (horário de Brasília). Sem aposta = 0.
- Vale o **placar do tempo normal (90 min)** — prorrogação e pênaltis **não** contam.
- Legenda do ranking: **Cravou** (verde) · **Acertou o resultado** (amarelo) · **Não apostou** (vermelho).

### Mata-mata (chave, a partir dos 16-avos)

O total de cada participante é a **soma de três fontes independentes**:

```
total = placar por jogo + cravada + flexível
```

1. **Placar por jogo** — a mesma pontuação da tabela acima (opcional, ligável no Admin). Conta só o tempo normal.
2. **Cravada** — o participante trava a chave inteira logo no começo (antes dos 16-avos). Pontua por **acertar quem avança** em cada confronto, com o peso da fase.
3. **Flexível** — palpita o avançador **fase a fase** (cada fase abre quando a anterior termina). Também pontua por acertar quem avança; como há mais informação, vale ~metade da cravada.

As três frentes **somam** — no mesmo jogo dá pra pontuar por placar, cravada e flexível ao mesmo tempo. Cravada e flexível dependem só de **quem avança**, não do placar.

Pesos padrão por fase (ajustáveis no Admin → *Regras do mata-mata*):

| Fase | Cravada | Flexível |
|------|---------|----------|
| 16-avos | 2 | 1 |
| Oitavas | 4 | 2 |
| Quartas | 8 | 4 |
| Semifinal | 15 | 8 |
| 3º lugar | 5 | 3 |
| Vice-campeão | 20 | 10 |
| Campeão | 40 | 20 |

- **Campeão** e **vice** são picks separados (pontuam só com a final encerrada).
- A **cravada** pode ser travada a qualquer momento; cada confronto também tem prazo próprio (o apito do jogo). Quem não palpitar antes de um jogo começar só perde os pontos daquele confronto — o resultado real flui adiante para destravar as fases seguintes.

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
