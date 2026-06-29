import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { filtrarPicksVisiveis } from '../../src/lib/cravadaPrivacy'
import type { KnockoutEngine } from '../../src/lib/knockoutBracket'
import type { PalpiteChaveDoc } from '../../src/lib/chavePalpiteModel'
import { BRACKET_TEMPLATE } from '../../src/data/chaveBracketTemplate'
import type { FaseChave, Partida } from '../../src/lib/types'

function finished(id: string): Partida {
  return {
    id,
    data: '2026-07-01',
    hora: '16:00',
    fase: 'x',
    time_casa: 'A',
    time_fora: 'B',
    gols_casa: 1,
    gols_fora: 0,
    status_api: 'FINISHED',
    vencedor: 'casa',
  }
}

/** Engine onde apenas as fases informadas têm todos os jogos encerrados. */
function engineComFasesEncerradas(fases: FaseChave[]): KnockoutEngine {
  const realPartida = new Map<string, Partida | undefined>()
  for (const node of BRACKET_TEMPLATE) {
    if (fases.includes(node.fase)) realPartida.set(node.id, finished(node.id))
  }
  return {
    realTeams: new Map(),
    realAdvancer: new Map(),
    realPerdedor: new Map(),
    realPartida,
    primeiroKickoff: new Map(),
  }
}

const doc: PalpiteChaveDoc = {
  participante_id: 'p1',
  cravada: {
    picks: {
      'r32-esq-1': 'Alemanha',
      'r16-esq-1': 'Alemanha',
    },
  },
}

describe('filtrarPicksVisiveis', () => {
  it('dono vê todos os picks', () => {
    const eng = engineComFasesEncerradas([])
    const { picks, fasesAbertas } = filtrarPicksVisiveis(doc, eng, true)
    assert.deepEqual(picks, doc.cravada!.picks)
    assert.deepEqual(fasesAbertas, [])
  })

  it('cravada travada é pública para todos (vê tudo, sem fases ocultas)', () => {
    const eng = engineComFasesEncerradas([])
    const travada: PalpiteChaveDoc = {
      ...doc,
      cravada: { picks: doc.cravada!.picks, travadoEm: '2026-06-28T12:00:00Z' },
    }
    const { picks, fasesAbertas } = filtrarPicksVisiveis(travada, eng, false)
    assert.deepEqual(picks, travada.cravada!.picks)
    assert.deepEqual(fasesAbertas, [])
  })

  it('outros só veem picks de fases encerradas', () => {
    const eng = engineComFasesEncerradas(['r32'])
    const { picks, fasesAbertas } = filtrarPicksVisiveis(doc, eng, false)
    assert.equal(picks['r32-esq-1'], 'Alemanha')
    assert.equal(picks['r16-esq-1'], undefined)
    assert.ok(fasesAbertas.includes('r16'))
    assert.ok(!fasesAbertas.includes('r32'))
  })

  it('fase incompleta fica oculta mesmo com alguns jogos encerrados', () => {
    const eng = engineComFasesEncerradas([])
    // encerra só um nó de r32 (não a fase toda)
    eng.realPartida.set('r32-esq-1', finished('r32-esq-1'))
    const { picks, fasesAbertas } = filtrarPicksVisiveis(doc, eng, false)
    assert.equal(picks['r32-esq-1'], undefined)
    assert.ok(fasesAbertas.includes('r32'))
  })
})
