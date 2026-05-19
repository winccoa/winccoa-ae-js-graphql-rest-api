// tests/suite-14-dp-find.js — Discover Example* and Pump* datapoints
//
// Purpose: enumerate the real DPs on the connected system so subsequent suites
// can pick concrete names.  All results are written to tests/results/ for
// manual inspection.

const {
  gql,
  DP_FLOAT_DP, DP_PUMP_PAT,
  assertNoErrors, assertIsArray, assertNotNull, assertArrayContains,
  assertTypeOf, assertEqual, dig,
  writeResult
} = require('./helpers')

module.exports = {
  name: 'Suite 14 — Discover Example* and Pump* DataPoints (GraphQL)',

  async run(t) {

    // ── Find all Example* DPs ─────────────────────────────────────────────────
    await t('14.1', 'api.dp.names(Example*) → write list to results file', async () => {
      const res = await gql('{ api { dp { names(dpPattern: "Example*") } } }')
      assertNoErrors(res, '14.1')
      const names = dig(res, 'data.api.dp.names')
      assertIsArray(names, 'dp.names')
      if (names.length === 0) throw new Error('Expected at least one Example* datapoint')
      writeResult('14-01-example-dp-names', { query: 'Example*', count: names.length, names })
    })

    // ── Find all Pump* DPs ────────────────────────────────────────────────────
    await t('14.2', `api.dp.names(${DP_PUMP_PAT}) → write list to results file`, async () => {
      const res = await gql(`{ api { dp { names(dpPattern: "${DP_PUMP_PAT}") } } }`)
      assertNoErrors(res, '14.2')
      const names = dig(res, 'data.api.dp.names')
      assertIsArray(names, 'dp.names pump')
      writeResult('14-02-pump-dp-names', { query: DP_PUMP_PAT, count: names.length, names })
      if (names.length === 0) return `No Pump* DPs on this system — further Pump tests will skip`
    })

    // ── Read dpQuery for Example* DPs ─────────────────────────────────────────
    await t('14.3', "api.dp.query(SELECT ... FROM 'Example*') → write results", async () => {
      const query = "SELECT '_original.._value' FROM 'Example*'"
      const res = await gql(`{ api { dp { query(query: ${JSON.stringify(query)}) } } }`)
      assertNoErrors(res, '14.3')
      const table = dig(res, 'data.api.dp.query')
      assertIsArray(table, 'dp.query result')
      assertIsArray(table[0], 'dp.query[0] header row')
      writeResult('14-03-example-dpquery', { query, rowCount: table.length, table })
    })

    // ── Read dpQuery for Pump* DPs ────────────────────────────────────────────
    await t('14.4', "api.dp.query(SELECT ... FROM 'Pump*') → write results", async () => {
      const query = "SELECT '_original.._value' FROM 'Pump*'"
      const res = await gql(`{ api { dp { query(query: ${JSON.stringify(query)}) } } }`)
      assertNoErrors(res, '14.4')
      const table = dig(res, 'data.api.dp.query')
      assertIsArray(table, 'dp.query pump result')
      writeResult('14-04-pump-dpquery', { query, rowCount: table.length, table })
      if (table.length <= 1) return 'No Pump* DPs found in dpQuery result'
    })

    // ── dp.get for a batch of Example* DPEs ──────────────────────────────────
    await t('14.5', 'api.dp.get([ExampleDP_Trend1., ExampleDP_AlertHdl1.]) → write values', async () => {
      const dpes = ['ExampleDP_Trend1.', 'ExampleDP_AlertHdl1.']
      const res = await gql(
        `{ api { dp { get(dpeNames: ${JSON.stringify(dpes)}) } } }`
      )
      assertNoErrors(res, '14.5')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'dp.get values')
      assertEqual(values.length, dpes.length, 'dp.get values length')
      writeResult('14-05-example-dp-get', {
        dpes,
        values,
        pairs: dpes.map((name, i) => ({ name, value: values[i] }))
      })
    })

    // ── dp.get for Pump1 leaf element (graceful skip) ─────────────────────────
    await t('14.6', 'api.dp.get([Pump1.value.speed]) → write value or SKIP', async () => {
      // First check Pump1 exists
      const existsRes = await gql('{ api { dp { exists(dpeName: "Pump1.") } } }')
      assertNoErrors(existsRes, '14.6 exists check')
      const exists = dig(existsRes, 'data.api.dp.exists')
      if (!exists) return 'Pump1 does not exist on this system'

      // Pump1 root is a STRUCT — get a known leaf element
      // Discover children first by querying names
      const childRes = await gql('{ api { dp { names(dpPattern: "Pump1.*.*") } } }')
      assertNoErrors(childRes, '14.6 child names')
      const children = dig(childRes, 'data.api.dp.names')
      assertIsArray(children, 'pump1 child names')

      // Filter to leaf elements (no further children expected at depth 2)
      // Try reading the first available leaf
      let leafDpe = null
      for (const child of children) {
        // Strip system prefix if present
        const dpe = child.replace(/^System\d+:/, '')
        const typeRes = await gql(`{ api { dp { elementType(dpeName: "${dpe}") } } }`)
        const et = dig(typeRes, 'data.api.dp.elementType')
        if (et && et !== 'STRUCT') { leafDpe = dpe; break }
      }
      if (!leafDpe) return 'No readable leaf elements found under Pump1'

      const valRes = await gql(`{ api { dp { get(dpeNames: ["${leafDpe}"]) } } }`)
      assertNoErrors(valRes, '14.6 get')
      const values = dig(valRes, 'data.api.dp.get')
      assertIsArray(values, 'dp.get pump leaf')
      writeResult('14-06-pump1-dp-get', { dpe: leafDpe, value: values[0] })
    })

    // ── dp.getMaxAge ──────────────────────────────────────────────────────────
    await t('14.7', 'api.dp.getMaxAge(age=60, [ExampleDP_Trend1.]) → write result', async () => {
      const dpes = ['ExampleDP_Trend1.']
      const res = await gql(
        `{ api { dp { getMaxAge(age: 60, dpeNames: ${JSON.stringify(dpes)}) } } }`
      )
      assertNoErrors(res, '14.7')
      const values = dig(res, 'data.api.dp.getMaxAge')
      assertIsArray(values, 'dp.getMaxAge values')
      writeResult('14-07-example-dp-getmaxage', { dpes, age: 60, values })
    })

    // ── dpTypes listing ───────────────────────────────────────────────────────
    await t('14.8', 'api.dp.types(ExampleDP*) → write DP type list', async () => {
      const res = await gql('{ api { dp { types(pattern: "ExampleDP*") } } }')
      assertNoErrors(res, '14.8')
      const types = dig(res, 'data.api.dp.types')
      assertIsArray(types, 'dp.types')
      writeResult('14-08-example-dp-types', { pattern: 'ExampleDP*', count: types.length, types })
    })

    // ── dp.names for Pump* with type ──────────────────────────────────────────
    await t('14.9', 'api.dp.names(Pump*, dpType filter) → write names + check type names', async () => {
      // First get Pump* type names
      const typesRes = await gql('{ api { dp { types(pattern: "Pump*") } } }')
      assertNoErrors(typesRes, '14.9 types')
      const pumpTypes = dig(typesRes, 'data.api.dp.types')
      assertIsArray(pumpTypes, 'pump types')
      writeResult('14-09-pump-dp-types', { pattern: 'Pump*', count: pumpTypes.length, pumpTypes })

      if (pumpTypes.length === 0) return 'No Pump* DP types on this system'

      // Get DPs by first found pump type
      const firstType = pumpTypes[0]
      const namesRes = await gql(
        `{ api { dp { names(dpPattern: "*", dpType: ${JSON.stringify(firstType)}) } } }`
      )
      assertNoErrors(namesRes, '14.9 names by type')
      const names = dig(namesRes, 'data.api.dp.names')
      assertIsArray(names, 'pump dp names by type')
      writeResult('14-09-pump-dp-names-by-type', { dpType: firstType, count: names.length, names })
    })

  }
}
