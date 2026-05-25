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

const TEAM_A = 'team-a'
const TEAM_B = 'team-b'
const TEAM_C = 'team-c'

describe('scoreKnockoutPick — rondas normales', () => {
  test('acierta el clasificado → points_classify', () =>
    assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_A, TEAM_B, 'round_of_32', 5), 5))

  test('falla el clasificado → 0',                () =>
    assert.equal(scoreKnockoutPick(TEAM_B, TEAM_A, TEAM_A, TEAM_B, 'round_of_32', 5), 0))

  test('pick de equipo distinto → 0',             () =>
    assert.equal(scoreKnockoutPick(TEAM_C, TEAM_A, TEAM_A, TEAM_B, 'round_of_16', 10), 0))

  test('R16 acierta → 10 pts',  () => assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_A, TEAM_B, 'round_of_16',   10), 10))
  test('QF acierta → 15 pts',   () => assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_A, TEAM_B, 'quarter_final', 15), 15))
  test('SF acierta → 25 pts',   () => assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_A, TEAM_B, 'semi_final',    25), 25))
})

describe('scoreKnockoutPick — final (ambos finalistas puntúan)', () => {
  test('predice al ganador → 35 pts',        () =>
    assert.equal(scoreKnockoutPick(TEAM_A, TEAM_A, TEAM_A, TEAM_B, 'final', 35), 35))

  test('predice al perdedor (también finalista) → 35 pts', () =>
    assert.equal(scoreKnockoutPick(TEAM_B, TEAM_A, TEAM_A, TEAM_B, 'final', 35), 35))

  test('predice equipo que no llegó a la final → 0', () =>
    assert.equal(scoreKnockoutPick(TEAM_C, TEAM_A, TEAM_A, TEAM_B, 'final', 35), 0))
})
