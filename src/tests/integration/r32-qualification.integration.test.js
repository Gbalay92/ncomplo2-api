/**
 * R32 Qualification integration test — real PostgreSQL
 *
 * Verifica que el criterio de clasificación a R32 se cumple correctamente:
 *  - Los 2 primeros de cada grupo clasifican siempre (24 equipos)
 *  - De los 12 equipos que terminan terceros, solo clasifican los 8 mejores
 *    (por puntos → diferencia de goles → goles a favor)
 *
 * Estrategia para hacerlo determinista:
 *  Grupos A-H: home gana 1-0  → 3er clasificado: 3pts, gd=-1, gf=1
 *  Grupos I-L: home gana 2-0  → 3er clasificado: 3pts, gd=-2, gf=2
 *
 *  Con pts=3 igual en todos, el desempate por gd hace que los 8 terceros de
 *  A-H (gd=-1) sean siempre mejores que los 4 de I-L (gd=-2).
 *  → Los 4 eliminados son siempre los terceros de I, J, K, L.
 *
 * Usuarios de test:
 *  u_correct      — predice los 32 correctos (top-2 + 8 mejores terceros A-H) → 160 pts
 *  u_wrong_thirds — predice los top-2 (24) + 4 terceros eliminados (I-L) + 4 buenos terceros → 140 pts
 *  u_no_thirds    — predice los top-2 (24) + los 8 terceros eliminados/malos → 120 pts
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { scoreGroupQualification } from '../../services/scoring.service.js'
import { getRealQualifiersMap } from '../../services/tournament.service.js'

const { Pool } = pg
const pool = new Pool({ host: 'localhost', port: 5432, database: 'postgres', user: 'vdp', password: 'vdp' })

const GROUPS_AH = ['A','B','C','D','E','F','G','H']
const GROUPS_IL = ['I','J','K','L']
const ALL_GROUPS = [...GROUPS_AH, ...GROUPS_IL]

const USERS = [
  { id: 'cc000000-0000-0000-0000-000000000001', name: 'u_correct',      email: 'r32_correct@test.com' },
  { id: 'cc000000-0000-0000-0000-000000000002', name: 'u_wrong_thirds', email: 'r32_wrong@test.com' },
  { id: 'cc000000-0000-0000-0000-000000000003', name: 'u_no_thirds',    email: 'r32_nothirds@test.com' },
]
const USER_IDS = USERS.map(u => u.id)

async function q(sql, params = []) { return pool.query(sql, params) }

async function cleanTestData() {
  await q('DELETE FROM score_log WHERE user_id = ANY($1)', [USER_IDS])
  await q('DELETE FROM predicted_group_standings WHERE user_id = ANY($1)', [USER_IDS])
  await q('DELETE FROM real_bracket')
  await q('UPDATE group_matches SET real_home_goals = NULL, real_away_goals = NULL, is_locked = false')
  await q('DELETE FROM users WHERE id = ANY($1)', [USER_IDS])
  await q('DELETE FROM email_whitelist WHERE email LIKE $1', ['r32_%@test.com'])
}

async function insertPredictedQualifiers(userId, qualifiers) {
  // qualifiers: array of { team_id, group_name, position }
  for (const [i, { team_id, group_name, position }] of qualifiers.entries()) {
    await q(
      `INSERT INTO predicted_group_standings
         (user_id, team_id, group_name, position, pred_points, pred_gd, pred_gf, is_classified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       ON CONFLICT DO NOTHING`,
      [userId, team_id, group_name, position,
        position === 1 ? 9 : position === 2 ? 6 : 3,
        position === 1 ? 3 : position === 2 ? 1 : -1,
        position === 1 ? 3 : position === 2 ? 2 : 1]
    )
  }
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('clasificación R32 — 2 primeros + 8 mejores terceros', () => {

  before(async () => {
    await cleanTestData()
    for (const u of USERS) {
      await q(`INSERT INTO email_whitelist (email, invited_by) VALUES ($1,'test') ON CONFLICT DO NOTHING`, [u.email])
      await q(
        `INSERT INTO users (id,email,first_name,last_name,display_name,password_hash,is_admin)
         VALUES ($1,$2,'Test','User',$3,'hash',false) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.email, u.name]
      )
    }
  })

  after(async () => {
    await cleanTestData()
    await pool.end()
  })

  test('los 8 mejores terceros clasifican y la puntuación refleja los aciertos', async () => {

    // ── 1. Establecer resultados de grupos ────────────────────────────────────
    // A-H: home gana 1-0  →  3er: 3pts, gd=-1, gf=1
    // I-L: home gana 2-0  →  3er: 3pts, gd=-2, gf=2  (peor gd → quedan eliminados)

    await q(`
      UPDATE group_matches
      SET real_home_goals = CASE WHEN group_name = ANY($1) THEN 1 ELSE 2 END,
          real_away_goals = 0,
          is_locked = true
    `, [GROUPS_AH])

    // ── 2. Obtener los 32 clasificados reales ─────────────────────────────────

    const qualMap = await getRealQualifiersMap(pool)

    // Los 8 mejores terceros deben ser de grupos A-H
    const qualifyingThirds = Array.from({ length: 8 }, (_, i) => qualMap[`3rd_${i + 1}`])
    const ahThirds = GROUPS_AH.map(g => qualMap[`3${g}`])
    const ilThirds = GROUPS_IL.map(g => qualMap[`3${g}`])

    for (const t of qualifyingThirds) {
      assert.ok(ahThirds.includes(t),
        `Tercero clasificado ${t} debe ser de grupos A-H (gd=-1), no de I-L (gd=-2)`)
    }
    for (const t of ilThirds) {
      assert.ok(!qualifyingThirds.includes(t),
        `Tercero de grupo I-L (${t}, gd=-2) NO debe clasificar`)
    }

    // ── 3. Insertar real_bracket R32 ──────────────────────────────────────────

    const { rows: r32Slots } = await q(
      `SELECT id, slot_label, home_source, away_source
       FROM knockout_slots WHERE stage='round_of_32' ORDER BY slot_label`
    )
    for (const slot of r32Slots) {
      await q(
        `INSERT INTO real_bracket (slot_id, home_team_id, away_team_id) VALUES ($1,$2,$3)
         ON CONFLICT (slot_id) DO UPDATE SET home_team_id=$2, away_team_id=$3`,
        [slot.id, qualMap[slot.home_source] ?? null, qualMap[slot.away_source] ?? null]
      )
    }

    // ── 4. Construir las predicciones de cada usuario ─────────────────────────

    // Top-2 de cada grupo (iguales para todos los usuarios)
    const top2Qualifiers = ALL_GROUPS.flatMap(g => [
      { team_id: qualMap[`1${g}`], group_name: g, position: 1 },
      { team_id: qualMap[`2${g}`], group_name: g, position: 2 },
    ])

    // u_correct: top-2 + los 8 buenos terceros (A-H)
    const correctThirds = GROUPS_AH.map((g, i) => ({
      team_id:    ahThirds[i],
      group_name: g,
      position:   3,
    }))
    await insertPredictedQualifiers(USERS[0].id, [...top2Qualifiers, ...correctThirds])

    // u_wrong_thirds: top-2 + 4 terceros eliminados (I-L) + 4 buenos terceros (A-D)
    const partialThirds = [
      ...GROUPS_IL.map((g, i) => ({ team_id: ilThirds[i],   group_name: g,              position: 3 })),
      ...GROUPS_AH.slice(0, 4).map((g, i) => ({ team_id: ahThirds[i], group_name: g,   position: 3 })),
    ]
    await insertPredictedQualifiers(USERS[1].id, [...top2Qualifiers, ...partialThirds])

    // u_no_thirds: top-2 + todos los terceros de I-L (4 equipos) + 4 cuartos de A-D (todos mal)
    const wrongThirds = [
      ...GROUPS_IL.map((g, i) => ({ team_id: ilThirds[i],             group_name: g,              position: 3 })),
      ...GROUPS_AH.slice(0, 4).map((g, i) => ({ team_id: qualMap[`4${g}`], group_name: g, position: 3 })),
    ]
    await insertPredictedQualifiers(USERS[2].id, [...top2Qualifiers, ...wrongThirds])

    // ── 5. Puntuar clasificación ───────────────────────────────────────────────

    await scoreGroupQualification(pool)

    // ── 6. Verificar puntos ───────────────────────────────────────────────────

    const { rows } = await q(`
      SELECT u.display_name, COALESCE(SUM(sl.points),0)::int AS pts
      FROM users u
      LEFT JOIN score_log sl ON sl.user_id = u.id
      WHERE u.id = ANY($1)
      GROUP BY u.display_name ORDER BY pts DESC
    `, [USER_IDS])

    const pts = Object.fromEntries(rows.map(r => [r.display_name, r.pts]))

    // u_correct: 24 top-2 + 8 buenos terceros = 32 aciertos × 5 = 160
    assert.equal(pts['u_correct'], 160,
      `u_correct esperado 160 (32 clasificados × 5pts), obtenido ${pts['u_correct']}`)

    // u_wrong_thirds: 24 top-2 + 4 buenos terceros (A-D) + 4 eliminados (I-L) = 28 aciertos × 5 = 140
    assert.equal(pts['u_wrong_thirds'], 140,
      `u_wrong_thirds esperado 140 (28 aciertos × 5pts), obtenido ${pts['u_wrong_thirds']}`)

    // u_no_thirds: 24 top-2 + 0 terceros buenos = 24 aciertos × 5 = 120
    assert.equal(pts['u_no_thirds'], 120,
      `u_no_thirds esperado 120 (24 top-2 × 5pts, sin terceros buenos), obtenido ${pts['u_no_thirds']}`)

    console.log('\n📋 Clasificación R32:')
    console.log('  Terceros de A-H (clasificados, gd=-1):', ahThirds.map(t => t.substring(0,8)).join(', '))
    console.log('  Terceros de I-L (eliminados, gd=-2): ', ilThirds.map(t => t.substring(0,8)).join(', '))
    console.log()
    rows.forEach(r => console.log(`  ${r.display_name.padEnd(16)} → ${r.pts} pts`))
  })
})
