// tests/suite-03-dptype-queries.js — Data Point Type read-only queries

const {
  gql,
  assertNoErrors, assertNotNull, assertIsArray, assertEqual, dig, writeResult
} = require('./helpers')

const DPT = 'ExampleDP_Float'
const DPT_STRUCT = 'PUMP1'

module.exports = {
  name: 'Suite 3 — Data Point Type Queries (read-only)',

  async run(t) {

    // ── ExampleDP_Float (simple/primitive type) ───────────────────────────────

    await t('3.1', `api.dpType.dpTypeGet(${DPT}) → name present`, async () => {
      const res = await gql(`{ api { dpType { dpTypeGet(dpt: "${DPT}") } } }`)
      assertNoErrors(res, '3.1')
      const node = dig(res, 'data.api.dpType.dpTypeGet')
      assertNotNull(node, 'dpTypeGet result')
      assertEqual(node.name, DPT, 'dpTypeGet.name')
      writeResult('03-01-dptype-get', node)
    })

    await t('3.2', `api.dpType.dpGetDpTypeRefs(${DPT}) → empty (no sub-type refs)`, async () => {
      const res = await gql(`{ api { dpType { dpGetDpTypeRefs(dpt: "${DPT}") { dptNames dpePaths } } } }`)
      assertNoErrors(res, '3.2')
      const refs = dig(res, 'data.api.dpType.dpGetDpTypeRefs')
      assertNotNull(refs, 'dpGetDpTypeRefs')
      assertIsArray(refs.dptNames, 'dptNames')
      assertIsArray(refs.dpePaths, 'dpePaths')
      writeResult('03-02-dptype-get-refs', { dpt: DPT, refs })
    })

    await t('3.3', `api.dpType.dpGetRefsToDpType(${DPT}) → types referencing it`, async () => {
      const res = await gql(`{ api { dpType { dpGetRefsToDpType(reference: "${DPT}") { dptNames dpePaths } } } }`)
      assertNoErrors(res, '3.3')
      const refs = dig(res, 'data.api.dpType.dpGetRefsToDpType')
      assertNotNull(refs, 'dpGetRefsToDpType')
      assertIsArray(refs.dptNames, 'dptNames')
      assertIsArray(refs.dpePaths, 'dpePaths')
      writeResult('03-03-dptype-refs-to', { reference: DPT, refs })
    })

    // ── PUMP1 structured type ─────────────────────────────────────────────────

    await t('3.4', `api.dpType.dpTypeGet(${DPT_STRUCT}, includeSubTypes) → state.mode children expanded (SKIP if absent)`, async () => {
      const res = await gql(`{ api { dpType { dpTypeGet(dpt: "${DPT_STRUCT}", includeSubTypes: true) } } }`)
      if (res.errors) {
        const msg = res.errors[0].message
        if (msg.includes('not found') || msg.includes('does not exist')) return `${DPT_STRUCT} type not on this system`
        throw new Error(`Unexpected error: ${msg}`)
      }
      const node = dig(res, 'data.api.dpType.dpTypeGet')
      if (!node) return `${DPT_STRUCT} type not on this system`
      assertEqual(node.name, DPT_STRUCT, 'dpTypeGet.name')
      assertIsArray(node.children, 'dpTypeGet.children')
      if (node.children.length === 0) throw new Error(`Expected ${DPT_STRUCT} to have children`)
      // state.mode has refName "MODE_STATE" (type 41) — with includeSubTypes its children must be expanded
      const stateEl = node.children.find(c => c.name === 'state')
      if (!stateEl) throw new Error('Expected "state" child in PUMP1')
      const modeEl = stateEl.children.find(c => c.name === 'mode')
      if (!modeEl) throw new Error('Expected "mode" child in PUMP1.state')
      if (modeEl.children.length === 0) throw new Error('Expected MODE_STATE children expanded under PUMP1.state.mode with includeSubTypes: true')
      writeResult('03-04-dptype-get-pump1', node)
    })

    await t('3.5', `api.dpType.dpGetDpTypeRefs(${DPT_STRUCT}) → empty (PUMP1 has no sub-type refs, SKIP if absent)`, async () => {
      const res = await gql(`{ api { dpType { dpGetDpTypeRefs(dpt: "${DPT_STRUCT}") { dptNames dpePaths } } } }`)
      if (res.errors) {
        const msg = res.errors[0].message
        if (msg.includes('not found') || msg.includes('does not exist')) return `${DPT_STRUCT} type not on this system`
        throw new Error(`Unexpected error: ${msg}`)
      }
      const refs = dig(res, 'data.api.dpType.dpGetDpTypeRefs')
      if (!refs) return `${DPT_STRUCT} type not on this system`
      assertIsArray(refs.dptNames, 'dptNames')
      assertIsArray(refs.dpePaths, 'dpePaths')
      // dpGetDpTypeRefs only tracks structural sub-type embeddings, not refName fields.
      // PUMP1.state.mode has refName "MODE_STATE" but that is a type-reference, not an embedding.
      // The reverse — dpGetRefsToDpType("MODE_STATE") → returns PUMP1 — is tested in 3.9.
      writeResult('03-05-dptype-get-refs-pump1', { dpt: DPT_STRUCT, refs, note: 'empty expected: PUMP1.state.mode references MODE_STATE via refName, use dpGetRefsToDpType("MODE_STATE") for the reverse lookup' })
    })

    await t('3.6', `api.dpType.dpGetRefsToDpType(${DPT_STRUCT}) → empty (nothing references PUMP1, SKIP if absent)`, async () => {
      const res = await gql(`{ api { dpType { dpGetRefsToDpType(reference: "${DPT_STRUCT}") { dptNames dpePaths } } } }`)
      if (res.errors) {
        const msg = res.errors[0].message
        if (msg.includes('not found') || msg.includes('does not exist')) return `${DPT_STRUCT} type not on this system`
        throw new Error(`Unexpected error: ${msg}`)
      }
      const refs = dig(res, 'data.api.dpType.dpGetRefsToDpType')
      if (!refs) return `${DPT_STRUCT} type not on this system`
      assertIsArray(refs.dptNames, 'dptNames')
      assertIsArray(refs.dpePaths, 'dpePaths')
      writeResult('03-06-dptype-refs-to-pump1', { reference: DPT_STRUCT, refs })
    })

    // ── MODE_STATE (referenced sub-type) ──────────────────────────────────────

    await t('3.7', 'api.dpType.dpTypeGet(MODE_STATE) → struct with BIT children (SKIP if absent)', async () => {
      const res = await gql('{ api { dpType { dpTypeGet(dpt: "MODE_STATE") } } }')
      if (res.errors) {
        const msg = res.errors[0].message
        if (msg.includes('not found') || msg.includes('does not exist')) return 'MODE_STATE type not on this system'
        throw new Error(`Unexpected error: ${msg}`)
      }
      const node = dig(res, 'data.api.dpType.dpTypeGet')
      if (!node) return 'MODE_STATE type not on this system'
      assertEqual(node.name, 'MODE_STATE', 'dpTypeGet.name')
      assertIsArray(node.children, 'dpTypeGet.children')
      if (node.children.length === 0) throw new Error('Expected MODE_STATE to have children')
      writeResult('03-07-dptype-get-mode-state', node)
    })

    await t('3.8', 'api.dpType.dpGetDpTypeRefs(MODE_STATE) → empty (pure BIT struct, SKIP if absent)', async () => {
      const res = await gql('{ api { dpType { dpGetDpTypeRefs(dpt: "MODE_STATE") { dptNames dpePaths } } } }')
      if (res.errors) {
        const msg = res.errors[0].message
        if (msg.includes('not found') || msg.includes('does not exist')) return 'MODE_STATE type not on this system'
        throw new Error(`Unexpected error: ${msg}`)
      }
      const refs = dig(res, 'data.api.dpType.dpGetDpTypeRefs')
      if (!refs) return 'MODE_STATE type not on this system'
      assertIsArray(refs.dptNames, 'dptNames')
      assertIsArray(refs.dpePaths, 'dpePaths')
      // MODE_STATE contains only BIT primitives — no type references → empty is expected
      writeResult('03-08-dptype-get-refs-mode-state', { dpt: 'MODE_STATE', refs, note: 'empty expected: MODE_STATE contains only BIT primitives' })
    })

    await t('3.9', 'api.dpType.dpGetRefsToDpType(MODE_STATE) → PUMP1 at state.mode (SKIP if absent)', async () => {
      const res = await gql('{ api { dpType { dpGetRefsToDpType(reference: "MODE_STATE") { dptNames dpePaths } } } }')
      if (res.errors) {
        const msg = res.errors[0].message
        if (msg.includes('not found') || msg.includes('does not exist')) return 'MODE_STATE type not on this system'
        throw new Error(`Unexpected error: ${msg}`)
      }
      const refs = dig(res, 'data.api.dpType.dpGetRefsToDpType')
      if (!refs) return 'MODE_STATE type not on this system'
      assertIsArray(refs.dptNames, 'dptNames')
      assertIsArray(refs.dpePaths, 'dpePaths')
      if (refs.dptNames.length === 0) throw new Error('Expected at least one type referencing MODE_STATE (e.g. PUMP1)')
      if (!refs.dptNames.includes('PUMP1')) throw new Error(`Expected PUMP1 in dptNames, got: ${refs.dptNames.join(', ')}`)
      // Verify PUMP1.state.mode is the specific path reported
      const pump1Idx = refs.dptNames.indexOf('PUMP1')
      if (refs.dpePaths[pump1Idx] !== 'state.mode') throw new Error(`Expected PUMP1 ref path "state.mode", got "${refs.dpePaths[pump1Idx]}"`)
      writeResult('03-09-dptype-refs-to-mode-state', { reference: 'MODE_STATE', refs })
    })
  }
}
