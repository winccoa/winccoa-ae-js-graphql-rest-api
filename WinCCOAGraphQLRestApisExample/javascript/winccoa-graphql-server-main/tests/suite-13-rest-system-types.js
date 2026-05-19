// tests/suite-13-rest-system-types.js — REST /health, /restapi/system, /restapi/auth, /restapi/datapoint-types

const {
  rest,
  TEST_TYPE_REST,
  assertNotNull, assertEqual, assertIsArray, assertTypeOf, dig,
  writeResult
} = require('./helpers')

function enc(name) { return encodeURIComponent(name) }

module.exports = {
  name: 'Suite 13 — REST System, Auth & DatapointType Routes',

  async run(t) {

    // ── Health ────────────────────────────────────────────────────────────────
    await t('13.1', 'GET /health → status: "healthy"', async () => {
      const { status, body } = await rest('GET', '/health')
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.status, 'healthy', 'body.status')
    })

    // ── System ───────────────────────────────────────────────────────────────
    await t('13.2', 'GET /restapi/system/version → api + winccoa info', async () => {
      const { status, body } = await rest('GET', '/restapi/system/version')
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      const api = body.api || body
      assertNotNull(api, 'api version info')
      writeResult('13-02-rest-system-version', { status, body })
    })

    await t('13.3', 'GET /restapi/system/id → systemId', async () => {
      const { status, body } = await rest('GET', '/restapi/system/id')
      assertEqual(status, 200, 'HTTP status')
      const id = body.systemId ?? body.id ?? body
      if (!id && id !== 0) throw new Error(`Expected numeric systemId, got ${JSON.stringify(body)}`)
      writeResult('13-03-rest-system-id', { status, body })
    })

    await t('13.4', 'GET /restapi/system/name → systemName', async () => {
      const { status, body } = await rest('GET', '/restapi/system/name')
      assertEqual(status, 200, 'HTTP status')
      const name = body.systemName || body.name || body
      if (typeof name !== 'string')
        throw new Error(`Expected string systemName, got ${JSON.stringify(body)}`)
      writeResult('13-04-rest-system-name', { status, body })
    })

    await t('13.5', 'GET /restapi/system/redundancy/active → Boolean', async () => {
      const { status, body } = await rest('GET', '/restapi/system/redundancy/active')
      assertEqual(status, 200, 'HTTP status')
      const active = body.active ?? body.isReduActive ?? body
      if (typeof active !== 'boolean')
        throw new Error(`Expected boolean, got ${JSON.stringify(body)}`)
      writeResult('13-05-rest-system-redundancy', { status, body })
    })

    // ── Auth ─────────────────────────────────────────────────────────────────
    await t('13.6', 'POST /restapi/auth/login with wrong creds → 401', async () => {
      const { status, body } = await rest('POST', '/restapi/auth/login', {
        username: 'wrong',
        password: 'wrong'
      })
      assertEqual(status, 401, 'HTTP status')
      writeResult('13-06-rest-login-wrong-creds', { status, body })
    })

    // ── DatapointType routes ─────────────────────────────────────────────────
    await t('13.7', 'GET /restapi/datapoint-types → list of types', async () => {
      const { status, body } = await rest('GET', '/restapi/datapoint-types')
      assertEqual(status, 200, 'HTTP status')
      const list = body.dpTypes || body.types || body.dataPointTypes || body
      assertIsArray(list, 'datapoint-types list')
      if (list.length === 0) throw new Error('Expected at least one data point type')
      writeResult('13-07-rest-dptype-list', { status, count: list.length, types: list })
    })

    await t('13.8', 'GET /restapi/datapoint-types/ExampleDP_Float/structure → type structure', async () => {
      const { status, body } = await rest('GET', '/restapi/datapoint-types/ExampleDP_Float/structure')
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      const name = body.name || (body.structure && body.structure.name)
      if (!name) throw new Error(`Expected type name in response: ${JSON.stringify(body)}`)
      writeResult('13-08-rest-dptype-structure', { status, body })
    })

    // ── Create + delete lifecycle ────────────────────────────────────────────
    await t('13.9', `POST /restapi/datapoint-types (create ${TEST_TYPE_REST}) → 201`, async () => {
      await rest('DELETE', `/restapi/datapoint-types/${enc(TEST_TYPE_REST)}`).catch(() => {})
      const { status, body } = await rest('POST', '/restapi/datapoint-types', {
        startNode: {
          name: TEST_TYPE_REST,
          type: 'STRUCT',
          children: [{ name: 'value', type: 'FLOAT' }]
        }
      })
      assertEqual(status, 201, 'HTTP status')
      writeResult('13-09-rest-dptype-create', { typeName: TEST_TYPE_REST, status, body })
    })

    await t('13.10', `PUT /restapi/datapoint-types/${TEST_TYPE_REST} → change (add count INT)`, async () => {
      const { status, body } = await rest('PUT', `/restapi/datapoint-types/${enc(TEST_TYPE_REST)}`, {
        startNode: {
          name: TEST_TYPE_REST,
          type: 'STRUCT',
          children: [
            { name: 'value', type: 'FLOAT' },
            { name: 'count', type: 'INT' }
          ]
        }
      })
      assertEqual(status, 200, 'HTTP status')
      writeResult('13-10-rest-dptype-change', { typeName: TEST_TYPE_REST, status, body })
    })

    await t('13.11', `DELETE /restapi/datapoint-types/${TEST_TYPE_REST} → 200`, async () => {
      const { status, body } = await rest('DELETE', `/restapi/datapoint-types/${enc(TEST_TYPE_REST)}`)
      assertEqual(status, 200, 'HTTP status')
      writeResult('13-11-rest-dptype-delete', { typeName: TEST_TYPE_REST, status, body })
    })

    // ── Stats ─────────────────────────────────────────────────────────────────
    await t('13.12', 'GET /restapi/stats → 200 with stats', async () => {
      const { status, body } = await rest('GET', '/restapi/stats')
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      writeResult('13-12-rest-stats', { status, body })
    })

    // ── System — redundancy configured ────────────────────────────────────────
    await t('13.13', 'GET /restapi/system/redundancy/configured → Boolean', async () => {
      const { status, body } = await rest('GET', '/restapi/system/redundancy/configured')
      assertEqual(status, 200, 'HTTP status')
      const configured = body.configured ?? body
      if (typeof configured !== 'boolean')
        throw new Error(`Expected boolean, got ${JSON.stringify(body)}`)
      writeResult('13-13-rest-system-redundancy-configured', { status, body })
    })

    // ── DatapointType — references + usages ───────────────────────────────────
    await t('13.14', 'GET /restapi/datapoint-types/ExampleDP_Float/references → { dptNames, dpePaths }', async () => {
      const { status, body } = await rest('GET', '/restapi/datapoint-types/ExampleDP_Float/references')
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.dptNames ?? [], 'dptNames')
      assertIsArray(body.dpePaths ?? [], 'dpePaths')
      writeResult('13-14-rest-dptype-references', { dpt: 'ExampleDP_Float', status, body })
    })

    await t('13.15', 'GET /restapi/datapoint-types/ExampleDP_Float/usages → { dptNames, dpePaths }', async () => {
      const { status, body } = await rest('GET', '/restapi/datapoint-types/ExampleDP_Float/usages')
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.dptNames ?? [], 'dptNames')
      assertIsArray(body.dpePaths ?? [], 'dpePaths')
      writeResult('13-15-rest-dptype-usages', { reference: 'ExampleDP_Float', status, body })
    })

    // ── Extras ────────────────────────────────────────────────────────────────
    await t('13.16', 'GET /restapi/extras/test-dummy → { success: true, timestamp }', async () => {
      const { status, body } = await rest('GET', '/restapi/extras/test-dummy')
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
      assertNotNull(body.timestamp, 'body.timestamp')
      writeResult('13-16-rest-extras-test-dummy-get', { status, body })
    })

    await t('13.17', 'POST /restapi/extras/test-dummy → { success: true, timestamp }', async () => {
      const { status, body } = await rest('POST', '/restapi/extras/test-dummy', { foo: 'bar' })
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
      assertNotNull(body.timestamp, 'body.timestamp')
      writeResult('13-17-rest-extras-test-dummy-post', { status, body })
    })
  }
}
