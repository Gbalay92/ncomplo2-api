/**
 * Lightweight helpers that simulate Express req / res objects for controller tests.
 *
 * Usage:
 *   const req = fakeReq({ params: { id: '42' }, body: { home_goals: 2, away_goals: 1 } })
 *   const res = fakeRes()
 *   await myController(req, res)
 *   assert.equal(res._status, 200)
 *   assert.deepEqual(res._body, { id: 42, ... })
 */

export function fakeReq({ params = {}, body = {}, user = { sub: 'user-1' } } = {}) {
  return { params, body, user }
}

export function fakeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code
      return this
    },
    json(body) {
      this._body = body
      return this
    },
  }
  return res
}

/**
 * Small helper for building a mock scoring object that records calls.
 * Returns { scoring, calls } where calls is an array of { fn, args }.
 */
export function fakeScoringFns() {
  const calls = []
  const scoring = {
    scoreGroupMatch:        async (...args) => calls.push({ fn: 'scoreGroupMatch',        args }),
    scoreGroupQualification:async (...args) => calls.push({ fn: 'scoreGroupQualification',args }),
    scoreKnockoutAdvancement:async (...args) => calls.push({ fn: 'scoreKnockoutAdvancement',args }),
    scoreChampion:          async (...args) => calls.push({ fn: 'scoreChampion',          args }),
  }
  return { scoring, calls }
}
