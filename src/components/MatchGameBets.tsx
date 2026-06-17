import { useMemo } from 'react'
import { formatDataCurta } from '../lib/dates'
import { getPontosLive } from '../lib/liveRanking'
import { buildApostasDoJogo } from '../lib/nextPartida'
import { palpitesAdversariosVisiveis, partidaAoVivo, partidaEncerrada, temPalpite } from '../lib/scoring'
import type { Palpite, Partida, Participante } from '../lib/types'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { useNow } from '../hooks/useNow'
import { LiveTag } from './LiveTag'
import { Avatar, Icon, TeamBadge } from './ui'

interface MatchGameBetsProps {
  partida: Partida
  participantes: Participante[]
  palpites: Palpite[]
  embedded?: boolean
  nav?: {
    index: number
    total: number
    canPrev: boolean
    canNext: boolean
    onPrev: () => void
    onNext: () => void
  }
}

function photoForParticipante(
  p: Participante,
  user: ReturnType<typeof useAuth>['user'],
  myId?: string,
): string | null | undefined {
  if (p.photoURL) return p.photoURL
  if (!user) return undefined
  const isYou =
    p.id === myId || p.id === user.uid || p.email?.toLowerCase() === user.email?.toLowerCase()
  return isYou ? user.photoURL : null
}

export function MatchGameBets({
  partida,
  participantes,
  palpites,
  embedded = false,
  nav,
}: MatchGameBetsProps) {
  const { user } = useAuth()
  const { participante } = useBolao()
  const now = useNow()

  const participantesOrdenados = useMemo(
    () => [...participantes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [participantes],
  )

  const apostas = useMemo(
    () => buildApostasDoJogo(participantesOrdenados, palpites, partida.id),
    [participantesOrdenados, palpites, partida.id],
  )

  const comAposta = apostas.filter((a) => a.palpite && temPalpite(a.palpite)).length
  const aoVivo = partidaAoVivo(partida)

  return (
    <aside className={`card game-bets-card${embedded ? ' embedded' : ' next-card'}`}>
      {nav && (
        <div className="next-titlebar">
          <button
            type="button"
            className="next-nav"
            disabled={!nav.canPrev}
            onClick={nav.onPrev}
            aria-label="Jogo anterior"
          >
            <Icon.back s={16} />
          </button>
          <span className="eyebrow">
            Jogos do dia · {nav.index + 1}/{nav.total}
          </span>
          <button
            type="button"
            className="next-nav next-nav-forward"
            disabled={!nav.canNext}
            onClick={nav.onNext}
            aria-label="Próximo jogo"
          >
            <Icon.back s={16} />
          </button>
        </div>
      )}

      <div className="next-head">
        <div className="next-match">
          <TeamBadge name={partida.time_casa} size={34} />
          <div className="next-vs">
            <span>{partida.time_casa}</span>
            <i>×</i>
            <span>{partida.time_fora}</span>
          </div>
          <TeamBadge name={partida.time_fora} size={34} />
        </div>
        <div className="next-meta">
          <span>
            {formatDataCurta(partida.data)} · {partida.hora}
          </span>
          {aoVivo && (
            <>
              <span className="dotsep">·</span>
              <LiveTag partida={partida} />
            </>
          )}
          <span className="dotsep">·</span>
          <span className="ok-text">
            {comAposta}/{apostas.length} apostaram
          </span>
        </div>
      </div>

      <div className="next-list">
        {apostas.map(({ participante: p, palpite }) => {
          const isYou =
            participante?.id === p.id ||
            user?.uid === p.id ||
            p.email?.toLowerCase() === user?.email?.toLowerCase()
          const photo = photoForParticipante(p, user, participante?.id)
          return (
            <div key={p.id} className={`bet-row${isYou ? ' is-you' : ''}`}>
              <Avatar name={p.nome} id={p.id} size={28} photo={photo} />
              <span className="bet-name">{p.nome}</span>
              <BetPalpite palpite={palpite} partida={partida} isYou={isYou} now={now} />
              <BetPontos palpite={palpite} partida={partida} isYou={isYou} now={now} />
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function BetPalpite({
  palpite,
  partida,
  isYou,
  now,
}: {
  palpite: Palpite | null
  partida: Partida
  isYou: boolean
  now: Date
}) {
  const oculto = !isYou && !palpitesAdversariosVisiveis(partida, now)

  if (oculto || !palpite || !temPalpite(palpite)) {
    return <span className="bet-score muted">—</span>
  }

  return (
    <span
      className="bet-score"
      title={`${partida.time_casa} ${palpite.palpite_casa} × ${partida.time_fora} ${palpite.palpite_fora}`}
    >
      {palpite.palpite_casa}
      <i>×</i>
      {palpite.palpite_fora}
    </span>
  )
}

function BetPontos({
  palpite,
  partida,
  isYou,
  now,
}: {
  palpite: Palpite | null
  partida: Partida
  isYou: boolean
  now: Date
}) {
  const oculto = !isYou && !palpitesAdversariosVisiveis(partida, now)
  const encerrada = partidaEncerrada(partida)
  const aoVivo = partidaAoVivo(partida)
  const comPlacar = encerrada || aoVivo

  if (oculto) {
    return <span className="bet-points muted">—</span>
  }

  if (!comPlacar) {
    return <span className="bet-points muted">—</span>
  }

  if (!palpite || !temPalpite(palpite)) {
    return <span className="bet-points zero">0</span>
  }

  const pts = getPontosLive(palpite, partida)
  if (pts === null) {
    return <span className="bet-points muted">—</span>
  }

  return (
    <span className={`bet-points${aoVivo ? ' live' : ''}`} title={`${pts} pontos`}>
      {pts}
    </span>
  )
}
