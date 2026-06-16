import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { findProximaPartida, partidaJaPassou, resolveJogosDoDia } from '../../src/lib/nextPartida'
import type { Partida } from '../../src/lib/types'

function partida(overrides: Partial<Partida> & Pick<Partida, 'id' | 'data' | 'hora'>): Partida {
  return {
    fase: 'Primeira fase',
    time_casa: 'A',
    time_fora: 'B',
    gols_casa: null,
    gols_fora: null,
    ...overrides,
  }
}

describe('partidaJaPassou', () => {
  it('só considera encerrado com status_api FINISHED', () => {
    const comPlacarSemStatus = partida({
      id: 'x',
      data: '2026-06-15',
      hora: '22:00',
      gols_casa: 0,
      gols_fora: 0,
    })
    assert.equal(partidaJaPassou(comPlacarSemStatus), false)

    const finished = partida({
      id: 'y',
      data: '2026-06-15',
      hora: '22:00',
      gols_casa: 0,
      gols_fora: 0,
      status_api: 'FINISHED',
    })
    assert.equal(partidaJaPassou(finished), true)
  })
})

describe('findProximaPartida + resolveJogosDoDia', () => {
  const iran = partida({
    id: '2026-06-15-IRN-NZL',
    data: '2026-06-15',
    hora: '22:00',
    time_casa: 'Irã',
    time_fora: 'Nova Zelândia',
    gols_casa: 0,
    gols_fora: 0,
    status_api: 'IN_PLAY',
  })

  const france = partida({
    id: '2026-06-16-FRA-SEN',
    data: '2026-06-16',
    hora: '16:00',
    time_casa: 'França',
    time_fora: 'Senegal',
  })

  const partidas = [france, iran]

  it('destaca jogo ao vivo de hoje, não o de amanhã', () => {
    const now = new Date('2026-06-15T22:30:00-03:00')
    const proxima = findProximaPartida(partidas, now)
    assert.equal(proxima?.id, iran.id)

    const jogos = resolveJogosDoDia(partidas, now)
    assert.equal(jogos.data, '2026-06-15')
    assert.ok(jogos.jogos.some((p) => p.id === iran.id))
    assert.ok(!jogos.jogos.some((p) => p.id === france.id))
  })

  it('não pula para amanhã só porque há placar parcial sem status final', () => {
    const iranParcial = partida({
      id: '2026-06-15-IRN-NZL',
      data: '2026-06-15',
      hora: '22:00',
      gols_casa: 0,
      gols_fora: 0,
    })
    const now = new Date('2026-06-15T22:30:00-03:00')
    const proxima = findProximaPartida([france, iranParcial], now)
    assert.equal(proxima?.id, iranParcial.id)
  })
})
