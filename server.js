import 'dotenv/config'
import app from './src/app.js'
import { scheduleKickoffs } from './src/jobs/autoKickoff.js'

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  scheduleKickoffs().catch(err => console.error('[autoKickoff] startup error:', err.message))
})
