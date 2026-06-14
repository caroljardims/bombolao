import { useEffect, useState } from 'react'
import { setDoc } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { useBolao } from '../contexts/BolaoContext'
import { apostasAbertas } from '../lib/scoring'
import { palpiteDoc } from '../lib/paths'
import type { Partida } from '../lib/types'

interface PalpiteInputProps {
  partida: Partida
  participanteId: string
  palpiteCasa: number | null
  palpiteFora: number | null
  readOnly?: boolean
}

export function PalpiteInput({
  partida,
  participanteId,
  palpiteCasa,
  palpiteFora,
  readOnly = false,
}: PalpiteInputProps) {
  const { bolaoId } = useBolao()
  const [casa, setCasa] = useState<string>(palpiteCasa?.toString() ?? '')
  const [fora, setFora] = useState<string>(palpiteFora?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCasa(palpiteCasa?.toString() ?? '')
    setFora(palpiteFora?.toString() ?? '')
  }, [palpiteCasa, palpiteFora])

  useEffect(() => {
    if (!saved) return
    const timer = setTimeout(() => setSaved(false), 4000)
    return () => clearTimeout(timer)
  }, [saved])

  function handleCasaChange(value: string) {
    setCasa(value)
    setSaved(false)
  }

  function handleForaChange(value: string) {
    setFora(value)
    setSaved(false)
  }

  const abertas = apostasAbertas(partida)
  const disabled = readOnly || !abertas || saving

  async function save() {
    if (disabled) return

    const casaNum = casa === '' ? null : parseInt(casa, 10)
    const foraNum = fora === '' ? null : parseInt(fora, 10)

    if (casaNum !== null && (isNaN(casaNum) || casaNum < 0 || casaNum > 20)) {
      toast.error('Placar casa inválido (0–20)')
      return
    }
    if (foraNum !== null && (isNaN(foraNum) || foraNum < 0 || foraNum > 20)) {
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

  if (readOnly) {
    return (
      <div className="flex items-center justify-center gap-3">
        <ScoreDisplay value={palpiteCasa} />
        <span className="text-white/40">×</span>
        <ScoreDisplay value={palpiteFora} />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          value={casa}
          onChange={(e) => handleCasaChange(e.target.value)}
          disabled={disabled}
          placeholder="–"
          className={`h-14 w-16 rounded-xl border bg-black/30 text-center text-2xl font-bold tabular-nums focus:outline-none disabled:opacity-50 ${
            saved ? 'border-green-500/50' : 'border-white/20 focus:border-gold'
          }`}
          aria-label={`Palpite ${partida.time_casa}`}
        />
        <span className="text-white/40">×</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={20}
          value={fora}
          onChange={(e) => handleForaChange(e.target.value)}
          disabled={disabled}
          placeholder="–"
          className={`h-14 w-16 rounded-xl border bg-black/30 text-center text-2xl font-bold tabular-nums focus:outline-none disabled:opacity-50 ${
            saved ? 'border-green-500/50' : 'border-white/20 focus:border-gold'
          }`}
          aria-label={`Palpite ${partida.time_fora}`}
        />
        <button
          type="button"
          onClick={save}
          disabled={disabled}
          className={`ml-1 flex h-14 min-w-[72px] items-center justify-center rounded-xl px-4 text-sm font-semibold text-white active:opacity-90 disabled:opacity-40 ${
            saved ? 'bg-green-600' : 'bg-grass-light active:bg-grass'
          }`}
        >
          {saving ? '…' : saved ? '✓' : 'Salvar'}
        </button>
      </div>

      {saved && (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-green-500/30 bg-green-500/15 py-2.5 text-sm font-medium text-green-400">
          <span>✅</span>
          Palpite enviado!
        </p>
      )}
    </div>
  )
}

function ScoreDisplay({ value }: { value: number | null }) {
  return (
    <span className="flex h-14 w-16 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-2xl font-bold tabular-nums">
      {value ?? '–'}
    </span>
  )
}
