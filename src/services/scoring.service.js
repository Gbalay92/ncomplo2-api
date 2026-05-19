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

// Called after each knockout result is saved.
// Scores the single slot immediately — safe to call multiple times as results
// are updated live. Uses slot_id as event_ref so each slot is independent.
export async function scoreKnockoutSlot(slotId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const { rows: slotRows } = await client.query(`
      SELECT ks.stage, rb.real_winner_id, rb.home_team_id, rb.away_team_id
      FROM knockout_slots ks
      JOIN real_bracket rb ON rb.slot_id = ks.id
      WHERE ks.id = $1
    `, [slotId])
    if (!slotRows.length) throw new Error('Slot not found')
    const { stage, real_winner_id, home_team_id, away_team_id } = slotRows[0]

    await client.query(
      "DELETE FROM score_log WHERE event_type = 'classification' AND event_ref = $1",
      [slotId]
    )

    // No winner yet (e.g. draw mid-match, penalties not decided) — nothing to score
    if (!real_winner_id) {
      await client.query('COMMIT')
      return
    }

    const { rows: rules } = await client.query(
      'SELECT points_classify FROM scoring_rules WHERE stage = $1',
      [stage]
    )
    if (!rules.length) throw new Error(`No scoring rule for stage: ${stage}`)
    const { points_classify } = rules[0]

    // Final: both finalists earn points_classify; other rounds: only the winner
    const scoringTeams = new Set(
      stage === 'final'
        ? [home_team_id, away_team_id].filter(Boolean)
        : [real_winner_id]
    )

    const { rows: predictions } = await client.query(`
      SELECT user_id, pred_winner_id
      FROM predicted_bracket
      WHERE slot_id = $1 AND pred_winner_id IS NOT NULL
    `, [slotId])

    for (const { user_id, pred_winner_id } of predictions) {
      if (scoringTeams.has(pred_winner_id)) {
        await client.query(`
          INSERT INTO score_log (user_id, event_type, event_ref, stage, points)
          VALUES ($1, 'classification', $2, $3, $4)
        `, [user_id, slotId, stage, points_classify])
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

