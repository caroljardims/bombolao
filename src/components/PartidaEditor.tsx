import type { PartidaDraft } from '../lib/types'

const EMPTY_PARTIDA: PartidaDraft = {
  data: '',
  hora: '16:00',
  fase: 'Fase de grupos',
  time_casa: '',
  time_fora: '',
}

interface PartidaEditorProps {
  partidas: PartidaDraft[]
  onChange: (partidas: PartidaDraft[]) => void
}

export function PartidaEditor({ partidas, onChange }: PartidaEditorProps) {
  function update(index: number, field: keyof PartidaDraft, value: string) {
    const next = [...partidas]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  function add() {
    onChange([...partidas, { ...EMPTY_PARTIDA }])
  }

  function remove(index: number) {
    if (partidas.length <= 1) return
    onChange(partidas.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      {partidas.map((p, i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/10 bg-pitch-card p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gold">Jogo {i + 1}</span>
            {partidas.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="text-xs text-red-300 hover:underline"
              >
                Remover
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <input
                type="date"
                value={p.data}
                onChange={(e) => update(i, 'data', e.target.value)}
                className="input-field"
                required
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={p.hora}
                onChange={(e) => update(i, 'hora', e.target.value)}
                className="input-field"
                required
              />
            </Field>
          </div>

          <Field label="Fase">
            <input
              type="text"
              value={p.fase}
              onChange={(e) => update(i, 'fase', e.target.value)}
              placeholder="Fase de grupos"
              className="input-field"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Time casa">
              <input
                type="text"
                value={p.time_casa}
                onChange={(e) => update(i, 'time_casa', e.target.value)}
                placeholder="Brasil"
                className="input-field"
                required
              />
            </Field>
            <Field label="Time fora">
              <input
                type="text"
                value={p.time_fora}
                onChange={(e) => update(i, 'time_fora', e.target.value)}
                placeholder="Argentina"
                className="input-field"
                required
              />
            </Field>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="w-full rounded-xl border border-dashed border-gold/40 py-3 text-sm font-semibold text-gold hover:bg-gold/10"
      >
        + Adicionar partida
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-white/50">{label}</span>
      {children}
    </label>
  )
}
