import type { KeyboardEvent, ReactNode } from 'react'
import { Icon, TeamBadge } from './ui'
import { teamAbbr } from '../lib/teamFlags'
import {
  BODY_TOP,
  COL_W,
  FASES_LADO,
  FASE_LABEL,
  FASE_ROUND,
  HEADER_H,
  MATCH_H,
  ROUND_MATCHES,
  bracketHeight,
  bracketWidth,
  columnIndex,
  columnX,
  matchCenterY,
  matchesByLadoFase,
  slotLabel,
} from '../lib/chave'
import type { ChaveData, KnockoutFase, KnockoutMatch, SlotRef } from '../lib/chave'

const FINAL_CENTER_Y = matchCenterY(3, 0)
// Espaço extra para a tag "Final" acima do card antes do box do campeão.
const CHAMPION_GAP = 42
const CHAMPION_H = 58
const TERCEIRO_CENTER_Y = FINAL_CENTER_Y + MATCH_H + CHAMPION_GAP + CHAMPION_H + 28

/** Time campeão = lado selecionado da final (palpite ou projeção). */
function championSlot(finalMatch: KnockoutMatch | undefined): SlotRef | null {
  if (!finalMatch || !finalMatch.selecionado) return null
  const slot = finalMatch.selecionado === 'A' ? finalMatch.timeA : finalMatch.timeB
  return slot.tipo === 'time' ? slot : null
}

function ChampionBox({ slot, compact }: { slot: SlotRef | null; compact?: boolean }) {
  const champ = slot && slot.tipo === 'time' ? slot : null
  const projetado = champ?.projetado === true
  const cls = ['chave-champion', champ ? 'is-set' : '', projetado ? 'is-proj' : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls}>
      <span className="chave-champion-tag">
        <Icon.trophy s={13} /> Campeão
      </span>
      {champ ? (
        <span className="chave-champion-team">
          <TeamBadge name={champ.nome} size={compact ? 20 : 24} />
          <span className="chave-champion-name" title={champ.nome}>
            {compact ? teamAbbr(champ.nome) : champ.nome}
          </span>
        </span>
      ) : (
        <span className="chave-champion-empty">a definir</span>
      )}
    </div>
  )
}

interface ChaveBracketProps {
  data: ChaveData
  /** Chamado quando o usuário escolhe o avançador de um jogo. */
  onPick?: (slotId: string, team: string) => void
  /** Chamado ao clicar numa disputa (modo placar) — recebe o id da partida real. */
  onSelectMatch?: (partidaId: string) => void
  /** Partida atualmente selecionada (modo placar). */
  selectedMatchId?: string | null
  /** Conteúdo (card de palpite) a abrir inline abaixo da disputa selecionada (lista). */
  detail?: ReactNode
}

/** Gols do time `nome` na partida real, se ele estiver escalado nela. */
function golsDoTime(match: KnockoutMatch, nome: string | null): number | null {
  const p = match.partida
  if (!p || nome == null || p.gols_casa == null || p.gols_fora == null) return null
  if (p.time_casa === nome) return p.gols_casa
  if (p.time_fora === nome) return p.gols_fora
  return null
}

function penaltisDoTime(match: KnockoutMatch, nome: string | null): number | null {
  const p = match.partida
  if (!p || nome == null) return null
  if (p.time_casa === nome) return p.penaltis_casa ?? null
  if (p.time_fora === nome) return p.penaltis_fora ?? null
  return null
}

