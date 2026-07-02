import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { getMyQualifiers, getMyBracket, saveMyBracket, getMyKnockoutScore } from '../controllers/bracket.controller.js'

const router = Router()

router.use(requireAuth)

router.get('/qualifiers', getMyQualifiers)
router.get('/knockout-score', getMyKnockoutScore)
router.get('/', getMyBracket)
router.post('/', saveMyBracket)

export default router
