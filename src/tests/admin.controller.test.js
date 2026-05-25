import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { makeAdminController } from '../controllers/admin.controller.js'
import { fakeDb } from './helpers/fakeDb.js'
import { fakeReq, fakeRes, fakeScoringFns } from './helpers/fakeHttp.js'

// ─── setGroupMatchResult ──────────────────────────────────────────────────────

describe('setGroupMatchResult', () => {

  test('goles nulos → 400', async () => {
    const { setGroupMatchResult } = makeAdminController(fakeDb())
    const req = fakeReq({ params: { id: '1' }, body: { home_goals: null, away_goals: 1 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 400)
    assert.match(res._body.error, /non-negative/)
  })

  test('goles negativos → 400', async () => {
    const { setGroupMatchResult } = makeAdminController(fakeDb())
    const req = fakeReq({ params: { id: '1' }, body: { home_goals: -1, away_goals: 0 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 400)
    assert.match(res._body.error, /non-negative/)
  })

  test('partido no encontrado → 404', async () => {
    const db = fakeDb([
      { rows: [] }, // UPDATE devuelve 0 filas
    ])
    const { setGroupMatchResult } = makeAdminController(db)
    const req = fakeReq({ params: { id: '999' }, body: { home_goals: 2, away_goals: 1 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 404)
    assert.equal(res._body.error, 'Match not found')
    assert.equal(db.updates.length, 1)
  })

  test('resultado válido → 200, llama al scorer, devuelve la fila', async () => {
    const updatedRow = { id: 5, real_home_goals: 2, real_away_goals: 1, is_locked: true }
    const db = fakeDb([
      { rows: [updatedRow] }, // UPDATE group_matches
    ])
    const { scoring, calls } = fakeScoringFns()
    const { setGroupMatchResult } = makeAdminController(db, scoring)
    const req = fakeReq({ params: { id: '5' }, body: { home_goals: 2, away_goals: 1 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 200)
    assert.deepEqual(res._body, updatedRow)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, 'scoreGroupMatch')
    assert.equal(calls[0].args[0], '5')
  })

  test('resultado 0-0 → válido (empate sin goles)', async () => {
    const updatedRow = { id: 7, real_home_goals: 0, real_away_goals: 0, is_locked: true }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setGroupMatchResult } = makeAdminController(db, scoring)
    const req = fakeReq({ params: { id: '7' }, body: { home_goals: 0, away_goals: 0 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 200)
    assert.equal(calls[0].fn, 'scoreGroupMatch')
  })
})

// ─── setKnockoutResult ────────────────────────────────────────────────────────

describe('setKnockoutResult', () => {

  test('goles nulos → 400', async () => {
    const { setKnockoutResult } = makeAdminController(fakeDb())
    const req = fakeReq({ params: { slot_id: 'slot-1' }, body: { home_goals: 1 } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 400)
    assert.match(res._body.error, /non-negative/)
  })

  test('empate sin winner_id → 400', async () => {
    const { setKnockoutResult } = makeAdminController(fakeDb())
    const req = fakeReq({
      params: { slot_id: 'slot-1' },
      body: { home_goals: 1, away_goals: 1 }, // empate, winner_id ausente
    })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 400)
    assert.match(res._body.error, /winner_id is required/)
  })

  test('slot no encontrado → 404', async () => {
    const db = fakeDb([
      { rows: [] }, // UPDATE devuelve 0 filas
    ])
    const { setKnockoutResult } = makeAdminController(db)
    const req = fakeReq({
      params: { slot_id: 'slot-999' },
      body: { home_goals: 2, away_goals: 0, winner_id: 'team-a' },
    })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 404)
    assert.equal(res._body.error, 'Bracket slot not found')
  })

  test('victoria clara (no final) → 200, llama a scoreKnockoutSlot, NO a scoreChampion', async () => {
    const updatedRow = {
      slot_id: 'slot-1', stage: 'round_of_16',
      real_home_goals: 2, real_away_goals: 0, real_winner_id: 'team-a',
    }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)
    const req = fakeReq({
      params: { slot_id: 'slot-1' },
      body: { home_goals: 2, away_goals: 0, winner_id: 'team-a' },
    })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 200)
    assert.deepEqual(res._body, updatedRow)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, 'scoreKnockoutSlot')
  })

  test('empate con winner_id → 200 (penaltis)', async () => {
    const updatedRow = {
      slot_id: 'slot-2', stage: 'quarter_final',
      real_home_goals: 1, real_away_goals: 1, real_winner_id: 'team-b',
    }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)
    const req = fakeReq({
      params: { slot_id: 'slot-2' },
      body: { home_goals: 1, away_goals: 1, winner_id: 'team-b' },
    })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 200)
    assert.equal(calls[0].fn, 'scoreKnockoutSlot')
    assert.equal(calls.length, 1) // scoreChampion no se llama (no es final)
  })

  test('final con ganador → llama a scoreKnockoutSlot Y scoreChampion', async () => {
    const updatedRow = {
      slot_id: 'slot-final', stage: 'final',
      real_home_goals: 1, real_away_goals: 0, real_winner_id: 'team-a',
    }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)
    const req = fakeReq({
      params: { slot_id: 'slot-final' },
      body: { home_goals: 1, away_goals: 0, winner_id: 'team-a' },
    })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 200)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].fn, 'scoreKnockoutSlot')
    assert.equal(calls[1].fn, 'scoreChampion')
  })

  test('final en empate sin winner_id → 400 antes de tocar la BD', async () => {
    const db = fakeDb() // cola vacía — no debe consultarse
    const { setKnockoutResult } = makeAdminController(db)
    const req = fakeReq({
      params: { slot_id: 'slot-final' },
      body: { home_goals: 0, away_goals: 0 }, // no winner_id
    })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 400)
    assert.equal(db.updates.length, 0)
  })
})

