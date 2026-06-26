import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import toast from 'react-hot-toast'
import { ChaveBracket, ChaveStacked } from '../components/ChaveBracket'
import { LoadingState } from '../components/LoadingState'
import { PalpiteCard } from './PalpitesPage'
import { useBolao } from '../contexts/BolaoContext'
import { usePartidas } from '../hooks/usePartidas'
import { usePalpiteChave } from '../hooks/usePalpiteChave'
import { buildChaveData } from '../lib/resolveChave'
import { DEFAULT_REGRAS_CHAVE } from '../lib/regras'
import {
  buildEngine,
  cravadaProgress,
  engineToCravada,
  engineToPlacarProjection,
  faseFromLabel,
  type ChavePicks,
} from '../lib/knockoutBracket'
import {
  cravadaAberta,
  cravadaDeadline,
  cravadaPicks,
  lockCravada,
  saveCravada,
} from '../lib/chavePalpite'
import { descendentesDe } from '../data/chaveBracketTemplate'
import { getKickoffDate } from '../lib/dates'
import { apostasAbertas } from '../lib/scoring'
import type { ChaveData } from '../lib/chave'
import type { Palpite, Partida } from '../lib/types'

type ChaveView = 'cravada' | 'placar'

// ─── Área da chave: bracket espelhado + empilhado, com toggle Lista/Chave no mobile ─

function BracketArea({
  data,
  onPick,
  onSelectMatch,
  selectedMatchId,
  detail,
}: {
  data: ChaveData
  onPick?: (slotId: string, team: string) => void
  onSelectMatch?: (partidaId: string) => void
  selectedMatchId?: string | null
  detail?: ReactNode
}) {
  const [mobileView, setMobileView] = useState<'lista' | 'chave'>('lista')

  return (
    <div className={`bracket-area mobile-${mobileView}`}>
      <div className="chave-mobile-toggle" role="tablist" aria-label="Modo de visualização">
        <button
          type="button"
          className={`chave-mobile-btn${mobileView === 'lista' ? ' active' : ''}`}
          onClick={() => setMobileView('lista')}
        >
          Lista
        </button>
        <button
          type="button"
          className={`chave-mobile-btn${mobileView === 'chave' ? ' active' : ''}`}
          onClick={() => setMobileView('chave')}
        >
          Chave
        </button>
      </div>

      {detail && <div className="chave-placar-detail chave-detail-top">{detail}</div>}

      <div className="chave-wide-wrap">
        <div className="chave-scroll">
          <ChaveBracket
            data={data}
            onPick={onPick}
            onSelectMatch={onSelectMatch}
            selectedMatchId={selectedMatchId}
          />
        </div>
      </div>
      <ChaveStacked
        data={data}
        onPick={onPick}
        onSelectMatch={onSelectMatch}
        selectedMatchId={selectedMatchId}
        detail={detail}
      />
    </div>
  )
}

export function ChavePage() {
  const { bolao, participante } = useBolao()
  const { partidas, palpites, loading } = usePartidas()

  const isMataMata = bolao?.modalidade === 'mata-mata'

  if (loading) return <LoadingState message="Carregando chave…" />
  if (isMataMata) {
    return (
      <ChaveMataMata
        key={participante?.id ?? 'anon'}
        partidas={partidas}
        palpites={palpites}
        participanteId={participante?.id}
      />
    )
  }

  return <ChavePreview partidas={partidas} />
}

// ─── Preview (modalidade pontos): só visual, resolvido pelos grupos ───────────

function ChavePreview({ partidas }: { partidas: Partida[] }) {
  const data = useMemo(() => buildChaveData(partidas), [partidas])
  return (
    <div className="screen chave-screen">
      <header className="section-head plain">
        <div>
          <h2>Chave</h2>
          <p className="sub">{data.competicao} · 16-avos atualizados pela fase de grupos</p>
        </div>
      </header>

      <BracketArea data={data} />
    </div>
  )
}


// ─── Mata-mata: chave palpitável (cravada de quem avança + placar por jogo) ────

