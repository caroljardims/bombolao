import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  extractApiScore,
  extractRegularScore,
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

  it('prefere a data UTC real (terminada em Z) da football-data', () => {
    const wc26 = match('Egypt', 'Iran', 'IN_PLAY', { home: 1, away: 1 })
    wc26.utcDate = '2026-06-26T20:00:00' // horário do estádio (naive), cai no dia errado
    const fd = match('Egypt', 'Iran', 'IN_PLAY', { home: 1, away: 0 })
    fd.utcDate = '2026-06-27T03:00:00Z' // UTC real

    assert.equal(mergeApiMatchPair(wc26, fd).utcDate, '2026-06-27T03:00:00Z')
    assert.equal(mergeApiMatchPair(fd, wc26).utcDate, '2026-06-27T03:00:00Z')
  })

  it('propaga a etapa mais avançada (EXTRA_TIME) entre as fontes', () => {
    const wc26 = match('Spain', 'Italy', 'FINISHED', { home: 2, away: 1 }) // sem duration
    const fd = match('Spain', 'Italy', 'FINISHED', { home: 2, away: 1 })
    fd.score.duration = 'EXTRA_TIME'

    assert.equal(mergeApiMatchPair(wc26, fd).score.duration, 'EXTRA_TIME')
    assert.equal(mergeApiMatchPair(fd, wc26).score.duration, 'EXTRA_TIME')
  })

  it('WorldCup26 com placar final + football-data com regularTime → 90 min corretos', () => {
    const wc26 = match('Argentina', 'Cape Verde', 'FINISHED', { home: 3, away: 2 })
    const fd = match('Argentina', 'Cape Verde', 'FINISHED', { home: 3, away: 2 })
    fd.score.duration = 'EXTRA_TIME'
    fd.score.regularTime = { home: 1, away: 1 }
    fd.score.winner = 'HOME_TEAM'

    const merged = mergeApiMatchPair(wc26, fd)
    assert.equal(merged.score.duration, 'EXTRA_TIME')
    assert.deepEqual(extractRegularScore(merged), { home: 1, away: 1 })
  })

  it('Cape Verde vs Cape Verde Islands mescla no mesmo jogo (90 min)', () => {
    const wc26 = match('Argentina', 'Cape Verde', 'FINISHED', { home: 3, away: 2 })
    const fd = match('Argentina', 'Cape Verde Islands', 'FINISHED', { home: 3, away: 2 })
    fd.score.duration = 'EXTRA_TIME'
    fd.score.regularTime = { home: 1, away: 1 }
    fd.score.extraTime = { home: 2, away: 1 }
    fd.score.winner = 'HOME_TEAM'

    const merged = mergeApiMatches([wc26], [fd])
    assert.equal(merged.length, 1)
    assert.deepEqual(extractRegularScore(merged[0]), { home: 1, away: 1 })
  })

  it('EXTRA_TIME sem regularTime: deriva 90 min via fullTime − extraTime', () => {
    const fd = match('Spain', 'Argentina', 'FINISHED', { home: 1, away: 0 })
    fd.score.duration = 'EXTRA_TIME'
    fd.score.regularTime = { home: null, away: null }
    fd.score.extraTime = { home: 1, away: 0 }
    fd.score.winner = 'HOME_TEAM'

    assert.deepEqual(extractRegularScore(fd), { home: 0, away: 0 })

    const wc26 = match('Spain', 'Argentina', 'FINISHED', { home: 1, away: 0 })
    const merged = mergeApiMatchPair(wc26, fd)
    assert.equal(merged.score.duration, 'EXTRA_TIME')
    assert.deepEqual(extractRegularScore(merged), { home: 0, away: 0 })
  })

  it('duration=REGULAR com extraTime preenchido ainda isola os 90 min', () => {
    // football-data errou o duration na final 2026 (marcou REGULAR com gol na PR).
    const fd = match('Spain', 'Argentina', 'FINISHED', { home: 1, away: 0 })
    fd.score.duration = 'REGULAR'
    fd.score.regularTime = { home: null, away: null }
    fd.score.extraTime = { home: 1, away: 0 }
    fd.score.halfTime = { home: 0, away: 0 }
    fd.score.winner = 'HOME_TEAM'

    assert.deepEqual(extractRegularScore(fd), { home: 0, away: 0 })
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
