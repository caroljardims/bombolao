import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { usePalpites } from '../hooks/usePalpites'
import { usePartidas } from '../hooks/usePartidas'
import { PalpiteInput } from '../components/PalpiteInput'
import { AcertoBadge } from '../components/AcertoBadge'
import { apostasAbertas, partidaEncerrada } from '../lib/scoring'
import { getPontosLive, classificarAcertoLive } from '../lib/liveRanking'
import { bolaoPath } from '../lib/paths'
import type { Palpite, Partida } from '../lib/types'

export function PalpitesPage() {
  const { user, loading: authLoading } = useAuth()
  const { participante, isMember, bolaoId } = useBolao()
  const { partidas, loading: partidasLoading } = usePartidas()
  const { palpitesMap, loading: palpitesLoading } = usePalpites(participante?.id, partidas)

  if (authLoading) return <LoadingState />
  if (!user) return <Navigate to="/conta" replace state={{ returnTo: bolaoPath(bolaoId, 'palpites') }} />
  if (!isMember || !participante) {
    return (
      <div className="space-y-4 rounded-2xl border border-gold/30 bg-gold/10 p-6 text-center">
        <p className="text-gold">Você ainda não faz parte deste bolão.</p>
        <Link to="/" className="text-sm hover:underline">← Voltar ao lobby</Link>
      </div>
    )
  }

  if (partidasLoading || palpitesLoading) return <LoadingState />

  return (
    <PalpitesList
      title="Meus Palpites"
      subtitle={participante.nome}
      participanteId={participante.id}
      partidas={partidas}
      palpitesMap={palpitesMap}
      readOnly={false}
    />
  )
}

interface PalpitesListProps {
  title: string
  subtitle: string
  participanteId: string
  partidas: Partida[]
  palpitesMap: Map<string, Palpite>
  readOnly: boolean
}

export function PalpitesList({
  title,
  subtitle,
  participanteId,
  partidas,
  palpitesMap,
  readOnly,
}: PalpitesListProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-white/50">{subtitle}</p>
      </div>

      <div className="space-y-3">
        {partidas.map((partida) => {
          const palpite = palpitesMap.get(partida.id)
          const encerrada = partidaEncerrada(partida)
          const abertas = apostasAbertas(partida)
          const tipo = palpite
            ? classificarAcertoLive(palpite, partida)
            : encerrada
              ? 'sem_aposta'
              : 'nada'
          const pontosLive = palpite ? getPontosLive(palpite, partida) : null

          return (
            <div
              key={partida.id}
              className="rounded-2xl border border-white/10 bg-pitch-card p-4"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-white/50">{partida.data} · {partida.hora}</p>
                  <p className="font-medium">
                    {partida.time_casa} × {partida.time_fora}
                  </p>
                  {encerrada && (
                    <p className="mt-1 text-sm text-gold">
                      Placar: {partida.gols_casa} × {partida.gols_fora}
                    </p>
                  )}
                </div>
                {encerrada && palpite && (
                  <AcertoBadge tipo={tipo} pontos={pontosLive} />
                )}
                {!encerrada && !readOnly && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      abertas ? 'bg-green-500/20 text-green-400' : 'bg-red-400/20 text-red-300'
                    }`}
                  >
                    {abertas ? 'Aberto' : 'Fechado'}
                  </span>
                )}
              </div>

              <PalpiteInput
                partida={partida}
                participanteId={participanteId}
                palpiteCasa={palpite?.palpite_casa ?? null}
                palpiteFora={palpite?.palpite_fora ?? null}
                readOnly={readOnly || !abertas}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/50">
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      Carregando palpites…
    </div>
  )
}
