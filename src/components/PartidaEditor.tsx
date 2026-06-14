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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {partidas.map((p, i) => (
        <div key={i} className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="gold-text" style={{ fontWeight: 700 }}>
              Jogo {i + 1}
            </span>
            {partidas.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="link-muted" style={{ fontSize: 13 }}>
                Remover
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Data">
              <input type="date" value={p.data} onChange={(e) => update(i, 'data', e.target.value)} className="input" required />
            </Field>
            <Field label="Hora">
              <input type="time" value={p.hora} onChange={(e) => update(i, 'hora', e.target.value)} className="input" required />
            </Field>
          </div>

          <Field label="Fase">
            <input
              type="text"
              value={p.fase}
              onChange={(e) => update(i, 'fase', e.target.value)}
              placeholder="Fase de grupos"
              className="input"
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Time casa">
              <input
                type="text"
                value={p.time_casa}
                onChange={(e) => update(i, 'time_casa', e.target.value)}
                placeholder="Brasil"
                className="input"
                required
              />
            </Field>
            <Field label="Time fora">
              <input
                type="text"
                value={p.time_fora}
                onChange={(e) => update(i, 'time_fora', e.target.value)}
                placeholder="Argentina"
                className="input"
                required
              />
            </Field>
          </div>
        </div>
      ))}

      <button type="button" onClick={add} className="btn btn-ghost-gold full">
        + Adicionar partida
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field" style={{ marginTop: 12 }}>
      <span className="field-label" style={{ fontSize: 13 }}>
        {label}
      </span>
      {children}
    </label>
  )
}
