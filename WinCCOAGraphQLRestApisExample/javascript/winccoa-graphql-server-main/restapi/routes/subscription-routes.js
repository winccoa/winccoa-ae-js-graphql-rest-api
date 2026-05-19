// SSE subscription routes for WinCC OA REST API
// Mirrors the GraphQL WebSocket subscriptions as Server-Sent Events endpoints.
//
// Uses req.winccoa (per-session WinccoaManager set by restAuthMiddleware) for all
// WinCC OA calls. Active SSE connection IDs are registered on the session's
// sseConnections Set so that destroySession() can disconnect them if the session
// is terminated by idle timeout or explicit logout while the SSE stream is open.
const express = require('express')

/**
 * Creates SSE subscription routes that wrap WinCC OA real-time connection functions.
 *
 * Endpoints stream JSON events over Server-Sent Events (text/event-stream).
 * Each event line is: data: <JSON>\n\n
 * On client disconnect the WinCC OA connection is cleaned up automatically.
 *
 * @param {object} logger - Logger instance
 * @returns {express.Router}
 */
module.exports = function createSubscriptionRoutes(logger) {
  const router = express.Router()

  // Helper: set SSE response headers and flush them immediately so the client
  // sees the connection upgrade before the first event arrives.
  function startSse(res) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()
  }

  // Helper: write a single SSE data event.
  function writeEvent(res, payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  // Helper: write an error event and end the response.
  function writeErrorAndEnd(res, message) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`)
    res.end()
  }

  /**
   * Register a connection ID on the session's sseConnections set so that
   * destroySession() can disconnect it on idle timeout / logout.
   * req.user.sseConnections is the set stored in the SessionManager entry.
   * This is retrieved via req.sseConnections set up below.
   */
  function trackConnection(req, id, type) {
    if (req.sseConnections) {
      req.sseConnections.add({ id, type })
    }
  }

  function untrackConnection(req, id, type) {
    if (req.sseConnections) {
      for (const conn of req.sseConnections) {
        if (conn.id === id && conn.type === type) {
          req.sseConnections.delete(conn)
          break
        }
      }
    }
  }

  /**
   * Middleware: attach the session's sseConnections Set to req so handlers can
   * register/unregister active connections. Falls back to a throw-away Set when
   * there is no session (DISABLE_AUTH or static token).
   */
  router.use((req, res, next) => {
    const sessionManager = req.app.locals.sessionManager
    const user = req.user

    if (sessionManager && user && user.tokenId && user.tokenId !== 'no-auth'
        && user.tokenId !== 'direct' && user.tokenId !== 'readonly') {
      const session = sessionManager.getSession(user.tokenId)
      req.sseConnections = session ? session.sseConnections : new Set()
    } else {
      req.sseConnections = new Set() // throw-away, not tracked for cleanup
    }
    next()
  })

  /**
   * GET /restapi/v1/subscriptions/dp-connect
   *
   * Subscribe to real-time data point element changes via dpConnect.
   * Supports multiple DPEs by repeating the dpeNames query parameter.
   *
   * Query params:
   *   dpeNames  string | string[]  Required. One or more DPE names.
   *                                Example: ?dpeNames=Dp1:elem&dpeNames=Dp2:elem
   *   answer    boolean            Optional. Default true. Send current value on connect.
   *
   * SSE event data shape:
   *   { dpeNames: string[], values: any[], type: string, error: string|null }
   */
  router.get('/dp-connect', async (req, res) => {
    const rawNames = req.query.dpeNames
    if (!rawNames) {
      return res.status(400).json({ error: 'Bad Request', message: 'dpeNames query parameter is required' })
    }
    const dpeNames = Array.isArray(rawNames) ? rawNames : [rawNames]
    const answer = req.query.answer !== 'false'

    startSse(res)

    let connectionId = null
    const winccoa = req.winccoa

    const callback = (names, values, type, error) => {
      writeEvent(res, { dpeNames: names, values, type, error: error || null })
    }

    try {
      connectionId = await winccoa.dpConnect(callback, dpeNames, answer)
      trackConnection(req, connectionId, 'dpConnect')
      logger.info(`SSE dpConnect ${connectionId} opened for: ${dpeNames.join(', ')}`)
    } catch (err) {
      logger.error('SSE dpConnect failed:', err)
      writeErrorAndEnd(res, err.message)
      return
    }

    req.on('close', () => {
      if (connectionId !== null) {
        untrackConnection(req, connectionId, 'dpConnect')
        try {
          winccoa.dpDisconnect(connectionId)
          logger.info(`SSE dpConnect ${connectionId} closed`)
        } catch (err) {
          logger.error(`SSE dpConnect ${connectionId} disconnect error:`, err)
        }
      }
    })
  })

  /**
   * GET /restapi/v1/subscriptions/dp-query-connect-single
   *
   * Subscribe to query result updates returning the most recent result set.
   * Wraps dpQueryConnectSingle(callback, answer, query, blockingTime).
   *
   * Query params:
   *   query        string   Required. dpQuery SQL-like query string.
   *   answer       boolean  Optional. Default true.
   *   blockingTime number   Optional. Blocking time in ms.
   *
   * SSE event data shape:
   *   { values: any[][], type: string, error: string|null }
   */
  router.get('/dp-query-connect-single', async (req, res) => {
    const { query, blockingTime } = req.query
    if (!query) {
      return res.status(400).json({ error: 'Bad Request', message: 'query query parameter is required' })
    }
    const answer = req.query.answer !== 'false'
    const blockingTimeNum = blockingTime !== undefined ? Number(blockingTime) : undefined

    startSse(res)

    let connectionId = null
    const winccoa = req.winccoa

    const callback = (resultTable) => {
      writeEvent(res, { values: resultTable, type: 'update', error: null })
    }

    try {
      connectionId = await winccoa.dpQueryConnectSingle(callback, answer, query, blockingTimeNum)
      if (connectionId < 0) {
        throw new Error(`dpQueryConnectSingle returned error code ${connectionId}`)
      }
      trackConnection(req, connectionId, 'dpQueryConnect')
      logger.info(`SSE dpQueryConnectSingle ${connectionId} opened for: ${query}`)
    } catch (err) {
      logger.error('SSE dpQueryConnectSingle failed:', err)
      writeErrorAndEnd(res, err.message)
      return
    }

    req.on('close', () => {
      untrackConnection(req, connectionId, 'dpQueryConnect')
      try {
        winccoa.dpQueryDisconnect(connectionId)
        logger.info(`SSE dpQueryConnectSingle ${connectionId} closed`)
      } catch (err) {
        logger.error(`SSE dpQueryConnectSingle ${connectionId} disconnect error:`, err)
      }
    })
  })

  /**
   * GET /restapi/v1/subscriptions/dp-query-connect-all
   *
   * Subscribe to query result updates returning the complete result set each time.
   * Wraps dpQueryConnectAll(callback, answer, query, blockingTime).
   *
   * Query params:
   *   query        string   Required. dpQuery SQL-like query string.
   *   answer       boolean  Optional. Default true.
   *   blockingTime number   Optional. Blocking time in ms.
   *
   * SSE event data shape:
   *   { values: any[][], type: string, error: string|null }
   */
  router.get('/dp-query-connect-all', async (req, res) => {
    const { query, blockingTime } = req.query
    if (!query) {
      return res.status(400).json({ error: 'Bad Request', message: 'query query parameter is required' })
    }
    const answer = req.query.answer !== 'false'
    const blockingTimeNum = blockingTime !== undefined ? Number(blockingTime) : undefined

    startSse(res)

    let connectionId = null
    const winccoa = req.winccoa

    const callback = (resultTable) => {
      writeEvent(res, { values: resultTable, type: 'update', error: null })
    }

    try {
      connectionId = await winccoa.dpQueryConnectAll(callback, answer, query, blockingTimeNum)
      if (connectionId < 0) {
        throw new Error(`dpQueryConnectAll returned error code ${connectionId}`)
      }
      trackConnection(req, connectionId, 'dpQueryConnect')
      logger.info(`SSE dpQueryConnectAll ${connectionId} opened for: ${query}`)
    } catch (err) {
      logger.error('SSE dpQueryConnectAll failed:', err)
      writeErrorAndEnd(res, err.message)
      return
    }

    req.on('close', () => {
      untrackConnection(req, connectionId, 'dpQueryConnect')
      try {
        winccoa.dpQueryDisconnect(connectionId)
        logger.info(`SSE dpQueryConnectAll ${connectionId} closed`)
      } catch (err) {
        logger.error(`SSE dpQueryConnectAll ${connectionId} disconnect error:`, err)
      }
    })
  })

  return router
}
