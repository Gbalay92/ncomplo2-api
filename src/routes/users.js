import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getUserTodayPredictions, getUserPredictions, getUserBracket } from '../controllers/users.controller.js'

const router = Router()
router.use(requireAuth)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function validateUserId(req, res, next) {
  if (!UUID_RE.test(req.params.userId)) {
    return res.status(400).json({ error: 'Invalid user ID' })
  }
  next()
}

router.get('/:userId/predictions/today', validateUserId, getUserTodayPredictions)
router.get('/:userId/predictions', validateUserId, getUserPredictions)
router.get('/:userId/bracket', validateUserId, getUserBracket)

export default router
