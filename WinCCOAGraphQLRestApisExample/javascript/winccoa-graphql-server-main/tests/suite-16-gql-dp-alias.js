// tests/suite-16-dp-alias.js — dp.setAlias / dp.getAlias round-trip
//
// Tests the alias mutation + read-back.  Uses a temporary DP so the alias
// can be fully set and then cleaned up by deleting the DP.
//
// NOTE: WinCC OA dpGetAlias returns error 76 "no such alias" when no alias
// has been set (rather than returning null).  The server propagates this as
// a GraphQL error.  We treat that as "no alias" rather than a test failure.
// Setting alias to "" is also unsupported — cleanup is done by deleting the DP.
//
// Results are written to tests/results/ for manual inspection.

const {
  gql,
  TEST_DP,
  assertNoErrors, assertNoUnexpectedErrors, assertEqual, assertTypeOf, assertNotNull, dig,
  writeResult
} = require('./helpers')

const DP_TYPE    = 'ExampleDP_Float'
const ROOT       = `${TEST_DP}.`
const ALIAS_VALUE = 'AutotestAlias'

// Read alias, gracefully returning null if WinCC OA says "no such alias"
async function getAliasSafe(dpe) {
  const res = await gql(`{ api { dp { getAlias(dpeName: "${dpe}") } } }`)
  if (res.errors) {
    const msg = res.errors.map(e => e.message).join('; ')
    if (msg.includes('no such alias')) return null
    throw new Error(`getAlias unexpected error: ${msg}`)
  }
  return dig(res, 'data.api.dp.getAlias')
}

module.exports = {
  name: 'Suite 16 — DataPoint Alias (setAlias / getAlias round-trip)',

  async run(t) {

    // ── Setup: create temporary DP ────────────────────────────────────────────
    await t('16.1', `Create temporary DP ${TEST_DP} for alias tests`, async () => {
      await gql(`mutation { api { dp { delete(dpName: "${TEST_DP}") } } }`).catch(() => {})
      const res = await gql(
        `mutation { api { dp { create(dpeName: "${TEST_DP}", dpType: "${DP_TYPE}") } } }`
      )
      assertNoErrors(res, '16.1')
      assertEqual(dig(res, 'data.api.dp.create'), true, 'dp.create')
    })

    // ── Baseline: new DP has no alias (getAlias returns error 76) ─────────────
    await t('16.2', `getAlias(${ROOT}) on new DP → null (no such alias)`, async () => {
      const alias = await getAliasSafe(ROOT)
      // A brand-new DP should have no alias — null is expected
      if (alias !== null)
        throw new Error(`Expected null alias on new DP, got: ${JSON.stringify(alias)}`)
      writeResult('16-02-alias-baseline', { dpe: ROOT, alias })
    })

    // ── Set alias ─────────────────────────────────────────────────────────────
    await t('16.3', `api.dp.setAlias(${ROOT}, "${ALIAS_VALUE}") → true`, async () => {
      const res = await gql(
        `mutation { api { dp { setAlias(dpeName: "${ROOT}", alias: "${ALIAS_VALUE}") } } }`
      )
      assertNoErrors(res, '16.3')
      assertEqual(dig(res, 'data.api.dp.setAlias'), true, 'dp.setAlias')
    })

    // ── Read back alias (round-trip) ──────────────────────────────────────────
    await t('16.4', `api.dp.getAlias(${ROOT}) → "${ALIAS_VALUE}" (round-trip)`, async () => {
      const res = await gql(`{ api { dp { getAlias(dpeName: "${ROOT}") } } }`)
      assertNoErrors(res, '16.4')
      const alias = dig(res, 'data.api.dp.getAlias')
      assertEqual(alias, ALIAS_VALUE, 'dp.getAlias round-trip')
      writeResult('16-04-alias-roundtrip', { dpe: ROOT, expected: ALIAS_VALUE, actual: alias })
    })

    // ── Update alias to a different value ─────────────────────────────────────
    await t('16.5', `api.dp.setAlias(${ROOT}, "UpdatedAlias") → true`, async () => {
      const res = await gql(
        `mutation { api { dp { setAlias(dpeName: "${ROOT}", alias: "UpdatedAlias") } } }`
      )
      assertNoErrors(res, '16.5')
      assertEqual(dig(res, 'data.api.dp.setAlias'), true, 'dp.setAlias update')
    })

    await t('16.6', `api.dp.getAlias(${ROOT}) → "UpdatedAlias" after update`, async () => {
      const res = await gql(`{ api { dp { getAlias(dpeName: "${ROOT}") } } }`)
      assertNoErrors(res, '16.6')
      const alias = dig(res, 'data.api.dp.getAlias')
      assertEqual(alias, 'UpdatedAlias', 'dp.getAlias updated')
      writeResult('16-06-alias-updated', { dpe: ROOT, alias })
    })

    // ── Cleanup: delete the DP (also removes the alias) ───────────────────────
    await t('16.7', `api.dp.delete(${TEST_DP}) → cleanup alias test DP`, async () => {
      const res = await gql(`mutation { api { dp { delete(dpName: "${TEST_DP}") } } }`)
      assertNoErrors(res, '16.7')
      assertEqual(dig(res, 'data.api.dp.delete'), true, 'dp.delete')
    })
  }
}
