import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getUserTodayPredictions, getUserPredictions, getUserBracket, getUserQualifiersHandler, getUserProfile } from '../controllers/users.controller.js'

const router = Router()
router.use(requireAuth)

router.get('/:userId/profile', getUserProfile)
router.get('/:userId/predictions/today', getUserTodayPredictions)
router.get('/:userId/predictions', getUserPredictions)
router.get('/:userId/bracket', getUserBracket)
router.get('/:userId/qualifiers', getUserQualifiersHandler)

export default router
