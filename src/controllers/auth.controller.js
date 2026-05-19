import bcrypt from 'bcrypt'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import pool from '../db/pool.js'

const ACCESS_TTL = '15m'
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000

function issueTokens(user) {
  const payload = { sub: user.id, display_name: user.display_name, is_admin: user.is_admin }
  const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL })
  const refreshToken = crypto.randomBytes(40).toString('hex')
  return { accessToken, refreshToken }
}

function setTokenCookies(res, accessToken, refreshToken) {
  const prod = process.env.NODE_ENV === 'production'
  const base = { httpOnly: true, sameSite: prod ? 'none' : 'strict', secure: prod }
  res.cookie('access_token', accessToken, { ...base, maxAge: 15 * 60 * 1000 })
  res.cookie('refresh_token', refreshToken, { ...base, maxAge: REFRESH_TTL_MS, path: '/auth/refresh' })
}

async function saveRefreshToken(userId, refreshToken) {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS)
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hash, expiresAt]
  )
}

function formatUser(user) {
  return { id: user.id, display_name: user.display_name, first_name: user.first_name, last_name: user.last_name, is_admin: user.is_admin }
}

export async function register(req, res) {
  const { email, first_name, last_name, display_name, password } = req.body
  if (!email || !first_name || !last_name || !display_name || !password) {
    return res.status(400).json({ error: 'email, first_name, last_name, display_name, and password are required' })
  }

  const { rows: whitelist } = await pool.query(
    'SELECT 1 FROM email_whitelist WHERE email = $1', [email]
  )
  if (!whitelist.length) return res.status(403).json({ error: 'Email not in whitelist' })

  const { rows: existing } = await pool.query('SELECT 1 FROM users WHERE email = $1', [email])
  if (existing.length) return res.status(409).json({ error: 'Email already registered' })

  const password_hash = await bcrypt.hash(password, 12)
  const { rows } = await pool.query(
    `INSERT INTO users (email, first_name, last_name, display_name, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, first_name, last_name, display_name, is_admin`,
    [email, first_name, last_name, display_name, password_hash]
  )
  const user = rows[0]

  const { accessToken, refreshToken } = issueTokens(user)
  await saveRefreshToken(user.id, refreshToken)
  setTokenCookies(res, accessToken, refreshToken)

  res.status(201).json({ user: formatUser(user) })
}

export async function login(req, res) {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' })

  const { rows } = await pool.query(
    'SELECT id, first_name, last_name, display_name, password_hash, is_admin FROM users WHERE email = $1', [email]
  )
  if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' })

  const user = rows[0]
  const match = await bcrypt.compare(password, user.password_hash)
  if (!match) return res.status(401).json({ error: 'Invalid credentials' })

  const { accessToken, refreshToken } = issueTokens(user)
  await saveRefreshToken(user.id, refreshToken)
  setTokenCookies(res, accessToken, refreshToken)

  res.json({ user: formatUser(user) })
}

export async function logout(req, res) {
  const token = req.cookies?.refresh_token
  if (token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash])
  }
  res.clearCookie('access_token')
  res.clearCookie('refresh_token', { path: '/auth/refresh' })
  res.json({ message: 'Logged out' })
}

export async function refresh(req, res) {
  const token = req.cookies?.refresh_token
  if (!token) return res.status(401).json({ error: 'No refresh token' })

  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const { rows } = await pool.query(
    `SELECT rt.user_id AS id, u.first_name, u.last_name, u.display_name, u.is_admin
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.expires_at > now()`,
    [hash]
  )
  if (!rows.length) return res.status(401).json({ error: 'Invalid or expired refresh token' })

  const user = rows[0]

  await pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash])
  const { accessToken, refreshToken: newRefresh } = issueTokens(user)
  await saveRefreshToken(user.id, newRefresh)
  setTokenCookies(res, accessToken, newRefresh)

  res.json({ user: formatUser(user) })
}

export async function me(req, res) {
  const { rows } = await pool.query(
    'SELECT id, first_name, last_name, display_name, is_admin FROM users WHERE id = $1',
    [req.user.sub]
  )
  if (!rows.length) return res.status(404).json({ error: 'User not found' })
  res.json({ user: formatUser(rows[0]) })
}
