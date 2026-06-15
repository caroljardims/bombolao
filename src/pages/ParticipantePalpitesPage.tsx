import { Link, Navigate, useParams } from 'react-router-dom'
import { LoadingState } from '../components/LoadingState'
import { Icon } from '../components/ui'
import { PalpitesList } from './PalpitesPage'
import { useParticipante, usePalpites } from '../hooks/usePalpites'
import { usePartidas } from '../hooks/usePartidas'
import { useBolao } from '../contexts/BolaoContext'
import { bolaoPath } from '../lib/paths'

export function ParticipantePalpitesPage() {
  const { participanteId } = useParams<{ participanteId: string }>()
  const { bolaoId, participante } = useBolao()
  const { partidas, loading: partidasLoading } = usePartidas()
  const { palpitesMap, loading: palpitesLoading } = usePalpites(participanteId, partidas)
  const { nome, loading: nomeLoading } = useParticipante(participanteId)

  if (!participanteId) return <Navigate to={bolaoPath(bolaoId)} replace />

  if (participanteId === participante?.id) {
    return <Navigate to={bolaoPath(bolaoId, 'palpites')} replace />
  }

  if (partidasLoading || palpitesLoading || nomeLoading) {
    return <LoadingState message="Carregando palpites…" />
  }

  return (
    <div className="screen">
      <Link to={bolaoPath(bolaoId)} className="link-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Icon.back s={14} /> Voltar ao ranking
      </Link>
      <PalpitesList
        title={`Palpites de ${nome}`}
        subtitle="Visualização"
        participanteId={participanteId}
        partidas={partidas}
        palpitesMap={palpitesMap}
        viewOnly
      />
    </div>
  )
}
