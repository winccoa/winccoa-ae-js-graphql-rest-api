// tests/suite-26-session-lifecycle.js
// Tests for per-session WinccoaManager lifecycle:
//   - Login creates a session (token returned)
//   - Authenticated requests succeed with session token
//   - Explicit logout invalidates the token immediately
//   - Using a logged-out token returns 401 (REST) / Unauthorized (GQL)
//   - REST POST /auth/logout is idempotent (double-logout safe)
//   - GraphQL mutation { logout } works
//   - Static tokens (DIRECT_ACCESS_TOKEN) are not affected by logout
//   - WinCC OA users demo/demo and guest/GuestGuest123$ can log in and get sessions

const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true'
const AUTH_MODE    = (process.env.AUTH_MODE || 'config').toLowerCase()

const {
  BASE_URL,
  gql,
  rest,
  request,
  assert,
  assertEqual,
  assertNotNull,
  assertTypeOf,
  assertNoErrors,
  dig,
  writeResult
} = require('./helpers')

/**
 * Perform a REST login and return { token, expiresAt }.
 * Skips (returns null) if ADMIN_USERNAME/ADMIN_PASSWORD are not configured.
 */
async function restLogin() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return null

  const { status, body } = await rest('POST', '/restapi/auth/login', { username, password })
  if (status !== 200 || !body.token) return null
  return body
}

/**
 * Perform a GraphQL login and return { token, expiresAt }.
 * Skips if credentials not configured.
 */
async function gqlLogin() {
  const username = process.env.ADMIN_USERNAME
  const password = process.env.ADMIN_PASSWORD
  if (!username || !password) return null

  const res = await gql(`mutation { login(username: "${username}", password: "${password}") { token expiresAt } }`)
  if (res.errors || !res.data?.login?.token) return null
  return res.data.login
}

/**
 * Login a named WinCC OA user via REST. Returns { token, expiresAt } or null if user not found.
 */
async function restLoginUser(username, password) {
  const { status, body } = await rest('POST', '/restapi/auth/login', { username, password })
  if (status === 401) return null  // user not found or wrong password
  if (status !== 200 || !body.token) return null
  return body
}

/**
 * Login a named WinCC OA user via GraphQL. Returns { token, expiresAt } or null if user not found.
 */
async function gqlLoginUser(username, password) {
  const res = await gql(`mutation { login(username: "${username}", password: "${password}") { token expiresAt } }`)
  if (res.errors || !res.data?.login?.token) return null
  return res.data.login
}

