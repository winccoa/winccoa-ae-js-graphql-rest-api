// tests/suite-09-cns.js — CNS queries + mutations lifecycle
//
// Full create → read → change → delete cycle for CNS views, trees, nodes and
// properties.  Read-only queries (exists, checkSeparator, isView/isTree/isNode, etc.)
// run against real objects so results are meaningful.
//
// WinCC OA CNS path format (confirmed by live testing):
//   createView / deleteView / addTree / getTrees:  "System1.VIEW:"
//   addNode / getChildren / changeTree / deleteTree / getProperty / setProperty:
//                                                   "System1.VIEW:TREE"
//   getParent / nested nodes:                       "System1.VIEW:TREE.NODE"
//   viewExists / treeExists / nodeExists:           same single-colon format as above

const {
  gql,
  DP_FLOAT,
  assertNoErrors, assertIsArray, assertTypeOf, assertEqual, assertNotNull, dig,
  writeResult
} = require('./helpers')

const SYSTEM    = 'System1'
const VIEW_NAME = 'AutotestView'
const TREE_NAME = 'AutotestTree'
const NODE_NAME = 'AutotestNode'

// Path helpers matching WinCC OA CNS conventions
const VIEW_ARG = `${SYSTEM}.${VIEW_NAME}:`
const TREE_ARG = `${SYSTEM}.${VIEW_NAME}:${TREE_NAME}`
const NODE_ARG = `${SYSTEM}.${VIEW_NAME}:${TREE_NAME}.${NODE_NAME}`

