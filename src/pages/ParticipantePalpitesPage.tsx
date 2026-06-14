import { Link, Navigate, useParams } from 'react-router-dom'
import { PalpitesList } from './PalpitesPage'
import { useParticipante, usePalpites } from '../hooks/usePalpites'
import { usePartidas } from '../hooks/usePartidas'
import { useBolao } from '../contexts/BolaoContext'
import { bolaoPath } from '../lib/paths'

export function ParticipantePalpitesPage() {
  const { participanteId } = useParams<{ participanteId: string }>()
  const { bolaoId } = useBolao()
  const { partidas, loading: partidasLoading } = usePartidas()
  const { palpitesMap, loading: palpitesLoading } = usePalpites(participanteId, partidas)
  const { nome, loading: nomeLoading } = useParticipante(participanteId)

  if (!participanteId) return <Navigate to={bolaoPath(bolaoId)} replace />

  if (partidasLoading || palpitesLoading || nomeLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/50">
        <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        Carregando palpites…
      </div>
    )
  }

  return (
    <div>
      <Link to={bolaoPath(bolaoId)} className="mb-4 inline-flex text-sm text-gold hover:underline">
        ← Voltar ao ranking
      </Link>
      <PalpitesList
        title={`Palpites de ${nome}`}
        subtitle="Visualização"
        participanteId={participanteId}
        partidas={partidas}
        palpitesMap={palpitesMap}
        readOnly
      />
    </div>
  )
}
