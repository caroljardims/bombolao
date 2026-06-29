import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { LoadingState } from '../components/LoadingState'
import { RegrasChaveEditor } from '../components/RegrasChaveEditor'
import { useAuth } from '../hooks/useAuth'
import { COMPETICOES, getCompeticaoTemplate, isCompeticaoTemplateId } from '../lib/competicoes'
import { wc2026MataPartidas } from '../data/competicoes/wc2026Mata'
import { criarBolao } from '../lib/criarBolao'
import { DEFAULT_REGRAS, DEFAULT_REGRAS_CHAVE } from '../lib/regras'
import { bolaoPath } from '../lib/paths'
import type {
  AcessoBolao,
  CompeticaoId,
  Modalidade,
  PartidaDraft,
  RegrasChave,
} from '../lib/types'

type Step = 1 | 2

export function CriarBolaoPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)

  const [nome, setNome] = useState('')
  const [competicaoId, setCompeticaoId] = useState<CompeticaoId | ''>('')
  const [acesso, setAcesso] = useState<AcessoBolao>('convite')
  const [partidas, setPartidas] = useState<PartidaDraft[]>([])
  const [modalidade, setModalidade] = useState<Modalidade>('pontos')
  const [regrasChave, setRegrasChave] = useState<RegrasChave>(DEFAULT_REGRAS_CHAVE)

  const competicaoLabel =
    competicaoId !== '' ? COMPETICOES.find((c) => c.id === competicaoId)?.label ?? '' : ''

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
    if (!competicaoId) {
      toast.error('Selecione um campeonato.')
      return false
    }
    return true
  }

  function goToReview() {
    if (!validateStep1() || !isCompeticaoTemplateId(competicaoId)) return

    const template = getCompeticaoTemplate(competicaoId)
    // Mata-mata começa nos 16-avos reais; pontos usa o campeonato inteiro.
    setPartidas(modalidade === 'mata-mata' ? wc2026MataPartidas() : template.partidas)
    setStep(2)
  }

  async function handlePublish() {
    if (!validateStep1() || !isCompeticaoTemplateId(competicaoId)) return
    if (partidas.length === 0) {
      toast.error('Nenhuma partida carregada para este campeonato.')
      return
    }

    const template = getCompeticaoTemplate(competicaoId)

    setBusy(true)
    try {
      const nomeExibicao = user!.displayName ?? user!.email?.split('@')[0] ?? 'Organizador'
      const { bolaoId, inviteCode } = await criarBolao(
        {
          nome,
          competicao: template.competicao,
          acesso,
          regras: DEFAULT_REGRAS,
          partidas,
          competicaoTemplateId: competicaoId,
          modalidade,
          ...(modalidade === 'mata-mata' ? { regrasChave } : {}),
        },
        user!.uid,
        user!.email ?? '',
        nomeExibicao,
        user!.photoURL,
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
          <p className="sub">Passo {step} de 2</p>
        </div>
      </header>

      <div className="step-progress">
        {[1, 2].map((s) => (
          <div key={s} className={`step-progress-bar${s <= step ? ' active' : ''}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="form-stack" style={{ marginTop: 20 }}>
          <Field label="Nome do bolão">
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Bolão da firma" className="input" />
          </Field>
          <Field label="Campeonato">
            <select
              value={competicaoId}
              onChange={(e) => setCompeticaoId(e.target.value as CompeticaoId | '')}
              className="input"
            >
              <option value="">Selecione…</option>
              {COMPETICOES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <p className="sub" style={{ marginTop: 8, fontSize: 13 }}>
              WIP — mais campeonatos em breve.
            </p>
          </Field>
          <Field label="Quem pode entrar?">
            <select value={acesso} onChange={(e) => setAcesso(e.target.value as AcessoBolao)} className="input">
              <option value="convite">Somente com convite</option>
              <option value="aberto">Qualquer pessoa com o link</option>
            </select>
          </Field>
          <Field label="Modalidade">
            <select
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value as Modalidade)}
              className="input"
            >
              <option value="pontos">Pontos por palpite (campeonato inteiro)</option>
              <option value="mata-mata">Mata-mata (palpite de chave, a partir dos 16-avos)</option>
            </select>
            {modalidade === 'mata-mata' && (
              <p className="sub" style={{ marginTop: 8, fontSize: 13 }}>
                Os participantes montam a chave (cravada e por fase) e ainda podem palpitar o
                placar de cada jogo. Tudo soma no ranking.
              </p>
            )}
          </Field>

          {modalidade === 'mata-mata' && (
            <RegrasChaveEditor value={regrasChave} onChange={setRegrasChave} />
          )}

          <button type="button" onClick={goToReview} className="btn btn-save full">
            Próximo: revisar
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 20 }}>
          <div className="card" style={{ padding: '18px 20px' }}>
            <p>
              <span className="sub">Nome:</span> {nome}
            </p>
            <p style={{ marginTop: 8 }}>
              <span className="sub">Campeonato:</span> {competicaoLabel}
            </p>
            <p style={{ marginTop: 8 }}>
              <span className="sub">Acesso:</span> {acesso === 'convite' ? 'Convite' : 'Aberto'}
            </p>
            <p style={{ marginTop: 8 }}>
              <span className="sub">Modalidade:</span>{' '}
              {modalidade === 'mata-mata' ? 'Mata-mata (chave)' : 'Pontos por palpite'}
            </p>
            <p style={{ marginTop: 8 }}>
              <span className="sub">Partidas:</span> {partidas.length}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="button" onClick={() => setStep(1)} className="btn btn-ghost-gold" style={{ flex: 1 }}>
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
