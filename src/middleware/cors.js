import cors from 'cors'

export function corsMiddleware() {
  return cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true
  })
}
