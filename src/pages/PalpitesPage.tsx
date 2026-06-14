import { Link, Navigate } from 'react-router-dom'
import { useMemo } from 'react'
import { LoadingState } from '../components/LoadingState'
import { PalpitesDaySection } from '../components/PalpitesDaySection'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { usePalpites } from '../hooks/usePalpites'
import { usePartidas } from '../hooks/usePartidas'
import { PalpiteInput } from '../components/PalpiteInput'
import { AcertoBadge } from '../components/AcertoBadge'
import { Pill, TeamBadge } from '../components/ui'
import { getHoje, groupPartidasByDay } from '../lib/dates'
import { apostasAbertas, partidaEncerrada, temPalpite } from '../lib/scoring'
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
      <div className="alert-gold" style={{ textAlign: 'center' }}>
        <p>Você ainda não faz parte deste bolão.</p>
        <Link to="/" className="link-gold center-link">
          ← Voltar ao lobby
        </Link>
      </div>
    )
  }

  if (partidasLoading || palpitesLoading) return <LoadingState message="Carregando palpites…" />

  return (
    <PalpitesList
      title="Palpites"
      subtitle="Mande seu placar antes do apito inicial de cada jogo"
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

interface PalpiteCardProps {
  partida: Partida
  participanteId: string
  palpite: Palpite | undefined
  readOnly: boolean
}

function PalpiteCard({ partida, participanteId, palpite, readOnly }: PalpiteCardProps) {
  const encerrada = partidaEncerrada(partida)
  const abertas = apostasAbertas(partida)
  const tipo = palpite
    ? classificarAcertoLive(palpite, partida)
    : encerrada
      ? 'sem_aposta'
      : 'nada'
  const pontosLive = palpite ? getPontosLive(palpite, partida) : null
  const state = encerrada ? 'result' : abertas ? 'open' : 'closed'

  return (
    <article className={`card palpite-card state-${state}`}>
      <div className="palpite-top">
        <div className="palpite-when">
          <span className="date">{partida.hora}</span>
          <h4 className="palpite-teams">
            <TeamBadge name={partida.time_casa} size={26} /> {partida.time_casa}
            <i className="vs">×</i>
            {partida.time_fora} <TeamBadge name={partida.time_fora} size={26} />
          </h4>
          {encerrada && (
            <span className="real-score">
              Placar oficial{' '}
              <b>
                {partida.gols_casa} × {partida.gols_fora}
              </b>
            </span>
          )}
        </div>
        {encerrada && palpite && <AcertoBadge tipo={tipo} pontos={pontosLive} />}
        {!encerrada && !readOnly && (
          <Pill tone={abertas ? 'ok-soft' : 'danger-soft'}>{abertas ? 'Aberto' : 'Fechado'}</Pill>
        )}
      </div>

      <PalpiteInput
        partida={partida}
        participanteId={participanteId}
        palpiteCasa={palpite?.palpite_casa ?? null}
        palpiteFora={palpite?.palpite_fora ?? null}
        readOnly={readOnly || !abertas}
      />
    </article>
  )
}

export function PalpitesList({
  title,
  subtitle,
  participanteId,
  partidas,
  palpitesMap,
  readOnly,
}: PalpitesListProps) {
  const hoje = getHoje()
  const days = useMemo(() => groupPartidasByDay(partidas), [partidas])

  const pending = partidas.filter((p) => {
    const palpite = palpitesMap.get(p.id)
    return apostasAbertas(p) && (!palpite || !temPalpite(palpite))
  }).length

  return (
    <div className="screen palpites-screen">
      <header className="section-head plain">
        <div>
          <h2>{title}</h2>
          <p className="sub">{subtitle}</p>
        </div>
        {pending > 0 && <Pill tone="gold-soft">{pending} sem palpite</Pill>}
      </header>

      <div className="palpite-days">
        {days.map(([data, partidasDoDia]) => (
          <PalpitesDaySection
            key={data}
            data={data}
            count={partidasDoDia.length}
            defaultOpen={data >= hoje}
          >
            {partidasDoDia.map((partida) => (
              <PalpiteCard
                key={partida.id}
                partida={partida}
                participanteId={participanteId}
                palpite={palpitesMap.get(partida.id)}
                readOnly={readOnly}
              />
            ))}
          </PalpitesDaySection>
        ))}
      </div>
    </div>
  )
}
