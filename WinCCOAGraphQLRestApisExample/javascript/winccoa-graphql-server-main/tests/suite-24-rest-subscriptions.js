// tests/suite-24-rest-subscriptions.js — REST SSE subscription endpoints
//
// Tests the three Server-Sent Events subscription endpoints:
//   GET /restapi/v1/subscriptions/dp-connect
//   GET /restapi/v1/subscriptions/dp-query-connect-single
//   GET /restapi/v1/subscriptions/dp-query-connect-all
//
// Strategy for SSE tests:
//   1. Open an HTTP GET connection with streaming.
//   2. If answer=true (default), the server sends the current value immediately.
//   3. Wait for the first `data:` event line, parse the JSON, and assert shape.
//   4. Destroy the socket — this triggers req.on('close') → dpDisconnect cleanup.
//
// Negative tests use the regular `rest()` helper (server returns 400 JSON before
// upgrading to SSE, so regular HTTP response handling works fine).

const http = require('http')
const {
  BASE_URL, rest, gql,
  DP_FLOAT, DP_FLOAT_DP, DP_BIT,
  assertEqual, assertNotNull, assertIsArray, assertTypeOf,
  writeResult
} = require('./helpers')

// ─── SSE helper ──────────────────────────────────────────────────────────────

/**
 * Open an SSE connection and wait for the first `data:` event.
 * Resolves with the parsed JSON payload of the first event.
 * Rejects if no event arrives within timeoutMs.
 * Automatically destroys the connection after the first event (or on timeout).
 *
 * @param {string} path      - Path relative to BASE_URL, e.g. '/restapi/v1/subscriptions/dp-connect?...'
 * @param {number} timeoutMs - Max wait time (default 5000ms)
 * @returns {Promise<object>}
 */
