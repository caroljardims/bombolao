import { Link, Navigate } from 'react-router-dom'
import { useMemo } from 'react'
import { LoadingState } from '../components/LoadingState'
import { MatchGameBets } from '../components/MatchGameBets'
import { PalpitesDaySection } from '../components/PalpitesDaySection'
import { RankingEvolutionChart } from '../components/RankingEvolutionChart'
import { PointsEvolutionChart } from '../components/PointsEvolutionChart'
import { useAuth } from '../hooks/useAuth'
import { useBolao } from '../contexts/BolaoContext'
import { useNow } from '../hooks/useNow'
import { usePartidas } from '../hooks/usePartidas'
import { PalpiteInput } from '../components/PalpiteInput'
import { AcertoBadge } from '../components/AcertoBadge'
import { Pill, TeamBadge } from '../components/ui'
import { getHoje, getKickoffDate, groupPartidasByDay } from '../lib/dates'
import { apostasAbertas, palpitesAdversariosVisiveis, partidaAoVivo, partidaEncerrada, temPalpite } from '../lib/scoring'
import { jogosPendentesDiasAnteriores, partidaJaPassou } from '../lib/nextPartida'
import { getPontosLive, classificarAcertoLive } from '../lib/liveRanking'
import { buildRankingHistory } from '../lib/rankingHistory'
import { bolaoPath } from '../lib/paths'
import { LiveTag } from '../components/LiveTag'
import type { Palpite, Partida } from '../lib/types'

/** Agrupa por dia, jogando partidas pendentes de dias anteriores no bloco de hoje. */
function groupPartidasForDisplay(partidas: Partida[]): [string, Partida[]][] {
  const hoje = getHoje()
  const pendentes = jogosPendentesDiasAnteriores(partidas, hoje)
  const pendentesIds = new Set(pendentes.map((p) => p.id))

  const groups = new Map<string, Partida[]>()
  for (const p of partidas) {
    if (pendentesIds.has(p.id)) continue
    const list = groups.get(p.data) ?? []
    list.push(p)
    groups.set(p.data, list)
  }

  const hojeList = [...pendentes, ...(groups.get(hoje) ?? [])].sort(
    (a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime(),
  )
  if (hojeList.length > 0) groups.set(hoje, hojeList)

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, list]) => [
      data,
      [...list].sort((a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime()),
    ])
}

export function PalpitesPage() {
  const { user, loading: authLoading } = useAuth()
  const { participante, isMember, bolaoId } = useBolao()
  const { partidas, participantes, palpites, loading } = usePartidas()

  const rankingHistory = useMemo(
    () => buildRankingHistory(participantes, palpites, partidas),
    [participantes, palpites, partidas],
  )

  const myPalpitesMap = useMemo(() => {
    const map = new Map<string, Palpite>()
    if (!participante) return map
    for (const p of palpites) {
      if (p.participante_id === participante.id) map.set(p.partida_id, p)
    }
    return map
  }, [palpites, participante])

  const dayGroups = useMemo(() => groupPartidasForDisplay(partidas), [partidas])

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

  if (loading) return <LoadingState message="Carregando palpites…" />

  const hoje = getHoje()
  const pending = partidas.filter((p) => {
    const palpite = myPalpitesMap.get(p.id)
    return apostasAbertas(p) && (!palpite || !temPalpite(palpite))
  }).length

  return (
    <div className="screen palpites-screen">
      <header className="section-head plain">
        <div>
          <h2>Palpites</h2>
          <p className="sub">Mande seu placar antes do apito inicial de cada jogo</p>
        </div>
        {pending > 0 && <Pill tone="gold-soft">{pending} sem palpite</Pill>}
      </header>

      <RankingEvolutionChart steps={rankingHistory.steps} lines={rankingHistory.lines} />
      <PointsEvolutionChart steps={rankingHistory.steps} lines={rankingHistory.pointsLines} />

      <div className="palpite-days">
        {dayGroups.map(([data, partidasDoDia]) => (
          <PalpitesDaySection
            key={data}
            data={data}
            count={partidasDoDia.length}
            defaultOpen={data >= hoje || partidasDoDia.some((p) => !partidaJaPassou(p))}
          >
            {partidasDoDia.map((partida) =>
              apostasAbertas(partida) ? (
                <PalpiteCard
                  key={partida.id}
                  partida={partida}
                  participanteId={participante.id}
                  palpite={myPalpitesMap.get(partida.id)}
                  viewOnly={false}
                />
              ) : (
                <MatchGameBets
                  key={partida.id}
                  partida={partida}
                  participantes={participantes}
                  palpites={palpites}
                  embedded
                />
              ),
            )}
          </PalpitesDaySection>
        ))}
      </div>
    </div>
  )
}

interface PalpitesListProps {
  title: string
  subtitle: string
  participanteId: string
  partidas: Partida[]
  palpitesMap: Map<string, Palpite>
  viewOnly?: boolean
}

interface PalpiteCardProps {
  partida: Partida
  participanteId: string
  palpite: Palpite | undefined
  viewOnly: boolean
}

export function PalpiteCard({ partida, participanteId, palpite, viewOnly }: PalpiteCardProps) {
  const { participante } = useBolao()
  const now = useNow()
  const encerrada = partidaEncerrada(partida)
  const aoVivo = partidaAoVivo(partida)
  const abertas = apostasAbertas(partida, now)
  const isOwn = participanteId === participante?.id
  const oculto = viewOnly && !isOwn && !palpitesAdversariosVisiveis(partida, now)
  const canEdit = isOwn && abertas && !encerrada
  const inputReadOnly = !canEdit
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
              Placar final{' '}
              <b>
                {partida.gols_casa} × {partida.gols_fora}
              </b>
            </span>
          )}
        </div>
        {encerrada && palpite && <AcertoBadge tipo={tipo} pontos={pontosLive} />}
        {aoVivo && <LiveTag partida={partida} />}
        {!encerrada && !aoVivo && canEdit && (
          <Pill tone={abertas ? 'ok-soft' : 'danger-soft'}>{abertas ? 'Aberto' : 'Fechado'}</Pill>
        )}
      </div>

      <PalpiteInput
        partida={partida}
        participanteId={participanteId}
        palpiteCasa={palpite?.palpite_casa ?? null}
        palpiteFora={palpite?.palpite_fora ?? null}
        readOnly={inputReadOnly}
        oculto={oculto}
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
  viewOnly = false,
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
            defaultOpen={data >= hoje || partidasDoDia.some((p) => !partidaJaPassou(p))}
          >
            {partidasDoDia.map((partida) => (
              <PalpiteCard
                key={partida.id}
                partida={partida}
                participanteId={participanteId}
                palpite={palpitesMap.get(partida.id)}
                viewOnly={viewOnly}
              />
            ))}
          </PalpitesDaySection>
        ))}
      </div>
    </div>
  )
}
