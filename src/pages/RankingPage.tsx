import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { NextGameBets } from '../components/NextGameBets'
import { RankingCard } from '../components/RankingCard'
import { useBolao } from '../contexts/BolaoContext'
import { useLiveRanking } from '../hooks/useLiveRanking'
import { bolaoPath } from '../lib/paths'

export function RankingPage() {
  const { bolaoId, isAdmin } = useBolao()
  const {
    ranking,
    loading,
    refreshing,
    error,
    lastUpdate,
    aoVivo,
    encerradas,
    total,
    proximaPartida,
    apostasProximoJogo,
    refresh,
  } = useLiveRanking()

  async function handleRefresh() {
    try {
      await refresh()
      toast.success('Ranking atualizado!')
    } catch {
      toast.error('Erro ao atualizar ranking')
    }
  }

  if (loading && ranking.length === 0) {
    return <LoadingState />
  }

  if (error && ranking.length === 0) {
    return <ErrorState message={error} onRetry={handleRefresh} />
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <aside className="order-2 lg:order-1 lg:w-72 lg:shrink-0">
        <NextGameBets partida={proximaPartida} apostas={apostasProximoJogo} />
      </aside>

      <div className="order-1 min-w-0 flex-1 space-y-2 lg:order-2">
        <div className="mb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Ranking</h2>
              <p className="text-sm text-white/50">
                {encerradas}/{total} jogos com placar
              </p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold disabled:opacity-50"
            >
              <span className={refreshing ? 'animate-spin' : ''}>↻</span>
              {refreshing ? 'Atualizando…' : 'Atualizar'}
            </button>
          </div>

          {aoVivo > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-400">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {aoVivo} jogo{aoVivo > 1 ? 's' : ''} ao vivo agora
            </p>
          )}
          <p className="mt-1 text-xs text-white/30">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
          </p>
          {isAdmin && (
            <Link
              to={bolaoPath(bolaoId, 'admin')}
              className="mt-2 inline-block text-xs text-gold hover:underline"
            >
              Administração →
            </Link>
          )}
        </div>

        <div className="space-y-1.5">
          {ranking.map((p) => (
            <RankingCard key={p.id} participante={p} compact />
          ))}
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/50">
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      Carregando ranking…
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-300">
      <p>Erro ao carregar ranking: {message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-xl bg-red-400/20 px-4 py-2 text-sm font-semibold text-red-200"
      >
        Tentar novamente
      </button>
    </div>
  )
}
