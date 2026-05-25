import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { calculateGroupTable, getRealQualifiersMap } from '../services/tournament.service.js'
import { fakeDb } from './helpers/fakeDb.js'

// ─── calculateGroupTable ──────────────────────────────────────────────────────
// Esta es la función central de la clasificación. Ordena por pts → gd → gf.

describe('calculateGroupTable', () => {

  test('ganador claro por puntos', () => {
    const matches = [
      { home_team_id: 'A', away_team_id: 'B', home_goals: 2, away_goals: 0 }, // A gana
      { home_team_id: 'A', away_team_id: 'C', home_goals: 1, away_goals: 0 }, // A gana
      { home_team_id: 'B', away_team_id: 'C', home_goals: 1, away_goals: 0 }, // B gana
    ]
    // A: 6pts; B: 3pts; C: 0pts — orden claro sin desempates
    const table = calculateGroupTable(matches)
    assert.equal(table[0].team_id, 'A')
    assert.equal(table[1].team_id, 'B')
    assert.equal(table[2].team_id, 'C')
    assert.equal(table[0].pts, 6)
    assert.equal(table[1].pts, 3)
    assert.equal(table[2].pts, 0)
  })

  test('empate en puntos, desempate por diferencia de goles', () => {
    const matches = [
      { home_team_id: 'A', away_team_id: 'B', home_goals: 3, away_goals: 0 }, // A +3 gd
      { home_team_id: 'C', away_team_id: 'D', home_goals: 1, away_goals: 0 }, // C +1 gd
      { home_team_id: 'A', away_team_id: 'C', home_goals: 0, away_goals: 1 }, // C gana
      { home_team_id: 'B', away_team_id: 'D', home_goals: 2, away_goals: 0 }, // B +2 gd total
      { home_team_id: 'A', away_team_id: 'D', home_goals: 1, away_goals: 0 }, // A gana
      { home_team_id: 'B', away_team_id: 'C', home_goals: 0, away_goals: 1 }, // C gana
    ]
    // A: 2V 1D = 6pts, gf=4, ga=1, gd=+3
    // C: 3V 0D = 9pts → C primero
    // A: 6pts, gd=+3 → A segundo
    // B: 1V 2D = 3pts, gd=+2 → B tercero
    // D: 0V 3D = 0pts → D cuarto
    const table = calculateGroupTable(matches)
    assert.equal(table[0].team_id, 'C')
    assert.equal(table[1].team_id, 'A')
    assert.equal(table[2].team_id, 'B')
    assert.equal(table[3].team_id, 'D')
  })

  test('empate en puntos Y en gd, desempate por goles a favor', () => {
    // A y B con los mismos pts y gd, pero A marcó más goles
    const matches = [
      { home_team_id: 'A', away_team_id: 'C', home_goals: 3, away_goals: 1 }, // A: +2 gd, 3gf
      { home_team_id: 'B', away_team_id: 'C', home_goals: 2, away_goals: 0 }, // B: +2 gd, 2gf
      { home_team_id: 'A', away_team_id: 'B', home_goals: 0, away_goals: 0 }, // empate
    ]
    // A: 1V 1E = 4pts, gd=+2, gf=3
    // B: 1V 1E = 4pts, gd=+2, gf=2
    // C: 0pts
    const table = calculateGroupTable(matches)
    assert.equal(table[0].team_id, 'A') // más goles a favor
    assert.equal(table[1].team_id, 'B')
    assert.equal(table[2].team_id, 'C')
  })

  test('partidos sin resultado (null) no se cuentan', () => {
    const matches = [
      { home_team_id: 'A', away_team_id: 'B', home_goals: 1, away_goals: 0 },
      { home_team_id: 'A', away_team_id: 'C', home_goals: null, away_goals: null }, // no jugado
    ]
    const table = calculateGroupTable(matches)
    assert.equal(table[0].team_id, 'A')
    assert.equal(table[0].pts, 3)
    assert.equal(table[0].gf, 1) // solo el partido jugado
  })

  test('empate: ambos equipos suman 1 punto', () => {
    const matches = [
      { home_team_id: 'A', away_team_id: 'B', home_goals: 1, away_goals: 1 },
    ]
    const table = calculateGroupTable(matches)
    assert.equal(table[0].pts, 1)
    assert.equal(table[1].pts, 1)
    assert.equal(table[0].gd, 0)
    assert.equal(table[1].gd, 0)
  })

  test('grupo con un equipo con victorias grandes (gd alto)', () => {
    const matches = [
      { home_team_id: 'A', away_team_id: 'B', home_goals: 5, away_goals: 0 },
      { home_team_id: 'A', away_team_id: 'C', home_goals: 4, away_goals: 0 },
      { home_team_id: 'B', away_team_id: 'C', home_goals: 1, away_goals: 0 },
    ]
    const table = calculateGroupTable(matches)
    assert.equal(table[0].team_id, 'A')
    assert.equal(table[0].pts, 6)
    assert.equal(table[0].gd, 9)
    assert.equal(table[0].gf, 9)
    assert.equal(table[1].team_id, 'B') // 3pts, gd=0
    assert.equal(table[2].team_id, 'C') // 0pts, gd=-9
  })
})

// ─── getRealQualifiersMap ─────────────────────────────────────────────────────
// Verifica que el mapa de clasificados se construye correctamente:
// - Posiciones 1X / 2X por grupo
// - Los 8 mejores terceros clasificados

