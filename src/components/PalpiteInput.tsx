import { useEffect, useState } from 'react'
import { setDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { useBolao } from '../contexts/BolaoContext'
import { apostasAbertas, temPalpite } from '../lib/scoring'
import { palpiteDoc } from '../lib/paths'
import type { Partida } from '../lib/types'
import { Icon } from './ui'

interface PalpiteInputProps {
  partida: Partida
  participanteId: string
  palpiteCasa: number | null
  palpiteFora: number | null
  readOnly?: boolean
  oculto?: boolean
}

function Stepper({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
  label: string
}) {
  function handleInput(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 2)
    if (digits === '') {
      onChange(null)
      return
    }
    onChange(Math.min(20, Number.parseInt(digits, 10)))
  }

  return (
    <div className={`stepper${disabled ? ' disabled' : ''}`}>
      <button
        type="button"
        className="step-btn"
        disabled={disabled}
        onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
        aria-label={`menos ${label}`}
      >
        –
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        className="step-val"
        disabled={disabled}
        value={value == null ? '' : String(value)}
        onChange={(e) => handleInput(e.target.value)}
        aria-label={label}
        placeholder="–"
      />
      <button
        type="button"
        className="step-btn"
        disabled={disabled}
        onClick={() => onChange(Math.min(20, (value ?? -1) + 1))}
        aria-label={`mais ${label}`}
      >
        +
      </button>
    </div>
  )
}

function PalpiteDisplay({
  casa,
  fora,
  oculto,
}: {
  casa: number | null
  fora: number | null
  oculto?: boolean
}) {
  if (oculto) {
    return (
      <span className="palpite-display is-hidden">
        —
        <i>×</i>
        —
      </span>
    )
  }

  const filled = casa !== null && fora !== null
  if (!filled) {
    return (
      <span className="palpite-display is-empty">
        —
        <i>×</i>
        —
      </span>
    )
  }

  return (
    <span className="palpite-display">
      {casa}
      <i>×</i>
      {fora}
    </span>
  )
}

export function PalpiteInput({
  partida,
  participanteId,
  palpiteCasa,
  palpiteFora,
  readOnly = false,
  oculto = false,
}: PalpiteInputProps) {
  const { bolaoId } = useBolao()
  const [casa, setCasa] = useState<number | null>(palpiteCasa)
  const [fora, setFora] = useState<number | null>(palpiteFora)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCasa(palpiteCasa)
    setFora(palpiteFora)
  }, [palpiteCasa, palpiteFora])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(timer)
  }, [saved])

  const abertas = apostasAbertas(partida)
  const disabled = readOnly || !abertas || saving
  const filled = casa !== null && fora !== null

  async function save(casaNum: number | null, foraNum: number | null) {
    if (disabled) return

    if (casaNum !== null && (casaNum < 0 || casaNum > 20)) {
      toast.error('Placar casa inválido (0–20)')
      return
    }
    if (foraNum !== null && (foraNum < 0 || foraNum > 20)) {
      toast.error('Placar fora inválido (0–20)')
      return
    }
    if ((casaNum === null) !== (foraNum === null)) {
      toast.error('Preencha casa e fora, ou deixe ambos vazios')
      return
    }

    setSaving(true)
    try {
      const id = `${participanteId}_${partida.id}`
      await setDoc(
        palpiteDoc(bolaoId, id),
        {
          participante_id: participanteId,
          partida_id: partida.id,
          palpite_casa: casaNum,
          palpite_fora: foraNum,
          pontos: null,
        },
        { merge: true },
      )
      setSaved(true)
    } catch {
      toast.error('Erro ao salvar palpite')
    } finally {
      setSaving(false)
    }
  }

  function setScore(side: 'casa' | 'fora', value: number | null) {
    const nextCasa = side === 'casa' ? value : casa
    const nextFora = side === 'fora' ? value : fora
    setCasa(nextCasa)
    setFora(nextFora)
    setSaved(false)
  }

  if (readOnly) {
    const note = oculto
      ? 'Oculto até fechar apostas'
      : temPalpite({ palpite_casa: palpiteCasa, palpite_fora: palpiteFora })
        ? 'Palpite registrado'
        : 'Sem palpite'

    return (
      <div className="palpite-controls">
        <PalpiteDisplay casa={palpiteCasa} fora={palpiteFora} oculto={oculto} />
        <span className={`guess-note${oculto ? ' muted' : ''}`}>{note}</span>
      </div>
    )
  }

  return (
    <div className="palpite-controls">
      <div className="guess-block">
        <Stepper
          value={casa}
          onChange={(v) => setScore('casa', v)}
          disabled={disabled}
          label="gols casa"
        />
        <i className="guess-x">×</i>
        <Stepper
          value={fora}
          onChange={(v) => setScore('fora', v)}
          disabled={disabled}
          label="gols fora"
        />
      </div>
      {abertas && (
        <button
          type="button"
          onClick={() => save(casa, fora)}
          disabled={disabled || !filled}
          className={`btn btn-save${saved ? ' done' : ''}`}
        >
          {saved ? (
            <>
              <Icon.check s={16} /> Salvo
            </>
          ) : saving ? (
            '…'
          ) : (
            'Salvar palpite'
          )}
        </button>
      )}
      {!abertas && <span className="guess-note">Apostas encerradas</span>}
    </div>
  )
}
