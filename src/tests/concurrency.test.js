/**
 * Concurrency tests — optimistic locking
 *
 * Scenario: two admins open the same form at the same moment, both see
 * updated_at = T0, and fire their PATCH at roughly the same time.
 *
 * Without protection the last write silently overwrites the first.
 * With optimistic locking the UPDATE adds "AND updated_at = $current" to the
 * WHERE clause; only one admin's transaction matches, the other gets 0 rows
 * back and receives a 409 before the scorer is ever called.
 *
 * Each concurrent request gets its own db instance (as it would in production,
 * where each HTTP request runs on its own pooled connection).
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { makeAdminController } from '../controllers/admin.controller.js'
import { fakeDb } from './helpers/fakeDb.js'
import { fakeReq, fakeRes, fakeScoringFns } from './helpers/fakeHttp.js'

const T0 = '2026-06-15T18:00:00.000Z' // timestamp ambos admins leyeron
const T1 = '2026-06-15T18:05:00.000Z' // timestamp tras la primera escritura

// ─── setGroupMatchResult — optimistic locking ─────────────────────────────────

describe('setGroupMatchResult — optimistic locking', () => {

  test('sin current_updated_at → last-write-wins (retrocompatible)', async () => {
    // El UPDATE siempre tiene éxito porque no hay condición de timestamp
    const db = fakeDb([{ rows: [{ id: '1', real_home_goals: 2, real_away_goals: 0 }] }])
    const { scoring } = fakeScoringFns()
    const { setGroupMatchResult } = makeAdminController(db, scoring)

    const req = fakeReq({ params: { id: '1' }, body: { home_goals: 2, away_goals: 0 } })
    const res = fakeRes()
    await setGroupMatchResult(req, res)

    assert.equal(res._status, 200)
  })

  test('current_updated_at correcto → 200, scorer llamado', async () => {
    const updatedRow = { id: '5', real_home_goals: 2, real_away_goals: 1, updated_at: T1 }
    const db = fakeDb([
      { rows: [updatedRow] }, // UPDATE con condición de timestamp → match
    ])
    const { scoring, calls } = fakeScoringFns()
    const { setGroupMatchResult } = makeAdminController(db, scoring)

    const req = fakeReq({
      params: { id: '5' },
      body: { home_goals: 2, away_goals: 1, current_updated_at: T0 },
    })
    const res = fakeRes()
    await setGroupMatchResult(req, res)

    assert.equal(res._status, 200)
    assert.deepEqual(res._body, updatedRow)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].fn, 'scoreGroupMatch')
  })

  test('current_updated_at obsoleto (ya fue editado) → 409, scorer NO llamado', async () => {
    const db = fakeDb([
      { rows: [] },               // UPDATE con timestamp obsoleto → 0 filas
      { rows: [{ id: '5' }] },    // SELECT EXISTS → el partido sí existe
    ])
    const { scoring, calls } = fakeScoringFns()
    const { setGroupMatchResult } = makeAdminController(db, scoring)

    const req = fakeReq({
      params: { id: '5' },
      body: { home_goals: 1, away_goals: 0, current_updated_at: T0 },
    })
    const res = fakeRes()
    await setGroupMatchResult(req, res)

    assert.equal(res._status, 409)
    assert.match(res._body.error, /modified by another admin/)
    assert.equal(calls.length, 0) // puntuación no recalculada
  })

  test('current_updated_at obsoleto + partido inexistente → 404', async () => {
    const db = fakeDb([
      { rows: [] }, // UPDATE → 0 filas
      { rows: [] }, // SELECT EXISTS → tampoco existe
    ])
    const { setGroupMatchResult } = makeAdminController(db)

    const req = fakeReq({
      params: { id: '999' },
      body: { home_goals: 1, away_goals: 0, current_updated_at: T0 },
    })
    const res = fakeRes()
    await setGroupMatchResult(req, res)

    assert.equal(res._status, 404)
    assert.equal(res._body.error, 'Match not found')
  })

  test('dos admins simultáneos — el primero gana, el segundo recibe 409', async () => {
    // Admin 1: su UPDATE llega primero → ok
    const db1 = fakeDb([{ rows: [{ id: '5', real_home_goals: 2, real_away_goals: 0, updated_at: T1 }] }])
    const { scoring: s1, calls: calls1 } = fakeScoringFns()

    // Admin 2: llega tarde, la fila ya tiene updated_at = T1 en la BD real.
    // Nuestro fakeDb simula que el UPDATE no matchea (0 filas) y que el partido existe.
    const db2 = fakeDb([
      { rows: [] },            // UPDATE → 0 filas (timestamp no coincide)
      { rows: [{ id: '5' }] }, // SELECT EXISTS → sí existe
    ])
    const { scoring: s2, calls: calls2 } = fakeScoringFns()

    const ctrl1 = makeAdminController(db1, s1)
    const ctrl2 = makeAdminController(db2, s2)

    const req1 = fakeReq({ params: { id: '5' }, body: { home_goals: 2, away_goals: 0, current_updated_at: T0 } })
    const req2 = fakeReq({ params: { id: '5' }, body: { home_goals: 3, away_goals: 1, current_updated_at: T0 } })
    const res1 = fakeRes()
    const res2 = fakeRes()

    await Promise.all([
      ctrl1.setGroupMatchResult(req1, res1),
      ctrl2.setGroupMatchResult(req2, res2),
    ])

    assert.equal(res1._status, 200)         // Admin 1 ganó
    assert.equal(res2._status, 409)         // Admin 2 rechazado
    assert.match(res2._body.error, /modified by another admin/)
    assert.equal(calls1.length, 1)          // scorer llamado una vez
    assert.equal(calls2.length, 0)          // no para el perdedor
  })
})

// ─── setKnockoutResult — optimistic locking ───────────────────────────────────

describe('setKnockoutResult — optimistic locking', () => {

  test('current_updated_at correcto → 200', async () => {
    const slotRow = {
      slot_id: 'slot-1', stage: 'round_of_16',
      real_home_goals: 2, real_away_goals: 0, real_winner_id: 'team-a', updated_at: T1,
    }
    const db = fakeDb([
      { rows: [slotRow] },                      // UPDATE real_bracket
      { rows: [{ slot_id: 'next-slot' }] },     // SELECT next slots
    ])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)

    const req = fakeReq({
      params: { slot_id: 'slot-1' },
      body: { home_goals: 2, away_goals: 0, winner_id: 'team-a', current_updated_at: T0 },
    })
    const res = fakeRes()
    await setKnockoutResult(req, res)

    assert.equal(res._status, 200)
    assert.equal(calls[0].fn, 'scoreKnockoutSlot')
  })

  test('current_updated_at obsoleto → 409, scorer NO llamado', async () => {
    const db = fakeDb([
      { rows: [] },                      // UPDATE → 0 filas
      { rows: [{ slot_id: 'slot-1' }] }, // SELECT EXISTS → existe
    ])
    const { scoring, calls } = fakeScoringFns()
    const { setKnockoutResult } = makeAdminController(db, scoring)

    const req = fakeReq({
      params: { slot_id: 'slot-1' },
      body: { home_goals: 1, away_goals: 0, winner_id: 'team-a', current_updated_at: T0 },
    })
    const res = fakeRes()
    await setKnockoutResult(req, res)

    assert.equal(res._status, 409)
    assert.match(res._body.error, /modified by another admin/)
    assert.equal(calls.length, 0)
  })

  test('dos admins simultáneos en la final — solo uno activa scoreChampion', async () => {
    const slotRow = { slot_id: 'slot-final', stage: 'final', real_winner_id: 'team-a', updated_at: T1 }

    const db1 = fakeDb([
      { rows: [slotRow] },                        // UPDATE real_bracket
      { rows: [] },                               // SELECT next slots → vacío (no hay slot tras la final)
    ])
    const db2 = fakeDb([
      { rows: [] },                               // UPDATE → 0 filas
      { rows: [{ slot_id: 'slot-final' }] },      // SELECT EXISTS → existe
    ])
    const { scoring: s1, calls: calls1 } = fakeScoringFns()
    const { scoring: s2, calls: calls2 } = fakeScoringFns()

    const ctrl1 = makeAdminController(db1, s1)
    const ctrl2 = makeAdminController(db2, s2)

    const req1 = fakeReq({
      params: { slot_id: 'slot-final' },
      body: { home_goals: 1, away_goals: 0, winner_id: 'team-a', current_updated_at: T0 },
    })
    const req2 = fakeReq({
      params: { slot_id: 'slot-final' },
      body: { home_goals: 1, away_goals: 0, winner_id: 'team-a', current_updated_at: T0 },
    })
    const res1 = fakeRes()
    const res2 = fakeRes()

    await Promise.all([
      ctrl1.setKnockoutResult(req1, res1),
      ctrl2.setKnockoutResult(req2, res2),
    ])

    assert.equal(res1._status, 200)
    assert.equal(res2._status, 409)

    // La final no tiene slot siguiente → solo scoreChampion para el ganador
    assert.equal(calls1.length, 1)
    assert.equal(calls1[0].fn, 'scoreChampion')

    // El perdedor no activa nada
    assert.equal(calls2.length, 0)
  })
})
