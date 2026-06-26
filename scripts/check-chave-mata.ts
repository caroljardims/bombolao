/**
 * Verificação local (sem Firestore/credenciais) da chave mata-mata.
 *
 * Carrega os 72 jogos de grupo do template, simula resultados, e então
 * "joga" o mata-mata inteiro sintetizando as partidas de cada fase com um
 * vencedor — exatamente o formato que o sync grava. No fim valida a resolução
 * do bracket e a pontuação (cravada + flexível).
 *
 *   npx tsx scripts/check-chave-mata.ts
 */
import { getCompeticaoTemplate } from '../src/lib/competicoes'
import { buildEngine, engineToResultado } from '../src/lib/knockoutBracket'
import { computeGroupStandings } from '../src/lib/standings'
import { BRACKET_TEMPLATE, FASE_ORDER } from '../src/data/chaveBracketTemplate'
import { DEFAULT_REGRAS_CHAVE } from '../src/lib/regras'
import type { KnockoutFase, SlotRef } from '../src/lib/chave'
import type { Partida } from '../src/lib/types'

const FASE_LABEL_SYNC: Record<KnockoutFase, string> = {
  r32: '16 avos de final',
  r16: 'Oitavas de final',
  qf: 'Quartas de final',
  sf: 'Semifinal',
  final: 'Final',
  terceiro: 'Disputa de 3º lugar',
}

// Pontuação espelha src/lib/chaveScoring.ts (inline pra não puxar o firebase).
function scorePicks(
  picks: Record<string, string>,
  engine: ReturnType<typeof buildEngine>,
  pesos: Record<KnockoutFase, number>,
): number {
  let total = 0
  for (const node of BRACKET_TEMPLATE) {
    const pick = picks[node.id]
    if (!pick) continue
    const real = engine.realAdvancer.get(node.id) ?? null
    if (real && pick === real) total += pesos[node.fase]
  }
  return total
}

const nomeDe = (s: SlotRef | undefined): string | null =>
  s && s.tipo === 'time' ? s.nome : null

function simKnock(id: string, fase: KnockoutFase, casa: string, fora: string): Partida {
  return {
    id: `sim-${id}`,
    data: '2026-07-01',
    hora: '16:00',
    fase: FASE_LABEL_SYNC[fase],
    time_casa: casa,
    time_fora: fora,
    gols_casa: 1,
    gols_fora: 0,
    status_api: 'FINISHED',
    vencedor: 'casa',
  }
}

function simulate(): Partida[] {
  const template = getCompeticaoTemplate('wc2026')
  const grupos: Partida[] = template.partidas.map((p, i) => ({
    id: p.id ?? `g-${i}`,
    data: p.data,
    hora: p.hora,
    fase: p.fase,
    time_casa: p.time_casa,
    time_fora: p.time_fora,
    // placar determinístico só pra fechar a classificação dos grupos
    gols_casa: (i % 3) + 1,
    gols_fora: i % 3,
    status_api: 'FINISHED',
  }))

  const partidas: Partida[] = [...grupos]

  // 8 melhores terceiros (aqui: 3º de 8 grupos quaisquer) pra preencher os slots
  // de "3º" — o sync real traria esses confrontos prontos.
  const standings = computeGroupStandings(grupos)
  const thirds = [...standings.values()]
    .map((g) => g.teams[2]?.team)
    .filter((t): t is string => Boolean(t))
  let ti = 0

  // 16-avos: resolve o lado conhecido pelos grupos e injeta um 3º no placeholder.
  const eng0 = buildEngine(grupos)
  for (const node of BRACKET_TEMPLATE.filter((n) => n.fase === 'r32')) {
    const rt = eng0.realTeams.get(node.id)
    const casa = nomeDe(rt?.A) ?? thirds[ti++]
    const fora = nomeDe(rt?.B) ?? thirds[ti++]
    if (casa && fora) partidas.push(simKnock(node.id, 'r32', casa, fora))
  }

  // Demais fases: jogadas a partir dos vencedores reais já propagados.
  for (const fase of FASE_ORDER.filter((f) => f !== 'r32')) {
    const engine = buildEngine(partidas)
    for (const node of BRACKET_TEMPLATE.filter((n) => n.fase === fase)) {
      const rt = engine.realTeams.get(node.id)
      const casa = nomeDe(rt?.A)
      const fora = nomeDe(rt?.B)
      if (casa && fora) partidas.push(simKnock(node.id, fase, casa, fora))
    }
  }
  return partidas
}

function main() {
  const partidas = simulate()
  const engine = buildEngine(partidas)
  const resultado = engineToResultado(engine)

  console.log('— 16-avos resolvidos pela fase de grupos —')
  resultado.matches
    .filter((m) => m.fase === 'r32')
    .forEach((m) => {
      const a = m.timeA.tipo === 'time' ? m.timeA.nome : m.timeA.label
      const b = m.timeB.tipo === 'time' ? m.timeB.nome : m.timeB.label
      console.log(`  ${m.lado.toUpperCase()} ${m.slot}: ${a}  ×  ${b}`)
    })

  const campeao = engine.realAdvancer.get('final')
  console.log(`\nCampeão simulado: ${campeao ?? '(indefinido)'}`)

  // Picks "perfeitos" = todos os avançadores reais.
  const perfeito: Record<string, string> = {}
  for (const node of BRACKET_TEMPLATE) {
    const adv = engine.realAdvancer.get(node.id)
    if (adv) perfeito[node.id] = adv
  }

  const pesosC = DEFAULT_REGRAS_CHAVE.pesos_cravada
  const pesosF = DEFAULT_REGRAS_CHAVE.pesos_flex
  const esperadoC = BRACKET_TEMPLATE.reduce((s, n) => s + pesosC[n.fase], 0)
  const esperadoF = BRACKET_TEMPLATE.reduce((s, n) => s + pesosF[n.fase], 0)

  const cravadaPerfeita = scorePicks(perfeito, engine, pesosC)
  const flexPerfeita = scorePicks(perfeito, engine, pesosF)

  // Erra 1 jogo dos 16-avos → perde o peso de r32.
  const comErro = { ...perfeito }
  const algumR32 = BRACKET_TEMPLATE.find((n) => n.fase === 'r32')!
  comErro[algumR32.id] = '___time_inexistente___'
  const cravadaComErro = scorePicks(comErro, engine, pesosC)

  console.log('\n— Pontuação —')
  console.log(`  Cravada perfeita: ${cravadaPerfeita} (esperado ${esperadoC})`)
  console.log(`  Flexível perfeita: ${flexPerfeita} (esperado ${esperadoF})`)
  console.log(`  Cravada errando 1 jogo de 16-avos: ${cravadaComErro} (esperado ${esperadoC - pesosC.r32})`)

  const ok =
    cravadaPerfeita === esperadoC &&
    flexPerfeita === esperadoF &&
    cravadaComErro === esperadoC - pesosC.r32 &&
    Boolean(campeao)

  console.log(`\n${ok ? '✅ OK — engine e pontuação batem' : '❌ FALHOU — confira os valores acima'}`)
  if (!ok) process.exit(1)
}

main()