module.exports = {
  name: 'Suite 9 — CNS Queries + Mutations lifecycle',

  async run(t) {

    // ── Baseline: read existing views ─────────────────────────────────────────
    await t('9.1', 'api.cns.getViews("") → write current view list', async () => {
      const res = await gql('{ api { cns { getViews(systemName: "") } } }')
      assertNoErrors(res, '9.1')
      const views = dig(res, 'data.api.cns.getViews')
      assertIsArray(views, 'cns.getViews')
      writeResult('09-01-cns-views-before', { views })
    })

    // ── Pre-cleanup: delete leftover view from previous failed run ────────────
    await t('9.2', `Pre-cleanup: delete ${VIEW_NAME} if it exists`, async () => {
      await gql(`mutation { api { cns { deleteView(view: "${VIEW_ARG}") } } }`).catch(() => {})
    })

    // ── createView ────────────────────────────────────────────────────────────
    await t('9.3', `api.cns.createView(${VIEW_ARG}) → true`, async () => {
      const res = await gql(`
        mutation {
          api {
            cns {
              createView(
                view: "${VIEW_ARG}",
                displayName: "${VIEW_NAME}"
              )
            }
          }
        }
      `)
      assertNoErrors(res, '9.3')
      assertEqual(dig(res, 'data.api.cns.createView'), true, 'cns.createView')
      writeResult('09-03-cns-create-view', { view: VIEW_ARG, result: true })
    })

    // ── addTree ───────────────────────────────────────────────────────────────
    await t('9.4', `api.cns.addTree(${VIEW_ARG}, ${TREE_NAME}) → true`, async () => {
      const res = await gql(`
        mutation {
          api {
            cns {
              addTree(
                cnsParentPath: "${VIEW_ARG}",
                tree: {
                  name:        "${TREE_NAME}",
                  displayName: "${TREE_NAME}"
                }
              )
            }
          }
        }
      `)
      assertNoErrors(res, '9.4')
      assertEqual(dig(res, 'data.api.cns.addTree'), true, 'cns.addTree')
      writeResult('09-04-cns-add-tree', { parent: VIEW_ARG, tree: TREE_NAME, result: true })
    })

    // ── addNode ───────────────────────────────────────────────────────────────
    await t('9.5', `api.cns.addNode(${TREE_ARG}, ${NODE_NAME}) → true`, async () => {
      const res = await gql(`
        mutation {
          api {
            cns {
              addNode(
                cnsParentPath: "${TREE_ARG}",
                name:          "${NODE_NAME}",
                displayName:   "${NODE_NAME}"
              )
            }
          }
        }
      `)
      assertNoErrors(res, '9.5')
      assertEqual(dig(res, 'data.api.cns.addNode'), true, 'cns.addNode')
      writeResult('09-05-cns-add-node', { parent: TREE_ARG, node: NODE_NAME, result: true })
    })

    // ── viewExists / treeExists / nodeExists (positive) ───────────────────────
    await t('9.6', `api.cns.viewExists(${VIEW_ARG}) → true`, async () => {
      const res = await gql(`{ api { cns { viewExists(path: "${VIEW_ARG}") } } }`)
      assertNoErrors(res, '9.6')
      const result = dig(res, 'data.api.cns.viewExists')
      assertEqual(result, true, 'cns.viewExists')
      writeResult('09-06-cns-view-exists-true', { path: VIEW_ARG, result })
    })

    await t('9.7', `api.cns.treeExists(${TREE_ARG}) → true`, async () => {
      const res = await gql(`{ api { cns { treeExists(path: "${TREE_ARG}") } } }`)
      assertNoErrors(res, '9.7')
      const result = dig(res, 'data.api.cns.treeExists')
      assertEqual(result, true, 'cns.treeExists')
      writeResult('09-07-cns-tree-exists-true', { path: TREE_ARG, result })
    })

    await t('9.8', `api.cns.nodeExists(${NODE_ARG}) → true`, async () => {
      const res = await gql(`{ api { cns { nodeExists(path: "${NODE_ARG}") } } }`)
      assertNoErrors(res, '9.8')
      const result = dig(res, 'data.api.cns.nodeExists')
      assertEqual(result, true, 'cns.nodeExists')
      writeResult('09-08-cns-node-exists-true', { path: NODE_ARG, result })
    })

    // ── viewExists / treeExists / nodeExists (negative) ───────────────────────
    await t('9.9', 'api.cns.viewExists("nonexistent_view") → false', async () => {
      const res = await gql('{ api { cns { viewExists(path: "nonexistent_view") } } }')
      assertNoErrors(res, '9.9')
      const result = dig(res, 'data.api.cns.viewExists')
      assertEqual(result, false, 'cns.viewExists nonexistent')
      writeResult('09-09-cns-view-exists-false', { path: 'nonexistent_view', result })
    })

    await t('9.10', 'api.cns.treeExists("nonexistent") → false', async () => {
      const res = await gql('{ api { cns { treeExists(path: "nonexistent") } } }')
      assertNoErrors(res, '9.10')
      const result = dig(res, 'data.api.cns.treeExists')
      assertEqual(result, false, 'cns.treeExists nonexistent')
      writeResult('09-10-cns-tree-exists-false', { path: 'nonexistent', result })
    })

    await t('9.11', 'api.cns.nodeExists("nonexistent") → false', async () => {
      const res = await gql('{ api { cns { nodeExists(path: "nonexistent") } } }')
      assertNoErrors(res, '9.11')
      const result = dig(res, 'data.api.cns.nodeExists')
      assertEqual(result, false, 'cns.nodeExists nonexistent')
      writeResult('09-11-cns-node-exists-false', { path: 'nonexistent', result })
    })

    // ── isView / isTree / isNode ──────────────────────────────────────────────
    await t('9.12', `api.cns.isView(${VIEW_ARG}) → true`, async () => {
      const res = await gql(`{ api { cns { isView(path: "${VIEW_ARG}") } } }`)
      assertNoErrors(res, '9.12')
      const result = dig(res, 'data.api.cns.isView')
      assertEqual(result, true, 'cns.isView')
      writeResult('09-12-cns-is-view-true', { path: VIEW_ARG, result })
    })

    await t('9.13', `api.cns.isTree(${TREE_ARG}) → true`, async () => {
      const res = await gql(`{ api { cns { isTree(path: "${TREE_ARG}") } } }`)
      assertNoErrors(res, '9.13')
      const result = dig(res, 'data.api.cns.isTree')
      assertEqual(result, true, 'cns.isTree')
      writeResult('09-13-cns-is-tree-true', { path: TREE_ARG, result })
    })

    await t('9.14', `api.cns.isNode(${NODE_ARG}) → true`, async () => {
      const res = await gql(`{ api { cns { isNode(path: "${NODE_ARG}") } } }`)
      assertNoErrors(res, '9.14')
      const result = dig(res, 'data.api.cns.isNode')
      assertEqual(result, true, 'cns.isNode')
      writeResult('09-14-cns-is-node-true', { path: NODE_ARG, result })
    })

    // ── checkSeparator / checkId / checkName ──────────────────────────────────
    await t('9.15', 'api.cns.checkSeparator(".") → Boolean', async () => {
      const res = await gql('{ api { cns { checkSeparator(separator: ".") } } }')
      assertNoErrors(res, '9.15')
      const result = dig(res, 'data.api.cns.checkSeparator')
      assertTypeOf(result, 'boolean', 'cns.checkSeparator')
      writeResult('09-15-cns-check-separator', { separator: '.', result })
    })

    await t('9.16', 'api.cns.checkId("valid-id") → Boolean', async () => {
      const res = await gql('{ api { cns { checkId(id: "valid-id") } } }')
      assertNoErrors(res, '9.16')
      const result = dig(res, 'data.api.cns.checkId')
      assertTypeOf(result, 'boolean', 'cns.checkId')
      writeResult('09-16-cns-check-id', { id: 'valid-id', result })
    })

    await t('9.17', 'api.cns.checkName("TestName") → Int', async () => {
      const res = await gql('{ api { cns { checkName(name: "TestName") } } }')
      assertNoErrors(res, '9.17')
      const result = dig(res, 'data.api.cns.checkName')
      assertTypeOf(result, 'number', 'cns.checkName')
      writeResult('09-17-cns-check-name', { name: 'TestName', result })
    })

    // ── setProperty / getProperty / getPropertyKeys ───────────────────────────
    await t('9.18', `api.cns.setProperty(${NODE_ARG}, key=testKey) → true`, async () => {
      const res = await gql(`
        mutation {
          api {
            cns {
              setProperty(
                cnsPath:   "${NODE_ARG}",
                key:       "testKey",
                value:     "testValue",
                valueType: STRING_VAR
              )
            }
          }
        }
      `)
      assertNoErrors(res, '9.18')
      assertEqual(dig(res, 'data.api.cns.setProperty'), true, 'cns.setProperty')
      writeResult('09-18-cns-set-property', { path: NODE_ARG, key: 'testKey', value: 'testValue' })
    })

    await t('9.19', `api.cns.getProperty(${NODE_ARG}, testKey) → "testValue"`, async () => {
      const res = await gql(
        `{ api { cns { getProperty(cnsPath: "${NODE_ARG}", key: "testKey") } } }`
      )
      assertNoErrors(res, '9.19')
      const value = dig(res, 'data.api.cns.getProperty')
      assertEqual(value, 'testValue', 'cns.getProperty round-trip')
      writeResult('09-19-cns-property-roundtrip', { path: NODE_ARG, key: 'testKey', value })
    })

    await t('9.20', `api.cns.getPropertyKeys(${NODE_ARG}) → contains "testKey"`, async () => {
      const res = await gql(
        `{ api { cns { getPropertyKeys(cnsPath: "${NODE_ARG}") } } }`
      )
      assertNoErrors(res, '9.20')
      const keys = dig(res, 'data.api.cns.getPropertyKeys')
      assertIsArray(keys, 'cns.getPropertyKeys')
      if (!keys.includes('testKey'))
        throw new Error(`Expected key "testKey" in [${keys.join(', ')}]`)
      writeResult('09-20-cns-property-keys', { path: NODE_ARG, keys })
    })

    // ── getTrees / getChildren / getParent ────────────────────────────────────
    await t('9.21', `api.cns.getTrees(${VIEW_ARG}) → contains ${TREE_NAME}`, async () => {
      const res = await gql(`{ api { cns { getTrees(view: "${VIEW_ARG}") } } }`)
      assertNoErrors(res, '9.21')
      const trees = dig(res, 'data.api.cns.getTrees')
      assertIsArray(trees, 'cns.getTrees')
      if (!trees.some(t => t.includes(TREE_NAME)))
        throw new Error(`Expected tree "${TREE_NAME}" in [${trees.join(', ')}]`)
      writeResult('09-21-cns-trees', { view: VIEW_ARG, trees })
    })

    await t('9.22', `api.cns.getChildren(${TREE_ARG}) → contains ${NODE_NAME}`, async () => {
      const res = await gql(`{ api { cns { getChildren(cnsPath: "${TREE_ARG}") } } }`)
      assertNoErrors(res, '9.22')
      const children = dig(res, 'data.api.cns.getChildren')
      assertIsArray(children, 'cns.getChildren')
      if (!children.some(c => c.includes(NODE_NAME)))
        throw new Error(`Expected node "${NODE_NAME}" in children [${children.join(', ')}]`)
      writeResult('09-22-cns-children', { parent: TREE_ARG, children })
    })

    await t('9.23', `api.cns.getParent(${NODE_ARG}) → contains ${TREE_NAME}`, async () => {
      const res = await gql(`{ api { cns { getParent(cnsPath: "${NODE_ARG}") } } }`)
      assertNoErrors(res, '9.23')
      const parent = dig(res, 'data.api.cns.getParent')
      assertTypeOf(parent, 'string', 'cns.getParent')
      if (!parent.includes(TREE_NAME))
        throw new Error(`Expected parent to contain "${TREE_NAME}", got: "${parent}"`)
      writeResult('09-23-cns-parent', { node: NODE_ARG, parent })
    })

    // ── getDisplayNames / getDisplayPath / getId ───────────────────────────────
    await t('9.24', `api.cns.getDisplayNames(${NODE_ARG}) → JSON`, async () => {
      const res = await gql(`{ api { cns { getDisplayNames(cnsPath: "${NODE_ARG}") } } }`)
      assertNoErrors(res, '9.24')
      const result = dig(res, 'data.api.cns.getDisplayNames')
      assertNotNull(result, 'cns.getDisplayNames')
      writeResult('09-24-cns-display-names', { node: NODE_ARG, result })
    })

    await t('9.25', `api.cns.getDisplayPath(${NODE_ARG}) → JSON`, async () => {
      const res = await gql(`{ api { cns { getDisplayPath(cnsPath: "${NODE_ARG}") } } }`)
      assertNoErrors(res, '9.25')
      const result = dig(res, 'data.api.cns.getDisplayPath')
      assertNotNull(result, 'cns.getDisplayPath')
      writeResult('09-25-cns-display-path', { node: NODE_ARG, result })
    })

    await t('9.26', `api.cns.getId(${NODE_ARG}) → String or null`, async () => {
      const res = await gql(`{ api { cns { getId(cnsPath: "${NODE_ARG}") } } }`)
      assertNoErrors(res, '9.26')
      // id may be null/empty when no DP is linked to the node
      const result = dig(res, 'data.api.cns.getId')
      writeResult('09-26-cns-id', { node: NODE_ARG, result })
    })

    // ── getNodesByName / getNodesByData / getIdSet ─────────────────────────────
    await t('9.27', `api.cns.getNodesByName("*${NODE_NAME}*") → [String]`, async () => {
      const res = await gql(`{ api { cns { getNodesByName(pattern: "*${NODE_NAME}*") } } }`)
      assertNoErrors(res, '9.27')
      const result = dig(res, 'data.api.cns.getNodesByName')
      assertIsArray(result, 'cns.getNodesByName')
      writeResult('09-27-cns-nodes-by-name', { pattern: `*${NODE_NAME}*`, result })
    })

    await t('9.28', `api.cns.getNodesByData(${DP_FLOAT}) → [String]`, async () => {
      const res = await gql(`{ api { cns { getNodesByData(dpName: "${DP_FLOAT}") } } }`)
      assertNoErrors(res, '9.28')
      const result = dig(res, 'data.api.cns.getNodesByData')
      assertIsArray(result, 'cns.getNodesByData')
      writeResult('09-28-cns-nodes-by-data', { dpName: DP_FLOAT, result })
    })

    await t('9.29', `api.cns.getIdSet("*${NODE_NAME}*") → [String]`, async () => {
      const res = await gql(`{ api { cns { getIdSet(pattern: "*${NODE_NAME}*") } } }`)
      assertNoErrors(res, '9.29')
      const result = dig(res, 'data.api.cns.getIdSet')
      assertIsArray(result, 'cns.getIdSet')
      writeResult('09-29-cns-id-set', { pattern: `*${NODE_NAME}*`, result })
    })

    // ── changeTree ────────────────────────────────────────────────────────────
    await t('9.30', `api.cns.changeTree(${TREE_ARG}) → rename display name → true`, async () => {
      const res = await gql(`
        mutation {
          api {
            cns {
              changeTree(
                cnsPath: "${TREE_ARG}",
                tree: {
                  name:        "${TREE_NAME}",
                  displayName: "${TREE_NAME} (changed)"
                }
              )
            }
          }
        }
      `)
      assertNoErrors(res, '9.30')
      assertEqual(dig(res, 'data.api.cns.changeTree'), true, 'cns.changeTree')
      writeResult('09-30-cns-change-tree', { path: TREE_ARG, result: true })
    })

    // ── Cleanup: deleteTree then deleteView ───────────────────────────────────
    await t('9.31', `api.cns.deleteTree(${TREE_ARG}) → true`, async () => {
      const res = await gql(
        `mutation { api { cns { deleteTree(cnsPath: "${TREE_ARG}") } } }`
      )
      assertNoErrors(res, '9.31')
      assertEqual(dig(res, 'data.api.cns.deleteTree'), true, 'cns.deleteTree')
    })

    await t('9.32', `api.cns.treeExists(${TREE_ARG}) → false after delete`, async () => {
      const res = await gql(`{ api { cns { treeExists(path: "${TREE_ARG}") } } }`)
      assertNoErrors(res, '9.32')
      const result = dig(res, 'data.api.cns.treeExists')
      assertEqual(result, false, 'cns.treeExists after delete')
      writeResult('09-32-cns-tree-exists-after-delete', { path: TREE_ARG, result })
    })

    await t('9.33', `api.cns.deleteView(${VIEW_ARG}) → true`, async () => {
      const res = await gql(
        `mutation { api { cns { deleteView(view: "${VIEW_ARG}") } } }`
      )
      assertNoErrors(res, '9.33')
      assertEqual(dig(res, 'data.api.cns.deleteView'), true, 'cns.deleteView')
    })

    await t('9.34', `api.cns.viewExists(${VIEW_ARG}) → false after delete`, async () => {
      const res = await gql(`{ api { cns { viewExists(path: "${VIEW_ARG}") } } }`)
      assertNoErrors(res, '9.34')
      const result = dig(res, 'data.api.cns.viewExists')
      assertEqual(result, false, 'cns.viewExists after delete')
      writeResult('09-34-cns-view-exists-after-delete', { path: VIEW_ARG, result })
    })

    // ── Final view list ───────────────────────────────────────────────────────
    await t('9.35', 'api.cns.getViews("") → write final view list', async () => {
      const res = await gql('{ api { cns { getViews(systemName: "") } } }')
      assertNoErrors(res, '9.35')
      const views = dig(res, 'data.api.cns.getViews')
      assertIsArray(views, 'cns.getViews final')
      writeResult('09-35-cns-views-after', { views })
    })
  }
}
