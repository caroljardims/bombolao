import { R32_TEMPLATE } from '../chaveR32Template'
import type { PartidaDraft } from '../../lib/types'

/**
 * Confrontos REAIS dos 16-avos da Copa 2026, indexados pelo número oficial do
 * jogo (73–88) — o mesmo `no` do [chaveR32Template.ts](../chaveR32Template.ts).
 * Assim o engine casa cada confronto ao nó certo do bracket sem depender dos
 * resultados da fase de grupos (ver `buildEngine`).
 *
 * Fonte: chaveamento oficial da FIFA (situação em 28/06/2026).
 */
/**
 * Confronto + data/hora reais (horário de Brasília) de cada jogo dos 16-avos,
 * indexados pelo número oficial (73–88). As datas batem com o calendário real
 * para que o sync de placares case a partida e preencha o resultado.
 */
const JOGOS_POR_NO: Record<
  number,
  { time_casa: string; time_fora: string; data: string; hora: string }
> = {
  73: { time_casa: 'África do Sul', time_fora: 'Canadá', data: '2026-06-28', hora: '16:00' },
  74: { time_casa: 'Alemanha', time_fora: 'Paraguai', data: '2026-06-29', hora: '17:30' },
  75: { time_casa: 'Holanda', time_fora: 'Marrocos', data: '2026-06-29', hora: '22:00' },
  76: { time_casa: 'Brasil', time_fora: 'Japão', data: '2026-06-29', hora: '14:00' },
  77: { time_casa: 'França', time_fora: 'Suécia', data: '2026-06-30', hora: '18:00' },
  78: { time_casa: 'Costa do Marfim', time_fora: 'Noruega', data: '2026-06-30', hora: '14:00' },
  79: { time_casa: 'México', time_fora: 'Equador', data: '2026-06-30', hora: '22:00' },
  80: { time_casa: 'Inglaterra', time_fora: 'Congo', data: '2026-07-01', hora: '13:00' },
  81: { time_casa: 'Estados Unidos', time_fora: 'Bósnia-Herzegovina', data: '2026-07-01', hora: '21:00' },
  82: { time_casa: 'Bélgica', time_fora: 'Senegal', data: '2026-07-01', hora: '17:00' },
  83: { time_casa: 'Portugal', time_fora: 'Croácia', data: '2026-07-02', hora: '20:00' },
  84: { time_casa: 'Espanha', time_fora: 'Áustria', data: '2026-07-02', hora: '16:00' },
  85: { time_casa: 'Suíça', time_fora: 'Argélia', data: '2026-07-03', hora: '00:00' },
  86: { time_casa: 'Argentina', time_fora: 'Cabo Verde', data: '2026-07-03', hora: '19:00' },
  87: { time_casa: 'Colômbia', time_fora: 'Gana', data: '2026-07-03', hora: '22:30' },
  88: { time_casa: 'Austrália', time_fora: 'Egito', data: '2026-07-03', hora: '15:00' },
}

/**
 * Partidas dos 16-avos reais, prontas para semear um bolão mata-mata. O id
 * `r32-{no}` é a chave que liga o jogo ao nó do bracket.
 */
export function wc2026MataPartidas(): PartidaDraft[] {
  return R32_TEMPLATE.map((tpl) => {
    const jogo = JOGOS_POR_NO[tpl.no]
    if (!jogo) throw new Error(`Jogo não definido para o confronto ${tpl.no}`)
    return {
      id: `r32-${tpl.no}`,
      data: jogo.data,
      hora: jogo.hora,
      fase: '16-avos de final',
      time_casa: jogo.time_casa,
      time_fora: jogo.time_fora,
    }
  })
}
