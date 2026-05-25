import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { scoreGroupMatch, scoreKnockoutSlot, scoreChampion } from '../services/scoring.service.js'
import { fakeDb } from './helpers/fakeDb.js'

const MATCH_ID = 'match-1'
const SLOT_ID  = 'slot-1'

// ─── scoreGroupMatch ──────────────────────────────────────────────────────────

describe('scoreGroupMatch', () => {
  function makeDb(result, predictions) {
    return fakeDb([
      { rows: [result] },
      { rows: [{ points_sign: 2, points_exact: 3 }] },
      { rows: predictions },
    ])
  }

  test('resultado exacto → 5 pts', async () => {
    const db = makeDb(
      { real_home_goals: 2, real_away_goals: 1 },
      [{ user_id: 'u1', pred_home_goals: 2, pred_away_goals: 1 }]
    )
    await scoreGroupMatch(MATCH_ID, db)
    assert.equal(db.inserts.length, 1)
    assert.equal(db.inserts[0][2], 5) // points
  })

  test('signo correcto → 2 pts', async () => {
    const db = makeDb(
      { real_home_goals: 3, real_away_goals: 0 },
      [{ user_id: 'u1', pred_home_goals: 1, pred_away_goals: 0 }]
    )
    await scoreGroupMatch(MATCH_ID, db)
    assert.equal(db.inserts.length, 1)
    assert.equal(db.inserts[0][2], 2)
  })

  test('signo incorrecto → no inserta nada', async () => {
    const db = makeDb(
      { real_home_goals: 2, real_away_goals: 0 },
      [{ user_id: 'u1', pred_home_goals: 0, pred_away_goals: 1 }]
    )
    await scoreGroupMatch(MATCH_ID, db)
    assert.equal(db.inserts.length, 0)
  })

  test('múltiples predicciones — exacto, signo, fallo', async () => {
    const db = makeDb(
      { real_home_goals: 2, real_away_goals: 1 },
      [
        { user_id: 'u1', pred_home_goals: 2, pred_away_goals: 1 }, // exacto → 5
        { user_id: 'u2', pred_home_goals: 1, pred_away_goals: 0 }, // signo → 2
        { user_id: 'u3', pred_home_goals: 0, pred_away_goals: 2 }, // fallo → 0
      ]
    )
    await scoreGroupMatch(MATCH_ID, db)
    assert.equal(db.inserts.length, 2)
    assert.equal(db.inserts[0][2], 5) // u1
    assert.equal(db.inserts[1][2], 2) // u2
  })

  test('sin predicciones → no inserta nada', async () => {
    const db = makeDb({ real_home_goals: 1, real_away_goals: 0 }, [])
    await scoreGroupMatch(MATCH_ID, db)
    assert.equal(db.inserts.length, 0)
  })

  test('partido sin resultado → lanza error y hace rollback', async () => {
    const db = fakeDb([{ rows: [{ real_home_goals: null, real_away_goals: null }] }])
    await assert.rejects(
      () => scoreGroupMatch(MATCH_ID, db),
      /Match has no result yet/
    )
  })
})

// ─── scoreKnockoutSlot ────────────────────────────────────────────────────────
// Puntúa CLASIFICACIÓN: el equipo predicho debe estar en el slot (local o visitante).
// Se llama cuando los equipos del slot son confirmados, no cuando se juega el partido.

