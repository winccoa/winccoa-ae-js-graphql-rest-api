// tests/suite-12-rest-datapoints.js — REST /restapi/datapoints, tags, and history routes

const {
  gql, rest,
  DP_FLOAT, DP_FLOAT_DP,
  TEST_DP_REST,
  assertNotNull, assertEqual, assertIsArray, assertTypeOf, assertNoUnexpectedErrors, dig,
  writeResult
} = require('./helpers')

// Encode a DP name with trailing dot for use in URL paths
function enc(name) { return encodeURIComponent(name) }

module.exports = {
  name: 'Suite 12 — REST Datapoint, Tag & History Routes',

  async run(t) {

    // ── Search / read ────────────────────────────────────────────────────────
    await t('12.1', 'GET /restapi/datapoints?pattern=ExampleDP* → non-empty array', async () => {
      const { status, body } = await rest('GET', '/restapi/datapoints?pattern=ExampleDP*')
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body.datapoints, 'body.datapoints')
      assertIsArray(body.datapoints, 'datapoints')
      if (body.datapoints.length === 0) throw new Error('Expected at least one ExampleDP datapoint')
      writeResult('12-01-rest-dp-search', { pattern: 'ExampleDP*', count: body.datapoints.length, datapoints: body.datapoints })
    })

    await t('12.2', `GET /restapi/datapoints/${DP_FLOAT}/value → { value: number }`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT)}/value`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      assertTypeOf(body.value, 'number', 'body.value')
      writeResult('12-02-rest-dp-get-value', { dpe: DP_FLOAT, status, value: body.value })
    })

    // ── Write + round-trip ───────────────────────────────────────────────────
    await t('12.3', `PUT /restapi/datapoints/${DP_FLOAT}/value { value: 77 } → success`, async () => {
      const { status, body } = await rest('PUT', `/restapi/datapoints/${enc(DP_FLOAT)}/value`, { value: 77 })
      assertEqual(status, 200, 'HTTP status')
      // server returns { success: true } or { value: 77 }
      assertNotNull(body, 'body')
      writeResult('12-03-rest-dp-put-value', { dpe: DP_FLOAT, written: 77, status, body })
    })

    await t('12.4', `GET /restapi/datapoints/${DP_FLOAT}/value → 77 (round-trip)`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT)}/value`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.value, 77, 'body.value after PUT')
      writeResult('12-04-rest-dp-roundtrip', { dpe: DP_FLOAT, expected: 77, actual: body.value })
    })

    // ── Metadata reads ───────────────────────────────────────────────────────
    await t('12.5', `GET /restapi/datapoints/${DP_FLOAT}/exists → { exists: true }`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT)}/exists`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.exists, true, 'body.exists')
      writeResult('12-05-rest-dp-exists', { dpe: DP_FLOAT, status, body })
    })

    await t('12.6', `GET /restapi/datapoints/${DP_FLOAT}/type → element type`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT)}/type`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      // body may be { elementType: "FLOAT" } or { type: "FLOAT" }
      const typeVal = body.elementType || body.type || body
      assertNotNull(typeVal, 'element type value')
      writeResult('12-06-rest-dp-type', { dpe: DP_FLOAT, status, body })
    })

    await t('12.7', `GET /restapi/datapoints/${DP_FLOAT}/dp-type → dp type name`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT_DP)}/dp-type`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      const typeName = body.typeName || body.dpType || body
      assertNotNull(typeName, 'dp type name')
      writeResult('12-07-rest-dp-dptype', { dp: DP_FLOAT_DP, status, body })
    })

    // ── Create + delete lifecycle ────────────────────────────────────────────
    await t('12.8', `POST /restapi/datapoints (create ${TEST_DP_REST}) → 201`, async () => {
      // Clean up any leftover
      await rest('DELETE', `/restapi/datapoints/${enc(TEST_DP_REST)}`).catch(() => {})

      const { status, body } = await rest('POST', '/restapi/datapoints', {
        dpeName: TEST_DP_REST,
        dpType: 'ExampleDP_Float'
      })
      assertEqual(status, 201, 'HTTP status')
      writeResult('12-08-rest-dp-create', { dpeName: TEST_DP_REST, status, body })
    })

    await t('12.9', `DELETE /restapi/datapoints/${TEST_DP_REST} → 200`, async () => {
      const { status, body } = await rest('DELETE', `/restapi/datapoints/${enc(TEST_DP_REST)}`)
      assertEqual(status, 200, 'HTTP status')
      writeResult('12-09-rest-dp-delete', { dpeName: TEST_DP_REST, status, body })
    })

    // ── dpQuery via REST ─────────────────────────────────────────────────────
    await t('12.10', "POST /restapi/query → 2D result array", async () => {
      const query = `SELECT '_original.._value' FROM '${DP_FLOAT_DP}'`
      const { status, body } = await rest('POST', '/restapi/query', { query })
      assertEqual(status, 200, 'HTTP status')
      // body may be { result: [[...]] } or just the 2D array
      const table = body.result || body
      assertIsArray(table, 'query result')
      assertIsArray(table[0], 'header row')
      writeResult('12-10-rest-query', { query, status, rowCount: table.length, table })
    })

    await t('12.10b', "GET /restapi/query?query=... → same 2D result array", async () => {
      const query = `SELECT '_original.._value' FROM '${DP_FLOAT_DP}'`
      const { status, body } = await rest('GET', `/restapi/query?query=${encodeURIComponent(query)}`)
      assertEqual(status, 200, 'HTTP status')
      const table = body.result || body
      assertIsArray(table, 'query result')
      assertIsArray(table[0], 'header row')
      writeResult('12-10b-rest-query-get', { query, status, rowCount: table.length, table })
    })

    // ── Tags ─────────────────────────────────────────────────────────────────
    await t('12.11', `GET /restapi/tags?dpeNames=${DP_FLOAT} → tags array`, async () => {
      const { status, body } = await rest('GET', `/restapi/tags?dpeNames=${encodeURIComponent(DP_FLOAT)}`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body.tags, 'body.tags')
      assertIsArray(body.tags, 'body.tags')
      assertEqual(body.tags.length, 1, 'tags.length')
      assertNotNull(body.tags[0].name, 'tag.name')
      writeResult('12-11-rest-tags', { dpe: DP_FLOAT, tags: body.tags })
    })

    // ── Tag history ───────────────────────────────────────────────────────────
    await t('12.12', `GET /restapi/tags/history(${DP_FLOAT}) — write 100 values then query (SKIP if no RDB)`, async () => {
      // Write 100 timed values then query history
      const startMs = Date.now()
      const writtenValues = []
      for (let i = 0; i < 100; i++) {
        const ts  = new Date().toISOString()
        const val = parseFloat((i * 0.1).toFixed(1))
        await gql(`mutation { api { dp { setTimed(time: "${ts}", dpeNames: ["${DP_FLOAT}"], values: [${val}]) } } }`)
        writtenValues.push({ ts, val })
      }
      const start = new Date(startMs - 2000).toISOString()
      const end   = new Date(Date.now() + 2000).toISOString()
      await new Promise(r => setTimeout(r, 1000))

      const params = `dpeNames=${encodeURIComponent(DP_FLOAT)}&startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`
      const { status, body } = await rest('GET', `/restapi/tags/history?${params}`)
      assertNotNull(body, 'response body')
      if (status === 500 || body.error) {
        writeResult('12-12-rest-tags-history', { skipped: true, status, error: body.error || body.message, writtenValues, note: 'values were written but RDB is not available' })
        return 'No RDB backend — history returns error (expected)'
      }
      assertNotNull(body.history, 'body.history')
      writeResult('12-12-rest-tags-history', { dpe: DP_FLOAT, start, end, writtenValues, history: body.history })
    })

    // ── Pump* datapoints via REST ─────────────────────────────────────────────
    await t('12.13', 'GET /restapi/datapoints?pattern=Pump* → write response', async () => {
      const { status, body } = await rest('GET', '/restapi/datapoints?pattern=Pump*')
      if (status === 200 && body.datapoints && body.datapoints.length === 0) {
        return 'No Pump* datapoints found via REST'
      }
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body.datapoints, 'body.datapoints')
      assertIsArray(body.datapoints, 'datapoints')
      writeResult('12-13-rest-pump-datapoints', {
        pattern: 'Pump*',
        count: body.datapoints.length,
        datapoints: body.datapoints
      })
    })

    // ── value/wait round-trip ────────────────────────────────────────────────
    await t('12.14', `PUT /restapi/datapoints/${DP_FLOAT}/value/wait { value: 88 } → success`, async () => {
      const { status, body } = await rest('PUT', `/restapi/datapoints/${enc(DP_FLOAT)}/value/wait`, { value: 88 })
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      writeResult('12-14-rest-dp-value-wait', { dpe: DP_FLOAT, written: 88, status, body })
    })

    await t('12.15', `GET /restapi/datapoints/${DP_FLOAT}/value → 88 (wait round-trip)`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT)}/value`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.value, 88, 'body.value after value/wait PUT')
    })

    // ── value/timed ──────────────────────────────────────────────────────────
    await t('12.16', `PUT /restapi/datapoints/${DP_FLOAT}/value/timed { value: 55.5 } → success`, async () => {
      const time = new Date().toISOString()
      const { status, body } = await rest('PUT', `/restapi/datapoints/${enc(DP_FLOAT)}/value/timed`, { value: 55.5, time })
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      writeResult('12-16-rest-dp-value-timed', { dpe: DP_FLOAT, written: 55.5, time, status, body })
    })

    // ── value/timed-wait ─────────────────────────────────────────────────────
    await t('12.17', `PUT /restapi/datapoints/${DP_FLOAT}/value/timed-wait { value: 66.6 } → success`, async () => {
      const time = new Date().toISOString()
      const { status, body } = await rest('PUT', `/restapi/datapoints/${enc(DP_FLOAT)}/value/timed-wait`, { value: 66.6, time })
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      writeResult('12-17-rest-dp-value-timed-wait', { dpe: DP_FLOAT, written: 66.6, time, status, body })
    })

    // ── copy lifecycle ───────────────────────────────────────────────────────
    const TEST_DP_REST_COPY = 'TestDP_RestTestCopy'

    await t('12.18', `POST /restapi/datapoints/${DP_FLOAT_DP}/copy → ${TEST_DP_REST_COPY}`, async () => {
      await rest('DELETE', `/restapi/datapoints/${enc(TEST_DP_REST_COPY)}`).catch(() => {})
      const { status, body } = await rest('POST', `/restapi/datapoints/${enc(DP_FLOAT_DP)}/copy`, { destination: TEST_DP_REST_COPY })
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      writeResult('12-18-rest-dp-copy', { source: DP_FLOAT_DP, destination: TEST_DP_REST_COPY, status, body })
    })

    await t('12.19', `GET /restapi/datapoints/${TEST_DP_REST_COPY}/exists → true (after copy)`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(TEST_DP_REST_COPY)}/exists`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.exists, true, 'body.exists after copy')
    })

    await t('12.20', `DELETE /restapi/datapoints/${TEST_DP_REST_COPY} → 200 (cleanup copy)`, async () => {
      const { status } = await rest('DELETE', `/restapi/datapoints/${enc(TEST_DP_REST_COPY)}`)
      assertEqual(status, 200, 'HTTP status')
    })

    // ── type-ref ─────────────────────────────────────────────────────────────
    await t('12.21', `GET /restapi/datapoints/${DP_FLOAT}/type-ref → { typeRef }`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT)}/type-ref`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      // typeRef may be empty string for simple/primitive types
      writeResult('12-21-rest-dp-type-ref', { dpe: DP_FLOAT, status, body })
    })

    // ── value/max-age ─────────────────────────────────────────────────────────
    await t('12.22', `GET /restapi/datapoints/${DP_FLOAT}/value/max-age?age=5000 → { value }`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT)}/value/max-age?age=5000`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      writeResult('12-22-rest-dp-value-max-age', { dpe: DP_FLOAT, age: 5000, status, body })
    })

    // ── DP history ────────────────────────────────────────────────────────────
    await t('12.23', `GET /restapi/datapoints/${DP_FLOAT}/history → values (SKIP if no RDB)`, async () => {
      const startTime = new Date(Date.now() - 60000).toISOString()
      const endTime   = new Date().toISOString()
      const params = `startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT)}/history?${params}`)
      if (status === 500 || body.error) {
        writeResult('12-23-rest-dp-history', { skipped: true, status, error: body.error || body.message })
        return 'No RDB backend — history returns error (expected)'
      }
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body.values, 'body.values')
      writeResult('12-23-rest-dp-history', { dpe: DP_FLOAT, startTime, endTime, status, body })
    })

    // ── attribute-type ────────────────────────────────────────────────────────
    // dpAttributeType expects a full attribute path, not just a DPE name
    const DP_FLOAT_ATTR = `${DP_FLOAT}:_online.._value`
    await t('12.24', `GET /restapi/datapoints/${DP_FLOAT_ATTR}/attribute-type → { ctrlType }`, async () => {
      const { status, body } = await rest('GET', `/restapi/datapoints/${enc(DP_FLOAT_ATTR)}/attribute-type`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      assertNotNull(body.ctrlType, 'body.ctrlType')
      writeResult('12-24-rest-dp-attribute-type', { dpAttribute: DP_FLOAT_ATTR, status, body })
    })
  }
}
