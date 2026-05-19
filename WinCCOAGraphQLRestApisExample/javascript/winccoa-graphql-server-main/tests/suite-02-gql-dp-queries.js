// tests/suite-02-dp-queries.js — Data Point read-only queries

const {
  gql, DP_FLOAT, DP_FLOAT_DP,
  assertNoErrors, assertNotNull, assertIsArray, assertArrayContains,
  assertTypeOf, assertEqual, dig, writeResult
} = require('./helpers')

module.exports = {
  name: 'Suite 2 — Data Point Queries (read-only)',

  async run(t) {

    await t('2.1', 'api.dp.names(Example*) → contains ExampleDP_Trend1', async () => {
      const res = await gql('{ api { dp { names(dpPattern: "Example*") } } }')
      assertNoErrors(res, '2.1')
      const names = dig(res, 'data.api.dp.names')
      assertIsArray(names, 'dp.names')
      assertArrayContains(names, DP_FLOAT_DP, 'dp.names')
      writeResult('02-01-dp-names', { pattern: 'Example*', count: names.length, names })
    })

    await t('2.2', `api.dp.exists(${DP_FLOAT}) → true`, async () => {
      const res = await gql(`{ api { dp { exists(dpeName: "${DP_FLOAT}") } } }`)
      assertNoErrors(res, '2.2')
      assertEqual(dig(res, 'data.api.dp.exists'), true, 'dp.exists')
    })

    await t('2.3', `api.dp.typeName(${DP_FLOAT_DP}) → "ExampleDP_Float"`, async () => {
      const res = await gql(`{ api { dp { typeName(dp: "${DP_FLOAT_DP}") } } }`)
      assertNoErrors(res, '2.3')
      assertEqual(dig(res, 'data.api.dp.typeName'), 'ExampleDP_Float', 'dp.typeName')
    })

    await t('2.4', `api.dp.elementType(${DP_FLOAT}) → "FLOAT"`, async () => {
      const res = await gql(`{ api { dp { elementType(dpeName: "${DP_FLOAT}") } } }`)
      assertNoErrors(res, '2.4')
      assertEqual(dig(res, 'data.api.dp.elementType'), 'FLOAT', 'dp.elementType')
    })

    await t('2.5', `api.dp.get([${DP_FLOAT}]) → array with numeric value`, async () => {
      const res = await gql(`{ api { dp { get(dpeNames: ["${DP_FLOAT}"]) } } }`)
      assertNoErrors(res, '2.5')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'dp.get')
      assertEqual(values.length, 1, 'dp.get length')
      assertTypeOf(values[0], 'number', 'dp.get[0]')
      writeResult('02-05-dp-get', { dpe: DP_FLOAT, values })
    })

    await t('2.6', `api.dp.getDescription(${DP_FLOAT}) → string`, async () => {
      const res = await gql(`{ api { dp { getDescription(dpeName: "${DP_FLOAT}") } } }`)
      assertNoErrors(res, '2.6')
      const desc = dig(res, 'data.api.dp.getDescription')
      // null is allowed if not set, but must not error
      assertNotNull(res.data, 'response.data')
    })

    await t('2.7', `api.dp.getFormat(${DP_FLOAT}) → string or null (no error)`, async () => {
      const res = await gql(`{ api { dp { getFormat(dpeName: "${DP_FLOAT}") } } }`)
      assertNoErrors(res, '2.7')
      assertNotNull(res.data, 'response.data')
    })

    await t('2.8', 'api.dp.types(ExampleDP*) → contains "ExampleDP_Float"', async () => {
      const res = await gql('{ api { dp { types(pattern: "ExampleDP*") } } }')
      assertNoErrors(res, '2.8')
      const types = dig(res, 'data.api.dp.types')
      assertIsArray(types, 'dp.types')
      assertArrayContains(types, 'ExampleDP_Float', 'dp.types')
    })

    await t('2.9', 'api.dp.attributeType(_online.._value) → CtrlType string', async () => {
      const res = await gql(`{ api { dp { attributeType(dpAttributeName: "${DP_FLOAT}:_online.._value") } } }`)
      assertNoErrors(res, '2.9')
      const t2 = dig(res, 'data.api.dp.attributeType')
      assertTypeOf(t2, 'string', 'dp.attributeType')
    })

    await t('2.10', 'api.dp.typeRefName(Pump1.state.mode) → "MODE_STATE" (SKIP if no PUMP1 DP)', async () => {
      // typeRefName requires a DPE whose type is a type-reference (dpType.refName != "").
      // In PUMP1, Pump1.state.mode has refName "MODE_STATE" (type 41).
      // Plain primitives (FLOAT/BIT/STRUCT) return error 248 → empty string.

      // 1. Find any DP of type PUMP1
      const namesRes = await gql('{ api { dp { names(dpType: "PUMP1") } } }')
      const pumpDps = dig(namesRes, 'data.api.dp.names') || []
      if (pumpDps.length === 0) return 'No PUMP1 datapoints on this system — skipping typeRefName test'

      // Strip system prefix, take first DP
      const pumpDp = pumpDps[0].replace(/^System\d+:/, '')

      // 2. Use the known type-reference element: <dp>.state.mode
      const leafDpe = `${pumpDp}.state.mode`

      // 3. Call typeRefName — expect a non-empty string like "MODE_STATE"
      const res = await gql(`{ api { dp { typeRefName(dpe: "${leafDpe}") } } }`)
      assertNoErrors(res, '2.10')
      const refName = dig(res, 'data.api.dp.typeRefName')
      assertTypeOf(refName, 'string', 'dp.typeRefName')
      if (!refName) throw new Error(`Expected non-empty typeRefName for ${leafDpe}, got empty string`)
      writeResult('02-10-dp-type-ref-name', { pumpDp, leafDpe, typeRefName: refName })
    })

    await t('2.11', "api.dp.query(SELECT ... FROM ExampleDP_Trend1) → 2D array", async () => {
      const query = `SELECT '_original.._value' FROM '${DP_FLOAT_DP}'`
      const res = await gql(`{ api { dp { query(query: "${query}") } } }`)
      assertNoErrors(res, '2.11')
      const table = dig(res, 'data.api.dp.query')
      assertIsArray(table, 'dp.query result')
      assertIsArray(table[0], 'dp.query[0] header row')
      // header row: ["", ":_original.._value"]
      assertArrayContains(table[0], '_original.._value', 'header row')
      writeResult('02-11-dp-query', { query, rowCount: table.length, table })
    })
  }
}
