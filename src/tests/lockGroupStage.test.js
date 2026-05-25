import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { makeAdminController } from '../controllers/admin.controller.js'
import { fakeDb } from './helpers/fakeDb.js'
import { fakeReq, fakeRes, fakeScoringFns } from './helpers/fakeHttp.js'

// Mock del servicio de clasificados — devuelve un mapa configurable
function fakeQualifiers(map = {}) {
  return { getRealQualifiersMap: async () => map }
}

describe('lockGroupStage', () => {

  test('hay partidos sin resultado → 409', async () => {
    const db = fakeDb([
      { rows: [{ count: '3' }] }, // SELECT COUNT → 3 partidos pendientes
    ])
    const { lockGroupStage } = makeAdminController(db, {}, fakeQualifiers())
    const res = fakeRes()
    await lockGroupStage(fakeReq(), res)

    assert.equal(res._status, 409)
    assert.match(res._body.error, /3 group match/)
  })

  test('1 partido pendiente → mensaje incluye el número', async () => {
    const db = fakeDb([
      { rows: [{ count: '1' }] },
    ])
    const { lockGroupStage } = makeAdminController(db, {}, fakeQualifiers())
    const res = fakeRes()
    await lockGroupStage(fakeReq(), res)

    assert.equal(res._status, 409)
    assert.match(res._body.error, /1 group match/)
  })

  test('todos los partidos con resultado → 200, devuelve los clasificados', async () => {
    const qualMap = {
      '1A': 'team-a1', '2A': 'team-a2',
      '1B': 'team-b1', '2B': 'team-b2',
      '3rd_1': 'team-c3',
    }

    const db = fakeDb([
      { rows: [{ count: '0' }] }, // COUNT → 0 pendientes
      // SELECT knockout_slots WHERE stage = 'round_of_32'
      { rows: [
        { id: 'slot-1', slot_label: 'R32-1', home_source: '1A', away_source: '2B' },
        { id: 'slot-2', slot_label: 'R32-2', home_source: '1B', away_source: '2A' },
      ]},
      // UPDATE tournament_settings
      { rows: [] },
    ])

    const { scoring } = fakeScoringFns()
    const { lockGroupStage } = makeAdminController(db, scoring, fakeQualifiers(qualMap))
    const res = fakeRes()
    await lockGroupStage(fakeReq(), res)

    assert.equal(res._status, 200)
    assert.equal(res._body.message, 'Group stage locked. Round of 32 matchups seeded.')
    assert.deepEqual(res._body.qualifiers, qualMap)
  })

  test('los slots de R32 se insertan con los equipos correctos del mapa', async () => {
    const qualMap = {
      '1A': 'team-alpha',
      '2B': 'team-beta',
    }

    const db = fakeDb([
      { rows: [{ count: '0' }] },
      { rows: [{ id: 'slot-1', home_source: '1A', away_source: '2B' }] },
      { rows: [] }, // UPDATE tournament_settings
    ])

    const { scoring } = fakeScoringFns()
    const { lockGroupStage } = makeAdminController(db, scoring, fakeQualifiers(qualMap))
    const res = fakeRes()
    await lockGroupStage(fakeReq(), res)

    // fakeDb captura los INSERTs en db.inserts
    assert.equal(db.inserts.length, 1)
    const [slotId, homeId, awayId] = db.inserts[0]
    assert.equal(slotId, 'slot-1')
    assert.equal(homeId, 'team-alpha') // 1A del mapa
    assert.equal(awayId, 'team-beta')  // 2B del mapa
  })

  test('fuente sin clasificado en el mapa → null (slot aún no definido)', async () => {
    // Puede pasar si el home_source apunta a un 3rd que no clasificó
    const qualMap = {
      '1A': 'team-alpha',
      // '3rd_5' no existe en el mapa
    }

    const db = fakeDb([
      { rows: [{ count: '0' }] },
      { rows: [{ id: 'slot-x', home_source: '1A', away_source: '3rd_5' }] },
      { rows: [] },
    ])

    const { scoring } = fakeScoringFns()
    const { lockGroupStage } = makeAdminController(db, scoring, fakeQualifiers(qualMap))
    const res = fakeRes()
    await lockGroupStage(fakeReq(), res)

    assert.equal(res._status, 200)
    const [, homeId, awayId] = db.inserts[0]
    assert.equal(homeId, 'team-alpha')
    assert.equal(awayId, null) // fuente desconocida → null
  })

  test('múltiples slots → un INSERT por slot', async () => {
    const qualMap = {
      '1A': 'ta1', '2B': 'tb2',
      '1C': 'tc1', '2D': 'td2',
    }

    const db = fakeDb([
      { rows: [{ count: '0' }] },
      { rows: [
        { id: 's1', home_source: '1A', away_source: '2B' },
        { id: 's2', home_source: '1C', away_source: '2D' },
        { id: 's3', home_source: '1E', away_source: '2F' }, // sin clasificado → null
      ]},
      { rows: [] },
    ])

    const { scoring } = fakeScoringFns()
    const { lockGroupStage } = makeAdminController(db, scoring, fakeQualifiers(qualMap))
    const res = fakeRes()
    await lockGroupStage(fakeReq(), res)

    assert.equal(db.inserts.length, 3)
    assert.equal(db.inserts[0][0], 's1')
    assert.equal(db.inserts[1][0], 's2')
    assert.equal(db.inserts[2][0], 's3')
    assert.equal(db.inserts[2][1], null) // 1E no está en el mapa
    assert.equal(db.inserts[2][2], null) // 2F tampoco
  })

  test('tras sembrar R32, llama a scoreKnockoutSlot para cada slot', async () => {
    const qualMap = { '1A': 'ta1', '2B': 'tb2', '1C': 'tc1', '2D': 'td2' }

    const db = fakeDb([
      { rows: [{ count: '0' }] },
      { rows: [
        { id: 'slot-r32-1', home_source: '1A', away_source: '2B' },
        { id: 'slot-r32-2', home_source: '1C', away_source: '2D' },
      ]},
      { rows: [] }, // UPDATE tournament_settings
    ])

    const { scoring, calls } = fakeScoringFns()
    const { lockGroupStage } = makeAdminController(db, scoring, fakeQualifiers(qualMap))
    const res = fakeRes()
    await lockGroupStage(fakeReq(), res)

    assert.equal(res._status, 200)
    assert.equal(calls.length, 2)
    assert.equal(calls[0].fn, 'scoreKnockoutSlot')
    assert.equal(calls[0].args[0], 'slot-r32-1')
    assert.equal(calls[1].fn, 'scoreKnockoutSlot')
    assert.equal(calls[1].args[0], 'slot-r32-2')
  })
})
