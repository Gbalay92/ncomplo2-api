import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getMyPredictions, upsertPrediction, upsertManyPredictions } from '../controllers/predictions.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/', getMyPredictions)
router.put('/', upsertPrediction)
router.put('/bulk', upsertManyPredictions)

export default router
