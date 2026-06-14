export {
  calcularPontos,
  calcularPosicoes,
  partidaEncerrada,
  temPalpite,
} from '../../src/lib/scoring'

import { calcularPontos, partidaEncerrada, temPalpite } from '../../src/lib/scoring'
import type { Partida, Palpite, ParticipanteStats } from '../../src/lib/types'

/**
 * Recalcula pontos a partir do placar (não confia no valor armazenado em palpite.pontos).
 * Diferente da versão do frontend, que confia no DB.
 */
export function contarEstatisticas(
  palpites: Palpite[],
  partidasMap: Map<string, Partida>,
): ParticipanteStats {
  let total_pontos = 0
  let na_mosca = 0
  let acerto_resultado = 0
  let sem_aposta = 0

  for (const palpite of palpites) {
    const partida = partidasMap.get(palpite.partida_id)
    if (!partida || !partidaEncerrada(partida)) continue

    if (!temPalpite(palpite)) {
      sem_aposta += 1
      continue
    }

    const pts = calcularPontos(
      { casa: partida.gols_casa!, fora: partida.gols_fora! },
      { casa: palpite.palpite_casa!, fora: palpite.palpite_fora! },
    )
    total_pontos += pts
    if (pts === 9) na_mosca += 1
    if (pts >= 4) acerto_resultado += 1
  }

  return { total_pontos, na_mosca, acerto_resultado, sem_aposta }
}
