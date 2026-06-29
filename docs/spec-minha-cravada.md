# Feature Spec: Minha Cravada

## Contexto

A infraestrutura de chaveamento já existe em grande parte: o motor `knockoutBracket.ts`, o schema Firestore `palpitesChave`, as funções de scoring em `chaveScoring.ts`, e a integração ao ranking em `liveRanking.ts`. O que falta é completar a UX de input de picks, ajustar o modelo de pontuação da final (vice + campeão como picks separados), calibrar os pesos, e implementar a privacidade de picks futuros.

---

## 1. Arquivos Impactados

### Reutilizados sem modificação

| Arquivo | O que já faz |
|---|---|
| `src/lib/knockoutBracket.ts` | Motor que constrói o bracket a partir das partidas, calcula `realAdvancer`, expõe `primeiroKickoff` por fase |
| `src/lib/chavePalpite.ts` | Salva/carrega `PalpiteChaveDoc`, lógica de deadline, locking por fase |
| `src/components/ChaveStacked.tsx` | View mobile do bracket |
| `src/lib/paths.ts` | Path builder `palpitesChaveRef` — sem mudança |
| `src/hooks/usePalpiteChave.ts` | Listener Firestore para o doc do participante logado |

### Estendidos / modificados

| Arquivo | O que muda |
|---|---|
| `src/lib/types.ts` | Adicionar `FaseScore`, ajustar `PesosChave`, nenhuma mudança em `ChavePicks` (node IDs reservados por convenção) |
| `src/lib/chaveScoring.ts` | Lógica de `vice` (quem perde a final) como pick scorável separado |
| `src/lib/regras.ts` | Pesos padrão corrigidos conforme a tabela do bolão |
| `src/lib/liveRanking.ts` | `pontos_cravada` já existe; garantir que pesos novos cheguem corretamente |
| `src/pages/ChavePage.tsx` | UX completa: seleção de picks, confirmação de travamento, estado de progresso, visibilidade de picks alheios |
| `src/components/ChaveBracket.tsx` | Handler `onPick` para clicks nos slots; destacar picks do usuário; mostrar acertos após os jogos; slot especial de vice na final |
| `src/components/RankingCard.tsx` | Verificar se label "Cravada" está correto com nova nomenclatura |
| `functions/src/scoring.ts` | Espelhar as mudanças de `chaveScoring.ts` (pesos + vice) — manter sincronizado |
| `functions/src/index.ts` | Trigger de recálculo de `pontos_cravada` nos participantes quando `vencedor` de uma partida eliminatória for gravado |

### Criados do zero

| Arquivo | Propósito |
|---|---|
| `src/components/CravadaProgressBar.tsx` | Pill / barra mostrando quantos picks faltam antes do travamento |
| `src/components/CravadaLockDialog.tsx` | Modal de confirmação de travamento (ação irreversível) |
| `src/components/CravadaFinalPicks.tsx` | UI especial para os dois picks da final (vice + campeão) |
| `src/lib/cravadaPrivacy.ts` | Função `filtrarPicksVisiveis(doc, engine)` — oculta picks de fases que ainda têm jogos abertos |

---

## 2. Novos Tipos e Interfaces

### 2.1 Extensão de `FaseChave` para scoring

O problema: a fase `'final'` precisa gerar **dois** picks pontuáveis (vice e campeão), mas os nós do bracket continuam sendo `'final'` e `'terceiro'`. A solução é separar as chaves de scoring das chaves do bracket:

```typescript
// src/lib/types.ts

// Fases do bracket (estrutura visual — sem mudança)
export type FaseChave = 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'terceiro'

// Chaves de scoring (usadas em PesosChave e na apuração)
export type FaseScore =
  | 'r32'       // 16-avos → 2 pts
  | 'r16'       // Oitavas → 4 pts
  | 'qf'        // Quartas → 8 pts
  | 'sf'        // Semis   → 15 pts
  | 'terceiro'  // 3º lugar → 5 pts
  | 'vice'      // Vice-campeão → 20 pts
  | 'campeao'   // Campeão → 40 pts

export type PesosChave = Record<FaseScore, number>
```

