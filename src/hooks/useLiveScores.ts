import type { LiveScore } from '../lib/scoresApi'
import type { Partida } from '../lib/types'

/** Placares vêm do Firestore (onSnapshot). Sem polling de API no browser (CORS). */
export function useLiveScores(_partidas: Partida[]) {
  const sync = async () => {}

  return {
    scores: [] as LiveScore[],
    syncing: false,
    lastSync: null as Date | null,
    error: null as string | null,
    sync,
  }
}
