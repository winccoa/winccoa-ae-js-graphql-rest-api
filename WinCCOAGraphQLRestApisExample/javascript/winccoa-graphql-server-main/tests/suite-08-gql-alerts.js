// tests/suite-08-alerts.js — Alert queries (GraphQL)
//
// ExampleDP_AlertHdl1 is a BOOL DP with _alert_hdl active (priority=60, text="Value to 1").
// Writing true triggers the alert (came), writing false resets it (went).

const {
  gql,
  DP_BIT,
  assertNoErrors, assertNotNull, assertEqual, assertIsArray, dig, writeResult
} = require('./helpers')

const ALERT_DP    = DP_BIT
const ALERT_NAMES = [':_alert_hdl.._value', ':_alert_hdl.._text']

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function triggerAlerts() {
  const startMs = Date.now()
  for (let i = 0; i < 3; i++) {
    await gql(`mutation { api { dp { setWait(dpeNames: ["${ALERT_DP}"], values: [true]) } } }`)
    await sleep(50)
    await gql(`mutation { api { dp { setWait(dpeNames: ["${ALERT_DP}"], values: [false]) } } }`)
    await sleep(50)
  }
  return {
    start: new Date(startMs - 1000).toISOString(),
    end:   new Date(Date.now() + 1000).toISOString()
  }
}

module.exports = {
  name: 'Suite 8 — Alert Queries (GraphQL)',

  async run(t) {

    await t('8.1', 'api.alert.alertGetPeriod → trigger 3x then query window', async () => {
      const { start, end } = await triggerAlerts()
      await sleep(300)

      const res = await gql(`
        { api { alert {
          alertGetPeriod(
            startTime: "${start}",
            endTime:   "${end}",
            names:     ${JSON.stringify(ALERT_NAMES)}
          ) { alertTimes { time count dpe } values }
        } } }
      `)
      assertNoErrors(res, '8.1')
      const result = dig(res, 'data.api.alert.alertGetPeriod')
      assertNotNull(result, 'alertGetPeriod result')
      assertIsArray(result.alertTimes, 'alertTimes')
      assertIsArray(result.values, 'values')
      if (result.alertTimes.length === 0)
        throw new Error('Expected alert events but got empty alertTimes array')
      assertEqual(result.alertTimes.length, result.values.length, 'alertTimes/values length match')
      assertNotNull(result.alertTimes[0].time, 'alertTimes[0].time')
      assertNotNull(result.alertTimes[0].dpe,  'alertTimes[0].dpe')
      writeResult('08-01-alert-get-period', { start, end, alertDp: ALERT_DP, names: ALERT_NAMES, result })
    })
  }
}
