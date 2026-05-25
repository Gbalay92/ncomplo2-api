import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { makeAdminController } from '../controllers/admin.controller.js'
import { fakeDb } from './helpers/fakeDb.js'
import { fakeReq, fakeRes, fakeScoringFns } from './helpers/fakeHttp.js'

// ─── setGroupMatchResult ──────────────────────────────────────────────────────

describe('setGroupMatchResult', () => {

  test('goles nulos → 400', async () => {
    const { setGroupMatchResult } = makeAdminController(fakeDb(), fakeScoringFns().scoring)
    const req = fakeReq({ params: { id: '1' }, body: { home_goals: null, away_goals: 1 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 400)
    assert.match(res._body.error, /non-negative/)
  })

  test('goles negativos → 400', async () => {
    const { setGroupMatchResult } = makeAdminController(fakeDb(), fakeScoringFns().scoring)
    const req = fakeReq({ params: { id: '1' }, body: { home_goals: -1, away_goals: 0 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 400)
  })

  test('partido no encontrado → 404', async () => {
    const db = fakeDb([{ rows: [] }])
    const { setGroupMatchResult } = makeAdminController(db, fakeScoringFns().scoring)
    const req = fakeReq({ params: { id: '999' }, body: { home_goals: 2, away_goals: 1 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 404)
  })

  test('resultado válido → 200, llama al scorer, devuelve la fila', async () => {
    const updatedRow = { id: '5', real_home_goals: 2, real_away_goals: 1, is_locked: true }
    const db = fakeDb([{ rows: [updatedRow] }])
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

  test('resultado 0-0 → válido', async () => {
    const db = fakeDb([{ rows: [{ id: '7' }] }])
    const { scoring } = fakeScoringFns()
    const { setGroupMatchResult } = makeAdminController(db, scoring)
    const req = fakeReq({ params: { id: '7' }, body: { home_goals: 0, away_goals: 0 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)
    assert.equal(res._status, 200)
  })
})

// ─── setKnockoutResult ────────────────────────────────────────────────────────

describe('setKnockoutResult', () => {

  test('goles nulos → 400', async () => {
    const { setKnockoutResult } = makeAdminController(fakeDb(), fakeScoringFns().scoring)
    const req = fakeReq({ params: { slot_id: 'slot-1' }, body: { home_goals: 1 } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 400)
  })

  test('empate sin winner_id → 400 antes de tocar la BD', async () => {
    const db = fakeDb()
    const { setKnockoutResult } = makeAdminController(db, fakeScoringFns().scoring)
    const req = fakeReq({ params: { slot_id: 'slot-1' }, body: { home_goals: 1, away_goals: 1 } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 400)
    assert.equal(db.updates.length, 0)
  })

  test('slot no encontrado → 404', async () => {
    const db = fakeDb([{ rows: [] }])
    const { setKnockoutResult } = makeAdminController(db, fakeScoringFns().scoring)
    const req = fakeReq({ params: { slot_id: 'slot-999' }, body: { home_goals: 2, away_goals: 0, winner_id: 'team-a' } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 404)
  })

  test('victoria en R32 → 200, llama scoreKnockoutAdvancement con winner y round_of_16', async () => {
    const updatedRow = { slot_id: 'slot-r32', stage: 'round_of_32', real_winner_id: 'team-a' }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)
    const req = fakeReq({ params: { slot_id: 'slot-r32' }, body: { home_goals: 2, away_goals: 0, winner_id: 'team-a' } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, 'scoreKnockoutAdvancement')
    assert.equal(calls[0].args[0], 'team-a')        // winner
    assert.equal(calls[0].args[1], 'round_of_16')   // next stage
  })

  test('victoria en penaltis (empate + winner_id) → scoreKnockoutAdvancement, NO scoreChampion', async () => {
    const updatedRow = { slot_id: 'slot-qf', stage: 'quarter_final', real_winner_id: 'team-b' }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)
    const req = fakeReq({ params: { slot_id: 'slot-qf' }, body: { home_goals: 1, away_goals: 1, winner_id: 'team-b' } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, 'scoreKnockoutAdvancement')
    assert.equal(calls[0].args[0], 'team-b')
    assert.equal(calls[0].args[1], 'semi_final')
  })

  test('resultado final con ganador → scoreKnockoutAdvancement(final) + scoreChampion', async () => {
    const updatedRow = { slot_id: 'slot-final', stage: 'final', real_winner_id: 'team-a' }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)
    const req = fakeReq({ params: { slot_id: 'slot-final' }, body: { home_goals: 1, away_goals: 0, winner_id: 'team-a' } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 200)
    // NEXT_STAGE['final'] === undefined → no scoreKnockoutAdvancement
    // BUT stage === 'final' && winner_id → scoreChampion
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, 'scoreChampion')
  })

  test('resultado final sin winner_id → ni scoreKnockoutAdvancement ni scoreChampion', async () => {
    const updatedRow = { slot_id: 'slot-final', stage: 'final', real_winner_id: null }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)
    const req = fakeReq({ params: { slot_id: 'slot-final' }, body: { home_goals: 2, away_goals: 0 } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 200)
    assert.equal(calls.length, 0)
  })

  test('semifinal winner → scoreKnockoutAdvancement con stage=final (finalista)', async () => {
    const updatedRow = { slot_id: 'slot-sf', stage: 'semi_final', real_winner_id: 'team-c' }
    const db = fakeDb([{ rows: [updatedRow] }])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)
    const req = fakeReq({ params: { slot_id: 'slot-sf' }, body: { home_goals: 2, away_goals: 1, winner_id: 'team-c' } })
    const res = fakeRes()
    await setKnockoutResult(req, res)
    assert.equal(res._status, 200)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, 'scoreKnockoutAdvancement')
    assert.equal(calls[0].args[0], 'team-c')
    assert.equal(calls[0].args[1], 'final')   // los finalistas se puntúan como clasificados al stage 'final'
  })
})

// ─── lockPredictions ──────────────────────────────────────────────────────────

describe('lockPredictions', () => {
  test('actualiza tournament_settings y devuelve mensaje', async () => {
    const db = fakeDb([{ rows: [] }])
    const { lockPredictions } = makeAdminController(db, fakeScoringFns().scoring)
    const res = fakeRes()
    await lockPredictions(fakeReq(), res)
    assert.equal(res._status, 200)
    assert.equal(res._body.message, 'Predictions locked.')
  })
})

// ─── Whitelist ────────────────────────────────────────────────────────────────

describe('addToWhitelist', () => {
  test('sin email → 400', async () => {
    const { addToWhitelist } = makeAdminController(fakeDb(), fakeScoringFns().scoring)
    const req = fakeReq({ body: {} })
    const res = fakeRes()
    await addToWhitelist(req, res)
    assert.equal(res._status, 400)
  })

  test('email ya existe → 409', async () => {
    const db = fakeDb([{ rows: [] }])
    const { addToWhitelist } = makeAdminController(db, fakeScoringFns().scoring)
    const req = fakeReq({ body: { email: 'test@test.com' }, user: { display_name: 'admin' } })
    const res = fakeRes()
    await addToWhitelist(req, res)
    assert.equal(res._status, 409)
  })

  test('email nuevo → 201', async () => {
    const newEntry = { id: 1, email: 'new@test.com', invited_by: 'admin' }
    const db = {
      query: async (sql) => {
        if (sql.trim().toUpperCase().startsWith('INSERT')) return { rows: [newEntry] }
        return { rows: [] }
      },
      connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }),
      inserts: [], updates: [],
    }
    const { addToWhitelist } = makeAdminController(db, fakeScoringFns().scoring)
    const req = fakeReq({ body: { email: 'new@test.com' }, user: { display_name: 'admin' } })
    const res = fakeRes()
    await addToWhitelist(req, res)
    assert.equal(res._status, 201)
    assert.deepEqual(res._body, newEntry)
  })
})

describe('removeFromWhitelist', () => {
  test('usuario ya registrado → 409', async () => {
    const db = fakeDb([{ rows: [{ '?column?': 1 }] }])
    const { removeFromWhitelist } = makeAdminController(db, fakeScoringFns().scoring)
    const req = fakeReq({ params: { email: 'existing@test.com' } })
    const res = fakeRes()
    await removeFromWhitelist(req, res)
    assert.equal(res._status, 409)
  })

  test('email no registrado → 200 y elimina', async () => {
    const db = fakeDb([{ rows: [] }])
    const { removeFromWhitelist } = makeAdminController(db, fakeScoringFns().scoring)
    const req = fakeReq({ params: { email: 'old@test.com' } })
    const res = fakeRes()
    await removeFromWhitelist(req, res)
    assert.equal(res._status, 200)
  })
})
