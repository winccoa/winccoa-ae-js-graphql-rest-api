// tests/suite-04-dp-write.js — Data Point write + round-trip

const {
  gql,
  TEST_DP, TEST_DP2,
  assertNoErrors, assertEqual, assertIsArray, dig, writeResult
} = require('./helpers')

const DP_TYPE = 'ExampleDP_Float'
const ROOT    = `${TEST_DP}.`
const ROOT2   = `${TEST_DP2}.`

// Delete a DP only if it exists — avoids SEVERE server log errors on cleanup
async function deleteIfExists(dpName) {
  const res = await gql(`{ api { dp { exists(dpeName: "${dpName}") } } }`)
  if (dig(res, 'data.api.dp.exists') === true) {
    await gql(`mutation { api { dp { delete(dpName: "${dpName}") } } }`)
  }
}

module.exports = {
  name: 'Suite 4 — Data Point Write + Round-trip',

  async run(t) {

    // ── Create ──────────────────────────────────────────────────────────────
    await t('4.1', `api.dp.create(${TEST_DP}, ${DP_TYPE}) → true`, async () => {
      // Clean up any leftover from a previous failed run (check existence first)
      await deleteIfExists(TEST_DP)
      await deleteIfExists(TEST_DP2)

      const res = await gql(`mutation { api { dp { create(dpeName: "${TEST_DP}", dpType: "${DP_TYPE}") } } }`)
      assertNoErrors(res, '4.1')
      assertEqual(dig(res, 'data.api.dp.create'), true, 'dp.create')
      writeResult('04-01-dp-create', { dpName: TEST_DP, dpType: DP_TYPE, created: true })
    })

    await t('4.2', `api.dp.exists(${TEST_DP}) → true after create`, async () => {
      const res = await gql(`{ api { dp { exists(dpeName: "${TEST_DP}") } } }`)
      assertNoErrors(res, '4.2')
      assertEqual(dig(res, 'data.api.dp.exists'), true, 'dp.exists')
      writeResult('04-02-dp-exists', { dpName: TEST_DP, exists: true })
    })

    // ── dpSet round-trip ─────────────────────────────────────────────────────
    await t('4.3', `api.dp.set([${ROOT}], [42.5]) → true`, async () => {
      const res = await gql(`mutation { api { dp { set(dpeNames: ["${ROOT}"], values: [42.5]) } } }`)
      assertNoErrors(res, '4.3')
      assertEqual(dig(res, 'data.api.dp.set'), true, 'dp.set')
    })

    await t('4.4', `api.dp.get([${ROOT}]) → [42.5]  (round-trip)`, async () => {
      const res = await gql(`{ api { dp { get(dpeNames: ["${ROOT}"]) } } }`)
      assertNoErrors(res, '4.4')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'dp.get')
      assertEqual(values[0], 42.5, 'dp.get[0]')
      writeResult('04-04-dp-set-roundtrip', { dpe: ROOT, written: 42.5, read: values[0] })
    })

    // ── dpSetWait round-trip ─────────────────────────────────────────────────
    await t('4.5', `api.dp.setWait([${ROOT}], [99.1]) → true`, async () => {
      const res = await gql(`mutation { api { dp { setWait(dpeNames: ["${ROOT}"], values: [99.1]) } } }`)
      assertNoErrors(res, '4.5')
      assertEqual(dig(res, 'data.api.dp.setWait'), true, 'dp.setWait')
    })

    await t('4.6', `api.dp.get([${ROOT}]) → [99.1]  (setWait round-trip)`, async () => {
      const res = await gql(`{ api { dp { get(dpeNames: ["${ROOT}"]) } } }`)
      assertNoErrors(res, '4.6')
      const values = dig(res, 'data.api.dp.get')
      assertEqual(values[0], 99.1, 'dp.get[0] after setWait')
      writeResult('04-06-dp-setWait-roundtrip', { dpe: ROOT, written: 99.1, read: values[0] })
    })

    // ── Metadata write/read ──────────────────────────────────────────────────
    await t('4.7', `api.dp.setDescription(${ROOT}, "Autotest") → true`, async () => {
      const res = await gql(`mutation { api { dp { setDescription(dpeName: "${ROOT}", description: "Autotest") } } }`)
      assertNoErrors(res, '4.7')
      assertEqual(dig(res, 'data.api.dp.setDescription'), true, 'dp.setDescription')
    })

    await t('4.8', `api.dp.getDescription(${ROOT}) → "Autotest"`, async () => {
      const res = await gql(`{ api { dp { getDescription(dpeName: "${ROOT}") } } }`)
      assertNoErrors(res, '4.8')
      const desc = dig(res, 'data.api.dp.getDescription')
      assertEqual(desc, 'Autotest', 'dp.getDescription')
      writeResult('04-08-dp-description-roundtrip', { dpe: ROOT, written: 'Autotest', read: desc })
    })

    await t('4.9', `api.dp.setFormat(${ROOT}, "%f") → true`, async () => {
      const res = await gql(`mutation { api { dp { setFormat(dpeName: "${ROOT}", format: "%f") } } }`)
      assertNoErrors(res, '4.9')
      assertEqual(dig(res, 'data.api.dp.setFormat'), true, 'dp.setFormat')
    })

    await t('4.10', `api.dp.getFormat(${ROOT}) → "%f"`, async () => {
      const res = await gql(`{ api { dp { getFormat(dpeName: "${ROOT}") } } }`)
      assertNoErrors(res, '4.10')
      const fmt = dig(res, 'data.api.dp.getFormat')
      assertEqual(fmt, '%f', 'dp.getFormat')
      writeResult('04-10-dp-format-roundtrip', { dpe: ROOT, written: '%f', read: fmt })
    })

    await t('4.11', `api.dp.setUnit(${ROOT}, "degC") → true`, async () => {
      const res = await gql(`mutation { api { dp { setUnit(dpeName: "${ROOT}", unit: "degC") } } }`)
      assertNoErrors(res, '4.11')
      assertEqual(dig(res, 'data.api.dp.setUnit'), true, 'dp.setUnit')
    })

    await t('4.12', `api.dp.getUnit(${ROOT}) → "degC"`, async () => {
      const res = await gql(`{ api { dp { getUnit(dpeName: "${ROOT}") } } }`)
      assertNoErrors(res, '4.12')
      const unit = dig(res, 'data.api.dp.getUnit')
      assertEqual(unit, 'degC', 'dp.getUnit')
      writeResult('04-12-dp-unit-roundtrip', { dpe: ROOT, written: 'degC', read: unit })
    })

    // ── dpCopy ───────────────────────────────────────────────────────────────
    await t('4.13', `api.dp.copy(${TEST_DP} → ${TEST_DP2}) → true`, async () => {
      const res = await gql(`mutation { api { dp { copy(source: "${TEST_DP}", destination: "${TEST_DP2}") } } }`)
      assertNoErrors(res, '4.13')
      assertEqual(dig(res, 'data.api.dp.copy'), true, 'dp.copy')
      writeResult('04-13-dp-copy', { source: TEST_DP, destination: TEST_DP2, copied: true })
    })

    await t('4.14', `api.dp.exists(${TEST_DP2}) → true after copy`, async () => {
      const res = await gql(`{ api { dp { exists(dpeName: "${TEST_DP2}") } } }`)
      assertNoErrors(res, '4.14')
      assertEqual(dig(res, 'data.api.dp.exists'), true, 'dp.exists copy')
    })

    // ── Cleanup ──────────────────────────────────────────────────────────────
    await t('4.15', `api.dp.delete(${TEST_DP2}) → true`, async () => {
      const res = await gql(`mutation { api { dp { delete(dpName: "${TEST_DP2}") } } }`)
      assertNoErrors(res, '4.15')
      assertEqual(dig(res, 'data.api.dp.delete'), true, 'dp.delete copy')
    })

    await t('4.16', `api.dp.delete(${TEST_DP}) → true`, async () => {
      const res = await gql(`mutation { api { dp { delete(dpName: "${TEST_DP}") } } }`)
      assertNoErrors(res, '4.16')
      assertEqual(dig(res, 'data.api.dp.delete'), true, 'dp.delete')
      writeResult('04-16-dp-delete', { dpName: TEST_DP, deleted: true })
    })

    await t('4.17', `api.dp.exists(${TEST_DP}) → false after delete`, async () => {
      const res = await gql(`{ api { dp { exists(dpeName: "${TEST_DP}") } } }`)
      assertNoErrors(res, '4.17')
      assertEqual(dig(res, 'data.api.dp.exists'), false, 'dp.exists after delete')
      writeResult('04-17-dp-exists-after-delete', { dpName: TEST_DP, exists: false })
    })
  }
}
