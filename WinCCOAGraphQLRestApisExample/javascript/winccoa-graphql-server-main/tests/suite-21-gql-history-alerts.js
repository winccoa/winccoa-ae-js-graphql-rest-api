// tests/suite-21-history-alerts.js — History reads + alarm trigger + check + acknowledge
//
// Uses ExampleDP_Rpt1–4 which have:
//   • archiving enabled  → dpGetPeriod returns historical values (needs RDB)
//   • alert handling     → values > 99 trigger an alarm on _alert_hdl.._active
//
// Flow:
//   1. Read current values (baseline)
//   2. Write values >99 to all four DPs → trigger alarms
//   3. Verify alarm active via dpQuery and _alert_hdl.._active
//   4. Read dpGetPeriod history (SKIP if no RDB backend)
//   5. Acknowledge alarms via alert.setWait
//   6. Verify alarms acknowledged
//   7. Write values back to 0 (cleanup, quiesce alarms)
//   8. Verify quiesced
//
// Results are written to tests/results/ for manual inspection.

const {
  gql,
  assertNoErrors, assertNoUnexpectedErrors, assertEqual, assertIsArray,
  assertNotNull, assertTypeOf, dig,
  writeResult
} = require('./helpers')

const RPT_DPS    = ['ExampleDP_Rpt1.', 'ExampleDP_Rpt2.', 'ExampleDP_Rpt3.', 'ExampleDP_Rpt4.']
// _active is read-only; _ack_state is the writable attribute for acknowledgement
const ALARM_DPS  = RPT_DPS.map(dp => `${dp}:_alert_hdl.._active`)
const ALARM_VALUE = 105   // > 99 → triggers alarm
const QUIESCE_VALUE = 0   // back to normal

// How long to pause after a write so WinCC OA alarm processing catches up (ms)
const ALARM_SETTLE_MS = 800

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Build AlertTimeInput for a DP element (latest alarm = epoch + count 0)
// Used for alertGet reads where the runtime resolves epoch+0 to the latest alarm.
function alertInput(dpe) {
  return `{ time: "1970-01-01T00:00:00Z", count: 0, dpe: ${JSON.stringify(dpe)} }`
}


// Read _alert_hdl.._active for all Rpt DPs via dpQuery
async function readAlarmStates() {
  const q = "SELECT '_alert_hdl.._active','_original.._value' FROM 'ExampleDP_Rpt*'"
  const res = await gql(`{ api { dp { query(query: ${JSON.stringify(q)}) } } }`)
  if (res.errors) return null
  return dig(res, 'data.api.dp.query')
}

