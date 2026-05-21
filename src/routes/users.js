import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getUserTodayPredictions, getUserPredictions, getUserBracket } from '../controllers/users.controller.js'

const router = Router()
router.use(requireAuth)

function validateUserId(req, res, next) {
  const id = parseInt(req.params.userId, 10)
  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid user ID' })
  }
  req.params.userId = id
  next()
}

router.get('/:userId/predictions/today', validateUserId, getUserTodayPredictions)
router.get('/:userId/predictions', validateUserId, getUserPredictions)
router.get('/:userId/bracket', validateUserId, getUserBracket)

export default router
