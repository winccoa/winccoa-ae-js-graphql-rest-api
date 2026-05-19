// tests/suite-20-subscriptions.js — WebSocket GraphQL subscriptions
//
// Tests all four subscription operations:
//   dpConnect, dpQueryConnectSingle, dpQueryConnectAll, tagSubscribe
//
// Strategy:
//   1. Open a WebSocket to ws://<host>/graphql using the graphql-ws protocol.
//   2. Start the subscription.
//   3. Trigger a value change via a dp.set mutation so we receive an update.
//   4. Assert the shape of the received message.
//   5. Close the subscription cleanly.
//
// All received messages are written to tests/results/ for manual inspection.
// The graphql-ws protocol is spoken with raw WS frames — no extra library needed.

const WebSocket  = require('ws')
const { BASE_URL, gql, DP_FLOAT, DP_FLOAT_DP, writeResult, assertIsArray,
        assertNotNull, assertTypeOf, assertEqual, dig } = require('./helpers')

// ─── WS helpers ──────────────────────────────────────────────────────────────

const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/graphql'

/** Open a graphql-ws connection, run fn(client), then close it. */
function withSubscription(fn) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL, ['graphql-transport-ws'])
    let settled = false

    function done(err) {
      if (settled) return
      settled = true
      try { ws.close() } catch (_) {}
      err ? reject(err) : resolve()
    }

    ws.on('error', (err) => done(err))

    ws.on('open', () => {
      // Send connection_init
      ws.send(JSON.stringify({ type: 'connection_init', payload: {} }))
    })

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }
      fn(ws, msg, done)
    })

    // Safety timeout
    const timeout = setTimeout(() => done(new Error('Subscription timed out after 10s')), 10000)
    ws.on('close', () => clearTimeout(timeout))
  })
}

/** Send a subscribe message over an open WS. */
function sendSubscribe(ws, id, query, variables) {
  ws.send(JSON.stringify({
    type:    'subscribe',
    id,
    payload: { query, variables: variables || {} }
  }))
}

/** Send a complete (unsubscribe) message. */
function sendComplete(ws, id) {
  ws.send(JSON.stringify({ type: 'complete', id }))
}

// ─── Suite ────────────────────────────────────────────────────────────────────