function ChaveMataMata({
  partidas,
  palpites,
  participanteId,
}: {
  partidas: Partida[]
  palpites: Palpite[]
  participanteId: string | undefined
}) {
  const { bolao } = useBolao()
  const regras = bolao?.regrasChave ?? DEFAULT_REGRAS_CHAVE
  const { doc, loading } = usePalpiteChave(participanteId)

  const [view, setView] = useState<ChaveView>('cravada')
  const [cravada, setCravada] = useState<ChavePicks>({})
  const [seeded, setSeeded] = useState(false)
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
  const [confirmLock, setConfirmLock] = useState(false)
  const [locking, setLocking] = useState(false)

  const engine = useMemo(() => buildEngine(partidas), [partidas])

  const myPalpites = useMemo(() => {
    const map = new Map<string, Palpite>()
    if (!participanteId) return map
    for (const p of palpites) {
      if (p.participante_id === participanteId) map.set(p.partida_id, p)
    }
    return map
  }, [palpites, participanteId])

  // Jogos do mata-mata existentes (para palpite de placar), em ordem de fase/apito.
  const knockoutGames = useMemo(() => {
    return partidas
      .filter((p) => faseFromLabel(p.fase))
      .sort((a, b) => getKickoffDate(a).getTime() - getKickoffDate(b).getTime())
  }, [partidas])

  const selectedPartida = useMemo(() => {
    if (selectedMatchId) {
      const found = knockoutGames.find((p) => p.id === selectedMatchId)
      if (found) return found
    }
    return knockoutGames.find((p) => apostasAbertas(p)) ?? knockoutGames[0] ?? null
  }, [selectedMatchId, knockoutGames])

  // Semeia o estado local uma vez quando o palpite carrega (depois, o estado
  // local é a fonte da verdade — cada clique é persistido no Firestore).
  if (!seeded && !loading) {
    setSeeded(true)
    setCravada(cravadaPicks(doc))
  }

  const cravadaOpen = cravadaAberta(engine, regras, doc)
  const deadline = cravadaDeadline(engine, regras)

  function handlePickCravada(slotId: string, team: string) {
    if (!participanteId || !cravadaOpen) return
    const next: ChavePicks = { ...cravada, [slotId]: team }
    for (const id of descendentesDe(slotId)) delete next[id]
    setCravada(next)
    saveCravada(bolao!.id, participanteId, next).catch(() =>
      toast.error('Não consegui salvar seu palpite.'),
    )
  }

  async function handleLock() {
    if (!participanteId || locking) return
    setLocking(true)
    try {
      await lockCravada(bolao!.id, participanteId)
      setConfirmLock(false)
      toast.success('Chave cravada travada!')
    } catch {
      toast.error('Não consegui travar a chave.')
    } finally {
      setLocking(false)
    }
  }

  const cravadaData = useMemo(
    () => engineToCravada(engine, cravada, { editavel: cravadaOpen && !!participanteId }),
    [engine, cravada, cravadaOpen, participanteId],
  )
  const { faltam, completa } = useMemo(() => cravadaProgress(cravadaData), [cravadaData])
  const placarData = useMemo(
    () => engineToPlacarProjection(engine, myPalpites),
    [engine, myPalpites],
  )
  const data = view === 'cravada' ? cravadaData : placarData

  if (loading) return <LoadingState message="Carregando chave…" />

  return (
    <div className="screen chave-screen">
      <div className="chave-toggle">
        <button
          type="button"
          className={`chave-toggle-btn${view === 'cravada' ? ' active' : ''}`}
          onClick={() => setView('cravada')}
        >
          Minha cravada
        </button>
        <button
          type="button"
          className={`chave-toggle-btn${view === 'placar' ? ' active' : ''}`}
          onClick={() => setView('placar')}
        >
          Por fase
        </button>
      </div>

      {view === 'cravada' ? (
        <>
          <div className="chave-status">
            {cravadaOpen ? (
              <>
                <p className="sub">
                  Clique no time que avança em cada jogo. A cravada trava
                  {deadline ? ` em ${deadline.toLocaleString('pt-BR')}` : ' no 1º jogo dos 16-avos'}.
                </p>
                {participanteId && (
                  <div className="chave-lock-actions">
                    <button
                      type="button"
                      className="btn btn-ghost-gold"
                      onClick={() => completa && setConfirmLock(true)}
                      disabled={!completa}
                      title={
                        completa
                          ? undefined
                          : 'Preencha todos os confrontos até o campeão para travar.'
                      }
                    >
                      Travar minha cravada
                    </button>
                    {!completa && (
                      <span className="chave-lock-hint">
                        {faltam > 0
                          ? `Faltam ${faltam} confronto${faltam > 1 ? 's' : ''} para completar sua cravada.`
                          : 'Escolha o campeão para completar sua cravada.'}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="sub">
                Cravada travada — acompanhe seus acertos (✓/✗) conforme os jogos acontecem.
              </p>
            )}
          </div>

          <BracketArea data={data} onPick={handlePickCravada} />
        </>
      ) : (
        <>
          <div className="chave-status">
            <p className="sub">
              Clique numa disputa da chave e mande o placar — vale o tempo normal (90 min). Os times
              avançam conforme os resultados reais.
            </p>
          </div>

          {knockoutGames.length === 0 ? (
            <p className="sub">Os jogos do mata-mata aparecem aqui assim que forem definidos.</p>
          ) : (
            <BracketArea
              data={data}
              onSelectMatch={setSelectedMatchId}
              selectedMatchId={selectedPartida?.id ?? null}
              detail={
                selectedPartida && participanteId ? (
                  <PalpiteCard
                    key={selectedPartida.id}
                    partida={selectedPartida}
                    participanteId={participanteId}
                    palpite={myPalpites.get(selectedPartida.id)}
                    viewOnly={false}
                  />
                ) : null
              }
            />
          )}
        </>
      )}

      {confirmLock && (
        <div
          className="chave-modal-overlay"
          role="presentation"
          onClick={() => !locking && setConfirmLock(false)}
        >
          <div
            className="chave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-lock-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="confirm-lock-title">Travar a cravada?</h3>
            <p className="sub">
              Esta ação é <strong>definitiva</strong>: depois de travar, você não poderá
              modificar mais nenhum palpite da chave.
            </p>
            <div className="chave-modal-actions">
              <button
                type="button"
                className="btn btn-ghost-gold"
                onClick={() => setConfirmLock(false)}
                disabled={locking}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-gold"
                onClick={handleLock}
                disabled={locking}
              >
                {locking ? 'Travando…' : 'Confirmar e travar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
