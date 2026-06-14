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

#### Tabela de pontuação

| Resultado | Pontos |
|-----------|--------|
| Na mosca (placar exato) | 9 |
| Vencedor + gol (acertou quem vence e um dos placares) | 6 |
| Empate acertado (sem placar exato) | 6 |
| Vencedor (acertou só quem vence) | 4 |
| Gol (acertou um dos placares, errou resultado) | 1 |
| Nada | 0 |

#### Implementação de `calcularPontos`

```typescript
function calcularPontos(
  placar: { casa: number; fora: number },
  palpite: { casa: number; fora: number }
): number {
  if (palpite.casa === placar.casa && palpite.fora === placar.fora) return 9;

  const resultadoReal = Math.sign(placar.casa - placar.fora);
  const resultadoPalpite = Math.sign(palpite.casa - palpite.fora);
  const acertouResultado = resultadoReal === resultadoPalpite;
  const acertouUmGol = palpite.casa === placar.casa || palpite.fora === placar.fora;

  if (resultadoReal === 0 && acertouResultado) return 6; // empate (placar exato já tratado acima)
  if (acertouResultado && acertouUmGol) return 6;        // vencedor + gol
  if (acertouResultado) return 4;                         // só vencedor
  if (acertouUmGol) return 1;                             // só gol
  return 0;
}
```

#### Ordem de desempate no ranking

1. Maior `total_pontos`
2. Maior `na_mosca` (MSC — acertos de placar exato)
3. Maior `acerto_resultado` (ARES — vencedor+gol, empate ou só vencedor)
4. Menor `sem_aposta` (JSA — menos é melhor)

### Sincronização de placares

`scripts/sync-scores.ts` chama a API [football-data.org](https://www.football-data.org/) e atualiza os docs de `partidas`. O GitHub Actions (`sync-scores.yml`) roda a cada 5 min durante a janela de jogos (jun/jul 2026, 12h–01h BRT). O script `should-sync-scores.mjs` age como gate: só prossegue se houver jogo ao vivo ou iminente, evitando chamadas desnecessárias à API.

### Autenticação

Google Sign-In via Firebase Auth. Usuário é identificado pelo `uid`. Participantes legados (importados antes do login existir) são vinculados pelo e-mail na primeira vez que o usuário entra em um bolão (`src/lib/linkParticipante.ts`).

### Variáveis de ambiente

`.env` (baseado em `.env.example`) deve conter as chaves do Firebase Web SDK (`VITE_FIREBASE_*`). Scripts Node usam `GOOGLE_APPLICATION_CREDENTIALS` (path para service account JSON) ou `firebase login`. A API de placares requer `FOOTBALL_DATA_TOKEN`.

## Regras de negócio importantes

- **Prazo para palpites:** 15 minutos antes do kickoff (horário de Brasília). Após isso, `PalpiteInput` bloqueia edição. Participantes sem aposta no prazo recebem 0 pontos — nenhum placar padrão é aplicado.
- **Prorrogação:** vale o placar ao final da prorrogação, não do tempo normal. Exemplo: 1×1 no tempo normal + 1 gol na prorrogação = placar final 2×1.
- **Status de partida:** `partidaEncerrada` só retorna `true` para `FINISHED` ou `AWARDED` — enquanto `IN_PLAY`/`PAUSED` o ranking ao vivo mostra placar parcial sem congelar pontos.
- **Scores aceitos:** inteiros 0–20 (validado no Firestore rules e no frontend).
- **Cloud Functions** exigem plano Blaze; sem elas, o recálculo acontece apenas via script.
- **Peso de fases/rodadas:** peso padrão 1 para todas as fases (sem multiplicador por rodada).

## Dados do bolão — Colorados do Inter (Copa do Mundo 2026)

### Palpites realizados (Primeira Fase — jogos 1 a 9)

Placares reais:

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
| 10 | 14/06 17h | Holanda x Japão | 2 x 1 | 

Palpites por participante (`casa × fora` — pontos):

| Jogo | Felipe | André | Pedro | Cacá | Maria H. | Jeanbiru | Camile | Michael |
|------|--------|-------|-------|------|----------|----------|--------|---------|
| 1 MEX×RSA | 2×0 9 | 2×0 9 | 2×0 9 | 1×1 0 | — 0 | 2×1 6 | — 0 | 3×1 4 |
| 2 KOR×CZE | 1×1 1 | 1×2 0 | 1×1 1 | 2×1 9 | — 0 | 1×1 1 | — 0 | 2×2 1 |
| 3 CAN×BIH | 1×1 9 | 1×0 1 | 2×1 1 | 3×1 1 | — 0 | 1×0 1 | — 0 | 2×0 0 |
| 4 USA×PAR | 0×1 1 | 2×1 6 | 1×0 4 | 2×2 0 | 1×1 1 | 2×2 0 | — 0 | 1×1 1 |
| 5 QAT×SUI | 1×1 9 | 0×3 0 | 0×1 1 | 1×2 1 | 0×3 0 | 0×2 0 | 0×2 0 | — 0 |
| 6 BRA×MAR | 1×2 1 | 2×2 6 | 2×1 1 | 2×2 6 | 1×1 9 | 2×1 1 | 2×1 1 | 3×0 0 |
| 7 HAI×SCO | 1×3 4 | 0×2 6 | 0×2 6 | 0×2 6 | 0×1 9 | 0×3 6 | 0×1 9 | 1×2 4 |
| 8 AUS×TUR | 0×3 0 | 1×3 0 | 1×3 0 | 1×2 0 | 0×2 0 | 1×3 0 | 1×1 0 | — 0 |
| 9 GER×CUR | 4×0 4 | 5×0 4 | 6×0 4 | 5×0 4 | 5×0 4 | 4×0 4 | 7×1 9 | — 0 |
| 10 HOL×JAP | 2×3 1 | 1×2 0 | 3×1 6 | 1×1 1 | 2×1 9 | 1x0 4 | 2x1 9 | 3x1 6 |
| **Total (9j)** | **38** | **32** | **27** | **27** | **23** | **19** | **19** | **10** |

> `—` indica sem aposta (JSA). Pontos já validados contra as regras de pontuação do bolão.

### Seed inicial

Os dados históricos completos (partidas, palpites e ranking) estão em `src/data/seed.json`. Use `npm run seed` para popular o Firestore.