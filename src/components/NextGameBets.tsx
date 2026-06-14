import { useEffect, useMemo, useState } from 'react'
import { formatDataCurta } from '../lib/dates'
import {
  buildApostasDoJogo,
  indiceProximoJogo,
  type ApostaProximoJogo,
} from '../lib/nextPartida'
import { temPalpite } from '../lib/scoring'
import type { Palpite, Partida, Participante } from '../lib/types'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { Avatar, Icon, TeamBadge } from './ui'

interface NextGameBetsProps {
  jogosDoDia: Partida[]
  proximaPartida: Partida | null
  participantes: Participante[]
  palpites: Palpite[]
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

export function NextGameBets({
  jogosDoDia,
  proximaPartida,
  participantes,
  palpites,
}: NextGameBetsProps) {
  const { user } = useAuth()
  const { participante } = useBolao()
  const [index, setIndex] = useState(0)

  const rankingOrder = useMemo(
    () =>
      [...participantes].sort((a, b) => {
        if (a.posicao !== b.posicao) return a.posicao - b.posicao
        return a.nome.localeCompare(b.nome, 'pt-BR')
      }),
    [participantes],
  )

  useEffect(() => {
    setIndex(indiceProximoJogo(jogosDoDia, proximaPartida))
  }, [jogosDoDia, proximaPartida?.id])

  const partida = jogosDoDia[index] ?? null

  const apostas: ApostaProximoJogo[] = useMemo(() => {
    if (!partida) return []
    const base = buildApostasDoJogo(rankingOrder, palpites, partida.id)
    return base.sort((a, b) => a.participante.posicao - b.participante.posicao)
  }, [partida, rankingOrder, palpites])

  if (jogosDoDia.length === 0) {
    return (
      <aside className="card next-card">
        <div className="next-head">
          <span className="eyebrow">Jogos do dia</span>
          <p className="sub" style={{ marginTop: 8 }}>
            Nenhum jogo pendente.
          </p>
        </div>
      </aside>
    )
  }

  const comAposta = apostas.filter((a) => a.palpite && temPalpite(a.palpite)).length
  const canPrev = index > 0
  const canNext = index < jogosDoDia.length - 1

  return (
    <aside className="card next-card">
      <div className="next-head">
        <div className="next-titlebar">
          <button
            type="button"
            className="next-nav"
            disabled={!canPrev}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            aria-label="Jogo anterior"
          >
            <Icon.back s={16} />
          </button>
          <span className="eyebrow">
            Jogos do dia · {index + 1}/{jogosDoDia.length}
          </span>
          <button
            type="button"
            className="next-nav next-nav-forward"
            disabled={!canNext}
            onClick={() => setIndex((i) => Math.min(jogosDoDia.length - 1, i + 1))}
            aria-label="Próximo jogo"
          >
            <Icon.back s={16} />
          </button>
        </div>

        {partida && (
          <>
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
              <span className="dotsep">·</span>
              <span className="ok-text">
                {comAposta}/{apostas.length} apostaram
              </span>
            </div>
          </>
        )}
      </div>

      <div className="next-list">
        {apostas.map(({ participante: p, palpite }, i) => {
          const isYou =
            participante?.id === p.id ||
            user?.uid === p.id ||
            p.email?.toLowerCase() === user?.email?.toLowerCase()
          const photo = photoForParticipante(p, user, participante?.id)
          return (
            <div key={p.id} className={`bet-row${isYou ? ' is-you' : ''}`}>
              <span className="bet-rank">{i + 1}</span>
              <Avatar name={p.nome} id={p.id} size={28} photo={photo} />
              <span className="bet-name">{p.nome}</span>
              <PalpiteScore palpite={palpite} partida={partida!} />
            </div>
          )
        })}
      </div>
    </aside>
  )
}

function PalpiteScore({ palpite, partida }: { palpite: Palpite | null; partida: Partida }) {
  if (!palpite || !temPalpite(palpite)) {
    return <span className="bet-score" style={{ color: 'var(--t-low)', fontWeight: 600 }}>—</span>
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
