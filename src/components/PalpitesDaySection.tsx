import { useState, type ReactNode } from 'react'
import { formatDataCurta, isHoje } from '../lib/dates'
import { Icon } from './ui'

interface PalpitesDaySectionProps {
  data: string
  count: number
  defaultOpen: boolean
  children: ReactNode
}

export function PalpitesDaySection({ data, count, defaultOpen, children }: PalpitesDaySectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const label = isHoje(data) ? 'Hoje' : formatDataCurta(data)

  return (
    <details
      className="palpite-day"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="palpite-day-summary">
        <span className="palpite-day-label">
          {isHoje(data) ? <span className="gold-text">{label}</span> : label}
        </span>
        <span className="count">{count}</span>
        <span className="palpite-day-chevron" aria-hidden="true">
          <Icon.back s={16} />
        </span>
      </summary>
      <div className="palpite-day-body">{children}</div>
    </details>
  )
}
