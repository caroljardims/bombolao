import { apostasAbertas, partidaAoVivo, partidaEncerrada, temPlacar } from '../lib/scoring'
import { formatDataCurta, isHoje } from '../lib/dates'
import type { Partida } from '../lib/types'
import { Icon, Pill, TeamBadge } from './ui'

interface MatchCardProps {
  partida: Partida
}

export function MatchCard({ partida }: MatchCardProps) {
  const encerrada = partidaEncerrada(partida)
  const aoVivo = partidaAoVivo(partida)
  const comPlacar = temPlacar(partida)
  const abertas = apostasAbertas(partida)
  const hoje = isHoje(partida.data)

  const homeWin = comPlacar && partida.gols_casa! > partida.gols_fora!
  const awayWin = comPlacar && partida.gols_fora! > partida.gols_casa!

  return (
    <article className="card match-card">
      <div className="match-top">
        <span className="phase">{partida.fase}</span>
        <div className="match-tags">
          {aoVivo && (
            <Pill tone="live" dot>
              Ao vivo
            </Pill>
          )}
          {hoje ? (
            <Pill tone="gold-soft">Hoje</Pill>
          ) : (
            <Pill tone="muted">{formatDataCurta(partida.data)}</Pill>
          )}
        </div>
      </div>

      <div className="match-teams">
        <div className={`mt-row${comPlacar && !homeWin ? ' dim' : ''}`}>
          <TeamBadge name={partida.time_casa} size={34} />
          <span className="mt-name">{partida.time_casa}</span>
          {comPlacar ? (
            <span className={`mt-score${aoVivo ? ' live' : ''}`}>{partida.gols_casa}</span>
          ) : (
            <span className="mt-kick">{partida.hora}</span>
          )}
        </div>
        <div className={`mt-row${comPlacar && !awayWin ? ' dim' : ''}`}>
          <TeamBadge name={partida.time_fora} size={34} />
          <span className="mt-name">{partida.time_fora}</span>
          {comPlacar ? (
            <span className={`mt-score${aoVivo ? ' live' : ''}`}>{partida.gols_fora}</span>
          ) : (
            <span className="mt-kick muted">&nbsp;</span>
          )}
        </div>
      </div>

      <div className="match-status">
        {aoVivo ? (
          <span className="ms-live">
            <i className="live-dot" /> Ao vivo
          </span>
        ) : encerrada ? (
          <span className="ms-ft">Encerrado</span>
        ) : (
          <span className="ms-sched">
            {hoje ? 'Hoje' : formatDataCurta(partida.data)} · começa {partida.hora}
          </span>
        )}
      </div>

      <div className="match-foot">
        {encerrada && (
          <span className="settled">
            <Icon.check s={15} /> Resultado computado
          </span>
        )}
        {!encerrada && !abertas && <Pill tone="danger-soft">Apostas encerradas</Pill>}
        {!encerrada && abertas && <Pill tone="ok-soft">Apostas abertas</Pill>}
      </div>
    </article>
  )
}

export function MatchGroupHeader({ data, count }: { data: string; count: number }) {
  return (
    <h3 className="day-label">
      <span>{formatDataCurta(data)}</span>
      <span className="count">{count}</span>
    </h3>
  )
}
