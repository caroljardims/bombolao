import { apostasAbertas, partidaAoVivo, partidaEncerrada, temPlacar } from '../lib/scoring'
import { formatDataCurta, isHoje } from '../lib/dates'
import type { Partida } from '../lib/types'

interface MatchCardProps {
  partida: Partida
  compact?: boolean
}

export function MatchCard({ partida, compact = false }: MatchCardProps) {
  const encerrada = partidaEncerrada(partida)
  const aoVivo = partidaAoVivo(partida)
  const comPlacar = temPlacar(partida)
  const abertas = apostasAbertas(partida)
  const hoje = isHoje(partida.data)

  return (
    <div
      className={`rounded-2xl border bg-pitch-card p-4 ${
        hoje ? 'border-gold/40 ring-1 ring-gold/20' : 'border-white/10'
      }`}
    >
      {!compact && (
        <div className="mb-2 flex items-center justify-between text-xs text-white/50">
          <span>{partida.fase}</span>
          <div className="flex items-center gap-2">
            {aoVivo && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 font-medium text-red-400">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                Ao vivo
              </span>
            )}
            {hoje && (
              <span className="rounded-full bg-gold/20 px-2 py-0.5 font-medium text-gold">
                Hoje
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <TeamBlock
          name={partida.time_casa}
          score={comPlacar ? partida.gols_casa : null}
        />
        <div className="shrink-0 text-center">
          {encerrada ? (
            <span className="text-xs text-white/40">FT</span>
          ) : comPlacar && aoVivo ? (
            <span className="text-xs font-medium text-red-400">AO VIVO</span>
          ) : (
            <span className="text-sm font-medium text-white/70">{partida.hora}</span>
          )}
        </div>
        <TeamBlock
          name={partida.time_fora}
          score={comPlacar ? partida.gols_fora : null}
          align="right"
        />
      </div>

      {!encerrada && !compact && (
        <div className="mt-3">
          <StatusBadge abertas={abertas} />
        </div>
      )}

      {encerrada && (
        <div className="mt-2 text-center text-lg">✅</div>
      )}
    </div>
  )
}

function TeamBlock({
  name,
  score,
  align = 'left',
}: {
  name: string
  score: number | null
  align?: 'left' | 'right'
}) {
  return (
    <div className={`flex-1 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <p className="text-sm font-medium leading-tight">{name}</p>
      {score !== null && (
        <p className="mt-1 text-3xl font-bold tabular-nums text-gold">{score}</p>
      )}
    </div>
  )
}

function StatusBadge({ abertas }: { abertas: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
        abertas
          ? 'bg-green-500/20 text-green-400'
          : 'bg-red-400/20 text-red-300'
      }`}
    >
      {abertas ? 'Apostas abertas' : 'Apostas encerradas'}
    </span>
  )
}

export function MatchGroupHeader({ data }: { data: string }) {
  return (
    <h2 className="sticky top-14 z-10 bg-pitch/95 py-2 text-sm font-semibold uppercase tracking-wide text-white/60 backdrop-blur">
      {formatDataCurta(data)}
    </h2>
  )
}