describe('scoreKnockoutSlot', () => {

  test('equipo local en el slot acertado → 5 pts (R32)', async () => {
    const db = fakeDb([
      { rows: [{ stage: 'round_of_32', home_team_id: 'team-a', away_team_id: 'team-b' }] },
      { rows: [{ points_classify: 5 }] },
      { rows: [{ user_id: 'u1', pred_winner_id: 'team-a' }] },
    ])
    await scoreKnockoutSlot(SLOT_ID, db)
    assert.equal(db.inserts.length, 1)
    assert.equal(db.inserts[0][3], 5)
  })

  test('equipo visitante en el slot acertado → 10 pts (R16)', async () => {
    const db = fakeDb([
      { rows: [{ stage: 'round_of_16', home_team_id: 'team-a', away_team_id: 'team-b' }] },
      { rows: [{ points_classify: 10 }] },
      { rows: [{ user_id: 'u1', pred_winner_id: 'team-b' }] },
    ])
    await scoreKnockoutSlot(SLOT_ID, db)
    assert.equal(db.inserts.length, 1)
    assert.equal(db.inserts[0][3], 10)
  })

  test('equipo NO en el slot → no inserta nada', async () => {
    const db = fakeDb([
      { rows: [{ stage: 'round_of_16', home_team_id: 'team-a', away_team_id: 'team-b' }] },
      { rows: [{ points_classify: 10 }] },
      { rows: [{ user_id: 'u1', pred_winner_id: 'team-c' }] },
    ])
    await scoreKnockoutSlot(SLOT_ID, db)
    assert.equal(db.inserts.length, 0)
  })

  test('múltiples predicciones — local, visitante, fuera del slot', async () => {
    const db = fakeDb([
      { rows: [{ stage: 'round_of_32', home_team_id: 'team-a', away_team_id: 'team-b' }] },
      { rows: [{ points_classify: 5 }] },
      { rows: [
        { user_id: 'u1', pred_winner_id: 'team-a' }, // local → 5
        { user_id: 'u2', pred_winner_id: 'team-b' }, // visitante → 5
        { user_id: 'u3', pred_winner_id: 'team-c' }, // fuera → 0
      ]},
    ])
    await scoreKnockoutSlot(SLOT_ID, db)
    assert.equal(db.inserts.length, 2)
    assert.equal(db.inserts[0][3], 5) // u1
    assert.equal(db.inserts[1][3], 5) // u2
  })

  test('Final — ambos finalistas puntúan (35 pts c/u)', async () => {
    const db = fakeDb([
      { rows: [{ stage: 'final', home_team_id: 'team-a', away_team_id: 'team-b' }] },
      { rows: [{ points_classify: 35 }] },
      { rows: [
        { user_id: 'u1', pred_winner_id: 'team-a' }, // → 35
        { user_id: 'u2', pred_winner_id: 'team-b' }, // → 35
        { user_id: 'u3', pred_winner_id: 'team-c' }, // → 0
      ]},
    ])
    await scoreKnockoutSlot(SLOT_ID, db)
    assert.equal(db.inserts.length, 2)
    assert.equal(db.inserts[0][3], 35) // u1
    assert.equal(db.inserts[1][3], 35) // u2
  })

  test('solo un equipo confirmado (away null) — puntúa si lo predijiste', async () => {
    const db = fakeDb([
      { rows: [{ stage: 'round_of_16', home_team_id: 'team-a', away_team_id: null }] },
      { rows: [{ points_classify: 10 }] },
      { rows: [
        { user_id: 'u1', pred_winner_id: 'team-a' }, // confirmado → 10
        { user_id: 'u2', pred_winner_id: 'team-b' }, // no confirmado aún → 0
      ]},
    ])
    await scoreKnockoutSlot(SLOT_ID, db)
    assert.equal(db.inserts.length, 1)
    assert.equal(db.inserts[0][3], 10)
  })

  test('ningún equipo en el slot aún → no puntúa', async () => {
    const db = fakeDb([
      { rows: [{ stage: 'round_of_16', home_team_id: null, away_team_id: null }] },
    ])
    await scoreKnockoutSlot(SLOT_ID, db)
    assert.equal(db.inserts.length, 0)
  })

  test('slot no encontrado → lanza error', async () => {
    const db = fakeDb([{ rows: [] }])
    await assert.rejects(
      () => scoreKnockoutSlot(SLOT_ID, db),
      /Slot not found/
    )
  })
})

// ─── scoreChampion ────────────────────────────────────────────────────────────

describe('scoreChampion', () => {
  test('acierta el campeón → 50 pts', async () => {
    const db = fakeDb([
      { rows: [{ real_winner_id: 'team-a' }] },
      { rows: [{ points_champion: 50 }] },
      { rows: [{ user_id: 'u1' }, { user_id: 'u2' }] },
    ])
    await scoreChampion(db)
    assert.equal(db.inserts.length, 2)
    assert.equal(db.inserts[0][1], 50) // u1
    assert.equal(db.inserts[1][1], 50) // u2
  })

  test('nadie acierta el campeón → no inserta nada', async () => {
    const db = fakeDb([
      { rows: [{ real_winner_id: 'team-a' }] },
      { rows: [{ points_champion: 50 }] },
      { rows: [] },
    ])
    await scoreChampion(db)
    assert.equal(db.inserts.length, 0)
  })

  test('final sin resultado → lanza error', async () => {
    const db = fakeDb([{ rows: [] }])
    await assert.rejects(
      () => scoreChampion(db),
      /Final result not yet confirmed/
    )
  })
})
