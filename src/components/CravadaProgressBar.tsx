interface CravadaProgressBarProps {
  feitos: number
  total: number
}

/** Barra de progresso dos picks da cravada (X de N). */
export function CravadaProgressBar({ feitos, total }: CravadaProgressBarProps) {
  const safeTotal = Math.max(total, 1)
  const pct = Math.min(100, Math.round((feitos / safeTotal) * 100))
  const completa = feitos >= total

  return (
    <div className={`cravada-progress${completa ? ' is-complete' : ''}`}>
      <div className="cravada-progress-track" role="progressbar" aria-valuenow={feitos} aria-valuemin={0} aria-valuemax={total}>
        <div className="cravada-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="cravada-progress-label">
        {completa ? 'Cravada completa' : `${feitos} de ${total} palpites`}
      </span>
    </div>
  )
}
