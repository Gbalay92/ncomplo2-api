/**
 * Puntuación máxima — integración end-to-end
 *
 * Simula un usuario que acierta absolutamente todo a lo largo del torneo
 * y verifica que la suma de puntos sea exactamente 1020.
 *
 * Desglose:
 *   Grupos:   72 partidos × 5 pts (resultado exacto)  =  360
 *   R32:      32 clasificados × 5 pts                 =  160
 *   R16:      16 equipos que avanzan × 10 pts         =  160
 *   QF:        8 equipos que avanzan × 15 pts         =  120
 *   SF:        4 equipos que avanzan × 25 pts         =  100
 *   Final:     2 finalistas × 35 pts                  =   70
 *   Campeón:   1 ganador × 50 pts                     =   50
 *                                             TOTAL = 1.020
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  scoreGroupMatch,
  scoreGroupQualification,
  scoreKnockoutAdvancement,
  scoreChampion,
} from '../services/scoring.service.js'
import { fakeDb } from './helpers/fakeDb.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** fakeDb para un partido de grupos predicho exactamente (2-1 real, 2-1 predicho → 5 pts) */
function groupMatchDb() {
  return fakeDb([
    { rows: [{ real_home_goals: 2, real_away_goals: 1 }] },
    { rows: [{ points_sign: 2, points_exact: 3 }] },
    { rows: [{ user_id: 'u1', pred_home_goals: 2, pred_away_goals: 1 }] },
  ])
}

/** fakeDb para scoreGroupQualification con 32 clasificados todos acertados */
function groupQualDb() {
  const predicted = Array.from({ length: 32 }, (_, i) => ({ user_id: 'u1', team_id: `t${i}` }))
  const slots = Array.from({ length: 16 }, (_, i) => ({
    home_team_id: `t${i * 2}`,
    away_team_id: `t${i * 2 + 1}`,
  }))
  return fakeDb([
    { rows: predicted },                        // predicted_group_standings
    { rows: slots },                            // R32 real_bracket slots
    { rows: [{ points_classify: 5 }] },         // scoring_rules
  ])
}

/** fakeDb para scoreKnockoutAdvancement con 1 usuario que predijo el equipo */
function advancementDb(pts) {
  return fakeDb([
    { rows: [{ points_classify: pts }] },
    { rows: [{ user_id: 'u1' }] },
  ])
}

/** fakeDb para scoreChampion con 1 usuario que acertó el campeón */
function championDb() {
  return fakeDb([
    { rows: [{ real_winner_id: 't0' }] },
    { rows: [{ points_champion: 50 }] },
    { rows: [{ user_id: 'u1' }] },
  ])
}

// Extrae los puntos de los INSERTs según la función que los generó
const ptsFromGroupMatch  = (ins) => ins[2]  // [user_id, matchId, pts]
const ptsFromGroupQual   = (ins) => ins[2]  // [user_id, team_id, pts]
const ptsFromAdvancement = (ins) => ins[3]  // [user_id, teamId, stage, pts]
const ptsFromChampion    = (ins) => ins[1]  // [user_id, pts]

// ─── Test ─────────────────────────────────────────────────────────────────────

describe('puntuación máxima — usuario acierta todo', () => {
  test('suma total de todas las fases = 1.020 pts', async () => {
    let total = 0

    // ── Grupos: 72 partidos × 5 pts = 360 ──────────────────────────────────
    for (let i = 0; i < 72; i++) {
      const db = groupMatchDb()
      await scoreGroupMatch(`m${i}`, db)
      total += db.inserts.reduce((s, ins) => s + ptsFromGroupMatch(ins), 0)
    }
    assert.equal(total, 360, `grupos: esperado 360, obtenido ${total}`)

    // ── Clasificación R32: 32 equipos × 5 = 160 ────────────────────────────
    const db32 = groupQualDb()
    await scoreGroupQualification(db32)
    total += db32.inserts.reduce((s, ins) => s + ptsFromGroupQual(ins), 0)
    assert.equal(total, 520, `grupos + R32: esperado 520, obtenido ${total}`)

    // ── Avances a R16: 16 equipos × 10 = 160 ───────────────────────────────
    for (let i = 0; i < 16; i++) {
      const db = advancementDb(10)
      await scoreKnockoutAdvancement(`t${i}`, 'round_of_16', null, db)
      total += db.inserts.reduce((s, ins) => s + ptsFromAdvancement(ins), 0)
    }
    assert.equal(total, 680, `hasta R16: esperado 680, obtenido ${total}`)

    // ── Avances a QF: 8 equipos × 15 = 120 ────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const db = advancementDb(15)
      await scoreKnockoutAdvancement(`t${i}`, 'quarter_final', null, db)
      total += db.inserts.reduce((s, ins) => s + ptsFromAdvancement(ins), 0)
    }
    assert.equal(total, 800, `hasta QF: esperado 800, obtenido ${total}`)

    // ── Avances a SF: 4 equipos × 25 = 100 ─────────────────────────────────
    for (let i = 0; i < 4; i++) {
      const db = advancementDb(25)
      await scoreKnockoutAdvancement(`t${i}`, 'semi_final', null, db)
      total += db.inserts.reduce((s, ins) => s + ptsFromAdvancement(ins), 0)
    }
    assert.equal(total, 900, `hasta SF: esperado 900, obtenido ${total}`)

    // ── Finalistas: 2 equipos × 35 = 70 ────────────────────────────────────
    for (let i = 0; i < 2; i++) {
      const db = advancementDb(35)
      await scoreKnockoutAdvancement(`t${i}`, 'final', null, db)
      total += db.inserts.reduce((s, ins) => s + ptsFromAdvancement(ins), 0)
    }
    assert.equal(total, 970, `hasta finalistas: esperado 970, obtenido ${total}`)

    // ── Campeón: 1 × 50 = 50 ───────────────────────────────────────────────
    const dbChamp = championDb()
    await scoreChampion(dbChamp)
    total += dbChamp.inserts.reduce((s, ins) => s + ptsFromChampion(ins), 0)

    assert.equal(total, 1020, `total: esperado 1020, obtenido ${total}`)
  })
})
