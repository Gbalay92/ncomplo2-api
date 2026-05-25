export function getOutcome(home, away) {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

export function scoreGroupPrediction(predHome, predAway, realHome, realAway, pointsSign, pointsExact) {
  if (predHome === realHome && predAway === realAway) return pointsSign + pointsExact
  if (getOutcome(predHome, predAway) === getOutcome(realHome, realAway)) return pointsSign
  return 0
}

// Maps each knockout stage to the stage its winner advances into.
// Used by setKnockoutResult to know which classification to score next.
export const NEXT_STAGE = {
  round_of_32:   'round_of_16',
  round_of_16:   'quarter_final',
  quarter_final: 'semi_final',
  semi_final:    'final',
  // 'final' has no next stage — champion is scored separately
}
