import type { ChaveData, KnockoutFase, KnockoutMatch, SlotRef } from './chave'
import { computeGroupStandings } from './standings'
import type { GroupLetter, GroupStanding } from './standings'
import { getKickoffDate } from './dates'
import { apostasAbertas, partidaEncerrada } from './scoring'
import type { Palpite, Partida } from './types'
import {
  BRACKET_TEMPLATE,
  FASE_ORDER,
  type BracketTemplateNode,
} from '../data/chaveBracketTemplate'
import type { SlotSpec } from '../data/chaveR32Template'

const TBD: SlotRef = { tipo: 'placeholder', label: 'a definir' }

/** Mapa de palpites: nó → nome do time escolhido para avançar. */
export type ChavePicks = Record<string, string>
/** Palpites flexíveis por fase. */
export type ChaveFlexPicks = Partial<Record<KnockoutFase, ChavePicks>>

/** Ids reservados para os dois picks pontuáveis da final. */
export const CAMPEAO_PICK = 'final-campeao'
export const VICE_PICK = 'final-vice'

/**
 * Total de picks de uma cravada completa: 16+8+4+2 (lados) + 3º + vice +
 * campeão = 33. A final conta como dois (campeão e vice).
 */
export const TOTAL_PICKS_CRAVADA = BRACKET_TEMPLATE.length + 1

/** Quantos picks o usuário já preencheu (campeão e vice contam separadamente). */
export function contarPicksCravada(picks: ChavePicks): number {
  let n = 0
  for (const node of BRACKET_TEMPLATE) {
    if (node.fase === 'final') {
      if (picks[CAMPEAO_PICK]) n++
      if (picks[VICE_PICK]) n++
    } else if (picks[node.id]) {
      n++
    }
  }
  return n
}

/** Converte o rótulo de fase do sync (pt-BR) para a chave canônica. */
export function faseFromLabel(label: string | undefined | null): KnockoutFase | null {
  const f = (label ?? '').toLowerCase()
  if (/16.?avos/.test(f)) return 'r32'
  if (/oitavas/.test(f)) return 'r16'
  if (/quartas/.test(f)) return 'qf'
  if (/semi/.test(f)) return 'sf'
  if (/3º|3o|terceiro|third/.test(f)) return 'terceiro'
  if (/final/.test(f)) return 'final'
  return null
}

function timeRef(nome: string): SlotRef {
  return { tipo: 'time', nome }
}

function projRef(nome: string, projetado: boolean): SlotRef {
  return projetado ? { tipo: 'time', nome, projetado: true } : { tipo: 'time', nome }
}

function teamName(ref: SlotRef | undefined): string | null {
  return ref && ref.tipo === 'time' ? ref.nome : null
}

function resolveR32Slot(spec: SlotSpec, standings: Map<GroupLetter, GroupStanding>): SlotRef {
  if (spec.kind === 'third') {
    return { tipo: 'placeholder', label: `3º ${spec.groups.join('/')}` }
  }
  const pos = spec.kind === 'winner' ? 1 : 2
  const grupo = standings.get(spec.group)
  if (grupo?.complete) {
    const t = grupo.teams.find((x) => x.posicao === pos)
    if (t) return timeRef(t.team)
  }
  return { tipo: 'placeholder', label: `${pos}º Grupo ${spec.group}` }
}

function findPartida(list: Partida[], a: string, b: string): Partida | undefined {
  return list.find(
    (p) =>
      (p.time_casa === a && p.time_fora === b) || (p.time_casa === b && p.time_fora === a),
  )
}

function findByTeam(list: Partida[], team: string): Partida | undefined {
  return list.find((p) => p.time_casa === team || p.time_fora === team)
}

/**
 * Casa um jogo real dos 16-avos. Como não resolvemos a matriz dos 495 terceiros,
 * o slot do "3º" fica placeholder; aqui usamos o lado conhecido (1º/2º) pra achar
 * a partida real e preencher o outro lado com o adversário de verdade.
 */
function attachR32(
  A: SlotRef,
  B: SlotRef,
  list: Partida[],
): { A: SlotRef; B: SlotRef; partida: Partida | undefined } {
  const aN = teamName(A)
  const bN = teamName(B)

  if (aN && bN) {
    return { A, B, partida: findPartida(list, aN, bN) }
  }
  if (aN && !bN) {
    const partida = findByTeam(list, aN)
    if (!partida) return { A, B, partida: undefined }
    const other = partida.time_casa === aN ? partida.time_fora : partida.time_casa
    return { A, B: timeRef(other), partida }
  }
  if (bN && !aN) {
    const partida = findByTeam(list, bN)
    if (!partida) return { A, B, partida: undefined }
    const other = partida.time_casa === bN ? partida.time_fora : partida.time_casa
    return { A: timeRef(other), B, partida }
  }
  return { A, B, partida: undefined }
}