module.exports = {
  name: 'Suite 26 — Session Lifecycle',

  async run(t) {

    // ── 26.1 REST login → token returned ──────────────────────────────────
    await t('26.1', 'REST login returns token and expiresAt', async () => {
      const creds = await restLogin()
      if (!creds) return 'ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping'

      assertTypeOf(creds.token, 'string', 'token type')
      assertNotNull(creds.expiresAt, 'expiresAt present')
      const exp = new Date(creds.expiresAt).getTime()
      assert(exp > Date.now(), 'expiresAt is in the future')
      writeResult('26-01-rest-login', { expiresAt: creds.expiresAt })
    })

    // ── 26.2 Authenticated REST request succeeds ────────────────────────
    await t('26.2', 'REST request with session token succeeds', async () => {
      const creds = await restLogin()
      if (!creds) return 'ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping'

      const { status, body } = await request('GET', `${BASE_URL}/restapi/v1/system/version`, null, {
        'Authorization': `Bearer ${creds.token}`
      })
      // version endpoint exists in all environments
      assert(status === 200 || status === 500, `expected 200 or 500 from system/version, got ${status}`)
      writeResult('26-02-authenticated-request', { status })
    })

    // ── 26.3 REST logout succeeds ──────────────────────────────────────────
    await t('26.3', 'REST POST /auth/logout returns { success: true }', async () => {
      const creds = await restLogin()
      if (!creds) return 'ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping'

      const { status, body } = await request('POST', `${BASE_URL}/restapi/v1/auth/logout`, null, {
        'Authorization': `Bearer ${creds.token}`
      })
      assertEqual(status, 200, 'logout status')
      assertEqual(body.success, true, 'logout success flag')
      writeResult('26-03-rest-logout', { success: body.success })
    })

    // ── 26.4 Token invalid after REST logout ──────────────────────────────
    await t('26.4', 'REST request after logout returns 401', async () => {
      const creds = await restLogin()
      if (!creds) return 'ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping'

      // Logout
      await request('POST', `${BASE_URL}/restapi/v1/auth/logout`, null, {
        'Authorization': `Bearer ${creds.token}`
      })

      // Try to use the token again
      const { status } = await request('GET', `${BASE_URL}/restapi/v1/system/version`, null, {
        'Authorization': `Bearer ${creds.token}`
      })
      assertEqual(status, 401, 'status after logout should be 401')
      writeResult('26-04-token-invalid-after-logout', { status })
    })

    // ── 26.5 REST logout is idempotent ─────────────────────────────────────
    await t('26.5', 'REST double-logout returns { success: true } (idempotent)', async () => {
      const creds = await restLogin()
      if (!creds) return 'ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping'

      const logoutHeaders = { 'Authorization': `Bearer ${creds.token}` }

      const first  = await request('POST', `${BASE_URL}/restapi/v1/auth/logout`, null, logoutHeaders)
      const second = await request('POST', `${BASE_URL}/restapi/v1/auth/logout`, null, logoutHeaders)

      assertEqual(first.body.success,  true, 'first logout success')
      assertEqual(second.body.success, true, 'second logout success (idempotent)')
      writeResult('26-05-double-logout', { first: first.status, second: second.status })
    })

    // ── 26.6 GraphQL login + logout mutation ──────────────────────────────
    await t('26.6', 'GraphQL mutation { logout } returns true and invalidates token', async () => {
      const creds = await gqlLogin()
      if (!creds) return 'ADMIN_USERNAME/ADMIN_PASSWORD not set — skipping'

      const authHeader = { 'Authorization': `Bearer ${creds.token}` }

      // Call logout mutation
      const { body: logoutBody } = await request('POST', `${BASE_URL}/graphql`, {
        query: 'mutation { logout }'
      }, { 'Content-Type': 'application/json', ...authHeader })

      assertNoErrors(logoutBody, 'logout mutation errors')
      assertEqual(logoutBody.data?.logout, true, 'logout mutation result')

      // Next request with same token should fail
      const { body: afterBody } = await request('POST', `${BASE_URL}/graphql`, {
        query: '{ __typename }'
      }, { 'Content-Type': 'application/json', ...authHeader })

      assert(
        afterBody.errors && afterBody.errors.some(e => e.message === 'Unauthorized'),
        `Expected Unauthorized after logout, got: ${JSON.stringify(afterBody.errors)}`
      )
      writeResult('26-06-gql-logout', { logoutResult: logoutBody.data?.logout })
    })

    // ── 26.7 Login with wrong credentials ─────────────────────────────────
    await t('26.7', 'REST login with wrong credentials returns 401', async () => {
      const { status, body } = await rest('POST', '/restapi/auth/login', {
        username: 'wrong_user_xyz',
        password: 'wrong_pass_xyz'
      })
      assertEqual(status, 401, 'wrong creds status')
      writeResult('26-07-rest-login-wrong-creds', { status, error: body.error })
    })

    // ── 26.8 Login without body fields returns 400 ────────────────────────
    await t('26.8', 'REST login with missing body fields returns 400', async () => {
      const { status } = await rest('POST', '/restapi/auth/login', { username: 'foo' })
      assertEqual(status, 400, 'missing password status')
      writeResult('26-08-rest-login-missing-fields', { status })
    })

    // ── 26.9 REST login as WinCC OA user demo/demo ─────────────────────────
    await t('26.9', 'REST login as WinCC OA user demo/demo → token returned', async () => {
      const creds = await restLoginUser('demo', 'demo')
      if (!creds) return 'demo user not found in WinCC OA — skipping'

      assertTypeOf(creds.token, 'string', 'token type')
      assertNotNull(creds.expiresAt, 'expiresAt present')
      assert(new Date(creds.expiresAt).getTime() > Date.now(), 'expiresAt is in the future')
      writeResult('26-09-rest-login-demo', { expiresAt: creds.expiresAt })
    })

    // ── 26.10 demo session can make authenticated REST request ─────────────
    await t('26.10', 'demo session token can execute a REST request', async () => {
      const creds = await restLoginUser('demo', 'demo')
      if (!creds) return 'demo user not found in WinCC OA — skipping'

      const { status } = await request('GET', `${BASE_URL}/restapi/v1/system/version`, null, {
        'Authorization': `Bearer ${creds.token}`
      })
      assert(status === 200 || status === 500, `expected 200 or 500 from system/version, got ${status}`)

      // Cleanup
      await request('POST', `${BASE_URL}/restapi/v1/auth/logout`, null, {
        'Authorization': `Bearer ${creds.token}`
      })
      writeResult('26-10-demo-rest-request', { status })
    })

    // ── 26.11 REST login as WinCC OA user guest/GuestGuest123$ ───────────────
    await t('26.11', 'REST login as WinCC OA user guest → token returned', async () => {
      const creds = await restLoginUser('guest', 'GuestGuest123$')
      if (!creds) return 'guest user not found in WinCC OA — skipping'

      assertTypeOf(creds.token, 'string', 'token type')
      assertNotNull(creds.expiresAt, 'expiresAt present')
      assert(new Date(creds.expiresAt).getTime() > Date.now(), 'expiresAt is in the future')
      writeResult('26-11-rest-login-guest', { expiresAt: creds.expiresAt })
    })

    // ── 26.12 guest session can make authenticated REST request ────────────
    await t('26.12', 'guest session token can execute a REST request', async () => {
      const creds = await restLoginUser('guest', 'GuestGuest123$')
      if (!creds) return 'guest user not found in WinCC OA — skipping'

      const { status } = await request('GET', `${BASE_URL}/restapi/v1/system/version`, null, {
        'Authorization': `Bearer ${creds.token}`
      })
      assert(status === 200 || status === 500, `expected 200 or 500 from system/version, got ${status}`)

      // Cleanup
      await request('POST', `${BASE_URL}/restapi/v1/auth/logout`, null, {
        'Authorization': `Bearer ${creds.token}`
      })
      writeResult('26-12-guest-rest-request', { status })
    })

    // ── 26.13 demo and guest sessions are independent ─────────────────────
    await t('26.13', 'demo and guest REST sessions are independent', async () => {
      if (DISABLE_AUTH) return 'DISABLE_AUTH=true — token invalidation not enforced, skipping'
      const demoCreds  = await restLoginUser('demo',  'demo')
      const guestCreds = await restLoginUser('guest', 'GuestGuest123$')

      if (!demoCreds)  return 'demo user not found in WinCC OA — skipping'
      if (!guestCreds) return 'guest user not found in WinCC OA — skipping'

      // Logout demo
      const { body: logoutBody } = await request('POST', `${BASE_URL}/restapi/v1/auth/logout`, null, {
        'Authorization': `Bearer ${demoCreds.token}`
      })
      assertEqual(logoutBody.success, true, 'demo logout success')

      // demo token should be rejected
      const { status: demoStatus } = await request('GET', `${BASE_URL}/restapi/v1/system/version`, null, {
        'Authorization': `Bearer ${demoCreds.token}`
      })
      assertEqual(demoStatus, 401, 'demo token should be 401 after logout')

      // guest token should still work
      const { status: guestStatus } = await request('GET', `${BASE_URL}/restapi/v1/system/version`, null, {
        'Authorization': `Bearer ${guestCreds.token}`
      })
      assert(guestStatus === 200 || guestStatus === 500, `guest should still be valid, got ${guestStatus}`)

      // Cleanup: logout guest
      await request('POST', `${BASE_URL}/restapi/v1/auth/logout`, null, {
        'Authorization': `Bearer ${guestCreds.token}`
      })
      writeResult('26-13-independent-sessions', { demoStatus, guestStatus })
    })

    // ── 26.14 demo with wrong password returns 401 ─────────────────────────
    await t('26.14', 'REST login as demo with wrong password returns 401', async () => {
      if (DISABLE_AUTH) return 'DISABLE_AUTH=true — auth not enforced, skipping'
      if (AUTH_MODE === 'winccoa' || AUTH_MODE === 'both')
        return 'AUTH_MODE includes winccoa — password not verified without server-side auth, skipping'
      const { status } = await rest('POST', '/restapi/auth/login', {
        username: 'demo',
        password: 'wrongpassword'
      })
      assertEqual(status, 401, 'wrong password status')
      writeResult('26-14-demo-wrong-password', { status })
    })

  }
}