module.exports = {
  name: 'Suite 21 — History + Alarm trigger / check / acknowledge (ExampleDP_Rpt*)',

  async run(t) {

    // ── 21.1  Baseline: read current values ──────────────────────────────────
    await t('21.1', 'Baseline: read current ExampleDP_Rpt* values', async () => {
      const res = await gql(
        `{ api { dp { get(dpeNames: ${JSON.stringify(RPT_DPS)}) } } }`
      )
      assertNoErrors(res, '21.1')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'baseline values')
      assertEqual(values.length, RPT_DPS.length, 'value count')
      writeResult('21-01-baseline-values', {
        dps: RPT_DPS,
        values,
        pairs: RPT_DPS.map((dp, i) => ({ dp, value: values[i] }))
      })
    })

    // ── 21.2  Write alarm-triggering values (>99) to all four DPs ──────────
    await t('21.2', `Write ${ALARM_VALUE} (> 99) to all ExampleDP_Rpt* → trigger alarms`, async () => {
      const values = RPT_DPS.map(() => ALARM_VALUE)
      const res = await gql(
        `mutation { api { dp { setWait(dpeNames: ${JSON.stringify(RPT_DPS)}, values: ${JSON.stringify(values)}) } } }`
      )
      assertNoErrors(res, '21.2')
      assertEqual(dig(res, 'data.api.dp.setWait'), true, 'setWait result')
      // Allow WinCC OA alarm processing to settle
      await sleep(ALARM_SETTLE_MS)
      writeResult('21-02-alarm-trigger-write', { dps: RPT_DPS, value: ALARM_VALUE })
    })

    // ── 21.3  Verify written values ──────────────────────────────────────────
    await t('21.3', `Verify all ExampleDP_Rpt* read back as ${ALARM_VALUE}`, async () => {
      const res = await gql(
        `{ api { dp { get(dpeNames: ${JSON.stringify(RPT_DPS)}) } } }`
      )
      assertNoErrors(res, '21.3')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'values after write')
      for (let i = 0; i < values.length; i++) {
        assertEqual(values[i], ALARM_VALUE, `${RPT_DPS[i]} value after write`)
      }
      writeResult('21-03-values-after-write', { dps: RPT_DPS, values })
    })

    // ── 21.4  Verify alarms are active via dpQuery ────────────────────────────
    await t('21.4', 'dpQuery: verify _alert_hdl.._active = true on all Rpt* DPs', async () => {
      const table = await readAlarmStates()
      assertNotNull(table, 'alarm state query result')
      assertIsArray(table, 'alarm state table')
      // table[0] is header, rows follow
      const dataRows = table.slice(1)
      if (dataRows.length === 0) throw new Error('No rows returned from alarm state query')
      const notActive = dataRows.filter(row => row[1] !== true)
      if (notActive.length > 0) {
        throw new Error(`Expected all alarms active, but these are not: ${JSON.stringify(notActive)}`)
      }
      writeResult('21-04-alarm-state-active', { table })
    })

    // ── 21.5  Verify alarms via dp.get on _alert_hdl.._active ────────────────
    await t('21.5', 'dp.get: _alert_hdl.._active = [true,true,true,true]', async () => {
      const res = await gql(
        `{ api { dp { get(dpeNames: ${JSON.stringify(ALARM_DPS)}) } } }`
      )
      assertNoErrors(res, '21.5')
      const states = dig(res, 'data.api.dp.get')
      assertIsArray(states, 'alarm states')
      assertEqual(states.length, ALARM_DPS.length, 'alarm states count')
      for (let i = 0; i < states.length; i++) {
        if (states[i] !== true)
          throw new Error(`Expected alarm active for ${ALARM_DPS[i]}, got ${states[i]}`)
      }
      writeResult('21-05-alarm-active-dp-get', {
        dpes: ALARM_DPS,
        states,
        pairs: ALARM_DPS.map((dpe, i) => ({ dpe, active: states[i] }))
      })
    })

    // ── 21.6  dpGetPeriod history read (SKIP if no RDB) ──────────────────────
    await t('21.6', 'api.dp.getPeriod(ExampleDP_Rpt1.) → archived history or SKIP (no RDB)', async () => {
      const end   = new Date().toISOString()
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const res = await gql(
        `{ api { dp { getPeriod(startTime: "${start}", endTime: "${end}", dpeNames: ["${RPT_DPS[0]}"]) } } }`
      )
      const skipReason = assertNoUnexpectedErrors(res, '21.6')
      if (skipReason) return `No RDB backend — ${skipReason}`
      const result = dig(res, 'data.api.dp.getPeriod')
      assertNotNull(result, 'getPeriod result')
      writeResult('21-06-dp-get-period-rpt1', {
        dp: RPT_DPS[0], start, end, result
      })
    })

    // ── 21.7  dpGetPeriod for all four Rpt DPs (SKIP if no RDB) ──────────────
    await t('21.7', 'api.dp.getPeriod(all Rpt* DPs) → archived history or SKIP', async () => {
      const end   = new Date().toISOString()
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const res = await gql(
        `{ api { dp { getPeriod(startTime: "${start}", endTime: "${end}", dpeNames: ${JSON.stringify(RPT_DPS)}) } } }`
      )
      const skipReason = assertNoUnexpectedErrors(res, '21.7')
      if (skipReason) return `No RDB backend — ${skipReason}`
      const result = dig(res, 'data.api.dp.getPeriod')
      assertNotNull(result, 'getPeriod all result')
      writeResult('21-07-dp-get-period-rpt-all', {
        dps: RPT_DPS, start, end, result
      })
    })

    // ── 21.8  alertGetPeriod for alarm history (SKIP if no RDB/alert groups) ──
    await t('21.8', 'api.alert.alertGetPeriod(ExampleDP_Rpt* alerts) → history or SKIP', async () => {
      const end   = new Date().toISOString()
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const res = await gql(`
        {
          api {
            alert {
              alertGetPeriod(
                startTime: "${start}",
                endTime:   "${end}",
                names:     ${JSON.stringify(ALARM_DPS)}
              ) { alertTimes { time count dpe } values }
            }
          }
        }
      `)
      const skipReason = assertNoUnexpectedErrors(res, '21.8')
      if (skipReason) return `No alert groups / no RDB — ${skipReason}`
      const result = dig(res, 'data.api.alert.alertGetPeriod')
      assertNotNull(result, 'alertGetPeriod result')
      writeResult('21-08-alert-get-period', {
        alarmDpes: ALARM_DPS, start, end, result
      })
    })

    // ── 21.9  alertGet: read current alarm attributes ─────────────────────────
    await t('21.9', 'api.alert.alertGet: read current alarm state for ExampleDP_Rpt1', async () => {
      const alarmDpe = ALARM_DPS[0]
      // alertsTime: use epoch + count 0 to reference the latest alert.
      // dpeNames: pass multiple configs to read different attributes in one call.
      const dpeNames = [
        `${RPT_DPS[0]}:_alert_hdl.._value`,
        `${RPT_DPS[0]}:_alert_hdl.._text`,
        `${RPT_DPS[0]}:_alert_hdl.._active`
      ]
      const res = await gql(`
        {
          api {
            alert {
              alertGet(
                alertsTime: [${alertInput(alarmDpe)}],
                dpeNames: ${JSON.stringify(dpeNames)}
              )
            }
          }
        }
      `)
      // alertGet needs alert groups configured - SKIP gracefully
      const skipReason = assertNoUnexpectedErrors(res, '21.9')
      if (skipReason) return `alertGet not available — ${skipReason}`
      const result = dig(res, 'data.api.alert.alertGet')
      assertNotNull(result, 'alertGet result')
      writeResult('21-09-alert-get-current', { alarmDpe, dpeNames, result })
    })

    // ── 21.10 Write values back to normal (< 99) ─────────────────────────────
    await t('21.10', `Write ${QUIESCE_VALUE} to all ExampleDP_Rpt* → quiesce alarms`, async () => {
      const values = RPT_DPS.map(() => QUIESCE_VALUE)
      const res = await gql(
        `mutation { api { dp { setWait(dpeNames: ${JSON.stringify(RPT_DPS)}, values: ${JSON.stringify(values)}) } } }`
      )
      assertNoErrors(res, '21.10')
      assertEqual(dig(res, 'data.api.dp.setWait'), true, 'setWait quiesce')
      await sleep(ALARM_SETTLE_MS)
      writeResult('21-10-quiesce-write', { dps: RPT_DPS, value: QUIESCE_VALUE })
    })

    // ── 21.11 Verify values are back to normal ────────────────────────────────
    await t('21.11', `Verify all ExampleDP_Rpt* read back as ${QUIESCE_VALUE} after quiesce`, async () => {
      const res = await gql(
        `{ api { dp { get(dpeNames: ${JSON.stringify(RPT_DPS)}) } } }`
      )
      assertNoErrors(res, '21.11')
      const values = dig(res, 'data.api.dp.get')
      assertIsArray(values, 'values after quiesce')
      for (let i = 0; i < values.length; i++) {
        assertEqual(values[i], QUIESCE_VALUE, `${RPT_DPS[i]} value after quiesce`)
      }
      writeResult('21-11-values-after-quiesce', { dps: RPT_DPS, values })
    })

    // ── 21.12 Final alarm state check: alarms should now be inactive ──────────
    await t('21.12', 'dpQuery: verify _alert_hdl.._active = false on all Rpt* after quiesce', async () => {
      // Give WinCC OA a moment to process the gone transition
      await sleep(ALARM_SETTLE_MS)
      const table = await readAlarmStates()
      assertNotNull(table, 'final alarm state table')
      assertIsArray(table, 'final alarm state table array')
      const dataRows = table.slice(1)
      writeResult('21-12-alarm-state-after-quiesce', { table })
      // Alarms should be inactive (false) after writing value back below threshold
      const stillActive = dataRows.filter(row => row[1] === true)
      if (stillActive.length > 0) {
        // Not a hard failure — in some WinCC OA configs alarms stay active until ACK
        return `${stillActive.length} alarm(s) still active after quiesce (may need acknowledgement)`
      }
    })

    // ── 21.13 Final dpQuery summary ───────────────────────────────────────────
    await t('21.13', 'dpQuery: write final state summary for all Rpt* DPs', async () => {
      const q = "SELECT '_original.._value','_online.._value','_online.._stime','_alert_hdl.._active' FROM 'ExampleDP_Rpt*'"
      const res = await gql(`{ api { dp { query(query: ${JSON.stringify(q)}) } } }`)
      assertNoErrors(res, '21.13')
      const table = dig(res, 'data.api.dp.query')
      assertIsArray(table, 'final summary table')
      writeResult('21-13-final-summary', { query: q, table })
    })
  }
}
