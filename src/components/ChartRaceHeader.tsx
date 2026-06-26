import { Icon } from './ui'

interface ChartRaceHeaderProps {
  title: string
  subtitle: string
  canReplay: boolean
  onReplay: () => void
}

export function ChartRaceHeader({ title, subtitle, canReplay, onReplay }: ChartRaceHeaderProps) {
  return (
    <div className="ranking-chart-head">
      <div className="ranking-chart-head-text">
        <h3 className="ranking-chart-title">{title}</h3>
        <p className="sub ranking-chart-sub">{subtitle}</p>
      </div>
      {canReplay && (
        <button
          type="button"
          className="chart-replay-btn"
          onClick={onReplay}
          aria-label="Repetir animação"
        >
          <Icon.refresh s={15} />
          Replay
        </button>
      )}
    </div>
  )
}