describe('getRealQualifiersMap', () => {

  /**
   * Helper: devuelve los resultados de un grupo como fila de fakeDb.
   * Cada equipo juega 2 partidos (grupos de 3 para mantener el mock corto).
   */
  function groupRows(teamA, teamB, teamC, goalsAB, goalsAC, goalsBC) {
    return {
      rows: [
        { home_team_id: teamA, away_team_id: teamB, home_goals: goalsAB[0], away_goals: goalsAB[1] },
        { home_team_id: teamA, away_team_id: teamC, home_goals: goalsAC[0], away_goals: goalsAC[1] },
        { home_team_id: teamB, away_team_id: teamC, home_goals: goalsBC[0], away_goals: goalsBC[1] },
      ],
    }
  }

  test('mapa básico: posiciones 1X y 2X por grupo', async () => {
    // Grupo A: A1 gana todo, A2 segundo, A3 tercero
    // Grupo B: B1 gana todo, B2 segundo, B3 tercero
    const db = fakeDb([
      groupRows('A1', 'A2', 'A3', [2, 0], [2, 0], [1, 0]), // A1>A2>A3
      groupRows('B1', 'B2', 'B3', [2, 0], [2, 0], [1, 0]), // B1>B2>B3
    ])

    const map = await getRealQualifiersMap(db, ['A', 'B'])

    assert.equal(map['1A'], 'A1')
    assert.equal(map['2A'], 'A2')
    assert.equal(map['3A'], 'A3')
    assert.equal(map['1B'], 'B1')
    assert.equal(map['2B'], 'B2')
    assert.equal(map['3B'], 'B3')
  })

  test('mejor tercero clasificado → 3rd_1', async () => {
    // Escenario RPS (piedra-papel-tijera): los tres equipos del grupo A terminan con 3pts.
    // A1 vs A2: 2-0 (A1 gana). A2 vs A3: 3-0 (A2 gana). A3 vs A1: 1-0 (A3 gana).
    // Puntos: A1=3, A2=3, A3=3. Desempate por gd: A2(+1)=A1(+1) > A3(-2).
    // Desempate A1 vs A2 por gf: A2(gf=3) > A1(gf=2) → orden: A2, A1, A3.
    // A3 queda 3º con 3pts y gd=-2.
    // Grupo B: B3 es tercero con 0pts → A3 (3pts) > B3 (0pts).
    const db = fakeDb([
      { rows: [
        { home_team_id: 'A1', away_team_id: 'A2', home_goals: 2, away_goals: 0 },
        { home_team_id: 'A2', away_team_id: 'A3', home_goals: 3, away_goals: 0 },
        { home_team_id: 'A3', away_team_id: 'A1', home_goals: 1, away_goals: 0 },
      ]},
      groupRows('B1', 'B2', 'B3', [2, 0], [2, 0], [1, 0]),
    ])

    const map = await getRealQualifiersMap(db, ['A', 'B'])

    assert.equal(map['3A'], 'A3')   // A3 es el tercero del grupo A
    assert.equal(map['3rd_1'], 'A3') // y el mejor tercero de todos
    assert.equal(map['3rd_2'], 'B3')
  })

  test('terceros desempatan por gd cuando tienen los mismos puntos', async () => {
    // Grupo A: A3 es 3º con 1pt y gd=-3
    //   A1 vs A2: 1-1 (empate). A1 vs A3: 3-0 (A1 gana). A2 vs A3: 0-0 (empate).
    //   A1: 4pts, A2: 2pts, A3: 1pt gd=-3.
    // Grupo B: B3 es 3º con 1pt y gd=-5 (peor)
    //   B1 vs B2: 1-1. B1 vs B3: 5-0. B2 vs B3: 0-0.
    //   B1: 4pts, B2: 2pts, B3: 1pt gd=-5.
    // A3 (gd=-3) > B3 (gd=-5) → A3 es 3rd_1.
    const db = fakeDb([
      { rows: [
        { home_team_id: 'A1', away_team_id: 'A2', home_goals: 1, away_goals: 1 },
        { home_team_id: 'A1', away_team_id: 'A3', home_goals: 3, away_goals: 0 },
        { home_team_id: 'A2', away_team_id: 'A3', home_goals: 0, away_goals: 0 },
      ]},
      { rows: [
        { home_team_id: 'B1', away_team_id: 'B2', home_goals: 1, away_goals: 1 },
        { home_team_id: 'B1', away_team_id: 'B3', home_goals: 5, away_goals: 0 },
        { home_team_id: 'B2', away_team_id: 'B3', home_goals: 0, away_goals: 0 },
      ]},
    ])

    const map = await getRealQualifiersMap(db, ['A', 'B'])

    assert.equal(map['3rd_1'], 'A3')
    assert.equal(map['3rd_2'], 'B3')
  })

  test('solo los 8 mejores terceros se incluyen en el mapa (con 9 grupos)', async () => {
    // 9 grupos → 9 terceros, solo 8 entran
    // El 9º tercero (peor) no debe aparecer en el mapa
    const groups = ['A','B','C','D','E','F','G','H','I']

    // Grupos A-H: el tercero tiene 3pts (gana 1 partido)
    // Grupo I: el tercero tiene 0pts (pierde todo)
    const responses = []
    for (let i = 0; i < 8; i++) {
      const g = groups[i]
      responses.push(groupRows(
        `${g}1`, `${g}2`, `${g}3`,
        [2, 0], [2, 0], [1, 0]  // tercero pierde todo: 0pts
      ))
    }
    // Grupo I: el tercero (I3) también pierde todo, pero con más goles en contra
    responses.push(groupRows('I1', 'I2', 'I3', [3, 0], [3, 0], [2, 0]))

    const db = fakeDb(responses)
    const map = await getRealQualifiersMap(db, groups)

    // El mapa de terceros debe tener exactamente 8 entradas (3rd_1 … 3rd_8)
    const thirdKeys = Object.keys(map).filter(k => k.startsWith('3rd_'))
    assert.equal(thirdKeys.length, 8)
    assert.equal(map['3rd_9'], undefined) // el 9º no existe
  })
})
