import { useState } from 'react'
import { teamFlagEmoji, teamFlagUrl } from '../../lib/teamFlags'

interface TeamBadgeProps {
  name: string
  size?: number
}

export function TeamBadge({ name, size = 30 }: TeamBadgeProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <span
        className="team-badge team-badge-emoji"
        style={{ width: size, height: size, fontSize: size * 0.62 }}
        aria-hidden
      >
        {teamFlagEmoji(name)}
      </span>
    )
  }

  return (
    <img
      src={teamFlagUrl(name)}
      alt=""
      aria-hidden
      className="team-badge"
      width={size}
      height={Math.round(size * 0.67)}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
