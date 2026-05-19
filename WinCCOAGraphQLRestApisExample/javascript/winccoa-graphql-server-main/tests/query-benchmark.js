// scripts/query-benchmark.js — POST /restapi/query and report duration + row count

const http = require('http')

const BASE_URL = process.env.TEST_BASE_URL || 'http://debian:4000'
const QUERY = "SELECT '_original.._value' FROM '{Test_00*.*,Test_01*.**,Test_02*.**}'"

const url = new URL(`${BASE_URL}/restapi/query`)
const payload = JSON.stringify({ query: QUERY })

const options = {
  hostname: url.hostname,
  port:     url.port || 80,
  path:     url.pathname,
  method:   'POST',
  headers: {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}

const start = Date.now()

const req = http.request(options, (res) => {
  let raw = ''
  res.on('data', chunk => { raw += chunk })
  res.on('end', () => {
    const elapsed = Date.now() - start
    const body = JSON.parse(raw)
    const table = body.result || body
    const dataRows = Array.isArray(table) ? table.length - 1 : 'n/a'
    console.log(`Query:     ${QUERY}`)
    console.log(`Duration:  ${elapsed} ms`)
    console.log(`Data rows: ${dataRows}`)
  })
})

req.on('error', err => { console.error('Request failed:', err.message) })
req.write(payload)
req.end()
