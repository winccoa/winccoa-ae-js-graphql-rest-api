// tests/suite-06-tags.js — Tag reads via dp.get (GraphQL)

const {
  gql,
  DP_FLOAT,
  assertNoErrors, assertIsArray, assertNotNull, assertTypeOf, assertEqual, dig, writeResult
} = require('./helpers')

module.exports = {
  name: 'Suite 6 — Tag Queries (GraphQL)',

  async run(t) {

    await t('6.1', `api.dp.get([${DP_FLOAT}:_online.._value/stime/status]) → 3 values`, async () => {
      const valueAttr  = `${DP_FLOAT}:_online.._value`
      const stimeAttr  = `${DP_FLOAT}:_online.._stime`
      const statusAttr = `${DP_FLOAT}:_online.._status`
      const res = await gql(
        `{ api { dp { get(dpeNames: ["${valueAttr}", "${stimeAttr}", "${statusAttr}"]) } } }`
      )
      assertNoErrors(res, '6.1')
      const vals = dig(res, 'data.api.dp.get')
      assertIsArray(vals, 'dp.get')
      assertEqual(vals.length, 3, 'dp.get length')
      assertTypeOf(vals[0], 'number', 'value')
      assertNotNull(vals[1], 'stime')
      assertNotNull(res.data, 'response.data')
      writeResult('06-01-tag-online-attrs', {
        dpe:    DP_FLOAT,
        value:  vals[0],
        stime:  vals[1],
        status: vals[2]
      })
    })
  }
}
