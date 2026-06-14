# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos principais

```bash
npm run dev              # servidor de desenvolvimento (Vite)
npm run build            # tsc + vite build
npm run lint             # ESLint
npm run deploy           # build + firebase deploy (hosting, rules, indexes, auth)
npm run deploy:functions # build functions + firebase deploy --only functions

# Scripts de dados (requerem GOOGLE_APPLICATION_CREDENTIALS ou firebase login)
npm run sync-scores            # busca API football-data.org + atualiza Firestore + recalcula ranking
npm run sync-scores:all        # idem, força todos os bolões
npm run sync-scores:recalc     # só recalcula pontos com placares já no Firestore
npm run seed                   # popula Firestore a partir de src/data/seed.json
npm run grant-admin            # concede papel admin a um usuário
npm run import-palpites        # importa palpites de bolão legado
npm run migrate                # migração de estrutura single → multi-bolão
```

## Arquitetura

### Frontend

React 19 + Vite + TypeScript + Tailwind v4. Roteamento via React Router v7.

Dois níveis de layout:
- `Layout` — rotas globais (lobby, criar bolão, convite, conta)
- `BolaoLayout` — rotas por bolão em `/b/:bolaoId/*` (ranking, partidas, palpites, admin)

`BolaoProvider` (em `src/contexts/BolaoContext.tsx`) envolve todas as rotas de bolão e mantém via `onSnapshot`: o documento do bolão, o participante do usuário logado e a membrosia (papel no lobby). Detecta automaticamente participantes legados pelo e-mail e executa `claimLegacyParticipante`.

### Firestore — estrutura de coleções

```
boloes/{bolaoId}
  partidas/{partidaId}
  participantes/{uid}       # stats persistidos (total_pontos, na_mosca, etc.)
  palpites/{palpiteId}      # participante_id + partida_id + palpite_casa/fora + pontos

convites/{code}
users/{uid}/membrosias/{bolaoId}   # lobby — lista de bolões que o usuário participa
```

Funções auxiliares em `src/lib/paths.ts` centralizam todas as referências de doc/collection.

### Ranking ao vivo vs. persistido

Existe uma dupla camada de ranking:
- **Persistido**: `participantes/{uid}.total_pontos` etc. — atualizado pela Cloud Function (`functions/src/index.ts`) quando um `partida` doc é alterado, e pelo script `sync-scores`.
- **Ao vivo** (`src/lib/liveRanking.ts`): calculado no navegador a partir de todos os palpites + partidas via `onSnapshot`, sem esperar a função. Usado nas páginas de ranking e palpites durante jogos em andamento.

### Lógica de pontuação

`src/lib/scoring.ts` é a fonte canônica. As mesmas funções (`calcularPontos`, `contarEstatisticas`, `calcularPosicoes`) são duplicadas em `functions/src/scoring.ts` (Cloud Functions rodam em Node, sem acesso ao bundle do frontend). Ao alterar regras de pontuação, atualizar **ambos**.

Ordem de desempate no ranking: `total_pontos` → `na_mosca` → `acerto_resultado` → `sem_aposta` (menos é melhor).

### Sincronização de placares

`scripts/sync-scores.ts` chama a API [football-data.org](https://www.football-data.org/) e atualiza os docs de `partidas`. O GitHub Actions (`sync-scores.yml`) roda a cada 5 min durante a janela de jogos (jun/jul 2026, 12h–01h BRT). O script `should-sync-scores.mjs` age como gate: só prossegue se houver jogo ao vivo ou iminente, evitando chamadas desnecessárias à API.

### Autenticação

Google Sign-In via Firebase Auth. Usuário é identificado pelo `uid`. Participantes legados (importados antes do login existir) são vinculados pelo e-mail na primeira vez que o usuário entra em um bolão (`src/lib/linkParticipante.ts`).

### Variáveis de ambiente

`.env` (baseado em `.env.example`) deve conter as chaves do Firebase Web SDK (`VITE_FIREBASE_*`). Scripts Node usam `GOOGLE_APPLICATION_CREDENTIALS` (path para service account JSON) ou `firebase login`. A API de placares requer `FOOTBALL_DATA_TOKEN`.

## Regras de negócio importantes

- Prazo para palpites: **15 minutos antes do kickoff** (horário de Brasília). Após isso, `PalpiteInput` bloqueia edição.
- Partidas têm `status_api` vindo da football-data.org. `partidaEncerrada` só retorna `true` para `FINISHED` ou `AWARDED` — enquanto `IN_PLAY`/`PAUSED` o ranking ao vivo mostra placar parcial sem congelar pontos.
- Scores de placar aceitos: inteiros 0–20 (validado no Firestore rules e no frontend).
- Cloud Functions exigem plano Blaze; sem elas, o recálculo acontece apenas via script.
