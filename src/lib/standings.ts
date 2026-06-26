import type { Partida } from './types'

/**
 * Classificação da fase de grupos da Copa 2026, calculada a partir das partidas.
 *
 * Os 12 grupos são reconstruídos automaticamente da própria tabela de jogos
 * (cada seleção enfrenta exatamente as outras 3 do seu grupo na 1ª fase), e
 * rotulados A–L por um time âncora (cabeça de chave / anfitrião) garantido em
 * cada grupo — coincide com o sorteio oficial da FIFA (05/12/2025).
 *
 * Desempate: pontos → saldo de gols → gols marcados. Critérios mais finos
 * (fair play / ranking FIFA) não são considerados por falta de dados.
 */

export type GroupLetter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L'

export const GROUP_LETTERS: GroupLetter[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
]

/** Time âncora garantidamente presente em cada grupo (para rotular A–L). */
const GROUP_ANCHORS: Record<GroupLetter, string> = {
  A: 'México',
  B: 'Suíça',
  C: 'Brasil',
  D: 'Estados Unidos',
  E: 'Alemanha',
  F: 'Holanda',
  G: 'Bélgica',
  H: 'Espanha',
  I: 'França',
  J: 'Argentina',
  K: 'Portugal',
  L: 'Inglaterra',
}

export interface TeamStanding {
  team: string
  jogos: number
  vitorias: number
  empates: number
  derrotas: number
  gols_pro: number
  gols_contra: number
  saldo: number
  pontos: number
  posicao: number
}

export interface GroupStanding {
  letter: GroupLetter
  teams: TeamStanding[]
  /** Todos os 6 jogos do grupo já encerraram. */
  complete: boolean
}

function isGroupStage(p: Partida): boolean {
  return /grupo|primeira fase|group/i.test(p.fase ?? '')
}

function isFinished(p: Partida): boolean {
  if (p.gols_casa == null || p.gols_fora == null) return false
  const s = (p.status_api ?? '').toUpperCase()
  if (s) return s === 'FINISHED' || s === 'AWARDED'
  // Sem status (ex.: seed): placar presente já conta como encerrado.
  return true
}

/** Reconstrói os 12 grupos a partir da tabela de jogos da fase de grupos. */
export function reconstructGroups(partidas: Partida[]): Map<GroupLetter, string[]> {
  const adj = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, new Set())
    adj.get(a)!.add(b)
  }
  for (const p of partidas) {
    if (!isGroupStage(p)) continue
    link(p.time_casa, p.time_fora)
    link(p.time_fora, p.time_casa)
  }

  const visited = new Set<string>()
  const result = new Map<GroupLetter, string[]>()

  for (const start of adj.keys()) {
    if (visited.has(start)) continue
    const comp: string[] = []
    const stack = [start]
    visited.add(start)
    while (stack.length) {
      const t = stack.pop()!
      comp.push(t)
      for (const n of adj.get(t) ?? []) {
        if (!visited.has(n)) {
          visited.add(n)
          stack.push(n)
        }
      }
    }
    const letter = GROUP_LETTERS.find((L) => comp.includes(GROUP_ANCHORS[L]))
    if (letter) result.set(letter, comp.sort((a, b) => a.localeCompare(b, 'pt-BR')))
  }

  return result
}

function compareStandings(a: TeamStanding, b: TeamStanding): number {
  return (
    b.pontos - a.pontos ||
    b.saldo - a.saldo ||
    b.gols_pro - a.gols_pro ||
    a.team.localeCompare(b.team, 'pt-BR')
  )
}

/** Classificação por grupo (rotulado A–L), ordenada e com posições. */
export function computeGroupStandings(partidas: Partida[]): Map<GroupLetter, GroupStanding> {
  const groups = reconstructGroups(partidas)
  const out = new Map<GroupLetter, GroupStanding>()

  for (const [letter, teams] of groups) {
    const stats = new Map<string, TeamStanding>()
    for (const team of teams) {
      stats.set(team, {
        team,
        jogos: 0,
        vitorias: 0,
        empates: 0,
        derrotas: 0,
        gols_pro: 0,
        gols_contra: 0,
        saldo: 0,
        pontos: 0,
        posicao: 0,
      })
    }

    let jogosEncerrados = 0
    for (const p of partidas) {
      if (!isGroupStage(p) || !isFinished(p)) continue
      const casa = stats.get(p.time_casa)
      const fora = stats.get(p.time_fora)
      if (!casa || !fora) continue
      jogosEncerrados++

      const gc = p.gols_casa!
      const gf = p.gols_fora!
      casa.jogos++
      fora.jogos++
      casa.gols_pro += gc
      casa.gols_contra += gf
      fora.gols_pro += gf
      fora.gols_contra += gc

      if (gc > gf) {
        casa.vitorias++
        casa.pontos += 3
        fora.derrotas++
      } else if (gc < gf) {
        fora.vitorias++
        fora.pontos += 3
        casa.derrotas++
      } else {
        casa.empates++
        fora.empates++
        casa.pontos++
        fora.pontos++
      }
    }

    for (const s of stats.values()) s.saldo = s.gols_pro - s.gols_contra
    const sorted = [...stats.values()].sort(compareStandings)
    sorted.forEach((s, i) => (s.posicao = i + 1))

    out.set(letter, { letter, teams: sorted, complete: jogosEncerrados === 6 })
  }

  return out
}