### 2.2 Picks com vice e campeão explícitos

O `ChavePicks` já é `Record<string, string>`. Usar node IDs reservados por convenção:

```typescript
// Picks normais: { 'r32-esq-1': 'Brasil', 'r16-esq-1': 'Brasil', ... }
// Final: dois picks especiais
// picks['final-campeao'] = 'Brasil'   ← quem vence a final
// picks['final-vice']    = 'Alemanha' ← quem perde a final

// Nenhuma mudança na interface ChavePicks — apenas dois IDs reservados convencionados
```

Total de picks: 16 (r32) + 8 (r16) + 4 (qf) + 2 (sf) + 1 (terceiro) + 1 (vice) + 1 (campeão) = **33 picks**.

### 2.3 `RegrasChave` ajustada

```typescript
// src/lib/types.ts — campo já existe, só pesos padrão mudam em regras.ts
export interface RegrasChave {
  pesos_cravada: PesosChave  // Novo tipo FaseScore (7 chaves)
  pesos_flex: PesosChave     // Idem
  prazo_minutos: number
}
```

### 2.4 Visibilidade de picks

```typescript
// src/lib/cravadaPrivacy.ts
export interface PicksVisiveis {
  picks: ChavePicks        // Somente picks de fases com todos os jogos encerrados
  fasesAbertas: FaseChave[] // Fases cujos picks ainda estão ocultos
}

export function filtrarPicksVisiveis(
  doc: PalpiteChaveDoc | null,
  engine: KnockoutEngine,
  isOwner: boolean,         // true = o próprio participante vê tudo
): PicksVisiveis
```

### 2.5 `realPerdedor` no engine

```typescript
// src/lib/knockoutBracket.ts — adição ao KnockoutEngine
export interface KnockoutEngine {
  // ... campos existentes ...
  realPerdedor: Map<string, string | null>  // quem perdeu cada nó (derivado de realAdvancer)
}
```

---

## 3. Nova Lógica de Apuração

### 3.1 Pesos padrão corrigidos

```typescript
// src/lib/regras.ts
export const DEFAULT_PESOS_CRAVADA: PesosChave = {
  r32:      2,
  r16:      4,
  qf:       8,
  sf:       15,
  terceiro: 5,
  vice:     20,
  campeao:  40,
}
```

### 3.2 Lógica de scoring do vice

```typescript
// src/lib/chaveScoring.ts — extensão de scoreCravada()

function scoreNodeFinal(picks: ChavePicks, engine: KnockoutEngine, pesos: PesosChave): number {
  let pts = 0
  const finalPartida = engine.realPartida.get('final')
  if (!finalPartida || !partidaEncerrada(finalPartida)) return 0

  const campeaoReal = engine.realAdvancer.get('final') ?? null
  const viceReal    = engine.realPerdedor.get('final') ?? null

  if (picks['final-campeao'] && picks['final-campeao'] === campeaoReal) pts += pesos.campeao
  if (picks['final-vice']    && picks['final-vice']    === viceReal)    pts += pesos.vice
  return pts
}
```

### 3.3 Critério de acerto

O campo `vencedor` da partida já reflete quem avança no mata-mata (considerando prorrogação e pênaltis), conforme a regra do sync. A apuração da Cravada usa **apenas `vencedor`** — nunca `gols_casa`/`gols_fora`. Isso já é o comportamento do `realAdvancer` atual.

### 3.4 Pontos no ranking

```
total_pontos = pontos_palpites + pontos_cravada
```

Já implementado em `liveRanking.ts`. Verificar que `scoreChave()` recebe os pesos do `regrasChave` do bolão, não defaults hardcoded.

### 3.5 Cloud Function trigger

