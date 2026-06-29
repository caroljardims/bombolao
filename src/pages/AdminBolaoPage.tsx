import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getDocs, query, updateDoc, where } from 'firebase/firestore'
import { Icon } from '../components/ui'
import { RegrasChaveEditor } from '../components/RegrasChaveEditor'
import { useBolao } from '../contexts/BolaoContext'
import { useAuth } from '../hooks/useAuth'
import { criarConvite } from '../lib/joinBolao'
import { bolaoDoc, convitesRef } from '../lib/paths'
import { normalizeRegrasChave } from '../lib/regras'
import type { Convite, RegrasChave } from '../lib/types'

export function AdminBolaoPage() {
  const { user } = useAuth()
  const { bolaoId, bolao, isAdmin } = useBolao()
  const location = useLocation()
  const [convites, setConvites] = useState<Convite[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function load() {
      const snap = await getDocs(query(convitesRef(), where('bolaoId', '==', bolaoId)))
      setConvites(snap.docs.map((d) => ({ code: d.id, ...d.data() }) as Convite))
      setLoading(false)
    }
    if (bolaoId) load().catch(() => setLoading(false))
  }, [bolaoId])

  const newCode = (location.state as { newInviteCode?: string } | null)?.newInviteCode

  if (!isAdmin) {
    return <div className="alert-error">Apenas administradores podem acessar esta página.</div>
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
    <div className="screen admin-screen">
      <header className="section-head plain">
        <div>
          <h2>Administração</h2>
          <p className="sub">Gerencie convites e membros do bolão · {bolao?.nome}</p>
        </div>
      </header>

      {newCode && (
        <div className="alert-gold" style={{ marginBottom: 16 }}>
          <p style={{ fontWeight: 700 }}>Bolão criado! Compartilhe o convite:</p>
          <button type="button" className="btn btn-gold full" style={{ marginTop: 12 }} onClick={() => copyLink(newCode)}>
            Copiar link de convite
          </button>
        </div>
      )}

      <div className="admin-grid">
        <button type="button" className="admin-tile card" onClick={handleNewInvite} disabled={busy}>
          <span className="admin-tile-ic">
            <Icon.user s={22} />
          </span>
          <span className="admin-tile-txt">
            <b>Novo convite</b>
            <em>Gere link para novos membros entrarem no bolão</em>
          </span>
          <Icon.arrow s={16} />
        </button>
        <Link to={`/b/${bolaoId}/partidas`} className="admin-tile card">
          <span className="admin-tile-ic">
            <Icon.ball s={22} />
          </span>
          <span className="admin-tile-txt">
            <b>Ver jogos</b>
            <em>Partidas e placares sincronizados</em>
          </span>
          <Icon.arrow s={16} />
        </Link>
        <Link to={`/b/${bolaoId}/palpites`} className="admin-tile card">
          <span className="admin-tile-ic">
            <Icon.pencil s={22} />
          </span>
          <span className="admin-tile-txt">
            <b>Meus palpites</b>
            <em>Confira e envie seus placares</em>
          </span>
          <Icon.arrow s={16} />
        </Link>
        <Link to={`/b/${bolaoId}`} className="admin-tile card">
          <span className="admin-tile-ic">
            <Icon.trophy s={22} />
          </span>
          <span className="admin-tile-txt">
            <b>Ranking</b>
            <em>Classificação ao vivo do bolão</em>
          </span>
          <Icon.arrow s={16} />
        </Link>
      </div>

      {bolao?.modalidade === 'mata-mata' && (
        <>
          <header className="section-head plain" style={{ paddingTop: 28 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>Regras do mata-mata</h2>
              <p className="sub">Placar por jogo e pontos por fase (cravada e flexível).</p>
            </div>
          </header>
          <ChaveRegrasSection
            key={bolaoId}
            bolaoId={bolaoId}
            inicial={normalizeRegrasChave(bolao.regrasChave)}
          />
        </>
      )}

      <header className="section-head plain" style={{ paddingTop: 28 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Convites ativos</h2>
        </div>
      </header>

      {loading ? (
        <p className="sub">Carregando…</p>
      ) : convites.length === 0 ? (
        <p className="sub">Nenhum convite ainda.</p>
      ) : (
        <div className="convite-list">
          {convites.map((c) => (
            <div key={c.code} className="convite-item card">
              <div>
                <p className="convite-code">{c.code}</p>
                <p className="sub tiny">
                  {c.usos}/{c.maxUsos} usos · {c.ativo ? 'Ativo' : 'Inativo'}
                </p>
              </div>
              <button type="button" className="btn btn-ghost-gold" onClick={() => copyLink(c.code)}>
                Copiar link
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ChaveRegrasSection({
  bolaoId,
  inicial,
}: {
  bolaoId: string
  inicial: RegrasChave
}) {
  const [regras, setRegras] = useState<RegrasChave>(inicial)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(regras) !== JSON.stringify(inicial)

  async function handleSave() {
    setSaving(true)
    try {
      await updateDoc(bolaoDoc(bolaoId), { regrasChave: regras })
      toast.success('Regras atualizadas! O ranking recalcula automaticamente.')
    } catch {
      toast.error('Não foi possível salvar as regras.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <RegrasChaveEditor value={regras} onChange={setRegras} defaultAdvanced />
      <button
        type="button"
        className="btn btn-gold full"
        style={{ marginTop: 12 }}
        onClick={handleSave}
        disabled={saving || !dirty}
      >
        {saving ? 'Salvando…' : dirty ? 'Salvar regras' : 'Salvo'}
      </button>
    </div>
  )
}
