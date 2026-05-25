import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getOutcome, scoreGroupPrediction, scoreKnockoutPick } from '../services/scoring.utils.js'

const POINTS_SIGN  = 2
const POINTS_EXACT = 3

// ─── getOutcome ───────────────────────────────────────────────────────────────

describe('getOutcome', () => {
  test('home win', () => assert.equal(getOutcome(2, 0), 'home'))
  test('away win', () => assert.equal(getOutcome(0, 1), 'away'))
  test('draw',     () => assert.equal(getOutcome(1, 1), 'draw'))
  test('0-0 draw', () => assert.equal(getOutcome(0, 0), 'draw'))
})

// ─── scoreGroupPrediction ─────────────────────────────────────────────────────

describe('scoreGroupPrediction', () => {
  describe('resultado exacto', () => {
    test('1-0 exacto → 5 pts',  () => assert.equal(scoreGroupPrediction(1, 0, 1, 0, POINTS_SIGN, POINTS_EXACT), 5))
    test('0-0 exacto → 5 pts',  () => assert.equal(scoreGroupPrediction(0, 0, 0, 0, POINTS_SIGN, POINTS_EXACT), 5))
    test('3-2 exacto → 5 pts',  () => assert.equal(scoreGroupPrediction(3, 2, 3, 2, POINTS_SIGN, POINTS_EXACT), 5))
    test('0-3 exacto → 5 pts',  () => assert.equal(scoreGroupPrediction(0, 3, 0, 3, POINTS_SIGN, POINTS_EXACT), 5))
  })

  describe('signo correcto, resultado no exacto', () => {
    test('predice 1-0, real 2-0 (victoria local) → 2 pts',  () => assert.equal(scoreGroupPrediction(1, 0, 2, 0, POINTS_SIGN, POINTS_EXACT), 2))
    test('predice 0-1, real 0-3 (victoria visitante) → 2 pts', () => assert.equal(scoreGroupPrediction(0, 1, 0, 3, POINTS_SIGN, POINTS_EXACT), 2))
    test('predice 1-1, real 2-2 (empate) → 2 pts',          () => assert.equal(scoreGroupPrediction(1, 1, 2, 2, POINTS_SIGN, POINTS_EXACT), 2))
    test('predice 1-1, real 0-0 (empate) → 2 pts',          () => assert.equal(scoreGroupPrediction(1, 1, 0, 0, POINTS_SIGN, POINTS_EXACT), 2))
  })

  describe('signo incorrecto', () => {
    test('predice 1-0, real 0-1 → 0 pts',  () => assert.equal(scoreGroupPrediction(1, 0, 0, 1, POINTS_SIGN, POINTS_EXACT), 0))
    test('predice 1-0, real 1-1 → 0 pts',  () => assert.equal(scoreGroupPrediction(1, 0, 1, 1, POINTS_SIGN, POINTS_EXACT), 0))
    test('predice 1-1, real 2-1 → 0 pts',  () => assert.equal(scoreGroupPrediction(1, 1, 2, 1, POINTS_SIGN, POINTS_EXACT), 0))
    test('predice 0-1, real 1-0 → 0 pts',  () => assert.equal(scoreGroupPrediction(0, 1, 1, 0, POINTS_SIGN, POINTS_EXACT), 0))
    test('predice 0-1, real 0-0 → 0 pts',  () => assert.equal(scoreGroupPrediction(0, 1, 0, 0, POINTS_SIGN, POINTS_EXACT), 0))
  })
})

// ─── scoreKnockoutPick ────────────────────────────────────────────────────────
// Lógica uniforme para todas las rondas: puntúa si el equipo predicho
// está en el slot (como local O visitante), independientemente del ganador.

const TEAM_A = 'team-a'
const TEAM_B = 'team-b'
const TEAM_C = 'team-c'

describe('scoreKnockoutPick', () => {
  test('predice el equipo local → points_classify',    () =>
    assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_B, 5), 5))

  test('predice el equipo visitante → points_classify', () =>
    assert.equal(scoreKnockoutPick(TEAM_B, TEAM_A, TEAM_B, 10), 10))

  test('predice equipo fuera del slot → 0',             () =>
    assert.equal(scoreKnockoutPick(TEAM_C, TEAM_A, TEAM_B, 5), 0))

  test('solo home confirmado (away null) — predice home → points_classify', () =>
    assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, null, 5), 5))

  test('solo home confirmado (away null) — predice otro → 0',               () =>
    assert.equal(scoreKnockoutPick(TEAM_C, TEAM_A, null, 5), 0))

  test('R32:   5 pts', () => assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_B,  5),  5))
  test('R16:  10 pts', () => assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_B, 10), 10))
  test('QF:   15 pts', () => assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_B, 15), 15))
  test('SF:   25 pts', () => assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_B, 25), 25))
  test('Final: 35 pts (cualquier finalista)', () =>
    assert.equal(scoreKnockoutPick(TEAM_B, TEAM_A, TEAM_B, 35), 35))
})
