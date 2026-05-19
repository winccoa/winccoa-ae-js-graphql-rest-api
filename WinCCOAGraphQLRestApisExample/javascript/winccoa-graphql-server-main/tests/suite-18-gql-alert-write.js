// tests/suite-18-alert-write.js — Alert mutations (set / setWait / setTimed / setTimedWait)
//
// Uses ExampleDP_Rpt1 — a float DP with a threshold alarm (values > 99 trigger _active).
//
// Pattern for each test:
//   1. Write ALARM_VALUE (105) to trigger the alarm
//   2. Query alertGetPeriod on _came_time to get the real { time, count, dpe } of the
//      active alert — this is the only reliable way to identify a specific alert instance
//   3. Replace _came_time with _add_values in the dpe to build the write/read target
//   4. Write via alertSet mutation using the real alert time+count
//   5. Read back via alertGet using the same real time+count and assert the value
//   6. Reset the DP to 0 in the finally block

const {
  gql,
  assertNoUnexpectedErrors, assertEqual, assertNotNull, dig,
  writeResult
} = require('./helpers')

const ALERT_DP    = 'ExampleDP_Rpt1.'
const CAME_DPE    = `${ALERT_DP}:_alert_hdl.._came_time`
const ALARM_VALUE = 105   // > 99 → triggers alarm on ExampleDP_Rpt1

function nowISO() { return new Date().toISOString() }
async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function dpWrite(value) {
  await gql(`mutation { api { dp { setWait(dpeNames: ["${ALERT_DP}"], values: [${value}]) } } }`)
}

/**
 * Trigger the alarm and return the real alert { time, count, dpe } for _add_values.
 * Uses alertGetPeriod on _came_time to find the most recent ExampleDP_Rpt1 alarm event.
 * Returns null if no alert groups are configured or no alarm was found.
 */
async function triggerAndGetLiveAlert() {
  await dpWrite(ALARM_VALUE)
  await sleep(500)  // allow alarm to activate and register in the alert system

  const start = new Date(Date.now() - 5000).toISOString()
  const end   = new Date().toISOString()
  const res = await gql(`
    {
      api {
        alert {
          alertGetPeriod(
            startTime: "${start}",
            endTime:   "${end}",
            names:     [":_alert_hdl.._came_time"]
          ) { alertTimes { time count dpe } values }
        }
      }
    }
  `)
  if (res.errors?.length) return null
  const period = dig(res, 'data.api.alert.alertGetPeriod')
  if (!period?.alertTimes?.length) return null

  // Most recent came event for ExampleDP_Rpt1
  const idx = period.alertTimes.findLastIndex(at => at.dpe.includes('ExampleDP_Rpt1'))
  if (idx < 0) return null

  const at = period.alertTimes[idx]
  return {
    time:  at.time,
    count: at.count,
    // Replace _came_time with _add_values to get the write/read target DPE
    dpe:   at.dpe.replace('_came_time', '_add_values'),
  }
}

