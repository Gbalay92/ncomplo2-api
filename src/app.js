import express from 'express'
import cookieParser from 'cookie-parser'
import { corsMiddleware } from './middleware/cors.js'
import authRoutes from './routes/auth.js'
import matchesRoutes from './routes/matches.js'
import leaderboardRoutes from './routes/leaderboard.js'
import predictionsRoutes from './routes/predictions.js'
import bracketRoutes from './routes/bracket.js'
import adminRoutes from './routes/admin.js'
import tournamentRoutes from './routes/tournament.js'

const app = express()

app.use(corsMiddleware())
app.use(express.json())
app.use(cookieParser())

app.use('/auth', authRoutes)
app.use('/matches', matchesRoutes)
app.use('/leaderboard', leaderboardRoutes)
app.use('/predictions', predictionsRoutes)
app.use('/bracket', bracketRoutes)
app.use('/admin', adminRoutes)
app.use('/tournament', tournamentRoutes)

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
