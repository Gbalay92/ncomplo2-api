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

export function scoreKnockoutPick(predWinnerId, realWinnerId, homeTeamId, awayTeamId, stage, pointsClassify) {
  if (stage === 'final') {
    if (predWinnerId === homeTeamId || predWinnerId === awayTeamId) return pointsClassify
    return 0
  }
  return predWinnerId === realWinnerId ? pointsClassify : 0
}
