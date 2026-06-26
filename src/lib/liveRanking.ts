import type {
  AcertoTipo,
  Participante,
  Palpite,
  Partida,
  ParticipanteRanking,
  ParticipanteStats,
  RegrasChave,
} from './types'
import {
  calcularPontos,
  calcularPosicoes,
  classificarTipoAcerto,
  partidaAoVivo,
  partidaEncerrada,
  temPalpite,
} from './scoring'
import { isPastKickoff } from './dates'
import { buildEngine, type KnockoutEngine } from './knockoutBracket'
import { scoreChave } from './chaveScoring'
import type { PalpiteChaveDoc } from './chavePalpite'

export function getPontosLive(palpite: Palpite, partida: Partida): number | null {
  const temPlacar = partida.gols_casa !== null && partida.gols_fora !== null
  if ((!partidaEncerrada(partida) && !partidaAoVivo(partida)) || !temPlacar || !temPalpite(palpite)) return null
  return calcularPontos(
    { casa: partida.gols_casa!, fora: partida.gols_fora! },
    { casa: palpite.palpite_casa!, fora: palpite.palpite_fora! },
  )
}

export function contarEstatisticasLive(
  palpites: Palpite[],
  partidasMap: Map<string, Partida>,
): ParticipanteStats {
  let total_pontos = 0
  let na_mosca = 0
  let acerto_resultado = 0
  let sem_aposta = 0

  for (const palpite of palpites) {
    const partida = partidasMap.get(palpite.partida_id)
    if (!partida) continue

    if (!temPalpite(palpite)) {
      if (partidaEncerrada(partida) || isPastKickoff(partida)) {
        sem_aposta += 1
      }
      continue
    }

    const temPlacar = partida.gols_casa !== null && partida.gols_fora !== null
    if (temPlacar && (partidaEncerrada(partida) || partidaAoVivo(partida))) {
      const pts = getPontosLive(palpite, partida)!
      total_pontos += pts
      if (pts === 9) na_mosca += 1
      if (pts >= 4) acerto_resultado += 1
    }
  }

  return { total_pontos, na_mosca, acerto_resultado, sem_aposta }
}

export function contarPontosAoVivo(
  palpites: Palpite[],
  partidasMap: Map<string, Partida>,
): number {
  let pontos = 0

  for (const palpite of palpites) {
    const partida = partidasMap.get(palpite.partida_id)
    if (!partida || !partidaAoVivo(partida) || !temPalpite(palpite)) continue

    const pts = getPontosLive(palpite, partida)
    if (pts !== null && pts > 0) pontos += pts
  }

  return pontos
}

export interface ChaveRankingOpts {
  chaveDocs: PalpiteChaveDoc[]
  regrasChave: RegrasChave
  /** Engine pré-construído; se ausente, é montado das `partidas`. */
  engine?: KnockoutEngine
}

export function buildLiveRanking(
  participantes: Participante[],
  palpites: Palpite[],
  partidas: Partida[],
  chave?: ChaveRankingOpts,
): ParticipanteRanking[] {
  const partidasMap = new Map(partidas.map((p) => [p.id, p]))
  const palpitesByParticipante = new Map<string, Palpite[]>()

  for (const palpite of palpites) {
    const list = palpitesByParticipante.get(palpite.participante_id) ?? []
    list.push(palpite)
    palpitesByParticipante.set(palpite.participante_id, list)
  }

  const engine = chave ? chave.engine ?? buildEngine(partidas) : null
  const chaveByParticipante = new Map<string, PalpiteChaveDoc>()
  if (chave) {
    for (const doc of chave.chaveDocs) {
      if (doc.participante_id) chaveByParticipante.set(doc.participante_id, doc)
    }
  }

  const withStats = participantes.map((p) => {
    const palpitesDoParticipante = palpitesByParticipante.get(p.id) ?? []
    const stats = contarEstatisticasLive(palpitesDoParticipante, partidasMap)
    const pontos_ao_vivo = contarPontosAoVivo(palpitesDoParticipante, partidasMap)

    if (chave && engine) {
      const placar = chave.regrasChave.placarAtivo ? stats.total_pontos : 0
      const breakdown = scoreChave(chaveByParticipante.get(p.id) ?? null, engine, chave.regrasChave)
      return {
        ...p,
        ...stats,
        total_pontos: placar + breakdown.total,
        pontos_placar: placar,
        pontos_cravada: breakdown.cravada,
        pontos_flex: breakdown.flex,
        pontos_ao_vivo,
      }
    }

    return { ...p, ...stats, pontos_ao_vivo }
  })

  const posicoes = calcularPosicoes(withStats)

  return withStats
    .map((p) => ({ ...p, posicao: posicoes.get(p.id) ?? 99 }))
    .sort((a, b) => a.posicao - b.posicao)
}

export function countPartidasAoVivo(partidas: Partida[]): number {
  return partidas.filter((p) => partidaAoVivo(p)).length
}

export function classificarAcertoLive(palpite: Palpite, partida: Partida): AcertoTipo {
  const encerrada = partidaEncerrada(partida)
  if (!temPalpite(palpite)) {
    if (encerrada || isPastKickoff(partida)) return 'sem_aposta'
    return 'sem_aposta'
  }
  if (!encerrada) return 'nada'
  const pts = getPontosLive(palpite, partida)
  if (pts === null) return 'nada'
  return classificarTipoAcerto(
    pts,
    { casa: partida.gols_casa!, fora: partida.gols_fora! },
    { casa: palpite.palpite_casa!, fora: palpite.palpite_fora! },
  )
}
