interface StatTrioProps {
  e: number
  p: number
  x: number
}

export function StatTrio({ e, p, x }: StatTrioProps) {
  return (
    <span className="stat-trio" title="Cravou · Acertou o resultado · Não apostou">
      <b className="s-e">{e}</b>
      <b className="s-p">{p}</b>
      <b className="s-x">{x}</b>
    </span>
  )
}
