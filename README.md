# Bolão Colorados do Inter — Copa 2026

App web de bolão da Copa do Mundo 2026 com React, Firebase (Firestore + Auth) e ranking em tempo real.

## Setup

```bash
npm install
cp .env.example .env   # preencher com credenciais Firebase
```

Preencha os e-mails em `src/data/participant-emails.json` e rode o seed:

```bash
# Requer service account ou firebase login + GOOGLE_APPLICATION_CREDENTIALS
npm run seed
```

## Desenvolvimento

```bash
npm run dev
```

## Deploy

```bash
npm run deploy
```

App publicado em: **https://bombolao-9ea22.web.app**

### Cloud Functions (opcional)

O recálculo automático de pontos usa Cloud Functions, que exige o plano **Blaze** (pay-as-you-go):

1. Ative em: https://console.firebase.google.com/project/bombolao-9ea22/usage/details
2. Depois rode: `npm run deploy:functions`

### Sincronizar placares (opcional)

Com token da [football-data.org](https://www.football-data.org/) no `.env`:

```bash
npm run sync-scores          # busca API + atualiza Firestore + ranking
npm run sync-scores:recalc   # só recalcula com placares já no Firestore
```

Rode a cada 5 min durante os jogos (cron ou manual). O app recalcula o ranking **em tempo real** no navegador via `onSnapshot` — basta os placares estarem no Firestore.

Sem API, atualize placares no Firebase Console e rode `npm run sync-scores:recalc`.

## Estrutura

- **Ranking** (`/`) — classificação em tempo real
- **Partidas** (`/partidas`) — jogos agrupados por data
- **Palpites** (`/palpites`) — apostas do usuário logado
- **Login** (`/login`) — Google Auth vinculado por e-mail

## Regras de pontuação

| Acerto | Pontos |
|--------|--------|
| Na mosca | 9 |
| Vencedor + gol | 6 |
| Empate | 6 |
| Vencedor | 4 |
| Gol | 1 |
| Nada | 0 |

Prazo: 15 min antes do jogo (horário de Brasília).
