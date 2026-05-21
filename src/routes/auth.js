import { Router } from 'express'
import { register, login, logout, refresh, me } from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/auth.js'
import { loginLimiter, registerLimiter, refreshLimiter } from '../middleware/rateLimiter.js'

const router = Router()

router.post('/register', registerLimiter, register)
router.post('/login', loginLimiter, login)
router.post('/logout', logout)
router.post('/refresh', refreshLimiter, refresh)
router.get('/me', requireAuth, me)

export default router
