import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { bolaoPath } from '../lib/paths'
import type { ParticipanteRanking } from '../lib/types'
import { Avatar, Icon, StatTrio } from './ui'

interface RankingCardProps {
  participante: ParticipanteRanking
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

export function RankingCard({ participante }: RankingCardProps) {
  const { user } = useAuth()
  const { bolaoId, participante: me } = useBolao()
  const isYou = isCurrentUser(participante, user?.uid, me?.id, user?.email)
  const photo = isYou
    ? (participante.photoURL ?? user?.photoURL)
    : (participante.photoURL ?? null)

  return (
    <Link
      to={bolaoPath(bolaoId, `palpites/${participante.id}`)}
      className={`rank-row${podiumClass(participante.posicao)}${isYou ? ' is-you' : ''}`}
    >
      <span className="rank-pos">
        {participante.posicao === 1 ? (
          <Icon.trophy s={18} w={2} />
        ) : (
          participante.posicao
        )}
      </span>
      <Avatar name={participante.nome} id={participante.id} size={40} photo={photo} />
      <span className="rank-name">
        {participante.nome}
        {isYou && <em className="you-tag">você</em>}
        {participante.pontos_cravada !== undefined && (
          <small className="rank-breakdown">
            {participante.pontos_placar ? `placar ${participante.pontos_placar}` : null}
            {participante.pontos_placar ? ' · ' : ''}
            cravada {participante.pontos_cravada} · fase {participante.pontos_flex ?? 0}
          </small>
        )}
      </span>
      <span className="rank-pts">
        {participante.total_pontos}
        <i>pts</i>
        {participante.pontos_ao_vivo > 0 && (
          <span className="rank-live-delta">+{participante.pontos_ao_vivo}</span>
        )}
      </span>
      <StatTrio
        e={participante.na_mosca}
        p={participante.acerto_resultado}
        x={participante.sem_aposta}
      />
    </Link>
  )
}
