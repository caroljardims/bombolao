import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { scoreCravada, scoreFlex } from '../../src/lib/chaveScoring'
import {
  CAMPEAO_PICK,
  VICE_PICK,
  type ChavePicks,
  type KnockoutEngine,
} from '../../src/lib/knockoutBracket'
import { DEFAULT_PESOS_CRAVADA } from '../../src/lib/regras'
import type { Partida } from '../../src/lib/types'

const P = DEFAULT_PESOS_CRAVADA

function emptyEngine(): KnockoutEngine {
  return {
    realTeams: new Map(),
    realAdvancer: new Map(),
    realPerdedor: new Map(),
    realPartida: new Map(),
    primeiroKickoff: new Map(),
  }
}

function finalPartida(campeao: string, vice: string, encerrada = true): Partida {
  return {
    id: 'final',
    data: '2026-07-19',
    hora: '16:00',
    fase: 'Final',
    time_casa: campeao,
    time_fora: vice,
    gols_casa: 1,
    gols_fora: 0,
    status_api: encerrada ? 'FINISHED' : 'IN_PLAY',
    vencedor: 'casa',
  }
}

function engineComFinal(campeao: string, vice: string, encerrada = true): KnockoutEngine {
  const eng = emptyEngine()
  eng.realPartida.set('final', finalPartida(campeao, vice, encerrada))
  eng.realAdvancer.set('final', campeao)
  eng.realPerdedor.set('final', vice)
  return eng
}

describe('scoreCravada — final (campeão + vice)', () => {
  it('soma os dois pesos quando acerta campeão e vice', () => {
    const eng = engineComFinal('Brasil', 'Argentina')
    const picks: ChavePicks = { [CAMPEAO_PICK]: 'Brasil', [VICE_PICK]: 'Argentina' }
    assert.equal(scoreCravada(picks, eng, P), P.campeao + P.vice)
  })

  it('só o campeão correto', () => {
    const eng = engineComFinal('Brasil', 'Argentina')
    const picks: ChavePicks = { [CAMPEAO_PICK]: 'Brasil', [VICE_PICK]: 'França' }
    assert.equal(scoreCravada(picks, eng, P), P.campeao)
  })

  it('só o vice correto', () => {
    const eng = engineComFinal('Brasil', 'Argentina')
    const picks: ChavePicks = { [CAMPEAO_PICK]: 'França', [VICE_PICK]: 'Argentina' }
    assert.equal(scoreCravada(picks, eng, P), P.vice)
  })

  it('nenhum correto', () => {
    const eng = engineComFinal('Brasil', 'Argentina')
    const picks: ChavePicks = { [CAMPEAO_PICK]: 'França', [VICE_PICK]: 'Espanha' }
    assert.equal(scoreCravada(picks, eng, P), 0)
  })

  it('não pontua enquanto a final não encerra', () => {
    const eng = engineComFinal('Brasil', 'Argentina', false)
    eng.realAdvancer.set('final', null)
    eng.realPerdedor.set('final', null)
    const picks: ChavePicks = { [CAMPEAO_PICK]: 'Brasil', [VICE_PICK]: 'Argentina' }
    assert.equal(scoreCravada(picks, eng, P), 0)
  })
})

describe('scoreCravada — fases de lado', () => {
  it('acertar um 16-avo soma o peso de r32', () => {
    const eng = emptyEngine()
    eng.realAdvancer.set('r32-esq-1', 'Alemanha')
    assert.equal(scoreCravada({ 'r32-esq-1': 'Alemanha' }, eng, P), P.r32)
  })

  it('errar não soma nada', () => {
    const eng = emptyEngine()
    eng.realAdvancer.set('r32-esq-1', 'Alemanha')
    assert.equal(scoreCravada({ 'r32-esq-1': 'Paraguai' }, eng, P), 0)
  })
})

describe('scoreFlex — final usa peso de campeão', () => {
  it('acertar o vencedor da final vale pesos.campeao', () => {
    const eng = emptyEngine()
    eng.realAdvancer.set('final', 'Brasil')
    assert.equal(scoreFlex({ final: { final: 'Brasil' } }, eng, P), P.campeao)
  })
})