Quando `vencedor` é gravado em uma partida de fase eliminatória:
1. Para cada `palpitesChave/{uid}` do bolão, recalcular `pontos_cravada` com `scoreCravada()`
2. Gravar resultado em `participantes/{uid}.pontos_cravada`
3. Recalcular `total_pontos` e `posicao` (já feito pela função existente para palpites)

---

## 4. Regras de Visibilidade de Picks

| Quem vê | O que vê |
|---|---|
| Próprio participante | Todos os picks, mesmo fases futuras |
| Outros participantes | Só picks de fases onde **todos** os jogos daquela fase estão `FINISHED`/`AWARDED` |

"Fase encerrada" = todos os `KnockoutMatch` daquela `FaseChave` têm `partida.status_api` em `FINISHED` ou `AWARDED`.

`filtrarPicksVisiveis()` implementa isso: para cada par `(faseChave, nodeIds)`, verifica o engine e retorna somente os picks de fases totalmente encerradas para não-donos.

---

## 5. Ordem de Implementação

### Passo 1 — Tipos e pesos (base para tudo)
1. Adicionar `FaseScore` e atualizar `PesosChave` em `src/lib/types.ts`
2. Atualizar `DEFAULT_PESOS_CRAVADA` em `src/lib/regras.ts`
3. Rodar `npm run lint` + `npm test` para garantir que nada quebrou

### Passo 2 — Motor de bracket
4. Adicionar `realPerdedor: Map<string, string | null>` ao `KnockoutEngine` em `src/lib/knockoutBracket.ts`
5. Popular `realPerdedor` nas funções que já populam `realAdvancer`

### Passo 3 — Scoring
6. Estender `scoreCravada()` em `src/lib/chaveScoring.ts` com `scoreNodeFinal()` para vice + campeão
7. Espelhar em `functions/src/scoring.ts`
8. Atualizar `npm test` para cobrir os novos casos (vice correto, campeão correto, ambos, nenhum)

### Passo 4 — Privacidade
9. Criar `src/lib/cravadaPrivacy.ts` com `filtrarPicksVisiveis()`
10. Cobrir com testes unitários (fase aberta oculta picks, fase encerrada expõe)

### Passo 5 — UI de input de picks
11. `CravadaProgressBar` — componente simples de progresso (X de 33 picks feitos)
12. Completar `onPick` em `src/components/ChaveBracket.tsx` — handler de click nos slots editáveis
13. `CravadaFinalPicks` — UI especial para selecionar vice + campeão (dois slots clicáveis com os finalistas como opções, populados a partir dos SF picks)
14. Integrar tudo em `src/pages/ChavePage.tsx` — fluxo: editar → progredir → travar

### Passo 6 — Confirmação de travamento
15. `CravadaLockDialog` — modal com aviso de irreversibilidade
16. Ligar `lockCravada()` de `src/lib/chavePalpite.ts` ao dialog

### Passo 7 — Exibição pós-jogo
17. Em `src/components/ChaveBracket.tsx`: usar `filtrarPicksVisiveis()` ao exibir picks de outros participantes
18. Marcar visualmente picks corretos vs errados após encerramento de cada fase

### Passo 8 — Cloud Function
19. Adicionar trigger `onPartidaEliminatoriaUpdate` em `functions/src/index.ts` para recalcular `pontos_cravada` de todos os participantes quando um jogo eliminatório encerrar

### Passo 9 — Ranking
20. Verificar que `src/components/RankingCard.tsx` exibe `pontos_cravada` com label correto
21. Verificar ordenação de desempate (a Cravada já entra via `total_pontos`)

---

## Resumo do delta

- **Linhas novas estimadas:** ~400 (componentes UI) + ~80 (scoring/privacy) + ~60 (Cloud Function trigger)
- **Zero mudança de schema Firestore:** `ChavePicks` como `Record<string, string>` absorve os novos node IDs `final-campeao` e `final-vice` sem migração
- **Risco principal:** sincronizar `FaseScore` com `FaseChave` sem quebrar o motor visual — manter os dois tipos distintos evita isso
