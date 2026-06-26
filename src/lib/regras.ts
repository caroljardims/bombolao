import type { PesosChave, RegrasChave, RegrasPontuacao } from './types'

export const DEFAULT_REGRAS: RegrasPontuacao = {
  na_mosca: 9,
  vencedor_gol: 6,
  vencedor: 4,
  um_gol: 1,
  nada: 0,
  prazo_minutos: 15,
}

/** Padrão "dobrando por fase" para a chave cravada. */
export const DEFAULT_PESOS_CRAVADA: PesosChave = {
  r32: 2,
  r16: 4,
  qf: 8,
  sf: 16,
  final: 32,
  terceiro: 8,
}

/** Flexível vale metade da cravada (acerta-se por fase, com mais informação). */
export const DEFAULT_PESOS_FLEX: PesosChave = {
  r32: 1,
  r16: 2,
  qf: 4,
  sf: 8,
  final: 16,
  terceiro: 4,
}

export const DEFAULT_REGRAS_CHAVE: RegrasChave = {
  pesos_cravada: DEFAULT_PESOS_CRAVADA,
  pesos_flex: DEFAULT_PESOS_FLEX,
  placarAtivo: true,
  placarConta: 'tempo_normal',
  prazo_minutos: 15,
}
