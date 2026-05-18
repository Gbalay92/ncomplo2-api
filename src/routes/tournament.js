import { Router } from 'express'
import { getSettings } from '../controllers/tournament.controller.js'

const router = Router()

router.get('/settings', getSettings)

export default router