/** Time que avançou no jogo real (resolve prorrogação/pênaltis via `vencedor`). */
function realAdvancerOf(p: Partida | undefined): string | null {
  if (!p || !partidaEncerrada(p)) return null
  if (p.vencedor === 'casa') return p.time_casa
  if (p.vencedor === 'fora') return p.time_fora
  if (p.gols_casa != null && p.gols_fora != null && p.gols_casa !== p.gols_fora) {
    return p.gols_casa > p.gols_fora ? p.time_casa : p.time_fora
  }
  return null
}

/** Time eliminado no confronto real (o outro do jogo, dado quem avançou). */
function realLoserOf(p: Partida | undefined, advancer: string | null): string | null {
  if (!p || !advancer) return null
  if (advancer === p.time_casa) return p.time_fora
  if (advancer === p.time_fora) return p.time_casa
  return null
}

export interface KnockoutEngine {
  /** Times reais/esperados (1º A, etc.) por nó. */
  realTeams: Map<string, { A: SlotRef; B: SlotRef }>
  /** Time que avançou de fato por nó (null enquanto indefinido). */
  realAdvancer: Map<string, string | null>
  /** Time eliminado de fato por nó (null enquanto indefinido). */
  realPerdedor: Map<string, string | null>
  /** Partida real associada por nó. */
  realPartida: Map<string, Partida | undefined>
  /** Apito do primeiro jogo de cada fase (para prazos). */
  primeiroKickoff: Map<KnockoutFase, Date | null>
}

/** Constrói a árvore viva a partir das partidas reais do sync. */
export function buildEngine(partidas: Partida[]): KnockoutEngine {
  const standings = computeGroupStandings(partidas)

  const porFase = new Map<KnockoutFase, Partida[]>()
  for (const p of partidas) {
    const fase = faseFromLabel(p.fase)
    if (!fase) continue
    if (!porFase.has(fase)) porFase.set(fase, [])
    porFase.get(fase)!.push(p)
  }

  const realTeams = new Map<string, { A: SlotRef; B: SlotRef }>()
  const realAdvancer = new Map<string, string | null>()
  const realPerdedor = new Map<string, string | null>()
  const realPartida = new Map<string, Partida | undefined>()

  const teamFromFeed = (feed: BracketTemplateNode['feedA']): SlotRef => {
    if (!feed) return TBD
    const adv = realAdvancer.get(feed.from) ?? null
    if (feed.take === 'winner') return adv ? timeRef(adv) : TBD
    // perdedor: o outro time do nó de origem (3º lugar)
    const teams = realTeams.get(feed.from)
    if (adv && teams) {
      const aN = teamName(teams.A)
      const bN = teamName(teams.B)
      const loser = adv === aN ? bN : adv === bN ? aN : null
      if (loser) return timeRef(loser)
    }
    return TBD
  }

  for (const fase of FASE_ORDER) {
    const list = porFase.get(fase) ?? []
    const nodes = BRACKET_TEMPLATE.filter((n) => n.fase === fase)
    for (const node of nodes) {
      let A: SlotRef
      let B: SlotRef
      let partida: Partida | undefined
      if (node.r32) {
        // Bolões mata-mata gravam os 16-avos reais com id `r32-{no}` → casa
        // direto, sem depender dos resultados da fase de grupos.
        const no = node.r32.no
        const direct = list.find((p) => p.id === `r32-${no}`)
        if (direct) {
          A = timeRef(direct.time_casa)
          B = timeRef(direct.time_fora)
          partida = direct
        } else {
          const resolved = attachR32(
            resolveR32Slot(node.r32.a, standings),
            resolveR32Slot(node.r32.b, standings),
            list,
          )
          A = resolved.A
          B = resolved.B
          partida = resolved.partida
        }
      } else {
        A = teamFromFeed(node.feedA)
        B = teamFromFeed(node.feedB)
        const aN = teamName(A)
        const bN = teamName(B)
        partida = aN && bN ? findPartida(list, aN, bN) : undefined
      }
      const adv = realAdvancerOf(partida)
      realTeams.set(node.id, { A, B })
      realPartida.set(node.id, partida)
      realAdvancer.set(node.id, adv)
      realPerdedor.set(node.id, realLoserOf(partida, adv))
    }
  }

  const primeiroKickoff = new Map<KnockoutFase, Date | null>()
  for (const fase of FASE_ORDER) {
    const list = porFase.get(fase) ?? []
    let earliest: Date | null = null
    for (const p of list) {
      const k = getKickoffDate(p)
      if (!earliest || k < earliest) earliest = k
    }
    primeiroKickoff.set(fase, earliest)
  }

  return { realTeams, realAdvancer, realPerdedor, realPartida, primeiroKickoff }
}