function SlotRow({
  match,
  side,
  mirror,
  compact,
  onPick,
}: {
  match: KnockoutMatch
  side: 'A' | 'B'
  mirror?: boolean
  compact?: boolean
  onPick?: (slotId: string, team: string) => void
}) {
  const slot: SlotRef = side === 'A' ? match.timeA : match.timeB
  const isTeam = slot.tipo === 'time'
  const selected = match.selecionado === side
  const acerto = side === 'A' ? match.acertoA : match.acertoB
  const gols = golsDoTime(match, isTeam ? slot.nome : null)
  const pen = penaltisDoTime(match, isTeam ? slot.nome : null)
  const canPick = Boolean(match.editavel && isTeam && onPick)

  const projetado = slot.tipo === 'time' && slot.projetado === true

  const cls = [
    'chave-slot',
    mirror ? 'mirror' : '',
    isTeam ? '' : 'is-ph',
    projetado ? 'is-proj' : '',
    selected ? 'is-sel' : '',
    acerto === true ? 'is-ok' : '',
    acerto === false ? 'is-bad' : '',
    canPick ? 'is-pickable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const label = isTeam && compact ? teamAbbr(slot.nome) : slotLabel(slot)
  const title = isTeam ? slot.nome : undefined

  const content = (
    <>
      {isTeam && <TeamBadge name={slot.nome} size={compact ? 16 : 20} />}
      <span className="chave-slot-name" title={title}>
        {label}
      </span>
      {gols != null && (
        <span className="chave-slot-score">
          {gols}
          {pen != null && <sup className="chave-slot-pen">({pen})</sup>}
        </span>
      )}
    </>
  )

  if (canPick && isTeam) {
    return (
      <button type="button" className={cls} onClick={() => onPick!(match.id, slot.nome)}>
        {content}
      </button>
    )
  }
  return <div className={cls}>{content}</div>
}

function MatchCard({
  match,
  mirror,
  compact,
  onPick,
}: {
  match: KnockoutMatch
  mirror?: boolean
  compact?: boolean
  onPick?: (slotId: string, team: string) => void
}) {
  return (
    <div className="chave-match">
      <SlotRow match={match} side="A" mirror={mirror} compact={compact} onPick={onPick} />
      <div className="chave-match-div" />
      <SlotRow match={match} side="B" mirror={mirror} compact={compact} onPick={onPick} />
      {(match.data || match.local) && (
        <span className="chave-match-meta">
          {[match.data, match.local].filter(Boolean).join(' · ')}
        </span>
      )}
    </div>
  )
}

/** Bracket de child (childX) convergindo para o parent (parentX), cantos retos. */
function connectorPath(childX: number, parentX: number, y0: number, y1: number, ymid: number): string {
  const xMid = (childX + parentX) / 2
  return [
    `M ${childX} ${y0}`,
    `H ${xMid}`,
    `V ${y1}`,
    `H ${childX}`,
    `M ${xMid} ${ymid}`,
    `H ${parentX}`,
  ].join(' ')
}

function buildConnectors(): string[] {
  const paths: string[] = []

  // Lados esq/dir: rounds 0->1->2->3
  for (const lado of ['esq', 'dir'] as const) {
    for (let r = 0; r < 3; r++) {
      const childCol = columnIndex(lado, r)
      const parentCol = columnIndex(lado, r + 1)
      const childX = lado === 'esq' ? columnX(childCol) + COL_W : columnX(childCol)
      const parentX = lado === 'esq' ? columnX(parentCol) : columnX(parentCol) + COL_W
      const parents = ROUND_MATCHES[r + 1]
      for (let pi = 0; pi < parents; pi++) {
        const y0 = BODY_TOP + matchCenterY(r, pi * 2)
        const y1 = BODY_TOP + matchCenterY(r, pi * 2 + 1)
        const ymid = BODY_TOP + matchCenterY(r + 1, pi)
        paths.push(connectorPath(childX, parentX, y0, y1, ymid))
      }
    }
  }

  // Semifinais -> Final (linha reta para o centro)
  const finalY = BODY_TOP + FINAL_CENTER_Y
  const sfColEsq = columnIndex('esq', 3)
  const sfColDir = columnIndex('dir', 3)
  paths.push(`M ${columnX(sfColEsq) + COL_W} ${finalY} H ${columnX(4)}`)
  paths.push(`M ${columnX(sfColDir)} ${finalY} H ${columnX(4) + COL_W}`)

  return paths
}

const COL_HEADERS: { col: number; label: string }[] = [
  { col: 0, label: FASE_LABEL.r32 },
  { col: 1, label: FASE_LABEL.r16 },
  { col: 2, label: FASE_LABEL.qf },
  { col: 3, label: FASE_LABEL.sf },
  { col: 4, label: FASE_LABEL.final },
  { col: 5, label: FASE_LABEL.sf },
  { col: 6, label: FASE_LABEL.qf },
  { col: 7, label: FASE_LABEL.r16 },
  { col: 8, label: FASE_LABEL.r32 },
]

function selectableProps(
  match: KnockoutMatch,
  onSelectMatch: ((partidaId: string) => void) | undefined,
  selectedMatchId: string | null | undefined,
): { className: string; handlers: Record<string, unknown> } {
  const pid = match.partida?.id
  if (!onSelectMatch || !pid) return { className: '', handlers: {} }
  const isSel = pid === selectedMatchId
  return {
    className: ` is-selectable${isSel ? ' is-selected' : ''}`,
    handlers: {
      role: 'button',
      tabIndex: 0,
      onClick: () => onSelectMatch(pid),
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelectMatch(pid)
        }
      },
    },
  }
}

