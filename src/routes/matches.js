import { Router } from 'express'
import { getMatches, getNextMatch, getTodayMatches } from '../controllers/matches.controller.js'

const router = Router()

router.get('/', getMatches)
router.get('/today', getTodayMatches)
router.get('/next', getNextMatch)

export default router