function side(team: string | null, A: SlotRef, B: SlotRef): 'A' | 'B' | null {
  if (!team) return null
  if (teamName(A) === team) return 'A'
  if (teamName(B) === team) return 'B'
  return null
}

function baseMatch(node: BracketTemplateNode, A: SlotRef, B: SlotRef): KnockoutMatch {
  return { id: node.id, fase: node.fase, lado: node.lado, slot: node.slot, timeA: A, timeB: B }
}

/**
 * Vista de "resultados reais": times propagados pelos vencedores de verdade.
 * Serve de preview/overlay e de base para a flexível.
 */
export function engineToResultado(engine: KnockoutEngine): ChaveData {
  const matches: KnockoutMatch[] = BRACKET_TEMPLATE.map((node) => {
    const { A, B } = engine.realTeams.get(node.id) ?? { A: TBD, B: TBD }
    const m = baseMatch(node, A, B)
    m.partida = engine.realPartida.get(node.id)
    m.selecionado = side(engine.realAdvancer.get(node.id) ?? null, A, B)
    return m
  })
  return { competicao: 'Copa do Mundo 2026', matches }
}

/**
 * Vista da chave cravada: 16-avos com times reais/esperados; fases internas
 * preenchidas pela cascata dos palpites do usuário. Quando há resultado real,
 * marca acerto/erro do avançador escolhido.
 */
export function engineToCravada(
  engine: KnockoutEngine,
  picks: ChavePicks,
  opts: { editavel: boolean; now?: Date } = { editavel: false },
): ChaveData {
  const now = opts.now ?? new Date()
  const pickAdvancer = new Map<string, string | null>()
  const teamA = new Map<string, SlotRef>()
  const teamB = new Map<string, SlotRef>()

  const teamFromPick = (feed: BracketTemplateNode['feedA']): SlotRef => {
    if (!feed) return TBD
    const adv = pickAdvancer.get(feed.from) ?? null
    if (feed.take === 'winner') return adv ? timeRef(adv) : TBD
    if (adv) {
      const aN = teamName(teamA.get(feed.from))
      const bN = teamName(teamB.get(feed.from))
      const loser = adv === aN ? bN : adv === bN ? aN : null
      if (loser) return timeRef(loser)
    }
    return TBD
  }

  const matches: KnockoutMatch[] = []
  for (const fase of FASE_ORDER) {
    for (const node of BRACKET_TEMPLATE.filter((n) => n.fase === fase)) {
      let A: SlotRef
      let B: SlotRef
      if (node.r32) {
        const rt = engine.realTeams.get(node.id) ?? { A: TBD, B: TBD }
        A = rt.A
        B = rt.B
      } else {
        A = teamFromPick(node.feedA)
        B = teamFromPick(node.feedB)
      }
      teamA.set(node.id, A)
      teamB.set(node.id, B)

      const partida = engine.realPartida.get(node.id)

      // A final guarda o campeão num id reservado (final-campeao); o vice
      // (final-vice) é o outro finalista, derivado automaticamente. Fallback para
      // a chave antiga (`final`) para docs ainda não migrados.
      const picked =
        (node.fase === 'final' ? picks[CAMPEAO_PICK] ?? picks[node.id] : picks[node.id]) ?? null
      const pickedSide = side(picked, A, B)
      // Cascata: usa o pick do usuário; se o jogo já encerrou e ele não palpitou,
      // propaga o vencedor REAL para destravar as fases seguintes (ele só não
      // pontua por esse confronto).
      let cascadeAdv: string | null = pickedSide ? picked : null
      if (!cascadeAdv && partida && partidaEncerrada(partida)) {
        cascadeAdv = engine.realAdvancer.get(node.id) ?? null
      }
      pickAdvancer.set(node.id, cascadeAdv)

      const m = baseMatch(node, A, B)
      m.partida = partida
      m.selecionado = pickedSide
      // Cada confronto tem prazo próprio: jogos que já começaram (ou sem os dois
      // times definidos) não podem mais ser palpitados.
      m.editavel =
        opts.editavel &&
        teamName(A) !== null &&
        teamName(B) !== null &&
        (!partida || apostasAbertas(partida, now))

      const real = engine.realAdvancer.get(node.id) ?? null
      if (real && pickedSide) {
        const acertou = picked === real
        if (pickedSide === 'A') m.acertoA = acertou
        else m.acertoB = acertou
      }
      matches.push(m)
    }
  }
  return { competicao: 'Copa do Mundo 2026', matches }
}

/**
 * Progresso da cravada: quantos confrontos com os dois times já definidos ainda
 * estão sem palpite de avançador. `completa` só é verdadeiro quando não falta
 * nenhum e a final já tem um campeão escolhido.
 */
