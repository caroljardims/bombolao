import { formatDataCurta } from '../lib/dates'
import type { ApostaProximoJogo } from '../lib/nextPartida'
import { temPalpite } from '../lib/scoring'
import type { Palpite, Partida } from '../lib/types'

interface NextGameBetsProps {
  partida: Partida | null
  apostas: ApostaProximoJogo[]
}

export function NextGameBets({ partida, apostas }: NextGameBetsProps) {
  if (!partida) {
    return (
      <section className="rounded-xl border border-white/10 bg-pitch-card p-4">
        <h3 className="text-sm font-semibold text-white/70">Próximo jogo</h3>
        <p className="mt-2 text-sm text-white/40">Nenhum jogo pendente.</p>
      </section>
    )
  }

  const comAposta = apostas.filter((a) => a.palpite && temPalpite(a.palpite)).length

  return (
    <section className="rounded-xl border border-white/10 bg-pitch-card p-3">
      <div className="mb-3 border-b border-white/10 pb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gold">Próximo jogo</p>
        <p className="mt-1 text-sm font-semibold leading-tight">
          {partida.time_casa} × {partida.time_fora}
        </p>
        <p className="mt-0.5 text-xs text-white/40">
          {formatDataCurta(partida.data)} · {partida.hora}
        </p>
        <p className="mt-1 text-xs text-white/30">
          {comAposta}/{apostas.length} apostaram
        </p>
      </div>

      <ul className="space-y-1">
        {apostas.map(({ participante, palpite }) => (
          <li
            key={participante.id}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-grass-light/30 text-[10px] font-bold text-white/80">
                {participante.posicao}
              </span>
              <span className="truncate text-sm">{participante.nome}</span>
            </div>
            <PalpiteBadge palpite={palpite} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PalpiteBadge({ palpite }: { palpite: Palpite | null }) {
  if (!palpite || !temPalpite(palpite)) {
    return <span className="shrink-0 text-xs text-white/25">—</span>
  }

  return (
    <span className="shrink-0 rounded-md bg-black/30 px-2 py-0.5 font-mono text-sm font-semibold tabular-nums text-gold">
      {palpite.palpite_casa}×{palpite.palpite_fora}
    </span>
  )
}