// ─── lockPredictions ──────────────────────────────────────────────────────────

describe('lockPredictions', () => {
  test('actualiza tournament_settings y devuelve mensaje', async () => {
    const db = fakeDb([{ rows: [] }]) // cola con respuesta para el UPDATE
    const { lockPredictions } = makeAdminController(db)
    const req = fakeReq()
    const res = fakeRes()
    await lockPredictions(req, res)
    assert.equal(res._status, 200)
    assert.equal(res._body.message, 'Predictions locked.')
  })
})

// ─── Whitelist ────────────────────────────────────────────────────────────────

describe('addToWhitelist', () => {
  test('sin email → 400', async () => {
    const { addToWhitelist } = makeAdminController(fakeDb())
    const req = fakeReq({ body: {} })
    const res = fakeRes()
    await addToWhitelist(req, res)
    assert.equal(res._status, 400)
    assert.equal(res._body.error, 'email is required')
  })

  test('email ya existe → 409', async () => {
    const db = fakeDb([
      { rows: [] }, // INSERT ON CONFLICT DO NOTHING → 0 filas devueltas
    ])
    const { addToWhitelist } = makeAdminController(db)
    const req = fakeReq({ body: { email: 'test@test.com' }, user: { display_name: 'admin' } })
    const res = fakeRes()
    await addToWhitelist(req, res)
    // INSERT is intercepted by fakeDb → tracked in inserts, returns { rows: [] }
    assert.equal(res._status, 409)
    assert.equal(res._body.error, 'Email already whitelisted')
  })

  test('email nuevo → 201', async () => {
    const newEntry = { id: 1, email: 'new@test.com', invited_by: 'admin' }
    // fakeDb intercepts INSERT → always returns { rows: [] }
    // We need to override this for INSERTs that RETURN rows.
    // Workaround: provide rows via queue (INSERT path in fakeDb doesn't use queue).
    // So we need a custom fakeDb variant here, or accept this limitation.
    // Instead, test via updates/query path by noting this is an edge case
    // of the current fakeDb. We'll verify the 409 path sufficiently above.
    // This test just confirms the happy path produces 201 when rows come back.
    const db = {
      query: async (sql) => {
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
          return { rows: [newEntry] }
        }
        return { rows: [] }
      },
      connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
      inserts: [],
      updates: [],
    }
    const { addToWhitelist } = makeAdminController(db)
    const req = fakeReq({ body: { email: 'new@test.com' }, user: { display_name: 'admin' } })
    const res = fakeRes()
    await addToWhitelist(req, res)
    assert.equal(res._status, 201)
    assert.deepEqual(res._body, newEntry)
  })
})

describe('removeFromWhitelist', () => {
  test('usuario ya registrado → 409', async () => {
    const db = fakeDb([
      { rows: [{ '?column?': 1 }] }, // SELECT 1 FROM users → hay usuario
    ])
    const { removeFromWhitelist } = makeAdminController(db)
    const req = fakeReq({ params: { email: 'existing@test.com' } })
    const res = fakeRes()
    await removeFromWhitelist(req, res)
    assert.equal(res._status, 409)
    assert.match(res._body.error, /already registered/)
  })

  test('email no registrado → 200 y elimina', async () => {
    const db = fakeDb([
      { rows: [] }, // SELECT 1 FROM users → no hay usuario
    ])
    const { removeFromWhitelist } = makeAdminController(db)
    const req = fakeReq({ params: { email: 'old@test.com' } })
    const res = fakeRes()
    await removeFromWhitelist(req, res)
    assert.equal(res._status, 200)
    assert.equal(res._body.message, 'Removed from whitelist')
  })
})
