// tests/suite-17-dp-timed-write.js — dpSetTimed / dpSetTimedWait round-trips
//
// Tests time-stamped writes using a temporary DP so we don't pollute
// production data.  The written value is verified with a dp.get read-back.
// Results are written to tests/results/ for manual inspection.

const {
  gql,
  TEST_DP,
  assertNoErrors, assertEqual, assertIsArray, assertNotNull, dig,
  writeResult
} = require('./helpers')

const DP_TYPE = 'ExampleDP_Float'
const ROOT    = `${TEST_DP}.`

// Returns current time as ISO-8601 string (WinCC OA Time scalar)
function nowISO() { return new Date().toISOString() }

// Delete DP only if it exists (avoids WinCC OA error 71 / error 33)
async function deleteIfExists(dpName) {
  const res = await gql(`{ api { dp { exists(dpeName: "${dpName}") } } }`)
  if (dig(res, 'data.api.dp.exists') === true) {
    await gql(`mutation { api { dp { delete(dpName: "${dpName}") } } }`)
  }
}

module.exports = {
  name: 'Suite 17 — DataPoint Timed Write (setTimed / setTimedWait)',

  async run(t) {

    // ── Setup: create temporary DP ────────────────────────────────────────────
    await t('17.1', `Create temporary DP ${TEST_DP} for timed-write tests`, async () => {
      // Clean up any leftover from a previous failed run (check existence first)
      await deleteIfExists(TEST_DP)
      const res = await gql(
        `mutation { api { dp { create(dpeName: "${TEST_DP}", dpType: "${DP_TYPE}") } } }`
      )
      assertNoErrors(res, '17.1')
      assertEqual(dig(res, 'data.api.dp.create'), true, 'dp.create')
    })

    // ── dpSetTimed + verify ───────────────────────────────────────────────────
    await t('17.2', `api.dp.setTimed([${ROOT}], 11.1) → true`, async () => {
      const time = nowISO()
      const res = await gql(
        `mutation { api { dp { setTimed(time: "${time}", dpeNames: ["${ROOT}"], values: [11.1]) } } }`
      )
      assertNoErrors(res, '17.2')
      assertEqual(dig(res, 'data.api.dp.setTimed'), true, 'dp.setTimed')
      writeResult('17-02-set-timed-req', { time, dpe: ROOT, value: 11.1 })
    })

    await t('17.3', `api.dp.get([${ROOT}]) → [11.1]  (setTimed round-trip)`, async () => {
      const res = await gql(`{ api { dp { get(dpeNames: ["${ROOT}"]) } } }`)
      assertNoErrors(res, '17.3')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'dp.get after setTimed')
      assertEqual(values[0], 11.1, 'dp.get[0] after setTimed')
      writeResult('17-03-set-timed-readback', { dpe: ROOT, values })
    })

    // ── dpSetTimedWait + verify ───────────────────────────────────────────────
    await t('17.4', `api.dp.setTimedWait([${ROOT}], 22.2) → true`, async () => {
      const time = nowISO()
      const res = await gql(
        `mutation { api { dp { setTimedWait(time: "${time}", dpeNames: ["${ROOT}"], values: [22.2]) } } }`
      )
      assertNoErrors(res, '17.4')
      assertEqual(dig(res, 'data.api.dp.setTimedWait'), true, 'dp.setTimedWait')
      writeResult('17-04-set-timed-wait-req', { time, dpe: ROOT, value: 22.2 })
    })

    await t('17.5', `api.dp.get([${ROOT}]) → [22.2]  (setTimedWait round-trip)`, async () => {
      const res = await gql(`{ api { dp { get(dpeNames: ["${ROOT}"]) } } }`)
      assertNoErrors(res, '17.5')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'dp.get after setTimedWait')
      assertEqual(values[0], 22.2, 'dp.get[0] after setTimedWait')
      writeResult('17-05-set-timed-wait-readback', { dpe: ROOT, values })
    })

    // ── Cleanup ───────────────────────────────────────────────────────────────
    await t('17.6', `api.dp.delete(${TEST_DP}) → cleanup after timed-write tests`, async () => {
      // Check existence first to avoid WinCC OA error 71/33 on missing DP
      await deleteIfExists(TEST_DP)
      writeResult('17-06-dp-delete', { dpName: TEST_DP, deleted: true })
    })
  }
}
