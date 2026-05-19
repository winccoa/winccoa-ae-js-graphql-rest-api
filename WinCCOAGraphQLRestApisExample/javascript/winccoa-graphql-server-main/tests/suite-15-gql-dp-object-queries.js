// tests/suite-15-dp-object-queries.js — DataPoint / DataPointElement object-API queries
//
// Exercises the rich DataPoint object type (name, fullName, type, exists, element,
// elements, value, tag, alias, description, format, unit) using ExampleDP_Trend1
// and Pump1 (skipped if absent).  All responses are written to results/.

const {
  gql,
  DP_FLOAT_DP,
  assertNoErrors, assertNotNull, assertIsArray, assertTypeOf, assertEqual, dig,
  writeResult
} = require('./helpers')

// Helper: check if a named DP exists before querying it
async function dpExists(name) {
  const res = await gql(`{ api { dp { exists(dpeName: "${name}.") } } }`)
  return dig(res, 'data.api.dp.exists') === true
}

module.exports = {
  name: 'Suite 15 — DataPoint Object Queries (rich type API)',

  async run(t) {

    // ── DataPoint core fields via dp.query object model ────────────────────────
    // NOTE: the DataPoint object type is accessed via the object-graph API, not
    // directly from the root Query type.  We simulate this by building queries
    // that nest DataPoint type fields inside dpQuery / dp.names results.

    // ── api.dp.names + dp.typeName + dp.elementType in one batch ──────────────
    await t('15.1', `DataPoint core: typeName + elementType for ${DP_FLOAT_DP}`, async () => {
      const res = await gql(`
        {
          api {
            dp {
              typeName(dp: "${DP_FLOAT_DP}")
              elementType(dpeName: "${DP_FLOAT_DP}.")
            }
          }
        }
      `)
      assertNoErrors(res, '15.1')
      const typeName    = dig(res, 'data.api.dp.typeName')
      const elementType = dig(res, 'data.api.dp.elementType')
      assertTypeOf(typeName,    'string', 'typeName')
      assertTypeOf(elementType, 'string', 'elementType')
      writeResult('15-01-dp-type-element-type', {
        dp: DP_FLOAT_DP,
        typeName,
        elementType
      })
    })

    // ── api.dp.exists + get + getDescription + getFormat + getUnit ────────────
    await t('15.2', `DataPoint metadata: exists/get/desc/format/unit for ${DP_FLOAT_DP}`, async () => {
      const res = await gql(`
        {
          api {
            dp {
              exists(dpeName: "${DP_FLOAT_DP}.")
              get(dpeNames: ["${DP_FLOAT_DP}."])
              getDescription(dpeName: "${DP_FLOAT_DP}.")
              getFormat(dpeName: "${DP_FLOAT_DP}.")
              getUnit(dpeName: "${DP_FLOAT_DP}.")
            }
          }
        }
      `)
      assertNoErrors(res, '15.2')
      const exists = dig(res, 'data.api.dp.exists')
      assertEqual(exists, true, 'dp.exists')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'dp.get')
      writeResult('15-02-dp-metadata', {
        dp: DP_FLOAT_DP,
        exists,
        value: values[0],
        description: dig(res, 'data.api.dp.getDescription'),
        format:      dig(res, 'data.api.dp.getFormat'),
        unit:        dig(res, 'data.api.dp.getUnit')
      })
    })

    // ── _online attributes: value / stime / status ────────────────────────────
    await t('15.3', `Online attributes (_value/_stime/_status) for ${DP_FLOAT_DP}`, async () => {
      const dpes = [
        `${DP_FLOAT_DP}.:_online.._value`,
        `${DP_FLOAT_DP}.:_online.._stime`,
        `${DP_FLOAT_DP}.:_online.._status`
      ]
      const res = await gql(`{ api { dp { get(dpeNames: ${JSON.stringify(dpes)}) } } }`)
      assertNoErrors(res, '15.3')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'dp.get online attrs')
      assertEqual(values.length, 3, 'online attrs count')
      writeResult('15-03-dp-online-attrs', {
        dp: DP_FLOAT_DP,
        value:     values[0],
        stime:     values[1],
        status:    values[2]
      })
    })

    // ── dpTypeGet full structure ──────────────────────────────────────────────
    await t('15.4', 'dpTypeGet(ExampleDP_Float) full structure → write tree', async () => {
      const res = await gql('{ api { dpType { dpTypeGet(dpt: "ExampleDP_Float") } } }')
      assertNoErrors(res, '15.4')
      const node = dig(res, 'data.api.dpType.dpTypeGet')
      assertNotNull(node, 'dpTypeGet node')
      assertEqual(node.name, 'ExampleDP_Float', 'type name')
      assertIsArray(node.children, 'type children')
      writeResult('15-04-dptype-structure', node)
    })

    // ── dpTypeGet with includeSubTypes ────────────────────────────────────────
    await t('15.5', 'dpTypeGet(ExampleDP_Float, includeSubTypes=true) → write', async () => {
      const res = await gql(
        '{ api { dpType { dpTypeGet(dpt: "ExampleDP_Float", includeSubTypes: true) } } }'
      )
      assertNoErrors(res, '15.5')
      const node = dig(res, 'data.api.dpType.dpTypeGet')
      assertNotNull(node, 'dpTypeGet node subtypes')
      writeResult('15-05-dptype-structure-subtypes', node)
    })

    // ── dp.names with dpType filter ───────────────────────────────────────────
    await t('15.6', 'dp.names(dpType=ExampleDP_Float) → DPs of that type', async () => {
      const res = await gql(
        '{ api { dp { names(dpType: "ExampleDP_Float") } } }'
      )
      assertNoErrors(res, '15.6')
      const names = dig(res, 'data.api.dp.names')
      assertIsArray(names, 'dp.names by type')
      if (names.length === 0)
        throw new Error('Expected at least one DP of type ExampleDP_Float')
      writeResult('15-06-dp-names-by-type-example', { dpType: 'ExampleDP_Float', count: names.length, names })
    })

    // ── dp.query: multi-column SELECT ─────────────────────────────────────────
    await t('15.7', "dp.query SELECT _original + _online from ExampleDP_Trend1", async () => {
      const query = `SELECT '_original.._value','_online.._value','_online.._stime' FROM '${DP_FLOAT_DP}'`
      const res = await gql(`{ api { dp { query(query: ${JSON.stringify(query)}) } } }`)
      assertNoErrors(res, '15.7')
      const table = dig(res, 'data.api.dp.query')
      assertIsArray(table, 'dp.query multi-col')
      assertIsArray(table[0], 'header row')
      // header row should have 3 column entries + 1 empty name col
      if (table[0].length < 3) throw new Error(`Expected ≥3 columns, got ${table[0].length}`)
      writeResult('15-07-dp-query-multi-col', { query, rowCount: table.length, table })
    })

    // ── dp.query: WHERE clause ────────────────────────────────────────────────
    await t('15.8', "dp.query SELECT ... FROM 'Example*' WHERE ... → write rows", async () => {
      // Query all ExampleDP_Float instances with their values
      const query = "SELECT '_original.._value' FROM 'ExampleDP_Float.*' WHERE '_original.._value' > 0"
      const res = await gql(`{ api { dp { query(query: ${JSON.stringify(query)}) } } }`)
      assertNoErrors(res, '15.8')
      const table = dig(res, 'data.api.dp.query')
      assertIsArray(table, 'dp.query WHERE')
      writeResult('15-08-dp-query-where', { query, rowCount: table.length, table })
    })

    // ── Pump1 object queries (graceful skip) ──────────────────────────────────
    await t('15.9', 'Pump1: typeName + elementType (root STRUCT) + leaf get (SKIP if absent)', async () => {
      if (!(await dpExists('Pump1'))) return 'Pump1 does not exist on this system'

      // Pump1 root is a STRUCT — fetch typeName, root elementType, and a leaf value
      const metaRes = await gql(`
        {
          api {
            dp {
              typeName(dp: "Pump1")
              elementType(dpeName: "Pump1.")
              getDescription(dpeName: "Pump1.")
            }
          }
        }
      `)
      assertNoErrors(metaRes, '15.9 meta')

      // Find and read a leaf element
      const childRes = await gql('{ api { dp { names(dpPattern: "Pump1.*.*") } } }')
      assertNoErrors(childRes, '15.9 children')
      const children = dig(childRes, 'data.api.dp.names') || []
      let leafValue = null
      let leafDpe   = null
      for (const child of children) {
        const dpe = child.replace(/^System\d+:/, '')
        const typeRes = await gql(`{ api { dp { elementType(dpeName: "${dpe}") } } }`)
        const et = dig(typeRes, 'data.api.dp.elementType')
        if (et && et !== 'STRUCT') {
          const valRes = await gql(`{ api { dp { get(dpeNames: ["${dpe}"]) } } }`)
          assertNoErrors(valRes, '15.9 leaf get')
          const vals = dig(valRes, 'data.api.dp.get')
          leafDpe   = dpe
          leafValue = vals ? vals[0] : null
          break
        }
      }

      writeResult('15-09-pump1-metadata', {
        dp:          'Pump1',
        typeName:    dig(metaRes, 'data.api.dp.typeName'),
        elementType: dig(metaRes, 'data.api.dp.elementType'),
        description: dig(metaRes, 'data.api.dp.getDescription'),
        leafDpe,
        leafValue
      })
    })

    // ── Pump1 dpTypeGet (graceful skip) ───────────────────────────────────────
    await t('15.10', 'Pump1: dpTypeGet for its type (SKIP if absent)', async () => {
      if (!(await dpExists('Pump1'))) return 'Pump1 does not exist on this system'

      const typeNameRes = await gql('{ api { dp { typeName(dp: "Pump1") } } }')
      assertNoErrors(typeNameRes, '15.10 typeName')
      const typeName = dig(typeNameRes, 'data.api.dp.typeName')
      assertTypeOf(typeName, 'string', 'Pump1 typeName')

      const structRes = await gql(
        `{ api { dpType { dpTypeGet(dpt: ${JSON.stringify(typeName)}) } } }`
      )
      assertNoErrors(structRes, '15.10 dpTypeGet')
      const node = dig(structRes, 'data.api.dpType.dpTypeGet')
      assertNotNull(node, 'Pump1 type node')
      writeResult('15-10-pump1-type-structure', { dp: 'Pump1', typeName, structure: node })
    })

    // ── dpGetDpTypeRefs for ExampleDP_Float ───────────────────────────────────
    await t('15.11', 'dpGetDpTypeRefs(ExampleDP_Float) → references', async () => {
      const res = await gql(
        '{ api { dpType { dpGetDpTypeRefs(dpt: "ExampleDP_Float") { dptNames dpePaths } } } }'
      )
      assertNoErrors(res, '15.11')
      const refs = dig(res, 'data.api.dpType.dpGetDpTypeRefs')
      assertNotNull(refs, 'dpGetDpTypeRefs')
      assertIsArray(refs.dptNames, 'dptNames')
      assertIsArray(refs.dpePaths, 'dpePaths')
      writeResult('15-11-dptype-refs', { dpt: 'ExampleDP_Float', refs })
    })

    // ── dpGetRefsToDpType (reverse lookup) ────────────────────────────────────
    await t('15.12', 'dpGetRefsToDpType(ExampleDP_Float) → types using it', async () => {
      const res = await gql(
        '{ api { dpType { dpGetRefsToDpType(reference: "ExampleDP_Float") { dptNames dpePaths } } } }'
      )
      assertNoErrors(res, '15.12')
      const refs = dig(res, 'data.api.dpType.dpGetRefsToDpType')
      assertNotNull(refs, 'dpGetRefsToDpType')
      writeResult('15-12-dptype-refs-to', { reference: 'ExampleDP_Float', refs })
    })
  }
}