export function cravadaProgress(data: ChaveData): { faltam: number; completa: boolean } {
  let faltam = 0
  let finalEscolhida = false
  for (const m of data.matches) {
    const prontos = m.timeA.tipo === 'time' && m.timeB.tipo === 'time'
    if (prontos && !m.selecionado) faltam++
    if (m.fase === 'final' && m.selecionado) finalEscolhida = true
  }
  return { faltam, completa: finalEscolhida && faltam === 0 }
}

/** Vencedor previsto pelo placar do usuário (empate não decide mata-mata). */
function placarWinner(
  partida: Partida,
  pal: Pick<Palpite, 'palpite_casa' | 'palpite_fora'> | undefined,
): string | null {
  if (!pal || pal.palpite_casa == null || pal.palpite_fora == null) return null
  if (pal.palpite_casa > pal.palpite_fora) return partida.time_casa
  if (pal.palpite_fora > pal.palpite_casa) return partida.time_fora
  return null
}

/**
 * Vista do modo placar: 16-avos com times reais; fases seguintes preenchidas
 * com quem o usuário acredita que avança (pelo placar palpitado) — em projeção
 * (itálico/baixa opacidade). Quando o jogo de verdade encerra, o avançador real
 * substitui a projeção (sólido).
 */
export function engineToPlacarProjection(
  engine: KnockoutEngine,
  palpites: Map<string, Pick<Palpite, 'palpite_casa' | 'palpite_fora'>>,
): ChaveData {
  const advancer = new Map<string, { team: string; projetado: boolean } | null>()
  const teamA = new Map<string, SlotRef>()
  const teamB = new Map<string, SlotRef>()

  const advFromFeed = (feed: BracketTemplateNode['feedA']): SlotRef => {
    if (!feed) return TBD
    const adv = advancer.get(feed.from) ?? null
    if (!adv) return TBD
    if (feed.take === 'winner') return projRef(adv.team, adv.projetado)
    const aN = teamName(teamA.get(feed.from))
    const bN = teamName(teamB.get(feed.from))
    const loser = adv.team === aN ? bN : adv.team === bN ? aN : null
    return loser ? projRef(loser, adv.projetado) : TBD
  }

  const matches: KnockoutMatch[] = []
  for (const fase of FASE_ORDER) {
    for (const node of BRACKET_TEMPLATE.filter((n) => n.fase === fase)) {
      let A: SlotRef
      let B: SlotRef
      if (node.r32) {
        const rt = engine.realTeams.get(node.id) ?? { A: TBD, B: TBD }
        A = rt.A
        B = rt.B
      } else {
        A = advFromFeed(node.feedA)
        B = advFromFeed(node.feedB)
      }
      teamA.set(node.id, A)
      teamB.set(node.id, B)

      const partida = engine.realPartida.get(node.id)
      const real = engine.realAdvancer.get(node.id) ?? null
      let adv: { team: string; projetado: boolean } | null = null
      if (real) {
        adv = { team: real, projetado: false }
      } else if (partida) {
        const w = placarWinner(partida, palpites.get(partida.id))
        if (w) adv = { team: w, projetado: true }
      }
      advancer.set(node.id, adv)

      const m = baseMatch(node, A, B)
      m.partida = partida
      m.selecionado = real ? side(real, A, B) : null
      matches.push(m)
    }
  }
  return { competicao: 'Copa do Mundo 2026', matches }
}

/**
 * Vista flexível: times reais por fase (propagados pelos vencedores de verdade);
 * o usuário palpita o avançador da fase aberta. `faseEditavel` controla quais
 * jogos aceitam clique.
 */
export function engineToFlex(
  engine: KnockoutEngine,
  flex: ChaveFlexPicks,
  opts: { fasesEditaveis?: Set<KnockoutFase> } = {},
): ChaveData {
  const editaveis = opts.fasesEditaveis ?? new Set<KnockoutFase>()
  const matches: KnockoutMatch[] = BRACKET_TEMPLATE.map((node) => {
    const { A, B } = engine.realTeams.get(node.id) ?? { A: TBD, B: TBD }
    const m = baseMatch(node, A, B)
    m.partida = engine.realPartida.get(node.id)

    const picked = flex[node.fase]?.[node.id] ?? null
    const pickedSide = side(picked, A, B)
    m.selecionado = pickedSide
    m.editavel =
      editaveis.has(node.fase) && teamName(A) !== null && teamName(B) !== null

    const real = engine.realAdvancer.get(node.id) ?? null
    if (real && pickedSide) {
      const acertou = picked === real
      if (pickedSide === 'A') m.acertoA = acertou
      else m.acertoB = acertou
    }
    return m
  })
  return { competicao: 'Copa do Mundo 2026', matches }
}
