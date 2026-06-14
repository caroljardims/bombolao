type PillTone = 'neutral' | 'muted' | 'gold-soft' | 'live' | 'ok-soft' | 'danger-soft'

interface PillProps {
  tone?: PillTone
  dot?: boolean
  children: React.ReactNode
}

export function Pill({ tone = 'neutral', children, dot }: PillProps) {
  return (
    <span className={`pill pill-${tone}`}>
      {dot && <i className="pill-dot" />}
      {children}
    </span>
  )
}
