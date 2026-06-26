# Copa do Mundo 2026 — Chaveamento da Fase Eliminatória

## Contexto geral

A Copa de 2026 é a primeira com 48 seleções. Isso criou uma fase eliminatória diferente de todas as edições anteriores. O mata-mata agora começa com 32 times (não 16), então tem uma rodada a mais.

---

## Quem se classifica da fase de grupos

- 12 grupos de 4 seleções cada
- Avançam: **1º e 2º de cada grupo** (24 seleções) + **8 melhores terceiros colocados** (entre os 12 terceiros) = **32 classificados**

### Critérios para escolher os melhores terceiros colocados
Em ordem de prioridade:
1. Pontos
2. Saldo de gols
3. Gols marcados
4. Fair play (cartões)
5. Ranking FIFA

---

## Estrutura do mata-mata

```
32 seleções
    ↓
16-avos de final (16 jogos) → 16 classificados
    ↓
Oitavas de final (8 jogos) → 8 classificados
    ↓
Quartas de final (4 jogos) → 4 classificados
    ↓
Semifinais (2 jogos) → 2 finalistas + 2 semifinalistas
    ↓
Disputa de 3º lugar + Final
```

Campeão precisa vencer **5 jogos** na fase eliminatória (1 a mais que nas Copas anteriores).

---

## 16-avos de final — Como funciona o chaveamento

Esta é a parte mais complexa. O chaveamento dos 16-avos **não é simplesmente 1º de um grupo vs 2º de outro**. A FIFA montou uma tabela fixa de confrontos cruzados entre grupos, onde alguns slots são preenchidos por primeiros colocados, outros por segundos, e alguns por terceiros (dependendo de quais grupos os oito melhores terceiros vierem).

### Confrontos fixos dos 16-avos (estrutura da FIFA)

Os 16 jogos têm a seguinte lógica de origem dos classificados:

| Jogo | Time A | Time B |
|------|--------|--------|
| 1 | 1º Grupo E (Alemanha) | 3º dos grupos A/B/C/D/F* |
| 2 | 1º Grupo A (México) | 3º dos grupos C/E/F/H/I* |
| 3 | 1º Grupo D (EUA) | 3º dos grupos B/E/F/I/J* |
| 4 | 1º Grupo B (Suíça) | 3º dos grupos E/F/G/I/J* |
| 5 | 1º Grupo G (Austrália?) | 2º Grupo G |
| 6 | 1º Grupo C (Brasil) | 2º Grupo F |
| 7 | 1º Grupo F | 2º Grupo C |
| 8 | 1º Grupo J (Argentina) | 2º Grupo H |
| 9 | 1º Grupo I (França) | 2º Grupo L |
| 10 | 1º Grupo L | 2º Grupo I |
| 11 | 1º Grupo H | 2º Grupo J |
| 12 | 1º Grupo K (Colômbia) | 3º dos grupos G/H/K/L* |
| 13 | Costa do Marfim (1º H?) | 2º Grupo I |
| 14 | 1º Grupo K | 3º dos grupos ... |
| ...  | ... | ... |

> **Nota**: A tabela exata com todos os slots está no regulamento oficial da FIFA. Os confrontos 1º×2º entre grupos específicos (ex: 1º C vs 2º F) são fixos. Os slots de terceiros colocados dependem de uma **matriz de distribuição** com até **495 combinações possíveis** definidas pela FIFA com base em quais grupos os terceiros vieram.

### Como a matriz de terceiros funciona

A FIFA pré-definiu para cada combinação possível de "quais são os 8 grupos que forneceram terceiros colocados" → em qual slot do chaveamento cada terceiro vai. Isso existe para:
- Evitar que uma seleção enfrente um time do próprio grupo
- Distribuir os terceiros nos confrontos corretos do chaveamento

**Na prática para o código:** quando os resultados da fase de grupos terminam, você precisa:
1. Identificar os 8 melhores terceiros colocados
2. Identificar de quais grupos eles vieram (ex: "terceiros dos grupos B, D, E, G, H, I, J, K")
3. Consultar a tabela da FIFA para essa combinação específica → ela diz qual terceiro vai em qual slot

---

## Confrontos conhecidos/confirmados (situação em 26/06/2026)

Com base nos classificados já confirmados ou prováveis:

- **Alemanha × 3º colocado** — 29/jun, Boston
- **África do Sul × Canadá** — já confirmado
- **Estados Unidos × Bósnia e Herzegovina** — 1º/jul, Santa Clara
- **Brasil × 2º do Grupo F** (provável Japão ou Países Baixos) — confronto fixo
- **Argentina × 2º do Grupo H** — 3/jul, Miami
- **França × 2º do Grupo L** — confronto fixo

---

## Datas da fase eliminatória

| Fase | Datas |
|------|-------|
| 16-avos de final | 28/jun a 3/jul |
| Oitavas de final | 4 a 7/jul |
| Quartas de final | 9, 10 e 11/jul |
| Semifinais | 14 e 15/jul |
| Disputa de 3º lugar | 18/jul |
| Final | 19/jul |

---

## Regras de desempate nos jogos eliminatórios

1. Empate nos 90min → **prorrogação** (2x15min)
2. Persiste empate → **pênaltis**

Não existe gol de ouro nem gol fora de casa — é sempre prorrogação completa + pênaltis se necessário.

---

## Regras de cartões no mata-mata

- 2 cartões amarelos em jogos diferentes → suspensão automática no próximo jogo
- Cartão amarelo isolado da fase de grupos **não** é carregado para o mata-mata
- Suspensão por cartão vermelho **é** carregada
- Cartões amarelos acumulados são zerados antes das semifinais

---

## Implicações para modelagem de dados

Para representar o chaveamento no código, considere:

```
Match {
  id
  phase: "round_of_32" | "round_of_16" | "quarterfinal" | "semifinal" | "third_place" | "final"
  slot: number  // posição fixa no chaveamento (1-32)
  home_team: Team | null  // null até ser definido
  away_team: Team | null
  home_score: number | null
  away_score: number | null
  home_score_et: number | null  // prorrogação
  away_score_et: number | null
  home_score_pen: number | null  // pênaltis
  away_score_pen: number | null
  winner: Team | null
  date: Date
  venue: string
}

// Para resolver os slots dos terceiros colocados:
ThirdPlaceSlotMatrix {
  // chave: conjunto dos 8 grupos que forneceram terceiros (ex: "BDEGHIJK")
  // valor: mapa de slot → grupo de origem do terceiro
  [groupsCombination: string]: { [slot: number]: string }
}
```

O chaveamento a partir das oitavas em diante é simples: vencedor do jogo X enfrenta vencedor do jogo Y, slots definidos estaticamente.

---

## Fonte

Regulamento oficial da FIFA para a Copa do Mundo 2026. Confrontos confirmados via CNN Brasil e Olympics.com (26/06/2026).
