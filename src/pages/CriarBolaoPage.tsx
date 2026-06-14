import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LoadingState } from '../components/LoadingState'
import { PartidaEditor } from '../components/PartidaEditor'
import { useAuth } from '../hooks/useAuth'
import { criarBolao } from '../lib/criarBolao'
import { DEFAULT_REGRAS } from '../lib/regras'
import { bolaoPath } from '../lib/paths'
import type { AcessoBolao, PartidaDraft } from '../lib/types'

type Step = 1 | 2 | 3

export function CriarBolaoPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)

  const [nome, setNome] = useState('')
  const [competicao, setCompeticao] = useState('')
  const [acesso, setAcesso] = useState<AcessoBolao>('convite')
  const [partidas, setPartidas] = useState<PartidaDraft[]>([
    { data: '', hora: '16:00', fase: 'Fase de grupos', time_casa: '', time_fora: '' },
  ])

  if (loading) return <LoadingState />
  if (!user) {
    return (
      <div className="screen" style={{ paddingTop: 24, textAlign: 'center' }}>
        <p className="sub">Faça login para criar um bolão.</p>
        <Link to="/conta" className="btn btn-gold full" style={{ marginTop: 16, maxWidth: 360, marginInline: 'auto', display: 'flex' }}>
          Entrar
        </Link>
      </div>
    )
  }

  function validateStep1(): boolean {
    if (!nome.trim()) {
      toast.error('Informe o nome do bolão.')
      return false
    }
    if (!competicao.trim()) {
      toast.error('Informe a competição.')
      return false
    }
    return true
  }

  function validateStep2(): boolean {
    for (const [i, p] of partidas.entries()) {
      if (!p.data || !p.hora || !p.time_casa.trim() || !p.time_fora.trim()) {
        toast.error(`Preencha todos os campos do jogo ${i + 1}.`)
        return false
      }
    }
    return true
  }

  async function handlePublish() {
    if (!validateStep1() || !validateStep2()) return

    setBusy(true)
    try {
      const nomeExibicao = user!.displayName ?? user!.email?.split('@')[0] ?? 'Organizador'
      const { bolaoId, inviteCode } = await criarBolao(
        { nome, competicao, acesso, regras: DEFAULT_REGRAS, partidas },
        user!.uid,
        user!.email ?? '',
        nomeExibicao,
      )
      toast.success('Bolão criado!')
      navigate(bolaoPath(bolaoId, 'admin'), {
        state: { newInviteCode: inviteCode },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar bolão')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <header className="section-head plain">
        <div>
          <Link to="/" className="link-gold" style={{ marginBottom: 8, display: 'inline-flex' }}>
            ← Voltar ao lobby
          </Link>
          <h2>Criar bolão</h2>
          <p className="sub">Passo {step} de 3</p>
        </div>
      </header>

      <div className="step-progress">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`step-progress-bar${s <= step ? ' active' : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="form-stack" style={{ marginTop: 20 }}>
          <Field label="Nome do bolão">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Bolão da firma" className="input" />
          </Field>
          <Field label="Competição">
            <input value={competicao} onChange={(e) => setCompeticao(e.target.value)} placeholder="Copa do Mundo 2026" className="input" />
          </Field>
          <Field label="Quem pode entrar?">
            <select value={acesso} onChange={(e) => setAcesso(e.target.value as AcessoBolao)} className="input">
              <option value="convite">Somente com convite</option>
              <option value="aberto">Qualquer pessoa com o link</option>
            </select>
          </Field>
          <button type="button" onClick={() => validateStep1() && setStep(2)} className="btn btn-save full">
            Próximo: partidas
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 20 }}>
          <p className="sub" style={{ marginBottom: 16 }}>
            Cadastre as partidas do seu bolão.
          </p>
          <PartidaEditor partidas={partidas} onChange={setPartidas} />
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost-gold" style={{ flex: 1 }}>
              Voltar
            </button>
            <button type="button" onClick={() => validateStep2() && setStep(3)} className="btn btn-save" style={{ flex: 1 }}>
              Revisar
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 20 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <p>
              <span className="sub">Nome:</span> {nome}
            </p>
            <p style={{ marginTop: 8 }}>
              <span className="sub">Competição:</span> {competicao}
            </p>
            <p style={{ marginTop: 8 }}>
              <span className="sub">Acesso:</span> {acesso === 'convite' ? 'Convite' : 'Aberto'}
            </p>
            <p style={{ marginTop: 8 }}>
              <span className="sub">Partidas:</span> {partidas.length}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="button" onClick={() => setStep(2)} className="btn btn-ghost-gold" style={{ flex: 1 }}>
              Voltar
            </button>
            <button type="button" onClick={handlePublish} disabled={busy} className="btn btn-gold" style={{ flex: 1 }}>
              {busy ? 'Criando…' : 'Publicar bolão'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field" style={{ marginTop: 0 }}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}
