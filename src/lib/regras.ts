import type { PesosChave, RegrasChave, RegrasPontuacao } from './types'

export const DEFAULT_REGRAS: RegrasPontuacao = {
  na_mosca: 9,
  vencedor_gol: 6,
  vencedor: 4,
  um_gol: 1,
  nada: 0,
  prazo_minutos: 15,
}

/** Pesos padrão da chave cravada (campeão e vice valem como picks separados). */
export const DEFAULT_PESOS_CRAVADA: PesosChave = {
  r32: 2,
  r16: 4,
  qf: 8,
  sf: 15,
  terceiro: 5,
  vice: 20,
  campeao: 40,
}

/** Flexível vale ~metade da cravada (acerta-se por fase, com mais informação). */
export const DEFAULT_PESOS_FLEX: PesosChave = {
  r32: 1,
  r16: 2,
  qf: 4,
  sf: 8,
  terceiro: 3,
  vice: 10,
  campeao: 20,
}

export const DEFAULT_REGRAS_CHAVE: RegrasChave = {
  pesos_cravada: DEFAULT_PESOS_CRAVADA,
  pesos_flex: DEFAULT_PESOS_FLEX,
  placarAtivo: true,
  placarConta: 'tempo_normal',
  prazo_minutos: 15,
}

/** Formato antigo permitia uma chave única `final`; o novo separa vice/campeão. */
type PesosRaw = Partial<Record<string, number>> | null | undefined

function mergePesos(raw: PesosRaw, def: PesosChave): PesosChave {
  return {
    r32: raw?.r32 ?? def.r32,
    r16: raw?.r16 ?? def.r16,
    qf: raw?.qf ?? def.qf,
    sf: raw?.sf ?? def.sf,
    terceiro: raw?.terceiro ?? def.terceiro,
    vice: raw?.vice ?? def.vice,
    // Migra o peso antigo de `final` para o campeão quando não houver `campeao`.
    campeao: raw?.campeao ?? raw?.final ?? def.campeao,
  }
}

/**
 * Garante que `regrasChave` tenha todas as fases do modelo atual (vice/campeão),
 * preenchendo o que faltar com os padrões e migrando o formato antigo (`final`).
 */
export function normalizeRegrasChave(raw: Partial<RegrasChave> | null | undefined): RegrasChave {
  return {
    pesos_cravada: mergePesos(raw?.pesos_cravada as PesosRaw, DEFAULT_PESOS_CRAVADA),
    pesos_flex: mergePesos(raw?.pesos_flex as PesosRaw, DEFAULT_PESOS_FLEX),
    placarAtivo: raw?.placarAtivo ?? DEFAULT_REGRAS_CHAVE.placarAtivo,
    placarConta: 'tempo_normal',
    prazo_minutos: raw?.prazo_minutos ?? DEFAULT_REGRAS_CHAVE.prazo_minutos,
  }
}
