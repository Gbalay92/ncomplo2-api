import jwt from 'jsonwebtoken'

export function requireAuth(req, res, next) {
  const token = req.cookies?.access_token
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' })
  }
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.is_admin) return res.status(403).json({ error: 'Forbidden' })
    next()
  })
}
