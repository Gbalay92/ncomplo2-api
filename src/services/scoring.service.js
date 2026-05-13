import pool from '../db/pool.js'

function getOutcome(home, away) {
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

function scoreGroupPrediction(predHome, predAway, realHome, realAway) {
  if (predHome === realHome && predAway === realAway) return 3
  if (getOutcome(predHome, predAway) === getOutcome(realHome, realAway)) return 1
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

    const { rows: predictions } = await client.query(
      'SELECT user_id, pred_home_goals, pred_away_goals FROM predictions WHERE match_id = $1',
      [matchId]
    )

    // Delete previous log entries for this match (idempotent recalculation)
    await client.query(
      "DELETE FROM score_log WHERE event_type = 'group_match' AND event_ref = $1",
      [matchId]
    )

    for (const pred of predictions) {
      const pts = scoreGroupPrediction(
        pred.pred_home_goals, pred.pred_away_goals,
        real_home_goals, real_away_goals
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
// Scores how many teams each user correctly predicted for that stage.
export async function scoreKnockoutRound(stage) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get points_classify for this stage
    const { rows: rules } = await client.query(
      'SELECT points_classify, points_champion FROM scoring_rules WHERE stage = $1',
      [stage]
    )
    if (!rules.length) throw new Error(`No scoring rule for stage: ${stage}`)
    const { points_classify, points_champion } = rules[0]

    // Real winners for this stage (teams that won their match = appear as winner in their slot)
    const { rows: realWinners } = await client.query(`
      SELECT rb.real_winner_id AS team_id
      FROM real_bracket rb
      JOIN knockout_slots ks ON ks.id = rb.slot_id
      WHERE ks.stage = $1 AND rb.real_winner_id IS NOT NULL
    `, [stage])

    if (!realWinners.length) throw new Error(`No real results for stage: ${stage}`)
    const realTeamIds = new Set(realWinners.map(r => r.team_id))

    // All users and their predicted winners for this stage
    const { rows: userPredictions } = await client.query(`
      SELECT pb.user_id, pb.pred_winner_id AS team_id
      FROM predicted_bracket pb
      JOIN knockout_slots ks ON ks.id = pb.slot_id
      WHERE ks.stage = $1 AND pb.pred_winner_id IS NOT NULL
    `, [stage])

    // Delete previous log entries for this stage
    await client.query(
      "DELETE FROM score_log WHERE event_type = 'classification' AND event_ref = $1",
      [stage]
    )

    // Group predictions by user
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

// Called after the final result is confirmed.
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

    // Users who predicted this team as the final winner
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
        VALUES ($1, 'champion', 'final', 'final', 50)
      `, [user_id])
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
