import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { bolaoPath } from '../lib/paths'
import type { ParticipanteRanking } from '../lib/types'
import { Avatar, Icon, StatTrio } from './ui'

export type RankingView = 'geral' | 'tradicional' | 'eliminatorias' | 'cravada'

interface RankingCardProps {
  participante: ParticipanteRanking
  view?: RankingView
}

function isCurrentUser(participante: ParticipanteRanking, uid?: string, myId?: string, email?: string | null) {
  if (myId && participante.id === myId) return true
  if (uid && participante.id === uid) return true
  if (email && participante.email?.toLowerCase() === email.toLowerCase()) return true
  return false
}

function podiumClass(posicao: number): string {
  if (posicao === 1) return ' leader'
  if (posicao === 2) return ' podium-2'
  if (posicao === 3) return ' podium-3'
  return ''
}

export function RankingCard({ participante, view = 'geral' }: RankingCardProps) {
  const { user } = useAuth()
  const { bolaoId, participante: me } = useBolao()
  const [open, setOpen] = useState(false)
  const isYou = isCurrentUser(participante, user?.uid, me?.id, user?.email)
  const photo = isYou
    ? (participante.photoURL ?? user?.photoURL)
    : (participante.photoURL ?? null)

  const isMata = participante.pontos_cravada !== undefined
  const placar = participante.pontos_placar ?? 0
  const placarElim = participante.pontos_placar_elim ?? 0
  const placarGrupos = Math.max(0, placar - placarElim)
  const cravada = participante.pontos_cravada ?? 0
  const flex = participante.pontos_flex ?? 0
  const tradicional = placar + flex
  const eliminatorias = placarElim + flex

  const pts =
    view === 'cravada'
      ? cravada
      : view === 'tradicional'
        ? tradicional
        : view === 'eliminatorias'
          ? eliminatorias
          : participante.total_pontos
  const showLive = view !== 'cravada' && participante.pontos_ao_vivo > 0

  const pos = (
    <span className="rank-pos">
      {participante.posicao === 1 ? <Icon.trophy s={18} w={2} /> : participante.posicao}
    </span>
  )
  const ptsEl = (
    <span className="rank-pts">
      {pts}
      <i>pts</i>
      {showLive && <span className="rank-live-delta">+{participante.pontos_ao_vivo}</span>}
    </span>
  )
  const trio = (
    <StatTrio
      e={participante.na_mosca}
      p={participante.acerto_resultado}
      x={participante.sem_aposta}
    />
  )

  // Bolão tradicional (sem mata-mata): card simples que leva ao perfil.
  if (!isMata) {
    return (
      <Link
        to={bolaoPath(bolaoId, `palpites/${participante.id}`)}
        className={`rank-row${podiumClass(participante.posicao)}${isYou ? ' is-you' : ''}`}
      >
        {pos}
        <Avatar name={participante.nome} id={participante.id} size={40} photo={photo} />
        <span className="rank-name">
          {participante.nome}
          {isYou && <em className="you-tag">você</em>}
        </span>
        {ptsEl}
        {trio}
      </Link>
    )
  }

  return (
    <div className={`rank-exp${open ? ' open' : ''}`}>
      <button
        type="button"
        className={`rank-row rank-row--exp${podiumClass(participante.posicao)}${isYou ? ' is-you' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {pos}
        <Avatar name={participante.nome} id={participante.id} size={40} photo={photo} />
        <span className="rank-name">
          {participante.nome}
          {isYou && <em className="you-tag">você</em>}
        </span>
        {ptsEl}
        <span className="rank-chev" aria-hidden="true">
          <Icon.chevron s={16} />
        </span>
        {trio}
      </button>

      {open && (
        <div className="rank-breakdown-panel">
          <BreakdownRow
            label="Placar — grupos"
            value={placarGrupos}
            active={view === 'geral' || view === 'tradicional'}
          />
          <BreakdownRow
            label="Placar — eliminatórias"
            value={placarElim}
            active={view !== 'cravada'}
          />
          <BreakdownRow label="Flexível (por fase)" value={flex} active={view !== 'cravada'} />
          <BreakdownRow
            label="Cravada"
            value={cravada}
            active={view === 'geral' || view === 'cravada'}
          />
          <div className="rb-row rb-total">
            <span>Total geral</span>
            <b>{participante.total_pontos}</b>
          </div>
          <Link to={bolaoPath(bolaoId, `palpites/${participante.id}`)} className="rb-link">
            Ver palpites de {participante.nome.split(' ')[0]} →
          </Link>
        </div>
      )}
    </div>
  )
}

function BreakdownRow({ label, value, active }: { label: string; value: number; active: boolean }) {
  return (
    <div className={`rb-row${active ? '' : ' rb-dim'}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}
