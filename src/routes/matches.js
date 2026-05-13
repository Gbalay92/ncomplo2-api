import { Router } from 'express'
import { getMatches, getNextMatch } from '../controllers/matches.controller.js'

const router = Router()

router.get('/', getMatches)
router.get('/next', getNextMatch)

export default router
