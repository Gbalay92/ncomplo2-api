import pool from '../db/pool.js'

export async function getLeaderboard(req, res) {
  const { rows } = await pool.query(`
    SELECT l.user_id, l.display_name, l.total_points, l.group_points, l.knockout_points, l.rank,
           u.first_name, u.last_name
    FROM leaderboard l
    JOIN users u ON u.id = l.user_id
    ORDER BY rank
    LIMIT 100
  `)
  res.json(rows)
}
