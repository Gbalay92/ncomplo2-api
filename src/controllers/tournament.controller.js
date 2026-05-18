import pool from '../db/pool.js'

export async function getSettings(req, res) {
  const { rows } = await pool.query(
    'SELECT predictions_locked, group_stage_locked FROM tournament_settings WHERE id = true'
  )
  const settings = rows[0] ?? { predictions_locked: false, group_stage_locked: false }
  res.json(settings)
}
