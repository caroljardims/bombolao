import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractApiScore,
  isFinalApiStatus,
  isLiveApiStatus,
  mergeApiMatchPair,
  mergeApiMatches,
} from './mergeApiMatches'
import type { ApiMatch } from './worldcup26Api'

function match(
  home: string,
  away: string,
  status: string,
  score?: { home: number; away: number },
): ApiMatch {
  return {
    utcDate: '2026-06-14T20:00:00',
    status,
    homeTeam: { name: home },
    awayTeam: { name: away },
    score: score
      ? { fullTime: { home: score.home, away: score.away } }
      : { fullTime: { home: null, away: null } },
  }
}

describe('isFinalApiStatus', () => {
  it('reconhece FINISHED e AWARDED', () => {
    assert.equal(isFinalApiStatus('FINISHED'), true)
    assert.equal(isFinalApiStatus('AWARDED'), true)
    assert.equal(isFinalApiStatus('IN_PLAY'), false)
  })
})

describe('isLiveApiStatus', () => {
  it('reconhece status ao vivo', () => {
    assert.equal(isLiveApiStatus('IN_PLAY'), true)
    assert.equal(isLiveApiStatus('PAUSED'), true)
    assert.equal(isLiveApiStatus('FINISHED'), false)
  })
})

describe('mergeApiMatchPair', () => {
  it('FINISHED vence IN_PLAY mesmo com placar mais recente no ao vivo', () => {
    const finished = match('Ivory Coast', 'Ecuador', 'FINISHED', { home: 1, away: 0 })
    const live = match('Ivory Coast', 'Ecuador', 'IN_PLAY', { home: 1, away: 0 })

    const merged = mergeApiMatchPair(live, finished)
    assert.equal(merged.status, 'FINISHED')
    assert.deepEqual(extractApiScore(merged), { home: 1, away: 0 })
  })

  it('FINISHED sem placar herda score de IN_PLAY', () => {
    const finished = match('Ivory Coast', 'Ecuador', 'FINISHED')
    const live = match('Ivory Coast', 'Ecuador', 'IN_PLAY', { home: 2, away: 1 })

    const merged = mergeApiMatchPair(finished, live)
    assert.equal(merged.status, 'FINISHED')
    assert.deepEqual(extractApiScore(merged), { home: 2, away: 1 })
  })

  it('entre duas fontes ao vivo, prefere placar mais informativo', () => {
    const stale = match('Sweden', 'Tunisia', 'IN_PLAY', { home: 0, away: 0 })
    const updated = match('Sweden', 'Tunisia', 'IN_PLAY', { home: 2, away: 1 })

    const merged = mergeApiMatchPair(stale, updated)
    assert.equal(merged.status, 'IN_PLAY')
    assert.deepEqual(extractApiScore(merged), { home: 2, away: 1 })
  })
})

describe('mergeApiMatches', () => {
  it('combina grupos priorizando FINISHED de qualquer fonte', () => {
    const wc26 = [match('Ivory Coast', 'Ecuador', 'IN_PLAY', { home: 1, away: 0 })]
    const fd = [match('Ivory Coast', 'Ecuador', 'FINISHED', { home: 1, away: 0 })]

    const merged = mergeApiMatches(wc26, fd)
    assert.equal(merged.length, 1)
    assert.equal(merged[0].status, 'FINISHED')
  })

  it('mantém dois jogos ao vivo em paralelo', () => {
    const wc26 = [
      match('Ivory Coast', 'Ecuador', 'IN_PLAY', { home: 1, away: 0 }),
      match('Sweden', 'Tunisia', 'IN_PLAY', { home: 0, away: 0 }),
    ]
    const fd = [
      match('Ivory Coast', 'Ecuador', 'FINISHED', { home: 1, away: 0 }),
      match('Sweden', 'Tunisia', 'IN_PLAY', { home: 2, away: 1 }),
    ]

    const merged = mergeApiMatches(wc26, fd)
    assert.equal(merged.length, 2)

    const ivory = merged.find((m) => m.homeTeam.name === 'Ivory Coast')!
    const sweden = merged.find((m) => m.homeTeam.name === 'Sweden')!

    assert.equal(ivory.status, 'FINISHED')
    assert.equal(sweden.status, 'IN_PLAY')
    assert.deepEqual(extractApiScore(sweden), { home: 2, away: 1 })
  })
})
