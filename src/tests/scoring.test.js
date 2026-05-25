import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getOutcome, scoreGroupPrediction, NEXT_STAGE } from '../services/scoring.utils.js'

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

// ─── NEXT_STAGE ───────────────────────────────────────────────────────────────

describe('NEXT_STAGE', () => {
  test('R32 → R16',      () => assert.equal(NEXT_STAGE['round_of_32'],   'round_of_16'))
  test('R16 → QF',       () => assert.equal(NEXT_STAGE['round_of_16'],   'quarter_final'))
  test('QF  → SF',       () => assert.equal(NEXT_STAGE['quarter_final'], 'semi_final'))
  test('SF  → Final',    () => assert.equal(NEXT_STAGE['semi_final'],    'final'))
  test('Final → sin siguiente', () => assert.equal(NEXT_STAGE['final'],  undefined))
})
