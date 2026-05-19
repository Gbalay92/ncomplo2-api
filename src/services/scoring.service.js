import pool from '../db/pool.js'

function getOutcome(home, away) {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

function scoreGroupPrediction(predHome, predAway, realHome, realAway, pointsSign, pointsExact) {
  if (predHome === realHome && predAway === realAway) return pointsSign + pointsExact
  if (getOutcome(predHome, predAway) === getOutcome(realHome, realAway)) return pointsSign
  return 0
}

// Called after admin enters a group match result.
// Deletes previous score_log entries for this match and reinserts recalculated ones.
export async function scoreGroupMatch(matchId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: matches } = await client.query(
      'SELECT real_home_goals, real_away_goals FROM group_matches WHERE id = $1',
      [matchId]
    )
    if (!matches.length || matches[0].real_home_goals == null) {
      throw new Error('Match has no result yet')
    }
    const { real_home_goals, real_away_goals } = matches[0]

    const { rows: rules } = await client.query(
      "SELECT points_sign, points_exact FROM scoring_rules WHERE stage = 'group'"
    )
    const { points_sign, points_exact } = rules[0]

    const { rows: predictions } = await client.query(
      'SELECT user_id, pred_home_goals, pred_away_goals FROM predictions WHERE match_id = $1',
      [matchId]
    )

    await client.query(
      "DELETE FROM score_log WHERE event_type = 'group_match' AND event_ref = $1",
      [matchId]
    )

    for (const pred of predictions) {
      const pts = scoreGroupPrediction(
        pred.pred_home_goals, pred.pred_away_goals,
        real_home_goals, real_away_goals,
        points_sign, points_exact
      )
      if (pts > 0) {
        await client.query(`
          INSERT INTO score_log (user_id, event_type, event_ref, stage, points)
          VALUES ($1, 'group_match', $2, 'group', $3)
        `, [pred.user_id, matchId, pts])
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Called after all matches in a knockout stage are resolved.
// R32–SF: scores correct predicted winners (points_classify each).
// Final: scores users whose final pick is either finalist (points_classify),
//        then scoreChampion() adds points_champion for the actual winner.
export async function scoreKnockoutRound(stage) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: rules } = await client.query(
      'SELECT points_classify FROM scoring_rules WHERE stage = $1',
      [stage]
    )
    if (!rules.length) throw new Error(`No scoring rule for stage: ${stage}`)
    const { points_classify } = rules[0]

    let realTeamIds

    if (stage === 'final') {
      // Award points_classify to users whose final pick reaches the final (either finalist)
      const { rows: finalists } = await client.query(`
        SELECT rb.home_team_id AS team_id FROM real_bracket rb
        JOIN knockout_slots ks ON ks.id = rb.slot_id WHERE ks.stage = 'final'
        UNION
        SELECT rb.away_team_id FROM real_bracket rb
        JOIN knockout_slots ks ON ks.id = rb.slot_id WHERE ks.stage = 'final'
      `)
      if (!finalists.length) throw new Error('Final teams not yet set')
      realTeamIds = new Set(finalists.map(r => r.team_id).filter(Boolean))
    } else {
      const { rows: realWinners } = await client.query(`
        SELECT rb.real_winner_id AS team_id
        FROM real_bracket rb
        JOIN knockout_slots ks ON ks.id = rb.slot_id
        WHERE ks.stage = $1 AND rb.real_winner_id IS NOT NULL
      `, [stage])
      if (!realWinners.length) throw new Error(`No real results for stage: ${stage}`)
      realTeamIds = new Set(realWinners.map(r => r.team_id))
    }

    const { rows: userPredictions } = await client.query(`
      SELECT pb.user_id, pb.pred_winner_id AS team_id
      FROM predicted_bracket pb
      JOIN knockout_slots ks ON ks.id = pb.slot_id
      WHERE ks.stage = $1 AND pb.pred_winner_id IS NOT NULL
    `, [stage])

    await client.query(
      "DELETE FROM score_log WHERE event_type = 'classification' AND event_ref = $1",
      [stage]
    )

    const byUser = {}
    for (const { user_id, team_id } of userPredictions) {
      if (!byUser[user_id]) byUser[user_id] = []
      byUser[user_id].push(team_id)
    }

    for (const [userId, predictedTeams] of Object.entries(byUser)) {
      const correct = predictedTeams.filter(id => realTeamIds.has(id)).length
      if (correct > 0) {
        await client.query(`
          INSERT INTO score_log (user_id, event_type, event_ref, stage, points)
          VALUES ($1, 'classification', $2, $3, $4)
        `, [userId, stage, stage, correct * points_classify])
      }
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Called after the final result is confirmed. Awards points_champion for the correct champion pick.
export async function scoreChampion() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: finalSlot } = await client.query(`
      SELECT rb.real_winner_id
      FROM real_bracket rb
      JOIN knockout_slots ks ON ks.id = rb.slot_id
      WHERE ks.stage = 'final' AND rb.real_winner_id IS NOT NULL
    `)
    if (!finalSlot.length) throw new Error('Final result not yet confirmed')
    const championId = finalSlot[0].real_winner_id

    const { rows: rules } = await client.query(
      "SELECT points_champion FROM scoring_rules WHERE stage = 'final'"
    )
    const { points_champion } = rules[0]

    const { rows: correct } = await client.query(`
      SELECT pb.user_id
      FROM predicted_bracket pb
      JOIN knockout_slots ks ON ks.id = pb.slot_id
      WHERE ks.stage = 'final' AND pb.pred_winner_id = $1
    `, [championId])

    await client.query(
      "DELETE FROM score_log WHERE event_type = 'champion' AND event_ref = 'final'"
    )

    for (const { user_id } of correct) {
      await client.query(`
        INSERT INTO score_log (user_id, event_type, event_ref, stage, points)
        VALUES ($1, 'champion', 'final', 'final', $2)
      `, [user_id, points_champion])
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Returns true when every match in a given knockout stage has a confirmed winner
export async function isStageComplete(stage) {
  const { rows } = await pool.query(`
    SELECT COUNT(*) AS total,
           COUNT(rb.real_winner_id) AS confirmed
    FROM knockout_slots ks
    LEFT JOIN real_bracket rb ON rb.slot_id = ks.id
    WHERE ks.stage = $1
  `, [stage])
  const { total, confirmed } = rows[0]
  return parseInt(total) > 0 && total === confirmed
}
