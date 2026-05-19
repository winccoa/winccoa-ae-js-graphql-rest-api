// tests/suite-23-rest-cns.js — REST /restapi/v1/cns routes
// Full create → read → change → delete lifecycle for CNS views, trees, nodes
// and properties.  Same WinCC OA path format as suite-09-gql-cns.js.

const {
  rest,
  DP_FLOAT,
  assertNotNull, assertEqual, assertIsArray, assertTypeOf,
  writeResult
} = require('./helpers')

const SYSTEM    = 'System1'
const VIEW_NAME = 'AutotestView'
const TREE_NAME = 'AutotestTree'
const NODE_NAME = 'AutotestNode'
const VIEW_PATH = `${SYSTEM}.${VIEW_NAME}:`
const TREE_PATH = `${SYSTEM}.${VIEW_NAME}:${TREE_NAME}`
const NODE_PATH = `${SYSTEM}.${VIEW_NAME}:${TREE_NAME}.${NODE_NAME}`

function enc(s) { return encodeURIComponent(s) }

module.exports = {
  name: 'Suite 23 — REST CNS Routes',

  async run(t) {

    // ── Baseline read ─────────────────────────────────────────────────────────
    await t('23.1', `GET /restapi/cns/views/${SYSTEM} → 200 with array`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/views/${enc(SYSTEM)}`)
      assertEqual(status, 200, 'HTTP status')
      const views = body.views || body
      assertIsArray(views, 'views')
      writeResult('23-01-rest-cns-views', { status, views })
    })

    // ── Pre-cleanup ───────────────────────────────────────────────────────────
    await t('23.2', `Pre-cleanup: DELETE /cns/views/${VIEW_PATH} if it exists`, async () => {
      await rest('DELETE', `/restapi/cns/views/${enc(VIEW_PATH)}`).catch(() => {})
    })

    // ── createView ────────────────────────────────────────────────────────────
    await t('23.3', `POST /restapi/cns/views (create ${VIEW_PATH}) → { success: true }`, async () => {
      const { status, body } = await rest('POST', '/restapi/cns/views', {
        view: VIEW_PATH,
        displayName: VIEW_NAME
      })
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
      writeResult('23-03-rest-cns-create-view', { view: VIEW_PATH, status, body })
    })

    await t('23.4', `GET /restapi/cns/views/${VIEW_PATH}/exists → { exists: true }`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/views/${enc(VIEW_PATH)}/exists`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.exists, true, 'body.exists')
      writeResult('23-04-rest-cns-view-exists-true', { path: VIEW_PATH, status, body })
    })

    // ── addTree ───────────────────────────────────────────────────────────────
    await t('23.5', `POST /restapi/cns/trees (add ${TREE_NAME}) → { success: true }`, async () => {
      const { status, body } = await rest('POST', '/restapi/cns/trees', {
        cnsParentPath: VIEW_PATH,
        tree: { name: TREE_NAME, displayName: TREE_NAME }
      })
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
      writeResult('23-05-rest-cns-add-tree', { parent: VIEW_PATH, tree: TREE_NAME, status, body })
    })

    await t('23.6', `GET /restapi/cns/trees/${VIEW_PATH} → { trees: [...] } contains ${TREE_NAME}`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/trees/${enc(VIEW_PATH)}`)
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.trees, 'body.trees')
      if (!body.trees.some(tr => tr.includes(TREE_NAME)))
        throw new Error(`Expected tree "${TREE_NAME}" in ${JSON.stringify(body.trees)}`)
      writeResult('23-06-rest-cns-trees', { view: VIEW_PATH, status, trees: body.trees })
    })

    await t('23.7', `GET /restapi/cns/trees/${TREE_PATH}/exists → { exists: true }`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/trees/${enc(TREE_PATH)}/exists`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.exists, true, 'body.exists')
      writeResult('23-07-rest-cns-tree-exists-true', { path: TREE_PATH, status, body })
    })

    // ── addNode ───────────────────────────────────────────────────────────────
    await t('23.8', `POST /restapi/cns/nodes (add ${NODE_NAME} to ${TREE_PATH}) → { success: true }`, async () => {
      const { status, body } = await rest('POST', '/restapi/cns/nodes', {
        cnsParentPath: TREE_PATH,
        name: NODE_NAME,
        displayName: NODE_NAME
      })
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
      writeResult('23-08-rest-cns-add-node', { parent: TREE_PATH, node: NODE_NAME, status, body })
    })

    await t('23.9', `GET /restapi/cns/nodes/${TREE_PATH}/children → contains ${NODE_NAME}`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(TREE_PATH)}/children`)
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.children, 'body.children')
      if (!body.children.some(c => c.includes(NODE_NAME)))
        throw new Error(`Expected node "${NODE_NAME}" in children ${JSON.stringify(body.children)}`)
      writeResult('23-09-rest-cns-children', { parent: TREE_PATH, status, children: body.children })
    })

    await t('23.10', `GET /restapi/cns/nodes/${NODE_PATH}/parent → contains ${TREE_NAME}`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(NODE_PATH)}/parent`)
      assertEqual(status, 200, 'HTTP status')
      assertTypeOf(body.parent, 'string', 'body.parent')
      if (!body.parent.includes(TREE_NAME))
        throw new Error(`Expected parent to contain "${TREE_NAME}", got: "${body.parent}"`)
      writeResult('23-10-rest-cns-parent', { node: NODE_PATH, status, body })
    })

    await t('23.11', `GET /restapi/cns/nodes/${NODE_PATH}/root → string`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(NODE_PATH)}/root`)
      assertEqual(status, 200, 'HTTP status')
      assertTypeOf(body.root, 'string', 'body.root')
      writeResult('23-11-rest-cns-root', { node: NODE_PATH, status, body })
    })

    await t('23.12', `GET /restapi/cns/nodes/${NODE_PATH}/display-name → displayName`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(NODE_PATH)}/display-name`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body.displayName, 'body.displayName')
      writeResult('23-12-rest-cns-display-name', { node: NODE_PATH, status, body })
    })

    await t('23.13', `GET /restapi/cns/nodes/${NODE_PATH}/display-path → displayPath`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(NODE_PATH)}/display-path`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      writeResult('23-13-rest-cns-display-path', { node: NODE_PATH, status, body })
    })

    await t('23.14', `GET /restapi/cns/nodes/${NODE_PATH}/id → string or null`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(NODE_PATH)}/id`)
      assertEqual(status, 200, 'HTTP status')
      assertNotNull(body, 'body')
      // id may be null/empty if no DP is linked to the node
      writeResult('23-14-rest-cns-node-id', { node: NODE_PATH, status, body })
    })

    await t('23.15', `GET /restapi/cns/nodes/${NODE_PATH}/exists → { exists: true }`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(NODE_PATH)}/exists`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.exists, true, 'body.exists')
      writeResult('23-15-rest-cns-node-exists-true', { path: NODE_PATH, status, body })
    })

    // ── Property set / get ────────────────────────────────────────────────────
    await t('23.16', `PUT /restapi/cns/nodes/${NODE_PATH}/property → set testKey`, async () => {
      const { status, body } = await rest('PUT', `/restapi/cns/nodes/${enc(NODE_PATH)}/property`, {
        key: 'testKey',
        value: 'testValue',
        valueType: 'STRING_VAR'
      })
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
      writeResult('23-16-rest-cns-set-property', { node: NODE_PATH, key: 'testKey', status, body })
    })

    await t('23.17', `GET /restapi/cns/nodes/${NODE_PATH}/property/testKey → "testValue"`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(NODE_PATH)}/property/testKey`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.value, 'testValue', 'body.value round-trip')
      writeResult('23-17-rest-cns-get-property', { node: NODE_PATH, key: 'testKey', status, body })
    })

    await t('23.18', `GET /restapi/cns/nodes/${NODE_PATH}/properties → contains testKey`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/nodes/${enc(NODE_PATH)}/properties`)
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.keys, 'body.keys')
      if (!body.keys.includes('testKey'))
        throw new Error(`Expected "testKey" in keys: ${JSON.stringify(body.keys)}`)
      writeResult('23-18-rest-cns-properties', { node: NODE_PATH, status, keys: body.keys })
    })

    // ── Search ────────────────────────────────────────────────────────────────
    await t('23.19', `GET /restapi/cns/nodes/search/by-name?pattern=${VIEW_NAME}* → nodes array`, async () => {
      const params = `pattern=${enc(VIEW_NAME + '*')}`
      const { status, body } = await rest('GET', `/restapi/cns/nodes/search/by-name?${params}`)
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.nodes, 'body.nodes')
      writeResult('23-19-rest-cns-search-by-name', { pattern: VIEW_NAME + '*', status, nodes: body.nodes })
    })

    await t('23.20', `GET /restapi/cns/nodes/search/by-data?dpName=${DP_FLOAT} → nodes array`, async () => {
      const params = `dpName=${enc(DP_FLOAT)}`
      const { status, body } = await rest('GET', `/restapi/cns/nodes/search/by-data?${params}`)
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.nodes, 'body.nodes')
      writeResult('23-20-rest-cns-search-by-data', { dpName: DP_FLOAT, status, nodes: body.nodes })
    })

    await t('23.21', `GET /restapi/cns/nodes/search/id-set?pattern=${VIEW_NAME}* → ids array`, async () => {
      const params = `pattern=${enc(VIEW_NAME + '*')}`
      const { status, body } = await rest('GET', `/restapi/cns/nodes/search/id-set?${params}`)
      assertEqual(status, 200, 'HTTP status')
      assertIsArray(body.ids, 'body.ids')
      writeResult('23-21-rest-cns-search-id-set', { pattern: VIEW_NAME + '*', status, ids: body.ids })
    })

    // ── Validation ────────────────────────────────────────────────────────────
    await t('23.22', 'GET /restapi/cns/validation/check-id?id=valid-id → { valid: boolean }', async () => {
      const { status, body } = await rest('GET', '/restapi/cns/validation/check-id?id=valid-id')
      assertEqual(status, 200, 'HTTP status')
      assertTypeOf(body.valid, 'boolean', 'body.valid')
      writeResult('23-22-rest-cns-check-id', { id: 'valid-id', status, body })
    })

    await t('23.23', 'POST /restapi/cns/validation/check-name { name: "TestName" } → { result: number }', async () => {
      const { status, body } = await rest('POST', '/restapi/cns/validation/check-name', { name: 'TestName' })
      assertEqual(status, 200, 'HTTP status')
      assertTypeOf(body.result, 'number', 'body.result')
      writeResult('23-23-rest-cns-check-name', { name: 'TestName', status, body })
    })

    await t('23.24', 'GET /restapi/cns/validation/check-separator?separator=. → { valid: boolean }', async () => {
      const { status, body } = await rest('GET', '/restapi/cns/validation/check-separator?separator=.')
      assertEqual(status, 200, 'HTTP status')
      assertTypeOf(body.valid, 'boolean', 'body.valid')
      writeResult('23-24-rest-cns-check-separator', { separator: '.', status, body })
    })

    // ── changeTree ────────────────────────────────────────────────────────────
    await t('23.25', `PUT /restapi/cns/trees/${TREE_PATH} → change display name → success`, async () => {
      const { status, body } = await rest('PUT', `/restapi/cns/trees/${enc(TREE_PATH)}`, {
        tree: { name: TREE_NAME, displayName: `${TREE_NAME} (changed)` }
      })
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
      writeResult('23-25-rest-cns-change-tree', { path: TREE_PATH, status, body })
    })

    // ── Cleanup: deleteTree then deleteView ───────────────────────────────────
    await t('23.26', `DELETE /restapi/cns/trees/${TREE_PATH} → success`, async () => {
      const { status, body } = await rest('DELETE', `/restapi/cns/trees/${enc(TREE_PATH)}`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
    })

    await t('23.27', `GET /restapi/cns/trees/${TREE_PATH}/exists → false after delete`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/trees/${enc(TREE_PATH)}/exists`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.exists, false, 'body.exists after tree delete')
      writeResult('23-27-rest-cns-tree-exists-false', { path: TREE_PATH, status, body })
    })

    await t('23.28', `DELETE /restapi/cns/views/${VIEW_PATH} → success`, async () => {
      const { status, body } = await rest('DELETE', `/restapi/cns/views/${enc(VIEW_PATH)}`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.success, true, 'body.success')
    })

    await t('23.29', `GET /restapi/cns/views/${VIEW_PATH}/exists → false after delete`, async () => {
      const { status, body } = await rest('GET', `/restapi/cns/views/${enc(VIEW_PATH)}/exists`)
      assertEqual(status, 200, 'HTTP status')
      assertEqual(body.exists, false, 'body.exists after view delete')
      writeResult('23-29-rest-cns-view-exists-false', { path: VIEW_PATH, status, body })
    })
  }
}
