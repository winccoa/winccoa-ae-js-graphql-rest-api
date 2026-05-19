// tests/suite-11-gql-auth.js — Authentication via GraphQL login mutation

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true'
const AUTH_MODE    = (process.env.AUTH_MODE || 'config').toLowerCase()

const {
  BASE_URL,
  gql,
  request,
  assert,
  assertEqual,
  assertNotNull, assertTypeOf, dig,
  writeResult
} = require('./helpers')

module.exports = {
  name: 'Suite 11 — Authentication (GraphQL)',

  async run(t) {

    await t('11.1', 'login with wrong credentials → GraphQL error', async () => {
      const res = await gql('mutation { login(username: "wrong", password: "wrong") { token expiresAt } }')
      assertNotNull(res.errors, 'errors array')
      if (!Array.isArray(res.errors) || res.errors.length === 0)
        throw new Error('Expected errors array to be non-empty')
      const msg = res.errors[0].message
      if (!msg.toLowerCase().includes('invalid'))
        throw new Error(`Expected "Invalid ..." error, got: ${msg}`)
      writeResult('11-01-login-wrong-creds', { errors: res.errors.map(e => e.message) })
    })

    await t('11.1b', 'login mixed with another mutation without auth → Unauthorized', async () => {
      if (DISABLE_AUTH) return 'DISABLE_AUTH=true — auth not enforced, skipping'

      const res = await gql(`
        mutation {
          login(username: "wrong", password: "wrong") { token expiresAt }
          extras { testDummy { success message timestamp } }
        }
      `)
      assertNotNull(res.errors, 'errors array')
      assert(
        res.errors.some(e => e.message === 'Unauthorized'),
        `Expected Unauthorized, got: ${JSON.stringify(res.errors)}`
      )
      writeResult('11-01b-login-mixed-mutation-blocked', { errors: res.errors.map(e => e.message) })
    })

    await t('11.2', 'login with correct creds → { token, expiresAt } (skipped if not configured)', async () => {
      const username = process.env.ADMIN_USERNAME
      const password = process.env.ADMIN_PASSWORD
      if (!username || !password) {
        writeResult('11-02-login-correct-creds', { skipped: true, note: 'ADMIN_USERNAME/ADMIN_PASSWORD env vars not set' })
        return 'ADMIN_USERNAME/ADMIN_PASSWORD env vars not set — skipping'
      }
      const res = await gql(
        `mutation { login(username: "${username}", password: "${password}") { token expiresAt } }`
      )
      assertNotNull(res.data, 'response.data')
      const payload = dig(res, 'data.login')
      assertNotNull(payload, 'login payload')
      assertTypeOf(payload.token, 'string', 'token')
      assertNotNull(payload.expiresAt, 'expiresAt')
      writeResult('11-02-login-correct-creds', { expiresAt: payload.expiresAt })
    })

    // ── WinCC OA user: demo / demo ─────────────────────────────────────────
    await t('11.3', 'login as WinCC OA user demo/demo → token returned', async () => {
      const res = await gql('mutation { login(username: "demo", password: "demo") { token expiresAt } }')
      if (res.errors) {
        // If WinCC OA user does not exist on this system, skip gracefully
        const msg = res.errors[0]?.message || ''
        if (msg.toLowerCase().includes('invalid')) {
          return 'demo user not found in WinCC OA — skipping'
        }
        throw new Error(`Unexpected error: ${msg}`)
      }
      assertNotNull(res.data, 'response.data')
      const payload = dig(res, 'data.login')
      assertNotNull(payload, 'login payload')
      assertTypeOf(payload.token, 'string', 'token type')
      assertNotNull(payload.expiresAt, 'expiresAt present')
      assert(new Date(payload.expiresAt).getTime() > Date.now(), 'expiresAt is in the future')
      writeResult('11-03-login-demo', { expiresAt: payload.expiresAt })
    })

    // ── WinCC OA user: demo — authenticated request works ──────────────────
    await t('11.4', 'demo session token can execute a query', async () => {
      const loginRes = await gql('mutation { login(username: "demo", password: "demo") { token expiresAt } }')
      if (loginRes.errors) return 'demo user not found in WinCC OA — skipping'

      const token = dig(loginRes, 'data.login.token')
      const { body } = await request('POST', `${BASE_URL}/graphql`,
        { query: '{ api { version } }' },
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      )
      // version query should succeed (or fail with an infra error, not Unauthorized)
      const unauthorized = body.errors?.some(e => e.message === 'Unauthorized')
      assert(!unauthorized, 'Should not get Unauthorized with valid demo token')
      writeResult('11-04-demo-query', { hasData: !!body.data, errors: body.errors?.map(e => e.message) })
    })

    // ── WinCC OA user: guest / GuestGuest123$ ─────────────────────────────
    await t('11.5', 'login as WinCC OA user guest → token returned', async () => {
      const res = await gql('mutation { login(username: "guest", password: "GuestGuest123$") { token expiresAt } }')
      if (res.errors) {
        const msg = res.errors[0]?.message || ''
        if (msg.toLowerCase().includes('invalid')) {
          return 'guest user not found in WinCC OA — skipping'
        }
        throw new Error(`Unexpected error: ${msg}`)
      }
      assertNotNull(res.data, 'response.data')
      const payload = dig(res, 'data.login')
      assertNotNull(payload, 'login payload')
      assertTypeOf(payload.token, 'string', 'token type')
      assertNotNull(payload.expiresAt, 'expiresAt present')
      assert(new Date(payload.expiresAt).getTime() > Date.now(), 'expiresAt is in the future')
      writeResult('11-05-login-guest', { expiresAt: payload.expiresAt })
    })

    // ── WinCC OA user: guest — authenticated request works ─────────────────
    await t('11.6', 'guest session token can execute a query', async () => {
      const loginRes = await gql('mutation { login(username: "guest", password: "GuestGuest123$") { token expiresAt } }')
      if (loginRes.errors) return 'guest user not found in WinCC OA — skipping'

      const token = dig(loginRes, 'data.login.token')
      const { body } = await request('POST', `${BASE_URL}/graphql`,
        { query: '{ api { version } }' },
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
      )
      const unauthorized = body.errors?.some(e => e.message === 'Unauthorized')
      assert(!unauthorized, 'Should not get Unauthorized with valid guest token')
      writeResult('11-06-guest-query', { hasData: !!body.data, errors: body.errors?.map(e => e.message) })
    })

    // ── WinCC OA user: wrong password ──────────────────────────────────────
    await t('11.7', 'login as demo with wrong password → GraphQL error', async () => {
      if (DISABLE_AUTH) return 'DISABLE_AUTH=true — auth not enforced, skipping'
      if (AUTH_MODE === 'winccoa' || AUTH_MODE === 'both')
        return 'AUTH_MODE includes winccoa — password not verified without server-side auth, skipping'
      const res = await gql('mutation { login(username: "demo", password: "wrongpassword") { token expiresAt } }')
      assertNotNull(res.errors, 'errors array present')
      assert(Array.isArray(res.errors) && res.errors.length > 0, 'errors array non-empty')
      const msg = res.errors[0].message
      assert(msg.toLowerCase().includes('invalid'), `Expected "Invalid ..." error, got: ${msg}`)
      writeResult('11-07-demo-wrong-password', { errors: res.errors.map(e => e.message) })
    })

    // ── demo and guest get independent sessions ────────────────────────────
    await t('11.8', 'demo and guest sessions are independent (logout one, other still valid)', async () => {
      if (DISABLE_AUTH) return 'DISABLE_AUTH=true — token invalidation not enforced, skipping'
      const demoLogin  = await gql('mutation { login(username: "demo",  password: "demo")  { token } }')
      const guestLogin = await gql('mutation { login(username: "guest", password: "GuestGuest123$") { token } }')

      if (demoLogin.errors)  return 'demo user not found in WinCC OA — skipping'
      if (guestLogin.errors) return 'guest user not found in WinCC OA — skipping'

      const demoToken  = dig(demoLogin,  'data.login.token')
      const guestToken = dig(guestLogin, 'data.login.token')

      // Logout demo
      const { body: logoutBody } = await request('POST', `${BASE_URL}/graphql`,
        { query: 'mutation { logout }' },
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${demoToken}` }
      )
      assertEqual(logoutBody.data?.logout, true, 'demo logout result')

      // Guest should still work
      const { body: guestBody } = await request('POST', `${BASE_URL}/graphql`,
        { query: '{ api { version } }' },
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${guestToken}` }
      )
      const guestUnauthorized = guestBody.errors?.some(e => e.message === 'Unauthorized')
      assert(!guestUnauthorized, 'guest session should still be valid after demo logout')

      // Demo should now be rejected
      const { body: demoBody } = await request('POST', `${BASE_URL}/graphql`,
        { query: '{ api { version } }' },
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${demoToken}` }
      )
      const demoUnauthorized = demoBody.errors?.some(e => e.message === 'Unauthorized')
      assert(demoUnauthorized, 'demo session should be rejected after logout')

      // Cleanup: logout guest too
      await request('POST', `${BASE_URL}/graphql`,
        { query: 'mutation { logout }' },
        { 'Content-Type': 'application/json', 'Authorization': `Bearer ${guestToken}` }
      )

      writeResult('11-08-independent-sessions', { demoLoggedOut: true, guestStillValid: !guestUnauthorized })
    })
  }
}
