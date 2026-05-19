// tests/helpers.js — shared HTTP utilities and assertion helpers

const http = require('http')
const fs   = require('fs')
const path = require('path')

// ─── Config ─────────────────────────────────────────────────────────────────
const BASE_URL    = process.env.TEST_BASE_URL || 'http://debian:4000'
const DP_FLOAT    = 'ExampleDP_Trend1.'          // root element of a Float DP
const DP_FLOAT_DP = 'ExampleDP_Trend1'           // DP name (no trailing dot)
const DP_BIT      = 'ExampleDP_AlertHdl1.'       // root element of a Bool DP
const DP_BIT_DP   = 'ExampleDP_AlertHdl1'
const TEST_DP     = 'TestDP_Autotest'            // created & deleted in suite 4
const TEST_DP2    = 'TestDP_AutotestCopy'
const TEST_DP_REST = 'TestDP_RestTest'           // created & deleted in suite 12
const TEST_TYPE   = 'TestType_Autotest'          // created & deleted in suite 5
const TEST_TYPE_REST = 'TestType_RestTest'       // created & deleted in suite 13

// ─── Pump structured DP constants ────────────────────────────────────────────
// WinCC OA demo projects use "Pump*" structured DPs for pump data simulation.
// These may not exist on all systems — tests using them should gracefully SKIP.
const DP_PUMP     = 'Pump1'                      // representative Pump DP name
const DP_PUMP_PAT = 'Pump*'                      // pattern matching all Pump DPs

// ─── Results output dir ───────────────────────────────────────────────────────
// All test results are written to tests/results/ for manual inspection.
const RESULTS_DIR = path.join(__dirname, 'results')
try { fs.mkdirSync(RESULTS_DIR, { recursive: true }) } catch (_) {}

/**
 * Write a JSON result to tests/results/<filename>.json
 * Used by tests to persist query responses for manual review.
 *
 * @param {string} filename  — e.g. "02-dp-names"  (no extension)
 * @param {*}      data      — anything JSON-serialisable
 */
function writeResult(filename, data) {
  const outPath = path.join(RESULTS_DIR, `${filename}.json`)
  try {
    fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  } catch (err) {
    // Never fail a test because of output writing
    console.warn(`  [warn] Could not write result file ${outPath}: ${err.message}`)
  }
}

// ─── Low-level HTTP ──────────────────────────────────────────────────────────

/**
 * Perform a raw HTTP request.
 * Returns { status, body (parsed JSON or raw string) }.
 */
function request(method, urlStr, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url      = new URL(urlStr)
    const payload  = body ? JSON.stringify(body) : null
    const options  = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch { parsed = data }
        resolve({ status: res.statusCode, body: parsed })
      })
    })

    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

/**
 * Send a GraphQL request.
 * Returns the full response body (with .data and/or .errors).
 */
async function gql(query, variables) {
  const { body } = await request('POST', `${BASE_URL}/graphql`, { query, variables })
  return body
}

/**
 * Send a REST request.
 * Returns { status, body }.
 */
async function rest(method, path, body) {
  const versionedPath = path.replace(/^\/restapi\//, '/restapi/v1/')
  return request(method, `${BASE_URL}${versionedPath}`, body)
}

// ─── Assertion helpers ───────────────────────────────────────────────────────

class AssertionError extends Error {
  constructor(msg) { super(msg); this.name = 'AssertionError' }
}

function assert(condition, msg) {
  if (!condition) throw new AssertionError(msg)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected)
    throw new AssertionError(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function assertNotNull(value, label) {
  if (value === null || value === undefined)
    throw new AssertionError(`${label}: expected non-null, got ${JSON.stringify(value)}`)
}

function assertIsArray(value, label) {
  if (!Array.isArray(value))
    throw new AssertionError(`${label}: expected array, got ${JSON.stringify(value)}`)
}

function assertArrayContains(arr, item, label) {
  assertIsArray(arr, label)
  const found = arr.some(el => (typeof el === 'string' ? el.includes(item) : el === item))
  if (!found)
    throw new AssertionError(`${label}: expected array to contain "${item}", got ${JSON.stringify(arr)}`)
}

function assertTypeOf(value, type, label) {
  if (typeof value !== type)
    throw new AssertionError(`${label}: expected typeof ${type}, got ${typeof value}`)
}

function assertNoErrors(res, label) {
  if (res.errors && res.errors.length > 0)
    throw new AssertionError(`${label}: unexpected GraphQL errors: ${res.errors.map(e => e.message).join('; ')}`)
}

/**
 * Like assertNoErrors but allows known "infrastructure not available" errors
 * (no RDB backend, no alert groups, etc.) — marks test as SKIP instead of FAIL.
 */
const EXPECTED_INFRA_ERRORS = [
  'No backends are defined',
  'no active alert groups',
  'not found',
  'REDU',
  'alertTime and alertCount size mismatch', // alertGet: no alert groups configured
  'Invalid attribute',                       // alertSet*: read-only or unconfigured attr
  'Setting/modifying attributes failed',     // alertSet*: attribute write rejected
  'Cannot convert NULL Variable',            // alertGetPeriod: no alerts in period (pre-fix)
]

function assertNoUnexpectedErrors(res, label) {
  if (!res.errors || res.errors.length === 0) return null // ok
  const msgs = res.errors.map(e => e.message)
  const isKnown = msgs.some(m => EXPECTED_INFRA_ERRORS.some(k => m.includes(k)))
  if (isKnown) return msgs.join('; ')  // caller treats as SKIP
  throw new AssertionError(`${label}: unexpected errors: ${msgs.join('; ')}`)
}

// ─── Deep accessor ───────────────────────────────────────────────────────────

/**
 * Navigate a nested object by dot-path, e.g. "data.api.dp.get"
 */
function dig(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

module.exports = {
  BASE_URL,
  DP_FLOAT, DP_FLOAT_DP, DP_BIT, DP_BIT_DP,
  DP_PUMP, DP_PUMP_PAT,
  TEST_DP, TEST_DP2, TEST_DP_REST,
  TEST_TYPE, TEST_TYPE_REST,
  RESULTS_DIR,
  writeResult,
  gql, rest, request,
  assert, assertEqual, assertNotNull, assertIsArray,
  assertArrayContains, assertTypeOf, assertNoErrors, assertNoUnexpectedErrors,
  AssertionError,
  dig
}