function waitForFirstSseEvent(path, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${path}`)
    let settled = false

    const req = http.get(
      {
        hostname: url.hostname,
        port:     url.port || 80,
        path:     url.pathname + url.search,
        headers:  { Accept: 'text/event-stream' }
      },
      (res) => {
        // For non-SSE error responses (e.g. 400), read body and reject.
        if (res.statusCode !== 200) {
          let body = ''
          res.on('data', c => { body += c })
          res.on('end', () => {
            settled = true
            reject(new Error(`SSE connect failed with status ${res.statusCode}: ${body}`))
          })
          return
        }

        let buffer = ''

        const timer = setTimeout(() => {
          if (!settled) {
            settled = true
            req.destroy()
            reject(new Error(`SSE timed out after ${timeoutMs}ms — no event received`))
          }
        }, timeoutMs)

        res.on('data', (chunk) => {
          if (settled) return
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop() // keep any incomplete trailing line

          for (const line of lines) {
            if (line.startsWith('data: ') && !settled) {
              settled = true
              clearTimeout(timer)
              req.destroy()
              try {
                resolve(JSON.parse(line.slice(6)))
              } catch (err) {
                reject(new Error(`Failed to parse SSE event JSON: ${err.message} — raw: ${line}`))
              }
              return
            }
          }
        })

        res.on('error', (err) => {
          if (!settled) { settled = true; clearTimeout(timer); reject(err) }
        })
      }
    )

    req.on('error', (err) => {
      // ECONNRESET is expected when we call req.destroy() after receiving the event
      if (!settled) { settled = true; reject(err) }
    })
  })
}

// ─── Suite ────────────────────────────────────────────────────────────────────

module.exports = {
  name: 'Suite 24 — REST SSE Subscriptions (dp-connect / dp-query-connect)',

  async run(t) {

    const DPE = `${DP_FLOAT}:_online.._value`
    const QUERY = `SELECT '_online.._value' FROM '${DP_FLOAT_DP}'`

    // ── dp-connect: validation ────────────────────────────────────────────────

    await t('24.1', 'GET /restapi/subscriptions/dp-connect (missing dpeNames) → 400', async () => {
      const { status, body } = await rest('GET', '/restapi/subscriptions/dp-connect')
      assertEqual(status, 400, 'HTTP status')
      assertNotNull(body.error, 'body.error')
      writeResult('24-01-sse-dp-connect-missing-params', { status, body })
    })

    // ── dp-connect: single DPE, answer=true (immediate value) ────────────────

    await t('24.2', `GET /restapi/subscriptions/dp-connect?dpeNames=${DPE}&answer=true → first event`, async () => {
      const path = `/restapi/v1/subscriptions/dp-connect?dpeNames=${encodeURIComponent(DPE)}&answer=true`
      const event = await waitForFirstSseEvent(path)

      assertIsArray(event.dpeNames, 'event.dpeNames')
      assertNotNull(event.dpeNames[0], 'event.dpeNames[0]')
      assertIsArray(event.values, 'event.values')
      assertNotNull(event.type, 'event.type')
      assertEqual(event.error, null, 'event.error')

      writeResult('24-02-sse-dp-connect-single', event)
    })

    // ── dp-connect: multiple DPEs ─────────────────────────────────────────────

    await t('24.3', 'GET /restapi/subscriptions/dp-connect with multiple dpeNames → both in event', async () => {
      const DPE2 = `${DP_BIT}:_online.._value`
      const params = [
        `dpeNames=${encodeURIComponent(DPE)}`,
        `dpeNames=${encodeURIComponent(DPE2)}`,
        'answer=true'
      ].join('&')
      const path = `/restapi/v1/subscriptions/dp-connect?${params}`

      // With answer=true and two DPEs, dpConnect fires a single callback with all
      // requested DPEs and their current values.
      const event = await waitForFirstSseEvent(path)

      assertIsArray(event.dpeNames, 'event.dpeNames')
      assertIsArray(event.values, 'event.values')
      assertEqual(event.dpeNames.length, event.values.length, 'dpeNames.length === values.length')
      assertEqual(event.error, null, 'event.error')

      writeResult('24-03-sse-dp-connect-multi', event)
    })

    // ── dp-query-connect-single: validation ──────────────────────────────────

    await t('24.4', 'GET /restapi/subscriptions/dp-query-connect-single (missing query) → 400', async () => {
      const { status, body } = await rest('GET', '/restapi/subscriptions/dp-query-connect-single')
      assertEqual(status, 400, 'HTTP status')
      assertNotNull(body.error, 'body.error')
      writeResult('24-04-sse-dpqcs-missing-params', { status, body })
    })

    // ── dp-query-connect-single: happy path ───────────────────────────────────

    await t('24.5', `GET /restapi/subscriptions/dp-query-connect-single?query=... → first result`, async () => {
      const path = `/restapi/v1/subscriptions/dp-query-connect-single?query=${encodeURIComponent(QUERY)}&answer=true`
      const event = await waitForFirstSseEvent(path)

      assertIsArray(event.values, 'event.values')
      assertTypeOf(event.type, 'string', 'event.type')
      assertEqual(event.error, null, 'event.error')
      // Result table has at least a header row
      assertIsArray(event.values[0], 'event.values[0] (header row)')

      writeResult('24-05-sse-dpqcs-result', event)
    })

    // ── dp-query-connect-all: validation ─────────────────────────────────────

    await t('24.6', 'GET /restapi/subscriptions/dp-query-connect-all (missing query) → 400', async () => {
      const { status, body } = await rest('GET', '/restapi/subscriptions/dp-query-connect-all')
      assertEqual(status, 400, 'HTTP status')
      assertNotNull(body.error, 'body.error')
      writeResult('24-06-sse-dpqca-missing-params', { status, body })
    })

    // ── dp-query-connect-all: happy path ──────────────────────────────────────

    await t('24.7', `GET /restapi/subscriptions/dp-query-connect-all?query=... → first result`, async () => {
      const path = `/restapi/v1/subscriptions/dp-query-connect-all?query=${encodeURIComponent(QUERY)}&answer=true`
      const event = await waitForFirstSseEvent(path)

      assertIsArray(event.values, 'event.values')
      assertTypeOf(event.type, 'string', 'event.type')
      assertEqual(event.error, null, 'event.error')
      assertIsArray(event.values[0], 'event.values[0] (header row)')

      writeResult('24-07-sse-dpqca-result', event)
    })
  }
}
