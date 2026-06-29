import { useState } from 'react'
import { FASE_SCORE_LABEL } from '../lib/chave'
import type { FaseScore, PesosChave, RegrasChave } from '../lib/types'

const FASE_KEYS: FaseScore[] = ['r32', 'r16', 'qf', 'sf', 'terceiro', 'vice', 'campeao']

/** Editor das regras do mata-mata: placar por jogo + pesos por fase (cravada/flex). */
export function RegrasChaveEditor({
  value,
  onChange,
  defaultAdvanced = false,
}: {
  value: RegrasChave
  onChange: (next: RegrasChave) => void
  defaultAdvanced?: boolean
}) {
  const [pesosAvancado, setPesosAvancado] = useState(defaultAdvanced)

  function setPeso(grupo: 'pesos_cravada' | 'pesos_flex', fase: FaseScore, valor: number) {
    onChange({
      ...value,
      [grupo]: { ...value[grupo], [fase]: valor } as PesosChave,
    })
  }

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <label className="check-row" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          type="checkbox"
          checked={value.placarAtivo}
          onChange={(e) => onChange({ ...value, placarAtivo: e.target.checked })}
        />
        <span>Ativar palpite de placar por jogo (conta só o tempo normal)</span>
      </label>

      <button
        type="button"
        className="link-gold"
        style={{ marginTop: 12, display: 'inline-flex' }}
        onClick={() => setPesosAvancado((v) => !v)}
      >
        {pesosAvancado ? '− Ocultar pesos' : '+ Ajustar pesos (avançado)'}
      </button>

      {pesosAvancado && (
        <div style={{ marginTop: 12 }}>
          <p className="sub" style={{ fontSize: 13, marginBottom: 8 }}>
            Pontos por acerto de avançador em cada fase. Padrão dobra a cada fase; a chave cravada
            vale o dobro da flexível.
          </p>
          <div className="pesos-grid">
            <span className="pesos-head" />
            <span className="pesos-head">Cravada</span>
            <span className="pesos-head">Flexível</span>
            {FASE_KEYS.map((fase) => (
              <PesoRow
                key={fase}
                label={FASE_SCORE_LABEL[fase]}
                cravada={value.pesos_cravada[fase]}
                flex={value.pesos_flex[fase]}
                onCravada={(v) => setPeso('pesos_cravada', fase, v)}
                onFlex={(v) => setPeso('pesos_flex', fase, v)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PesoRow({
  label,
  cravada,
  flex,
  onCravada,
  onFlex,
}: {
  label: string
  cravada: number
  flex: number
  onCravada: (v: number) => void
  onFlex: (v: number) => void
}) {
  return (
    <>
      <span className="pesos-label">{label}</span>
      <input
        type="number"
        min={0}
        className="input pesos-input"
        value={cravada}
        onChange={(e) => onCravada(Math.max(0, Number(e.target.value) || 0))}
      />
      <input
        type="number"
        min={0}
        className="input pesos-input"
        value={flex}
        onChange={(e) => onFlex(Math.max(0, Number(e.target.value) || 0))}
      />
    </>
  )
}
