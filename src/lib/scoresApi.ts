import type { Partida } from './types'

export interface LiveScore {
  data: string
  home: string
  away: string
  gols_casa: number
  gols_fora: number
  status: 'live' | 'finished'
}

export const LIVE_SCORES_POLL_MS = 30_000

/**
 * APIs externas (TheSportsDB, football-data.org) bloqueiam CORS no navegador.
 * Placares ao vivo no app vêm do Firestore, atualizados via:
 *   npm run sync-scores -- --bolao-id <id>
 */
export async function fetchLiveScoresForPartidas(_partidas: Partida[]): Promise<LiveScore[]> {
  return []
}
