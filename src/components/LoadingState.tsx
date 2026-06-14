export function LoadingState({ message = 'Carregando…' }: { message?: string }) {
  return (
    <div className="loading-center">
      <div className="loading-spinner" />
      {message}
    </div>
  )
}
