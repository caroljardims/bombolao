import { Link } from 'react-router-dom'
import { useBolao } from '../contexts/BolaoContext'
import { bolaoPath } from '../lib/paths'
import type { Participante } from '../lib/types'

interface RankingCardProps {
  participante: Participante
  compact?: boolean
}

export function RankingCard({ participante, compact = false }: RankingCardProps) {
  const { bolaoId } = useBolao()
  const isFirst = participante.posicao === 1

  if (compact) {
    return (
      <Link
        to={bolaoPath(bolaoId, `palpites/${participante.id}`)}
        className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition active:scale-[0.98] ${
          isFirst
            ? 'border-gold/50 bg-gold/10'
            : 'border-white/10 bg-pitch-card hover:border-grass-light/40'
        }`}
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            isFirst ? 'bg-gold text-pitch' : 'bg-grass-light/30 text-white'
          }`}
        >
          {isFirst ? '🏆' : participante.posicao}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-semibold ${isFirst ? 'text-gold' : 'text-white'}`}>
            {participante.nome}
          </p>
        </div>

        <p className={`shrink-0 text-lg font-bold tabular-nums ${isFirst ? 'text-gold' : 'text-white'}`}>
          {participante.total_pontos}
        </p>

        <div className="hidden shrink-0 gap-1 sm:flex">
          <MiniStat value={participante.na_mosca} color="text-gold" />
          <MiniStat value={participante.acerto_resultado} color="text-green-400" />
          <MiniStat value={participante.sem_aposta} color="text-red-300" />
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={bolaoPath(bolaoId, `palpites/${participante.id}`)}
      className={`block rounded-2xl border p-4 transition active:scale-[0.98] ${
        isFirst
          ? 'border-gold/60 bg-gradient-to-br from-gold/15 to-pitch-card shadow-lg shadow-gold/10'
          : 'border-white/10 bg-pitch-card hover:border-grass-light/40'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
            isFirst ? 'bg-gold text-pitch' : 'bg-grass-light/30 text-white'
          }`}
        >
          {isFirst ? '🏆' : participante.posicao}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold ${isFirst ? 'text-gold' : 'text-white'}`}>
            {participante.nome}
          </p>
          <p className="text-2xl font-bold tabular-nums">{participante.total_pontos} pts</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <StatBadge label="MSC" value={participante.na_mosca} color="text-gold" />
        <StatBadge label="ARES" value={participante.acerto_resultado} color="text-green-400" />
        <StatBadge label="JSA" value={participante.sem_aposta} color="text-red-300" />
      </div>
    </Link>
  )
}

function MiniStat({ value, color }: { value: number; color: string }) {
  return (
    <span className={`w-5 text-center text-xs font-semibold tabular-nums ${color}`}>{value}</span>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs">
      <span className="text-white/50">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>{value}</span>
    </span>
  )
}
