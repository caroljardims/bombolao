export type AcertoTipo = 'mosca' | 'empate' | 'resultado' | 'resultado_gol' | 'gol' | 'nada' | 'sem_aposta'
export type Papel = 'admin' | 'membro'
export type AcessoBolao = 'convite' | 'aberto'
export type CompeticaoId = 'wc2026'

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

export interface RegrasPontuacao {
  na_mosca: number
  vencedor_gol: number
  vencedor: number
  um_gol: number
  nada: number
  prazo_minutos: number
}

export interface Bolao {
  id: string
  nome: string
  competicao: string
  criadoPor: string
  criadoEm: string
  acesso: AcessoBolao
  regras: RegrasPontuacao
  ultimaSyncApi?: string
  competicaoTemplateId?: CompeticaoId
}

export interface Participante {
  id: string
  nome: string
  email: string
  photoURL?: string | null
  total_pontos: number
  na_mosca: number
  acerto_resultado: number
  sem_aposta: number
  posicao: number
  papel?: Papel
  entrouEm?: string
}

export interface Palpite {
  id: string
  participante_id: string
  partida_id: string
  palpite_casa: number | null
  palpite_fora: number | null
  pontos: number | null
}

export interface Membrosia {
  bolaoId: string
  nome: string
  papel: Papel
  entrouEm: string
}

export interface Convite {
  code: string
  bolaoId: string
  criadoPor: string
  ativo: boolean
  maxUsos: number
  usos: number
  expiraEm?: string | null
}

/** @deprecated use Bolao */
export interface BolaoConfig {
  nome: string
  competicao: string
}

export type PartidaDraft = Omit<Partida, 'id' | 'gols_casa' | 'gols_fora'> & {
  id?: string
  gols_casa?: null
  gols_fora?: null
}

export interface CriarBolaoInput {
  nome: string
  competicao: string
  acesso: AcessoBolao
  regras: RegrasPontuacao
  partidas: PartidaDraft[]
  competicaoTemplateId?: CompeticaoId
}

export interface ParticipanteStats {
  total_pontos: number
  na_mosca: number
  acerto_resultado: number
  sem_aposta: number
}

export interface ParticipanteRanking extends Participante {
  pontos_ao_vivo: number
}

export interface SeedData {
  bolao: BolaoConfig & { regras?: Record<string, unknown> }
  partidas: Partida[]
  participantes: { nome: string }[]
  palpites: Record<string, Omit<Palpite, 'id' | 'participante_id'>[]>
  ranking: (ParticipanteStats & { nome: string; posicao: number })[]
}
