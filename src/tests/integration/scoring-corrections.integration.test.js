/**
 * Scoring corrections & idempotency — real PostgreSQL
 *
 * Dos baterías de tests para los escenarios más delicados en producción:
 *
 * A) IDEMPOTENCIA
 *    Llamar al scoring varias veces (ej. el admin re-guarda un resultado)
 *    no debe duplicar puntos. Aplica a:
 *      - scoreGroupMatch (re-scoring del mismo partido)
 *      - scoreGroupQualification (re-locking del grupo)
 *      - scoreKnockoutAdvancement (mismo ganador re-confirmado)
 *
 * B) CAMBIO DE GANADOR EN ELIMINATORIAS
 *    Flujo: admin guarda 1-0 team-a → actualiza a 1-2 team-b.
 *    El sistema debe:
 *      - Borrar los puntos acumulados por quienes predijeron team-a
 *      - Otorgar los puntos a quienes predijeron team-b
 *    El usuario que predijo el ganador incorrecto (team-a) termina con 0 pts KO.
 *    El usuario que predijo el ganador correcto (team-b) termina con los pts correctos.
 */

import { test, describe, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import {
  scoreGroupMatch,
  scoreGroupQualification,
  scoreKnockoutAdvancement,
} from '../../services/scoring.service.js'

const { Pool } = pg
const pool = new Pool({ host: 'localhost', port: 5432, database: 'postgres', user: 'vdp', password: 'vdp' })

// ─── Users ────────────────────────────────────────────────────────────────────

const USERS = [
  { id: 'dd000000-0000-0000-0000-000000000001', name: 'u_a', email: 'corr_a@test.com' },
  { id: 'dd000000-0000-0000-0000-000000000002', name: 'u_b', email: 'corr_b@test.com' },
]
const USER_IDS = USERS.map(u => u.id)

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function q(sql, params = []) { return pool.query(sql, params) }

async function totalPts(userId) {
  const { rows } = await q(
    'SELECT COALESCE(SUM(points),0)::int AS pts FROM score_log WHERE user_id=$1',
    [userId]
  )
  return rows[0].pts
}

async function cleanScoring() {
  await q('DELETE FROM score_log WHERE user_id = ANY($1)', [USER_IDS])
  await q('DELETE FROM predicted_bracket WHERE user_id = ANY($1)', [USER_IDS])
  await q('DELETE FROM predicted_group_standings WHERE user_id = ANY($1)', [USER_IDS])
  await q('DELETE FROM predictions WHERE user_id = ANY($1)', [USER_IDS])
  await q('DELETE FROM real_bracket')
  await q('UPDATE group_matches SET real_home_goals=NULL, real_away_goals=NULL, is_locked=false')
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

before(async () => {
  for (const u of USERS) {
    await q(`INSERT INTO email_whitelist (email,invited_by) VALUES ($1,'test') ON CONFLICT DO NOTHING`, [u.email])
    await q(
      `INSERT INTO users (id,email,first_name,last_name,display_name,password_hash,is_admin)
       VALUES ($1,$2,'Test','User',$3,'hash',false) ON CONFLICT (id) DO NOTHING`,
      [u.id, u.email, u.name]
    )
  }
})

after(async () => {
  await cleanScoring()
  await q('DELETE FROM users WHERE id = ANY($1)', [USER_IDS])
  await q('DELETE FROM email_whitelist WHERE email LIKE $1', ['corr_%@test.com'])
  await pool.end()
})

beforeEach(async () => { await cleanScoring() })

// ─── A. IDEMPOTENCIA ──────────────────────────────────────────────────────────

describe('A — idempotencia del scoring', () => {

  test('scoreGroupMatch llamado dos veces → mismos puntos, sin duplicados', async () => {
    const [uA] = USERS

    // Un partido de grupos, predicción exacta (1-0)
    const { rows: [match] } = await q(
      'SELECT id FROM group_matches LIMIT 1'
    )
    await q('INSERT INTO predictions (user_id,match_id,pred_home_goals,pred_away_goals) VALUES ($1,$2,1,0)',
      [uA.id, match.id])
    await q('UPDATE group_matches SET real_home_goals=1, real_away_goals=0 WHERE id=$1', [match.id])

    // Primera pasada → 5 pts
    await scoreGroupMatch(match.id, pool)
    assert.equal(await totalPts(uA.id), 5, 'primera pasada: 5 pts')

    // Segunda pasada (admin re-guarda el mismo resultado) → sigue siendo 5 pts
    await scoreGroupMatch(match.id, pool)
    assert.equal(await totalPts(uA.id), 5, 'segunda pasada: sigue siendo 5 pts (no duplica)')

    // Tercera pasada → igual
    await scoreGroupMatch(match.id, pool)
    assert.equal(await totalPts(uA.id), 5, 'tercera pasada: sigue siendo 5 pts')
  })

  test('scoreGroupQualification llamado dos veces → mismos puntos, sin duplicados', async () => {
    const [uA] = USERS

    // Obtener cualquier equipo para usar como clasificado R32
    const { rows: [{ id: teamId }] } = await q('SELECT id FROM teams LIMIT 1')
    const { rows: [{ id: slotId }] } = await q(
      `SELECT id FROM knockout_slots WHERE stage='round_of_32' LIMIT 1`
    )

    // Predicción: uA predice que ese equipo clasifica
    await q(
      `INSERT INTO predicted_group_standings (user_id,team_id,group_name,position,pred_points,pred_gd,pred_gf,is_classified)
       VALUES ($1,$2,'A',1,9,3,3,true)`,
      [uA.id, teamId]
    )
    // Realidad: ese equipo sí clasifica (en el R32 real_bracket)
    await q(
      `INSERT INTO real_bracket (slot_id,home_team_id) VALUES ($1,$2)
       ON CONFLICT (slot_id) DO UPDATE SET home_team_id=$2`,
      [slotId, teamId]
    )

    // Primera pasada → 5 pts
    await scoreGroupQualification(pool)
    assert.equal(await totalPts(uA.id), 5, 'primera pasada: 5 pts')

    // Segunda pasada → sigue siendo 5 pts
    await scoreGroupQualification(pool)
    assert.equal(await totalPts(uA.id), 5, 'segunda pasada: sigue siendo 5 pts (no duplica)')
  })

  test('scoreKnockoutAdvancement con mismo ganador re-confirmado → no duplica puntos', async () => {
    const [uA] = USERS
    const { rows: [{ id: teamId }] } = await q('SELECT id FROM teams LIMIT 1')
    const { rows: [{ id: slotId, id: ksId }] } = await q(
      `SELECT id FROM knockout_slots WHERE stage='round_of_32' LIMIT 1`
    )

    // uA predijo team-a como ganador del R32 slot
    await q(
      `INSERT INTO predicted_bracket (user_id,slot_id,pred_winner_id) VALUES ($1,$2,$3)`,
      [uA.id, slotId, teamId]
    )

    // Primera pasada: team gana R32, avanza a R16 → 10 pts
    await scoreKnockoutAdvancement(teamId, 'round_of_16', null, pool)
    assert.equal(await totalPts(uA.id), 10, 'primera pasada: 10 pts')

    // Segunda pasada: mismo ganador re-confirmado (idempotente)
    await scoreKnockoutAdvancement(teamId, 'round_of_16', teamId, pool)
    assert.equal(await totalPts(uA.id), 10, 'misma confirmación: sigue siendo 10 pts')

    // Tercera pasada: mismo resultado
    await scoreKnockoutAdvancement(teamId, 'round_of_16', teamId, pool)
    assert.equal(await totalPts(uA.id), 10, 'tercera pasada: sigue siendo 10 pts')
  })
})

// ─── B. CAMBIO DE GANADOR EN ELIMINATORIAS ────────────────────────────────────

describe('B — cambio de ganador en eliminatorias', () => {

  test('1-0 team-a → corregido a 1-2 team-b: se reasignan puntos correctamente', async () => {
    const [uA, uB] = USERS

    // Obtener dos equipos distintos
    const { rows: teams } = await q('SELECT id FROM teams LIMIT 2')
    const teamA = teams[0].id
    const teamB = teams[1].id

    // Un slot R32
    const { rows: [r32Slot] } = await q(
      `SELECT id FROM knockout_slots WHERE stage='round_of_32' LIMIT 1`
    )

    // uA predijo team-a como ganador del R32
    // uB predijo team-b como ganador del R32
    await q(
      `INSERT INTO predicted_bracket (user_id,slot_id,pred_winner_id) VALUES ($1,$2,$3),($4,$2,$5)`,
      [uA.id, r32Slot.id, teamA, uB.id, teamB]
    )

    // ── PASO 1: Admin guarda resultado inicial → team-a gana (prevTeamId=null) ─

    await scoreKnockoutAdvancement(teamA, 'round_of_16', null, pool)

    assert.equal(await totalPts(uA.id), 10, 'paso 1: uA (predijo team-a) tiene 10 pts')
    assert.equal(await totalPts(uB.id),  0, 'paso 1: uB (predijo team-b) tiene 0 pts')

    // ── PASO 2: Admin corrige → team-b gana (prevTeamId=team-a) ──────────────

    await scoreKnockoutAdvancement(teamB, 'round_of_16', teamA, pool)

    assert.equal(await totalPts(uA.id),  0, 'paso 2: uA pierde sus 10 pts (team-a ya no ganó)')
    assert.equal(await totalPts(uB.id), 10, 'paso 2: uB recibe 10 pts (team-b es el ganador correcto)')
  })

  test('1-0 team-a → empate 1-1 (sin ganador): se limpian puntos, nadie tiene KO pts', async () => {
    const [uA, uB] = USERS

    const { rows: teams } = await q('SELECT id FROM teams LIMIT 2')
    const teamA = teams[0].id
    const teamB = teams[1].id
    const { rows: [r32Slot] } = await q(
      `SELECT id FROM knockout_slots WHERE stage='round_of_32' LIMIT 1`
    )

    await q(
      `INSERT INTO predicted_bracket (user_id,slot_id,pred_winner_id) VALUES ($1,$2,$3),($4,$2,$5)`,
      [uA.id, r32Slot.id, teamA, uB.id, teamB]
    )

    // Paso 1: team-a gana → uA tiene 10 pts
    await scoreKnockoutAdvancement(teamA, 'round_of_16', null, pool)
    assert.equal(await totalPts(uA.id), 10, 'paso 1: uA tiene 10 pts')

    // Paso 2: admin actualiza marcador a 1-1 en vivo (sin ganador todavía)
    // teamId=null, prevTeamId=teamA → se limpian los puntos de teamA
    await scoreKnockoutAdvancement(null, 'round_of_16', teamA, pool)

    assert.equal(await totalPts(uA.id), 0, 'paso 2: uA pierde sus pts (marcador en vivo, sin ganador)')
    assert.equal(await totalPts(uB.id), 0, 'paso 2: uB sigue con 0 pts')
  })

  test('cambio múltiple: a→b→a restaura puntos del predictor original', async () => {
    const [uA, uB] = USERS

    const { rows: teams } = await q('SELECT id FROM teams LIMIT 2')
    const teamA = teams[0].id
    const teamB = teams[1].id
    const { rows: [r32Slot] } = await q(
      `SELECT id FROM knockout_slots WHERE stage='round_of_32' LIMIT 1`
    )

    await q(
      `INSERT INTO predicted_bracket (user_id,slot_id,pred_winner_id) VALUES ($1,$2,$3),($4,$2,$5)`,
      [uA.id, r32Slot.id, teamA, uB.id, teamB]
    )

    // a → uA tiene 10 pts
    await scoreKnockoutAdvancement(teamA, 'round_of_16', null, pool)
    assert.equal(await totalPts(uA.id), 10, 'a: uA=10, uB=0')
    assert.equal(await totalPts(uB.id),  0)

    // b → uB tiene 10 pts, uA pierde los suyos
    await scoreKnockoutAdvancement(teamB, 'round_of_16', teamA, pool)
    assert.equal(await totalPts(uA.id),  0, 'b: uA=0, uB=10')
    assert.equal(await totalPts(uB.id), 10)

    // vuelve a a → uA recupera, uB pierde
    await scoreKnockoutAdvancement(teamA, 'round_of_16', teamB, pool)
    assert.equal(await totalPts(uA.id), 10, 'de vuelta a a: uA=10, uB=0')
    assert.equal(await totalPts(uB.id),  0)
  })
})
