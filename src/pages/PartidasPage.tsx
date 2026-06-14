import { MatchCard, MatchGroupHeader } from '../components/MatchCard'
import { useBolao } from '../contexts/BolaoContext'
import { usePartidas } from '../hooks/usePartidas'

export function PartidasPage() {
  const { bolao } = useBolao()
  const { grouped, partidasHoje, competicao, loading, error } = usePartidas()

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} />

  const ultimaSync = bolao?.ultimaSyncApi
    ? new Date(bolao.ultimaSyncApi).toLocaleString('pt-BR')
    : null

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Partidas</h2>
        <p className="text-sm text-white/50">
          {competicao || 'Partidas'} · placares via sync automático
        </p>
        {ultimaSync && (
          <p className="mt-1 text-xs text-white/30">Último sync: {ultimaSync}</p>
        )}
      </div>

      {partidasHoje.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gold">Jogos de hoje</h3>
          <div className="space-y-3">
            {partidasHoje.map((p) => (
              <MatchCard key={p.id} partida={p} />
            ))}
          </div>
        </section>
      )}

      {Array.from(grouped.entries()).map(([data, partidas]) => (
        <section key={data}>
          <MatchGroupHeader data={data} />
          <div className="space-y-3">
            {partidas.map((p) => (
              <MatchCard key={p.id} partida={p} compact />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/50">
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      Carregando partidas…
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-300">
      Erro ao carregar partidas: {message}
    </div>
  )
}