module.exports = {
  name: 'Suite 18 — Alert Mutations (set / setWait / setTimed / setTimedWait)',

  async run(t) {

    // ── 18.1  alertGet baseline (no alarm triggered) ─────────────────────────
    await t('18.1', 'api.alert.alertGet → read current alert state (SKIP if no groups)', async () => {
      const CAME_INPUT = `{ time: "1970-01-01T00:00:00Z", count: 0, dpe: "${CAME_DPE}" }`
      const res = await gql(`
        {
          api {
            alert {
              alertGet(
                alertsTime: [${CAME_INPUT}],
                dpeNames:   ["${CAME_DPE}"]
              )
            }
          }
        }
      `)
      const skipReason = assertNoUnexpectedErrors(res, '18.1')
      if (skipReason) return `No alert groups — ${skipReason}`
      assertNotNull(dig(res, 'data.api.alert.alertGet'), 'alertGet result')
      writeResult('18-01-alert-get-before', { alertDpe: CAME_DPE, result: dig(res, 'data.api.alert.alertGet') })
    })

    // ── 18.2  alert.set + read-back ──────────────────────────────────────────
    await t('18.2', 'api.alert.set → write _add_values + alertGet read-back (SKIP if no groups)', async () => {
      const liveAlert = await triggerAndGetLiveAlert()
      if (!liveAlert) return 'No active alert — no alert groups or no alarm registered'
      const alertInput = `{ time: "${liveAlert.time}", count: ${liveAlert.count}, dpe: "${liveAlert.dpe}" }`
      try {
        const res = await gql(`
          mutation($values: [Anytype!]!) {
            api {
              alert {
                set(alerts: [${alertInput}], values: $values)
              }
            }
          }
        `, { values: [[42]] })
        const skipReason = assertNoUnexpectedErrors(res, '18.2')
        if (skipReason) return `No alert groups — ${skipReason}`
        const result = dig(res, 'data.api.alert.set')
        assertEqual(result, true, 'alert.set result')

        // Read back via alertGet using the real alert time+count
        await sleep(200)
        const readRes = await gql(`
          {
            api {
              alert {
                alertGet(
                  alertsTime: [${alertInput}],
                  dpeNames:   ["${liveAlert.dpe}"]
                )
              }
            }
          }
        `)
        assertNoUnexpectedErrors(readRes, '18.2-readback')
        const readBack = dig(readRes, 'data.api.alert.alertGet')
        assertNotNull(readBack, '_add_values read-back not null')
        writeResult('18-02-alert-set', { liveAlert, result, readBack })
        assertEqual(JSON.stringify(readBack), JSON.stringify([[42]]), '_add_values read-back value')
      } finally {
        await dpWrite(0).catch(() => {})
      }
    })

    // ── 18.3  alert.setWait ───────────────────────────────────────────────────
    await t('18.3', 'api.alert.setWait → write _add_values (SKIP if no groups)', async () => {
      const liveAlert = await triggerAndGetLiveAlert()
      if (!liveAlert) return 'No active alert — no alert groups or no alarm registered'
      const alertInput = `{ time: "${liveAlert.time}", count: ${liveAlert.count}, dpe: "${liveAlert.dpe}" }`
      try {
        const res = await gql(`
          mutation($values: [Anytype!]!) {
            api {
              alert {
                setWait(alerts: [${alertInput}], values: $values)
              }
            }
          }
        `, { values: [[42]] })
        const skipReason = assertNoUnexpectedErrors(res, '18.3')
        if (skipReason) return `No alert groups — ${skipReason}`
        const result = dig(res, 'data.api.alert.setWait')
        assertEqual(result, true, 'alert.setWait result')
        writeResult('18-03-alert-set-wait', { liveAlert, result })
      } finally {
        await dpWrite(0).catch(() => {})
      }
    })

    // ── 18.4  alert.setTimed ──────────────────────────────────────────────────
    await t('18.4', 'api.alert.setTimed → write _add_values (SKIP if no groups)', async () => {
      const liveAlert = await triggerAndGetLiveAlert()
      if (!liveAlert) return 'No active alert — no alert groups or no alarm registered'
      const alertInput = `{ time: "${liveAlert.time}", count: ${liveAlert.count}, dpe: "${liveAlert.dpe}" }`
      try {
        const time = nowISO()
        const res = await gql(`
          mutation($values: [Anytype!]!) {
            api {
              alert {
                setTimed(time: "${time}", alerts: [${alertInput}], values: $values)
              }
            }
          }
        `, { values: [[42]] })
        const skipReason = assertNoUnexpectedErrors(res, '18.4')
        if (skipReason) return `No alert groups — ${skipReason}`
        const result = dig(res, 'data.api.alert.setTimed')
        assertEqual(result, true, 'alert.setTimed result')
        writeResult('18-04-alert-set-timed', { liveAlert, time, result })
      } finally {
        await dpWrite(0).catch(() => {})
      }
    })

    // ── 18.5  alert.setTimedWait ──────────────────────────────────────────────
    await t('18.5', 'api.alert.setTimedWait → write _add_values (SKIP if no groups)', async () => {
      const liveAlert = await triggerAndGetLiveAlert()
      if (!liveAlert) return 'No active alert — no alert groups or no alarm registered'
      const alertInput = `{ time: "${liveAlert.time}", count: ${liveAlert.count}, dpe: "${liveAlert.dpe}" }`
      try {
        const time = nowISO()
        const res = await gql(`
          mutation($values: [Anytype!]!) {
            api {
              alert {
                setTimedWait(time: "${time}", alerts: [${alertInput}], values: $values)
              }
            }
          }
        `, { values: [[42]] })
        const skipReason = assertNoUnexpectedErrors(res, '18.5')
        if (skipReason) return `No alert groups — ${skipReason}`
        const result = dig(res, 'data.api.alert.setTimedWait')
        assertEqual(result, true, 'alert.setTimedWait result')
        writeResult('18-05-alert-set-timed-wait', { liveAlert, time, result })
      } finally {
        await dpWrite(0).catch(() => {})
      }
    })

    // ── 18.6  alertGetPeriod sanity check ─────────────────────────────────────
    await t('18.6', 'api.alert.alertGetPeriod → verify period query still works', async () => {
      const start = '2025-01-01T00:00:00Z'
      const end   = new Date().toISOString()
      const res = await gql(`
        {
          api {
            alert {
              alertGetPeriod(
                startTime: "${start}",
                endTime:   "${end}",
                names:     [":_alert_hdl.._add_values"]
              ) { alertTimes { time count dpe } values }
            }
          }
        }
      `)
      const skipReason = assertNoUnexpectedErrors(res, '18.6')
      if (skipReason) return `No alert groups — ${skipReason}`
      assertNotNull(dig(res, 'data.api.alert.alertGetPeriod'), 'alertGetPeriod result')
      writeResult('18-06-alert-get-period', {
        start, end, alertDp: ALERT_DP,
        result: dig(res, 'data.api.alert.alertGetPeriod')
      })
    })
  }
}
