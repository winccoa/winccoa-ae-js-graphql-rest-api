// tests/suite-05-dptype-write.js — Data Point Type create → change → delete

const {
  gql,
  TEST_TYPE,
  assertNoErrors, assertEqual, assertIsArray, assertNotNull, dig, writeResult
} = require('./helpers')

// Delete a DP type only if it exists — avoids SEVERE server log errors on cleanup
async function dpTypeExists(typeName) {
  const res = await gql(`{ api { dpType { dpTypeGet(dpt: "${typeName}") } } }`)
  return !res.errors && dig(res, 'data.api.dpType.dpTypeGet') !== null
}

async function deleteTypeIfExists(typeName) {
  if (await dpTypeExists(typeName)) {
    await gql(`mutation { api { dpType { delete(dpt: "${typeName}") } } }`)
  }
}

module.exports = {
  name: 'Suite 5 — Data Point Type Write',

  async run(t) {

    // ── Create ──────────────────────────────────────────────────────────────
    await t('5.1', `api.dpType.create(${TEST_TYPE}) → true`, async () => {
      // Clean up any leftover from a previous failed run (check existence first)
      await deleteTypeIfExists(TEST_TYPE)

      const res = await gql(`
        mutation {
          api { dpType { create(startNode: {
            name: "${TEST_TYPE}",
            type: STRUCT,
            children: [{ name: "value", type: FLOAT }]
          }) } }
        }
      `)
      assertNoErrors(res, '5.1')
      assertEqual(dig(res, 'data.api.dpType.create'), true, 'dpType.create')
      writeResult('05-01-dptype-create', { typeName: TEST_TYPE, created: true })
    })

    await t('5.2', `api.dpType.dpTypeGet(${TEST_TYPE}) → has "value" child`, async () => {
      const res = await gql(`{ api { dpType { dpTypeGet(dpt: "${TEST_TYPE}") } } }`)
      assertNoErrors(res, '5.2')
      const node = dig(res, 'data.api.dpType.dpTypeGet')
      assertNotNull(node, 'dpTypeGet result')
      assertEqual(node.name, TEST_TYPE, 'dpTypeGet.name')
      assertIsArray(node.children, 'dpTypeGet.children')
      const names = node.children.map(c => c.name)
      if (!names.includes('value'))
        throw new Error(`Expected child "value" in ${JSON.stringify(names)}`)
      writeResult('05-02-dptype-get-after-create', node)
    })

    // ── Change (add a second element) ────────────────────────────────────────
    await t('5.3', `api.dpType.change(${TEST_TYPE}) → add "count" INT child → true`, async () => {
      const res = await gql(`
        mutation {
          api { dpType { change(startNode: {
            name: "${TEST_TYPE}",
            type: STRUCT,
            children: [
              { name: "value", type: FLOAT },
              { name: "count", type: INT }
            ]
          }) } }
        }
      `)
      assertNoErrors(res, '5.3')
      assertEqual(dig(res, 'data.api.dpType.change'), true, 'dpType.change')
      writeResult('05-03-dptype-change', { typeName: TEST_TYPE, changed: true, children: ['value (FLOAT)', 'count (INT)'] })
    })

    await t('5.4', `api.dpType.dpTypeGet(${TEST_TYPE}) → now has 2 children`, async () => {
      const res = await gql(`{ api { dpType { dpTypeGet(dpt: "${TEST_TYPE}") } } }`)
      assertNoErrors(res, '5.4')
      const node = dig(res, 'data.api.dpType.dpTypeGet')
      assertIsArray(node.children, 'children')
      if (node.children.length < 2)
        throw new Error(`Expected ≥2 children, got ${node.children.length}`)
      writeResult('05-04-dptype-get-after-change', node)
    })

    // ── Delete ───────────────────────────────────────────────────────────────
    await t('5.5', `api.dpType.delete(${TEST_TYPE}) → true`, async () => {
      const res = await gql(`mutation { api { dpType { delete(dpt: "${TEST_TYPE}") } } }`)
      assertNoErrors(res, '5.5')
      assertEqual(dig(res, 'data.api.dpType.delete'), true, 'dpType.delete')
      writeResult('05-05-dptype-delete', { typeName: TEST_TYPE, deleted: true })
    })

    await t('5.6', `api.dpType.dpTypeGet(${TEST_TYPE}) → error 57 after delete`, async () => {
      const res = await gql(`{ api { dpType { dpTypeGet(dpt: "${TEST_TYPE}") } } }`)
      if (!res.errors) throw new Error(`Expected error 57 for deleted type, got data: ${JSON.stringify(res.data)}`)
      const msg = res.errors[0].message
      if (!msg.includes('57') && !msg.includes('does not exist'))
        throw new Error(`Expected "does not exist" error, got: ${msg}`)
      writeResult('05-06-dptype-gone-after-delete', { typeName: TEST_TYPE, exists: false, error: msg })
    })
  }
}
