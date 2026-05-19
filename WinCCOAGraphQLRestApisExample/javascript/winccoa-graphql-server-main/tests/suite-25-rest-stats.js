// tests/suite-25-rest-stats.js — REST /restapi/v1/stats endpoint

const {
  rest,
  assertEqual, assertNotNull, assertIsArray, assertTypeOf,
  writeResult
} = require('./helpers')

module.exports = {
  name: 'Suite 25 — REST Stats Endpoint',

  async run(t) {

    // ── Default (sortBy=name) ─────────────────────────────────────────────────

    await t('25.1', 'GET /restapi/stats → 200 with stats array', async () => {
      const { status, body } = await rest('GET', '/restapi/stats')
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.stats, 'body.stats')
      assertTypeOf(body.total, 'number', 'body.total')
      assertNotNull(body.sortBy, 'body.sortBy')
      assertEqual(body.sortBy, 'name', 'body.sortBy default')
      // Each entry must have name (string) and count (number)
      if (body.stats.length > 0) {
        assertTypeOf(body.stats[0].name, 'string', 'stats[0].name')
        assertTypeOf(body.stats[0].count, 'number', 'stats[0].count')
      }
      assertEqual(body.total, body.stats.length, 'body.total matches stats.length')
      writeResult('25-01-rest-stats-default', body)
    })

    // ── sortBy=count ──────────────────────────────────────────────────────────

    await t('25.2', 'GET /restapi/stats?sortBy=count → 200, sortBy echoed', async () => {
      const { status, body } = await rest('GET', '/restapi/stats?sortBy=count')
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.stats, 'body.stats')
      assertTypeOf(body.total, 'number', 'body.total')
      assertEqual(body.sortBy, 'count', 'body.sortBy')
      writeResult('25-02-rest-stats-by-count', body)
    })

    // ── sortBy=name ───────────────────────────────────────────────────────────

    await t('25.3', 'GET /restapi/stats?sortBy=name → 200, sortBy echoed', async () => {
      const { status, body } = await rest('GET', '/restapi/stats?sortBy=name')
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.stats, 'body.stats')
      assertTypeOf(body.total, 'number', 'body.total')
      assertEqual(body.sortBy, 'name', 'body.sortBy')
      writeResult('25-03-rest-stats-by-name', body)
    })

    // ── stats appear after an API call ────────────────────────────────────────

    await t('25.4', 'GET /restapi/stats → stats endpoint itself is tracked', async () => {
      // Fetch stats twice so that the /stats entry is present in the second response.
      await rest('GET', '/restapi/stats')
      const { status, body } = await rest('GET', '/restapi/stats')
      assertEqual(status, 200, 'HTTP status')
      const statsEntry = body.stats.find(s => s.name.includes('/stats'))
      assertNotNull(statsEntry, 'stats entry for /stats endpoint')
      if (statsEntry.count < 1) {
        throw new Error(`Expected /stats count >= 1, got ${statsEntry.count}`)
      }
      writeResult('25-04-rest-stats-self-tracking', body)
    })
  }
}
