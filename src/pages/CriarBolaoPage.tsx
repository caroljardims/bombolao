import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { PartidaEditor } from '../components/PartidaEditor'
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
      <div className="space-y-4 pt-8 text-center">
        <p className="text-white/60">Faça login para criar um bolão.</p>
        <Link to="/conta" className="inline-block rounded-xl bg-grass-light px-6 py-3 font-semibold">
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
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-sm text-gold hover:underline">← Voltar ao lobby</Link>
        <h2 className="mt-2 text-xl font-bold">Criar bolão</h2>
        <p className="text-sm text-white/50">Passo {step} de 3</p>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-gold' : 'bg-white/10'}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-4">
          <Field label="Nome do bolão">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Bolão da firma"
              className="input-field"
            />
          </Field>
          <Field label="Competição">
            <input
              value={competicao}
              onChange={(e) => setCompeticao(e.target.value)}
              placeholder="Copa do Mundo 2026"
              className="input-field"
            />
          </Field>
          <Field label="Quem pode entrar?">
            <select
              value={acesso}
              onChange={(e) => setAcesso(e.target.value as AcessoBolao)}
              className="input-field"
            >
              <option value="convite">Somente com convite</option>
              <option value="aberto">Qualquer pessoa com o link</option>
            </select>
          </Field>
          <button
            type="button"
            onClick={() => validateStep1() && setStep(2)}
            className="w-full rounded-xl bg-grass-light py-4 font-semibold"
          >
            Próximo: partidas
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">Cadastre as partidas do seu bolão.</p>
          <PartidaEditor partidas={partidas} onChange={setPartidas} />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-xl border border-white/20 py-4 font-semibold"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => validateStep2() && setStep(3)}
              className="flex-1 rounded-xl bg-grass-light py-4 font-semibold"
            >
              Revisar
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-pitch-card p-4 space-y-2">
            <p><span className="text-white/50">Nome:</span> {nome}</p>
            <p><span className="text-white/50">Competição:</span> {competicao}</p>
            <p><span className="text-white/50">Acesso:</span> {acesso === 'convite' ? 'Convite' : 'Aberto'}</p>
            <p><span className="text-white/50">Partidas:</span> {partidas.length}</p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-xl border border-white/20 py-4 font-semibold"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={busy}
              className="flex-1 rounded-xl bg-gold py-4 font-semibold text-pitch disabled:opacity-50"
            >
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
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-white/70">{label}</span>
      {children}
    </label>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/50">
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      Carregando…
    </div>
  )
}