export function ChaveBracket({ data, onPick, onSelectMatch, selectedMatchId }: ChaveBracketProps) {
  const width = bracketWidth()
  const height = Math.max(
    BODY_TOP + bracketHeight(),
    BODY_TOP + TERCEIRO_CENTER_Y + MATCH_H / 2,
  ) + 8

  const cards: { match: KnockoutMatch; x: number; top: number; mirror: boolean }[] = []

  for (const lado of ['esq', 'dir'] as const) {
    for (const fase of FASES_LADO) {
      const round = FASE_ROUND[fase]
      const col = columnIndex(lado, round)
      const x = columnX(col)
      const list = matchesByLadoFase(data, lado, fase)
      list.forEach((match, idx) => {
        const top = BODY_TOP + matchCenterY(round, idx) - MATCH_H / 2
        cards.push({ match, x, top, mirror: lado === 'dir' })
      })
    }
  }

  const finalMatch = data.matches.find((mm) => mm.fase === 'final')
  const terceiroMatch = data.matches.find((mm) => mm.fase === 'terceiro')

  const connectors = buildConnectors()

  return (
    <div className="chave-bracket" style={{ width, height }}>
      <svg className="chave-conns" width={width} height={height} aria-hidden>
        {connectors.map((d, i) => (
          <path key={i} d={d} fill="none" />
        ))}
      </svg>

      {COL_HEADERS.map((h, i) => (
        <div
          key={i}
          className="chave-col-head"
          style={{ left: columnX(h.col), width: COL_W, height: HEADER_H }}
        >
          {h.label}
        </div>
      ))}

      {cards.map(({ match, x, top, mirror }) => {
        const sel = selectableProps(match, onSelectMatch, selectedMatchId)
        return (
          <div
            key={match.id}
            className={`chave-match-wrap${sel.className}`}
            style={{ left: x, top, width: COL_W }}
            {...sel.handlers}
          >
            <MatchCard match={match} mirror={mirror} compact onPick={onPick} />
          </div>
        )
      })}

      {finalMatch &&
        (() => {
          const sel = selectableProps(finalMatch, onSelectMatch, selectedMatchId)
          return (
            <div
              className={`chave-match-wrap is-final${sel.className}`}
              style={{ left: columnX(4), top: BODY_TOP + FINAL_CENTER_Y - MATCH_H / 2, width: COL_W }}
              {...sel.handlers}
            >
              <span className="chave-final-tag">Final</span>
              <MatchCard match={finalMatch} compact onPick={onPick} />
            </div>
          )
        })()}

      {finalMatch && (
        <div
          className="chave-champion-wrap"
          style={{
            left: columnX(4) - 18,
            top: BODY_TOP + FINAL_CENTER_Y + MATCH_H / 2 + CHAMPION_GAP,
            width: COL_W + 36,
          }}
        >
          <ChampionBox slot={championSlot(finalMatch)} compact />
        </div>
      )}

      {terceiroMatch &&
        (() => {
          const sel = selectableProps(terceiroMatch, onSelectMatch, selectedMatchId)
          return (
            <div
              className={`chave-match-wrap is-terceiro${sel.className}`}
              style={{
                left: columnX(4),
                top: BODY_TOP + TERCEIRO_CENTER_Y - MATCH_H / 2,
                width: COL_W,
              }}
              {...sel.handlers}
            >
              <span className="chave-terceiro-tag">Disputa de 3º lugar</span>
              <MatchCard match={terceiroMatch} compact onPick={onPick} />
            </div>
          )
        })()}
    </div>
  )
}

// ─── Versão empilhada (celular em portrait) ──────────────────────────────────

const STACK_ORDER: KnockoutFase[] = ['r32', 'r16', 'qf', 'sf', 'final', 'terceiro']

export function ChaveStacked({
  data,
  onPick,
  onSelectMatch,
  selectedMatchId,
  detail,
}: ChaveBracketProps) {
  const finalMatch = data.matches.find((mm) => mm.fase === 'final')
  return (
    <div className="chave-stacked">
      {STACK_ORDER.map((fase) => {
        const list = data.matches
          .filter((mm) => mm.fase === fase)
          .sort((a, b) => (a.lado === b.lado ? a.slot - b.slot : a.lado.localeCompare(b.lado)))
        if (list.length === 0) return null
        return (
          <section key={fase} className="chave-stack-section">
            <h3 className="chave-stack-title">{FASE_LABEL[fase]}</h3>
            <div className="chave-stack-list">
              {list.map((match) => {
                const sel = selectableProps(match, onSelectMatch, selectedMatchId)
                const showDetail = Boolean(detail && match.partida?.id === selectedMatchId)
                return (
                  <div key={match.id} className="chave-stack-item">
                    <div className={`chave-stack-card${sel.className}`} {...sel.handlers}>
                      <MatchCard match={match} onPick={onPick} />
                    </div>
                    {showDetail && <div className="chave-stack-detail">{detail}</div>}
                  </div>
                )
              })}
            </div>
            {fase === 'final' && (
              <div className="chave-champion-wrap chave-champion-wrap-stack">
                <ChampionBox slot={championSlot(finalMatch)} />
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
