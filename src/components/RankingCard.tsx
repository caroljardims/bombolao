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

export function RankingCard({ participante }: RankingCardProps) {
  const { user } = useAuth()
  const { bolaoId, participante: me } = useBolao()
  const leader = participante.posicao === 1
  const isYou = isCurrentUser(participante, user?.uid, me?.id, user?.email)
  const photo = isYou
    ? (participante.photoURL ?? user?.photoURL)
    : (participante.photoURL ?? null)

  return (
    <Link
      to={bolaoPath(bolaoId, `palpites/${participante.id}`)}
      className={`rank-row${leader ? ' leader' : ''}${isYou ? ' is-you' : ''}`}
    >
      <span className="rank-pos">
        {leader ? <Icon.trophy s={18} w={2} /> : participante.posicao}
      </span>
      <Avatar name={participante.nome} id={participante.id} size={40} photo={photo} />
      <span className="rank-name">
        {participante.nome}
        {isYou && <em className="you-tag">você</em>}
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
