interface CravadaLockDialogProps {
  open: boolean
  locking: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** Modal de confirmação do travamento da cravada (ação irreversível). */
export function CravadaLockDialog({ open, locking, onCancel, onConfirm }: CravadaLockDialogProps) {
  if (!open) return null
  return (
    <div className="chave-modal-overlay" role="presentation" onClick={() => !locking && onCancel()}>
      <div
        className="chave-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-lock-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-lock-title">Travar a cravada?</h3>
        <p className="sub">
          Esta ação é <strong>definitiva</strong>: depois de travar, você não poderá modificar mais
          nenhum palpite da chave.
        </p>
        <div className="chave-modal-actions">
          <button type="button" className="btn btn-ghost-gold" onClick={onCancel} disabled={locking}>
            Cancelar
          </button>
          <button type="button" className="btn btn-gold" onClick={onConfirm} disabled={locking}>
            {locking ? 'Travando…' : 'Confirmar e travar'}
          </button>
        </div>
      </div>
    </div>
  )
}
