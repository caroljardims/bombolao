import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getDocs, query, where } from 'firebase/firestore'
import { useBolao } from '../contexts/BolaoContext'
import { useAuth } from '../hooks/useAuth'
import { criarConvite } from '../lib/joinBolao'
import { convitesRef } from '../lib/paths'
import type { Convite } from '../lib/types'

export function AdminBolaoPage() {
  const { user } = useAuth()
  const { bolaoId, bolao, isAdmin } = useBolao()
  const location = useLocation()
  const [convites, setConvites] = useState<Convite[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      const snap = await getDocs(
        query(convitesRef(), where('bolaoId', '==', bolaoId)),
      )
      setConvites(snap.docs.map((d) => ({ code: d.id, ...d.data() }) as Convite))
      setLoading(false)
    }
    if (bolaoId) load().catch(() => setLoading(false))
  }, [bolaoId])

  const newCode = (location.state as { newInviteCode?: string } | null)?.newInviteCode

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-400/10 p-4 text-red-300">
        Apenas administradores podem acessar esta página.
      </div>
    )
  }

  async function handleNewInvite() {
    if (!user) return
    setBusy(true)
    try {
      const code = await criarConvite(bolaoId, user.uid, '')
      setConvites((prev) => [
        ...prev,
        {
          code,
          bolaoId,
          criadoPor: user.uid,
          ativo: true,
          maxUsos: 100,
          usos: 0,
        },
      ])
      toast.success('Convite criado!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar convite')
    } finally {
      setBusy(false)
    }
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/convite/${code}`
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Link copiado!')
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Administração</h2>
        <p className="text-sm text-white/50">{bolao?.nome}</p>
      </div>

      {newCode && (
        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
          <p className="text-sm font-medium text-gold">Bolão criado! Compartilhe o convite:</p>
          <button
            type="button"
            onClick={() => copyLink(newCode)}
            className="mt-2 w-full rounded-xl bg-gold py-3 font-semibold text-pitch"
          >
            Copiar link de convite
          </button>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Convites</h3>
          <button
            type="button"
            onClick={handleNewInvite}
            disabled={busy}
            className="rounded-lg bg-grass-light px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            + Novo
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-white/50">Carregando…</p>
        ) : convites.length === 0 ? (
          <p className="text-sm text-white/50">Nenhum convite ainda.</p>
        ) : (
          convites.map((c) => (
            <div
              key={c.code}
              className="rounded-xl border border-white/10 bg-pitch-card p-4"
            >
              <p className="font-mono text-lg font-bold tracking-widest text-gold">{c.code}</p>
              <p className="mt-1 text-xs text-white/40">
                {c.usos}/{c.maxUsos} usos · {c.ativo ? 'Ativo' : 'Inativo'}
              </p>
              <button
                type="button"
                onClick={() => copyLink(c.code)}
                className="mt-3 text-sm font-medium text-gold hover:underline"
              >
                Copiar link
              </button>
            </div>
          ))
        )}
      </section>

      <Link to={`/b/${bolaoId}`} className="text-sm text-gold hover:underline">
        ← Voltar ao ranking
      </Link>
    </div>
  )
}
