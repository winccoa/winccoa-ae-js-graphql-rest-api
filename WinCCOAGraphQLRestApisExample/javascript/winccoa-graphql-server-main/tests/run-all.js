// tests/run-all.js — master test runner
// Usage: node tests/run-all.js [--bail] [--suite <number|filename>]
//   --suite 1          run only suite-01-*
//   --suite 01         run only suite-01-*
//   --suite suite-01-gql-system.js  run only that file

const path = require('path')

const BAIL = process.argv.includes('--bail')

// Parse --suite argument
let suiteFilter = null
const suiteIdx = process.argv.indexOf('--suite')
if (suiteIdx !== -1 && process.argv[suiteIdx + 1]) {
  suiteFilter = process.argv[suiteIdx + 1]
}

// ANSI colours
const C = {
  reset:  '\x1b[0m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
}

const suiteFiles = [
  // ── GraphQL suites ───────────────────────────────────────────────────────────
  'suite-01-gql-system.js',
  'suite-02-gql-dp-queries.js',
  'suite-03-gql-dptype-queries.js',
  'suite-04-gql-dp-write.js',
  'suite-05-gql-dptype-write.js',
  'suite-06-gql-tags.js',
  'suite-07-gql-history.js',
  'suite-08-gql-alerts.js',
  'suite-09-gql-cns.js',
  'suite-10-gql-extras.js',
  'suite-11-gql-auth.js',
  'suite-14-gql-dp-find.js',
  'suite-15-gql-dp-object-queries.js',
  'suite-16-gql-dp-alias.js',
  'suite-17-gql-dp-timed-write.js',
  'suite-18-gql-alert-write.js',
  'suite-20-gql-subscriptions.js',
  'suite-21-gql-history-alerts.js',
  // ── REST suites ──────────────────────────────────────────────────────────────
  'suite-12-rest-datapoints.js',
  'suite-13-rest-system-types.js',
  'suite-22-rest-alerts.js',
  'suite-23-rest-cns.js',
  'suite-24-rest-subscriptions.js',
  'suite-25-rest-stats.js',
  'suite-26-session-lifecycle.js',
]

// ─── Runner state ────────────────────────────────────────────────────────────
let totalPass = 0
let totalFail = 0
let totalSkip = 0
const failedTests = []

function pad(str, n) { return str.padEnd(n, ' ') }

/**
 * Run a single test case.
 * @param {string} id   e.g. "1.1"
 * @param {string} name human-readable label
 * @param {()=>Promise<string|void>} fn
 *   - resolve void / undefined → PASS
 *   - resolve a string → SKIP (string is the reason)
 *   - throw AssertionError or any Error → FAIL
 */
async function runTest(id, name, fn) {
  const label = `${C.dim}[${id}]${C.reset} ${pad(name, 60)}`
  try {
    const skipReason = await fn()
    if (typeof skipReason === 'string') {
      totalSkip++
      console.log(`  ${C.yellow}SKIP${C.reset} ${label}  ${C.dim}${skipReason}${C.reset}`)
    } else {
      totalPass++
      console.log(`  ${C.green}PASS${C.reset} ${label}`)
    }
  } catch (err) {
    totalFail++
    failedTests.push({ id, name, error: err.message })
    console.log(`  ${C.red}FAIL${C.reset} ${label}`)
    console.log(`       ${C.red}${err.message}${C.reset}`)
    if (BAIL) {
      printSummary()
      process.exit(1)
    }
  }
}

/**
 * Run a suite module.
 * Each suite module must export: { name: string, run(runTest): Promise<void> }
 */
async function runSuite(file) {
  const suite = require(path.join(__dirname, file))
  console.log(`\n${C.bold}${C.cyan}▶ ${suite.name}${C.reset}`)
  await suite.run(runTest)
}

function printSummary() {
  const total = totalPass + totalFail + totalSkip
  console.log(`\n${C.bold}${'─'.repeat(72)}${C.reset}`)
  console.log(`${C.bold}Results:${C.reset}  ${C.green}${totalPass} passed${C.reset}  |  ${C.red}${totalFail} failed${C.reset}  |  ${C.yellow}${totalSkip} skipped${C.reset}  |  ${total} total`)
  if (failedTests.length > 0) {
    console.log(`\n${C.bold}${C.red}Failed tests:${C.reset}`)
    for (const t of failedTests) {
      console.log(`  ${C.dim}[${t.id}]${C.reset} ${t.name}`)
      console.log(`       ${C.red}${t.error}${C.reset}`)
    }
  }
  console.log('')
}

// ─── Main ────────────────────────────────────────────────────────────────────
;(async () => {
  const { BASE_URL, RESULTS_DIR } = require('./helpers')
  console.log(`${C.bold}WinCC OA GraphQL Server — Integration Tests${C.reset}`)
  console.log(`${C.dim}Target:  ${BASE_URL}${C.reset}`)
  console.log(`${C.dim}Results: ${RESULTS_DIR}${C.reset}`)
  console.log(`${C.dim}Started: ${new Date().toISOString()}${C.reset}`)

  // Apply --suite filter
  let filesToRun = suiteFiles
  if (suiteFilter !== null) {
    // Normalise: if it's a number (e.g. "1" or "01"), match suite-NN- prefix
    const asNum = suiteFilter.replace(/\D/g, '').padStart(2, '0')
    const isNumeric = /^\d+$/.test(suiteFilter.trim())
    filesToRun = suiteFiles.filter(f => {
      if (isNumeric) return f.startsWith(`suite-${asNum}-`)
      return f === suiteFilter || f === path.basename(suiteFilter)
    })
    if (filesToRun.length === 0) {
      console.log(`\n${C.red}No suite matched --suite "${suiteFilter}"${C.reset}`)
      console.log(`${C.dim}Available suites:${C.reset}`)
      suiteFiles.forEach(f => console.log(`  ${C.dim}${f}${C.reset}`))
      process.exit(1)
    }
  }

  for (const file of filesToRun) {
    try {
      await runSuite(file)
    } catch (err) {
      console.log(`\n${C.red}Error loading suite ${file}: ${err.message}${C.reset}`)
      totalFail++
      if (BAIL) break
    }
  }

  printSummary()
  process.exit(totalFail > 0 ? 1 : 0)
})()
