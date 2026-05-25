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

// Scores whether a user's bracket pick is present in a knockout slot.
// Points are awarded for CLASSIFICATION — the predicted team being IN the slot
// (either as home or away), regardless of who wins the match.
// This uniform logic applies to all stages including the final.
export function scoreKnockoutPick(predWinnerId, homeTeamId, awayTeamId, pointsClassify) {
  if (predWinnerId === homeTeamId || predWinnerId === awayTeamId) return pointsClassify
  return 0
}