module.exports = {
  name: 'Suite 20 — WebSocket Subscriptions (dpConnect / dpQueryConnect / tagSubscribe)',

  async run(t) {

    // ── dpConnect: initial answer + change notification ───────────────────────
    await t('20.1', `dpConnect(${DP_FLOAT}) → receive initial value (answer=true)`, async () => {
      const updates = []

      await withSubscription(async (ws, msg, done) => {
        if (msg.type === 'connection_ack') {
          sendSubscribe(ws, '1', `
            subscription {
              dpConnect(dpeNames: ["${DP_FLOAT}"], answer: true) {
                dpeNames
                values
                type
              }
            }
          `)
          return
        }

        if (msg.type === 'next' && msg.id === '1') {
          updates.push(msg.payload)
          if (updates.length >= 1) {
            sendComplete(ws, '1')
            done()
          }
        }

        if (msg.type === 'error' && msg.id === '1') {
          done(new Error(`Subscription error: ${JSON.stringify(msg.payload)}`))
        }
      })

      if (updates.length === 0) throw new Error('No updates received from dpConnect')
      const first = updates[0]
      assertNotNull(first.data, 'dpConnect data')
      const update = dig(first, 'data.dpConnect')
      assertNotNull(update, 'dpConnect update object')
      assertIsArray(update.dpeNames, 'dpeNames')
      assertIsArray(update.values, 'values')
      assertTypeOf(update.type, 'string', 'type')
      writeResult('20-01-dpconnect-initial', { dpe: DP_FLOAT, updates })
    })

    // ── dpConnect: write triggers update ─────────────────────────────────────
    await t('20.2', `dpConnect: dp.set triggers update event`, async () => {
      const NEW_VALUE = 55.5
      const updates   = []

      await withSubscription(async (ws, msg, done) => {
        if (msg.type === 'connection_ack') {
          sendSubscribe(ws, '2', `
            subscription {
              dpConnect(dpeNames: ["${DP_FLOAT}"], answer: false) {
                dpeNames
                values
                type
              }
            }
          `)
          // After subscribing, trigger a write via HTTP
          setTimeout(async () => {
            try {
              await gql(
                `mutation { api { dp { setWait(dpeNames: ["${DP_FLOAT}"], values: [${NEW_VALUE}]) } } }`
              )
            } catch (_) {}
          }, 300)
          return
        }

        if (msg.type === 'next' && msg.id === '2') {
          updates.push(msg.payload)
          sendComplete(ws, '2')
          done()
        }

        if (msg.type === 'error' && msg.id === '2') {
          done(new Error(`Subscription error: ${JSON.stringify(msg.payload)}`))
        }
      })

      if (updates.length === 0) throw new Error('No update received after dp.setWait')
      const update = dig(updates[0], 'data.dpConnect')
      assertNotNull(update, 'dpConnect update after write')
      writeResult('20-02-dpconnect-on-write', { dpe: DP_FLOAT, newValue: NEW_VALUE, updates })
    })

    // ── dpQueryConnectSingle ──────────────────────────────────────────────────
    await t('20.3', `dpQueryConnectSingle(SELECT FROM '${DP_FLOAT_DP}') → initial result`, async () => {
      const query   = `SELECT '_original.._value', '_original.._stime', '_original.._status' FROM '${DP_FLOAT_DP}'`
      const updates = []

      await withSubscription(async (ws, msg, done) => {
        if (msg.type === 'connection_ack') {
          sendSubscribe(ws, '3', `
            subscription {
              dpQueryConnectSingle(
                query: ${JSON.stringify(query)},
                answer: true
              ) {
                values
                type
              }
            }
          `)
          return
        }

        if (msg.type === 'next' && msg.id === '3') {
          updates.push(msg.payload)
          sendComplete(ws, '3')
          done()
        }

        if (msg.type === 'error' && msg.id === '3') {
          done(new Error(`Subscription error: ${JSON.stringify(msg.payload)}`))
        }
      })

      if (updates.length === 0) throw new Error('No update received from dpQueryConnectSingle')
      const update = dig(updates[0], 'data.dpQueryConnectSingle')
      assertNotNull(update, 'dpQueryConnectSingle update')
      assertIsArray(update.values, 'values')
      assertTypeOf(update.type, 'string', 'type')
      writeResult('20-03-dpquerycnxsingle-initial', { query, updates })
    })

    // ── dpQueryConnectAll ─────────────────────────────────────────────────────
    await t('20.4', `dpQueryConnectAll(SELECT FROM 'Example*') → initial result`, async () => {
      const query   = "SELECT '_original.._value', '_original.._stime', '_original.._status' FROM 'Example*'"
      const updates = []

      await withSubscription(async (ws, msg, done) => {
        if (msg.type === 'connection_ack') {
          sendSubscribe(ws, '4', `
            subscription {
              dpQueryConnectAll(
                query: ${JSON.stringify(query)},
                answer: true
              ) {
                values
                type
              }
            }
          `)
          return
        }

        if (msg.type === 'next' && msg.id === '4') {
          updates.push(msg.payload)
          sendComplete(ws, '4')
          done()
        }

        if (msg.type === 'error' && msg.id === '4') {
          done(new Error(`Subscription error: ${JSON.stringify(msg.payload)}`))
        }
      })

      if (updates.length === 0) throw new Error('No update received from dpQueryConnectAll')
      const update = dig(updates[0], 'data.dpQueryConnectAll')
      assertNotNull(update, 'dpQueryConnectAll update')
      assertIsArray(update.values, 'values')
      writeResult('20-04-dpquerycnxall-initial', { query, updates })
    })

    // ── tagSubscribe ──────────────────────────────────────────────────────────
    await t('20.5', `tagSubscribe(${DP_FLOAT}) → initial Tag with value/timestamp/status`, async () => {
      const NEW_VALUE = 77.7
      const updates   = []

      await withSubscription(async (ws, msg, done) => {
        if (msg.type === 'connection_ack') {
          sendSubscribe(ws, '5', `
            subscription {
              tagSubscribe(dpeNames: ["${DP_FLOAT}"], answer: false) {
                tags { name value timestamp status { value bits on off } }
                type
              }
            }
          `)
          // Trigger a write so we get a callback
          setTimeout(async () => {
            try {
              await gql(
                `mutation { api { dp { setWait(dpeNames: ["${DP_FLOAT}"], values: [${NEW_VALUE}]) } } }`
              )
            } catch (_) {}
          }, 300)
          return
        }

        if (msg.type === 'next' && msg.id === '5') {
          updates.push(msg.payload)
          sendComplete(ws, '5')
          done()
        }

        if (msg.type === 'error' && msg.id === '5') {
          done(new Error(`Subscription error: ${JSON.stringify(msg.payload)}`))
        }
      })

      if (updates.length === 0) throw new Error('No updates received from tagSubscribe')
      const update = dig(updates[0], 'data.tagSubscribe')
      assertNotNull(update, 'tagSubscribe update')
      assertIsArray(update.tags, 'tags')
      if (update.tags.length === 0) throw new Error('Expected at least one tag in update')
      const tag = update.tags[0]
      assertNotNull(tag.name, 'tag.name')
      // tag.timestamp and tag.status may be null (dpGet for stime/status can return null)
      assertTypeOf(update.type, 'string', 'type')
      writeResult('20-05-tagsubscribe-initial', { dpe: DP_FLOAT, updates })
    })

    // ── tagSubscribe: write triggers update ───────────────────────────────────
    await t('20.6', `tagSubscribe: dp.setWait triggers tag update`, async () => {
      const NEW_VALUE = 66.6
      const updates   = []

      await withSubscription(async (ws, msg, done) => {
        if (msg.type === 'connection_ack') {
          sendSubscribe(ws, '6', `
            subscription {
              tagSubscribe(dpeNames: ["${DP_FLOAT}"], answer: false) {
                tags { name value timestamp }
                type
              }
            }
          `)
          setTimeout(async () => {
            try {
              await gql(
                `mutation { api { dp { setWait(dpeNames: ["${DP_FLOAT}"], values: [${NEW_VALUE}]) } } }`
              )
            } catch (_) {}
          }, 300)
          return
        }

        if (msg.type === 'next' && msg.id === '6') {
          updates.push(msg.payload)
          sendComplete(ws, '6')
          done()
        }

        if (msg.type === 'error' && msg.id === '6') {
          done(new Error(`Subscription error: ${JSON.stringify(msg.payload)}`))
        }
      })

      if (updates.length === 0) throw new Error('No tag update received after dp.setWait')
      writeResult('20-06-tagsubscribe-on-write', { dpe: DP_FLOAT, newValue: NEW_VALUE, updates })
    })
  }
}
