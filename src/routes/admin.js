import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import {
  setGroupMatchResult,
  setKnockoutResult,
  lockPredictions,
  lockGroupStage,
  addToWhitelist,
  removeFromWhitelist,
  getWhitelist
} from '../controllers/admin.controller.js'

const router = Router()

router.use(requireAdmin)

router.post('/matches/group/:id/result', setGroupMatchResult)
router.post('/bracket/:slot_id/result', setKnockoutResult)
router.post('/lock-predictions', lockPredictions)
router.post('/lock-group-stage', lockGroupStage)

router.get('/whitelist', getWhitelist)
router.post('/whitelist', addToWhitelist)
router.delete('/whitelist/:email', removeFromWhitelist)

export default router
