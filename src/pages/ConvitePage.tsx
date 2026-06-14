import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth'
import { getBolao, getConvite, joinBolaoByInvite } from '../lib/joinBolao'
import { bolaoPath } from '../lib/paths'

export function ConvitePage() {
  const { code = '' } = useParams<{ code: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [nomeExibicao, setNomeExibicao] = useState('')
  const [bolaoNome, setBolaoNome] = useState('')
  const [busy, setBusy] = useState(false)
  const [validating, setValidating] = useState(true)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    async function validate() {
      const convite = await getConvite(code)
      if (!convite || !convite.ativo) {
        setInvalid(true)
        setValidating(false)
        return
      }
      const bolao = await getBolao(convite.bolaoId)
      setBolaoNome(bolao?.nome ?? 'Bolão')
      setValidating(false)
    }
    validate().catch(() => {
      setInvalid(true)
      setValidating(false)
    })
  }, [code])

  useEffect(() => {
    if (user?.displayName) setNomeExibicao(user.displayName)
  }, [user])

  if (authLoading || validating) return <LoadingState />

  if (invalid) {
    return (
      <div className="space-y-4 pt-8 text-center">
        <p className="text-red-300">Convite inválido ou expirado.</p>
        <Link to="/" className="text-gold hover:underline">← Voltar ao lobby</Link>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-6 pt-8 text-center">
        <div>
          <p className="text-sm text-white/50">Você foi convidado para</p>
          <h2 className="text-2xl font-bold text-gold">{bolaoNome}</h2>
        </div>
        <p className="text-sm text-white/60">Faça login para entrar no bolão.</p>
        <Link
          to="/conta"
          state={{ returnTo: `/convite/${code}` }}
          className="inline-block w-full max-w-xs rounded-xl bg-grass-light py-4 font-semibold"
        >
          Entrar
        </Link>
      </div>
    )
  }

  async function handleJoin() {
    if (!user) return
    if (!nomeExibicao.trim()) {
      toast.error('Informe como quer aparecer no ranking.')
      return
    }
    setBusy(true)
    try {
      const bolaoId = await joinBolaoByInvite(
        code,
        user.uid,
        user.email ?? '',
        nomeExibicao,
      )
      toast.success(`Bem-vindo ao ${bolaoNome}!`)
      navigate(bolaoPath(bolaoId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div className="text-center">
        <p className="text-sm text-white/50">Convite para</p>
        <h2 className="text-2xl font-bold text-gold">{bolaoNome}</h2>
      </div>

      <div className="rounded-2xl border border-white/10 bg-pitch-card p-5 space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm text-white/70">Seu nome no bolão</span>
          <input
            value={nomeExibicao}
            onChange={(e) => setNomeExibicao(e.target.value)}
            placeholder="Como aparecer no ranking"
            className="input-field"
          />
        </label>
        <button
          type="button"
          onClick={handleJoin}
          disabled={busy}
          className="w-full rounded-xl bg-gold py-4 font-semibold text-pitch disabled:opacity-50"
        >
          {busy ? 'Entrando…' : 'Entrar no bolão'}
        </button>
      </div>

      <Link to="/" className="block text-center text-sm text-white/50 hover:text-gold">
        ← Voltar ao lobby
      </Link>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-white/50">
      <div className="mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      Verificando convite…
    </div>
  )
}
