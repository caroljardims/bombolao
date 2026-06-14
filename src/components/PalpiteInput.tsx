import { useEffect, useState } from 'react'
import { setDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { useBolao } from '../contexts/BolaoContext'
import { apostasAbertas } from '../lib/scoring'
import { palpiteDoc } from '../lib/paths'
import type { Partida } from '../lib/types'
import { Icon } from './ui'

interface PalpiteInputProps {
  partida: Partida
  participanteId: string
  palpiteCasa: number | null
  palpiteFora: number | null
  readOnly?: boolean
}

function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number | null
  onChange: (v: number) => void
  disabled?: boolean
}) {
  const show = value == null ? '–' : value

  return (
    <div className={`stepper${disabled ? ' disabled' : ''}`}>
      <button
        type="button"
        className="step-btn"
        disabled={disabled}
        onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
        aria-label="menos"
      >
        –
      </button>
      <span className="step-val">{show}</span>
      <button
        type="button"
        className="step-btn"
        disabled={disabled}
        onClick={() => onChange((value ?? -1) + 1)}
        aria-label="mais"
      >
        +
      </button>
    </div>
  )
}

export function PalpiteInput({
  partida,
  participanteId,
  palpiteCasa,
  palpiteFora,
  readOnly = false,
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

  function setScore(side: 'casa' | 'fora', value: number) {
    const nextCasa = side === 'casa' ? value : casa
    const nextFora = side === 'fora' ? value : fora
    setCasa(nextCasa)
    setFora(nextFora)
    setSaved(false)
  }

  if (readOnly) {
    return (
      <div className="palpite-controls">
        <div className="guess-block">
          <Stepper value={palpiteCasa} onChange={() => {}} disabled />
          <i className="guess-x">×</i>
          <Stepper value={palpiteFora} onChange={() => {}} disabled />
        </div>
        <span className="guess-note">Palpite registrado</span>
      </div>
    )
  }

  return (
    <div className="palpite-controls">
      <div className="guess-block">
        <Stepper value={casa} onChange={(v) => setScore('casa', v)} disabled={disabled} />
        <i className="guess-x">×</i>
        <Stepper value={fora} onChange={(v) => setScore('fora', v)} disabled={disabled} />
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
