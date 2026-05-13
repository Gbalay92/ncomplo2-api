import pool from '../db/pool.js'

export async function getLeaderboard(req, res) {
  const { rows } = await pool.query(`
    SELECT user_id, display_name, total_points, group_points, knockout_points, rank
    FROM leaderboard
    LIMIT 100
  `)
  res.json(rows)
}
