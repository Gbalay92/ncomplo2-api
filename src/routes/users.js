import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getUserTodayPredictions, getUserPredictions, getUserBracket } from '../controllers/users.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/:userId/predictions/today', getUserTodayPredictions)
router.get('/:userId/predictions', getUserPredictions)
router.get('/:userId/bracket', getUserBracket)

export default router
