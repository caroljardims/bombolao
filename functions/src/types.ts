export interface Placar {
  casa: number
  fora: number
}

export interface Partida {
  id: string
  data: string
  hora: string
  fase: string
  time_casa: string
  time_fora: string
  gols_casa: number | null
  gols_fora: number | null
  status_api?: string | null
}

export interface Palpite {
  id: string
  participante_id: string
  partida_id: string
  palpite_casa: number | null
  palpite_fora: number | null
  pontos: number | null
}

export interface ParticipanteStats {
  total_pontos: number
  na_mosca: number
  acerto_resultado: number
  sem_aposta: number
}
