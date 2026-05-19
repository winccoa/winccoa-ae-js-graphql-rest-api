// tests/suite-07-history.js — dpGetPeriod via GraphQL using ExampleDP_Rpt*
//
// ExampleDP_Rpt1–4 have the _archive config in WinCC OA — must be active (set in Para).
// dpGetPeriod reads from the WinCC OA built-in archive store (no external RDB needed).
// Tests write 100 values then wait 1s before querying to allow the archive to flush.

const {
  gql,
  assertNoUnexpectedErrors, assertNotNull, assertIsArray, dig,
  writeResult
} = require('./helpers')

// RP DPs that have archiving AND alert-handling configured
const RPT_DPS = ['ExampleDP_Rpt1.', 'ExampleDP_Rpt2.', 'ExampleDP_Rpt3.', 'ExampleDP_Rpt4.']
const RPT_DP  = RPT_DPS[0]

// Write 100 timed values to a DPE as fast as possible (no artificial delay).
// Returns { writtenValues, start, end } where start/end bracket the writes with ±2 s margin.
async function writeHistoryValues(dpe) {
  const startMs = Date.now()
  const writtenValues = []
  for (let i = 0; i < 100; i++) {
    const ts  = new Date().toISOString()
    const val = parseFloat((i * 0.1).toFixed(1))
    await gql(`mutation { api { dp { setTimed(time: "${ts}", dpeNames: ["${dpe}"], values: [${val}]) } } }`)
    writtenValues.push({ ts, val })
  }
  return {
    writtenValues,
    start: new Date(startMs - 2000).toISOString(),
    end:   new Date(Date.now() + 2000).toISOString()
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

module.exports = {
  name: 'Suite 7 — History / dpGetPeriod (GraphQL)',

  async run(t) {

    await t('7.1', `api.dp.getPeriod(${RPT_DP}) — write 100 values then query window (SKIP if no RDB)`, async () => {
      const { writtenValues, start, end } = await writeHistoryValues(RPT_DP)

      await sleep(1000)
      console.log(`       window: ${start} → ${end}`)
      const res = await gql(
        `{ api { dp { getPeriod(startTime: "${start}", endTime: "${end}", dpeNames: ["${RPT_DP}"]) } } }`
      )
      const skipReason = assertNoUnexpectedErrors(res, '7.1')
      if (skipReason) {
        writeResult('07-01-dp-get-period-rpt1', { skipped: true, dp: RPT_DP, start, end, writtenValues, note: skipReason })
        return `No archive — ${skipReason}`
      }
      const result = dig(res, 'data.api.dp.getPeriod')
      assertNotNull(result, 'getPeriod result')
      if (result.every(r => r.times.length === 0))
        throw new Error(`getPeriod returned empty — archive may not be active on ${RPT_DP}`)
      writeResult('07-01-dp-get-period-rpt1', { dp: RPT_DP, start, end, writtenValues, result })
    })

    await t('7.2', 'api.dp.getPeriod(ExampleDP_Rpt1–4) — write values then query window (SKIP if no RDB)', async () => {
      let start, end
      const allWritten = {}
      for (const dp of RPT_DPS) {
        const r = await writeHistoryValues(dp)
        allWritten[dp] = r.writtenValues
        start = start ? (r.start < start ? r.start : start) : r.start
        end   = end   ? (r.end   > end   ? r.end   : end)   : r.end
      }

      await sleep(1000)
      console.log(`       window: ${start} → ${end}`)
      const res = await gql(
        `{ api { dp { getPeriod(startTime: "${start}", endTime: "${end}", dpeNames: ${JSON.stringify(RPT_DPS)}) } } }`
      )
      const skipReason = assertNoUnexpectedErrors(res, '7.2')
      if (skipReason) {
        writeResult('07-02-dp-get-period-rpt-all', { skipped: true, dpes: RPT_DPS, start, end, allWritten, note: skipReason })
        return `No archive — ${skipReason}`
      }
      const result = dig(res, 'data.api.dp.getPeriod')
      assertNotNull(result, 'getPeriod multi result')
      if (result.every(r => r.times.length === 0))
        throw new Error('getPeriod returned empty for all Rpt DPs — archive may not be active')
      writeResult('07-02-dp-get-period-rpt-all', { dpes: RPT_DPS, start, end, allWritten, result })
    })
  }
}
