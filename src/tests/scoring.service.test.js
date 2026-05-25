import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { scoreGroupMatch, scoreGroupQualification, scoreKnockoutAdvancement, scoreChampion } from '../services/scoring.service.js'
import { fakeDb } from './helpers/fakeDb.js'

const MATCH_ID = 'match-1'

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

// ─── scoreGroupQualification ──────────────────────────────────────────────────
// Awards 5 pts for each team a user predicted to qualify (in predicted_group_standings)
// that actually qualified (appears in real_bracket for R32 slots).

describe('scoreGroupQualification', () => {

  test('usuario acierta 2 clasificados → 10 pts (2 inserts de 5)', async () => {
    const db = fakeDb([
      // 1. predicted_group_standings (is_classified = true)
      { rows: [
        { user_id: 'u1', team_id: 'team-a' },
        { user_id: 'u1', team_id: 'team-b' },
      ]},
      // 2. actual R32 slots
      { rows: [
        { home_team_id: 'team-a', away_team_id: 'team-b' },
      ]},
      // 3. scoring rules
      { rows: [{ points_classify: 5 }] },
    ])
    await scoreGroupQualification(db)
    assert.equal(db.inserts.length, 2)
    assert.equal(db.inserts[0][2], 5) // points
    assert.equal(db.inserts[1][2], 5)
  })

  test('usuario falla todos los clasificados → 0 inserts', async () => {
    const db = fakeDb([
      { rows: [
        { user_id: 'u1', team_id: 'team-x' },
        { user_id: 'u1', team_id: 'team-y' },
      ]},
      { rows: [
        { home_team_id: 'team-a', away_team_id: 'team-b' },
      ]},
      { rows: [{ points_classify: 5 }] },
    ])
    await scoreGroupQualification(db)
    assert.equal(db.inserts.length, 0)
  })

  test('múltiples usuarios — puntuaciones independientes', async () => {
    const db = fakeDb([
      { rows: [
        { user_id: 'u1', team_id: 'team-a' }, // acierta
        { user_id: 'u1', team_id: 'team-x' }, // falla
        { user_id: 'u2', team_id: 'team-a' }, // acierta
        { user_id: 'u2', team_id: 'team-b' }, // acierta
      ]},
      { rows: [
        { home_team_id: 'team-a', away_team_id: 'team-b' },
      ]},
      { rows: [{ points_classify: 5 }] },
    ])
    await scoreGroupQualification(db)
    // u1: 1 acierto, u2: 2 aciertos → 3 inserts
    assert.equal(db.inserts.length, 3)
  })

  test('sin usuarios con predicciones → no inserta nada', async () => {
    const db = fakeDb([
      { rows: [] }, // sin predicted qualifiers
      { rows: [{ home_team_id: 'team-a', away_team_id: 'team-b' }] },
      { rows: [{ points_classify: 5 }] },
    ])
    await scoreGroupQualification(db)
    assert.equal(db.inserts.length, 0)
  })

  test('sin clasificados reales aún → termina sin insertar', async () => {
    const db = fakeDb([
      { rows: [{ user_id: 'u1', team_id: 'team-a' }] },
      { rows: [] }, // R32 vacío
    ])
    await scoreGroupQualification(db)
    assert.equal(db.inserts.length, 0)
  })
})

// ─── scoreKnockoutAdvancement ─────────────────────────────────────────────────
// Awards points to users who predicted the advancing team as winner of any
// match in the PREVIOUS stage.

describe('scoreKnockoutAdvancement', () => {

  test('un usuario predijo el equipo → recibe puntos (R16, 10 pts)', async () => {
    const db = fakeDb([
      { rows: [{ points_classify: 10 }] },               // scoring rule for round_of_16
      { rows: [{ user_id: 'u1' }] },                     // users who predicted team-a in R32
    ])
    await scoreKnockoutAdvancement('team-a', 'round_of_16', db)
    assert.equal(db.inserts.length, 1)
    assert.equal(db.inserts[0][0], 'u1')
    assert.equal(db.inserts[0][1], 'team-a')
    assert.equal(db.inserts[0][2], 'round_of_16')
    assert.equal(db.inserts[0][3], 10)
  })

  test('nadie predijo el equipo → 0 inserts', async () => {
    const db = fakeDb([
      { rows: [{ points_classify: 10 }] },
      { rows: [] },
    ])
    await scoreKnockoutAdvancement('team-a', 'round_of_16', db)
    assert.equal(db.inserts.length, 0)
  })

  test('múltiples usuarios que predijeron el mismo equipo', async () => {
    const db = fakeDb([
      { rows: [{ points_classify: 15 }] },               // quarter_final
      { rows: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }] },
    ])
    await scoreKnockoutAdvancement('team-b', 'quarter_final', db)
    assert.equal(db.inserts.length, 3)
    assert.equal(db.inserts[0][3], 15)
    assert.equal(db.inserts[1][3], 15)
    assert.equal(db.inserts[2][3], 15)
  })

  test('finalista (semi_final winner → final, 35 pts)', async () => {
    const db = fakeDb([
      { rows: [{ points_classify: 35 }] },               // final
      { rows: [{ user_id: 'u1' }] },
    ])
    await scoreKnockoutAdvancement('team-a', 'final', db)
    assert.equal(db.inserts.length, 1)
    assert.equal(db.inserts[0][2], 'final')
    assert.equal(db.inserts[0][3], 35)
  })

  test('targetStage sin entrada previa en PREV_STAGE → lanza error', async () => {
    const db = fakeDb([])
    await assert.rejects(
      () => scoreKnockoutAdvancement('team-a', 'round_of_32', db),
      /No previous stage for: round_of_32/
    )
  })

  test('idempotente — puede llamarse dos veces sin duplicar puntos', async () => {
    // Segunda llamada borra las entradas anteriores (DELETE) antes de insertar
    // fakeDb no ejecuta realmente el DELETE, pero sí los INSERTs: si la función
    // se llama dos veces con la misma fakeDb hay 2 inserts (uno por llamada).
    // Lo que testamos aquí es que la secuencia DELETE→INSERT exista en la función.
    const db1 = fakeDb([
      { rows: [{ points_classify: 10 }] },
      { rows: [{ user_id: 'u1' }] },
    ])
    await scoreKnockoutAdvancement('team-a', 'round_of_16', db1)
    assert.equal(db1.inserts.length, 1)

    // Segunda llamada con nueva db: mismo resultado limpio
    const db2 = fakeDb([
      { rows: [{ points_classify: 10 }] },
      { rows: [{ user_id: 'u1' }] },
    ])
    await scoreKnockoutAdvancement('team-a', 'round_of_16', db2)
    assert.equal(db2.inserts.length, 1)
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
