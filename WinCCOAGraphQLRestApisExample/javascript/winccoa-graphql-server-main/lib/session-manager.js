// Session Manager for WinCC OA GraphQL / REST Server
//
// Manages one WinccoaManager instance per authenticated session.
// On login  → createSession()   creates a new WinccoaManager and resolver set.
// On every authenticated request → getSession() resets the idle timer.
// After TOKEN_EXPIRY_MS of inactivity → idle timer fires, session is destroyed.
// On explicit logout → destroySession() tears everything down immediately.
// On server shutdown → destroyAll() tears down every active session.
//
// Static bypass tokens (DIRECT_ACCESS_TOKEN / READONLY_TOKEN) and DISABLE_AUTH
// mode use the global WinccoaManager passed in from index.js — they do NOT get
// a session entry in this manager.

const { WinccoaManager } = require('winccoa-manager')

// Resolver factories — called once per session with a fresh WinccoaManager
// graphql-factories.js is a thin re-export shim that avoids fragile relative paths
const factories = require('./graphql-factories')
const { createCommonResolvers }           = factories.common
const { createAlertOperationResolvers }   = factories.alerting
const { createSubscriptionResolvers }     = factories.subscriptions
const { createCnsOperationResolvers }     = factories.cns
const { createExtrasResolvers }           = factories.extras
const { createV2Resolvers }               = factories.resolvers

/**
 * Creates and manages per-session WinccoaManager instances.
 *
 * @param {object} options
 * @param {object} options.logger           - Logger instance
 * @param {boolean} options.debugWinccoa    - If true, wrap each WinccoaManager in the debug Proxy
 * @param {Map}    options.tokenStore       - The auth tokenStore Map (from lib/auth.js)
 * @param {number} options.idleTimeoutMs    - Idle timeout in milliseconds (default: TOKEN_EXPIRY_MS)
 * @param {function} options.mergeResolvers - Resolver-merge helper from index.js
 * @returns {SessionManager}
 */
function createSessionManager({ logger, debugWinccoa, tokenStore, idleTimeoutMs, mergeResolvers }) {
  // Map<tokenId, SessionEntry>
  // SessionEntry: { winccoa, resolvers, idleTimer, sseConnections: Set<{id, type}> }
  const sessionStore = new Map()

  /**
   * Wraps a WinccoaManager in the optional debug-logging Proxy.
   * Mirrors the same proxy logic in index.js.
   */
  function wrapWinccoa(winccoaBase) {
    if (!debugWinccoa) return winccoaBase
    return new Proxy(winccoaBase, {
      get(target, prop) {
        const value = target[prop]
        if (typeof value === 'function') {
          return function (...args) {
            console.log(`[WINCCOA] ${prop}(${args.map(a => JSON.stringify(a)).join(', ')})`)
            const result = value.apply(target, args)
            if (result instanceof Promise) {
              return result.then(res => {
                console.log(`[WINCCOA] ${prop} => ${JSON.stringify(res)}`)
                return res
              }).catch(err => {
                console.log(`[WINCCOA] ${prop} => ERROR: ${err.message}`)
                throw err
              })
            }
            console.log(`[WINCCOA] ${prop} => ${JSON.stringify(result)}`)
            return result
          }
        }
        return value
      }
    })
  }

  /**
   * Builds the flat oldResolvers object (V1 API) for a given winccoa instance.
   * This is equivalent to what index.js does once globally — here it is called
   * per session so each session has its own resolver closures.
   */
  function buildResolvers(winccoa) {
    const commonResolvers   = createCommonResolvers(winccoa, logger)
    const alertResolvers    = createAlertOperationResolvers(winccoa)
    const subResolvers      = createSubscriptionResolvers(winccoa, logger)
    const cnsResolvers      = createCnsOperationResolvers(winccoa)
    const extrasResolvers   = createExtrasResolvers(winccoa, logger)

    const oldResolvers = mergeResolvers(
      commonResolvers,
      alertResolvers,
      subResolvers,
      cnsResolvers,
      extrasResolvers
    )

    const v2Resolvers = createV2Resolvers(winccoa, logger, oldResolvers)

    return { oldResolvers, v2Resolvers }
  }

  /**
   * Starts (or resets) the idle timer for a session.
   * When the timer fires the session is destroyed.
   */
  function resetIdleTimer(tokenId, entry) {
    if (entry.idleTimer) clearTimeout(entry.idleTimer)
    entry.idleTimer = setTimeout(() => {
      logger.info(`Session idle timeout for tokenId=${tokenId.substring(0, 8)}... — destroying session`)
      destroySession(tokenId)
    }, idleTimeoutMs)
    // Allow the timer to be garbage-collected without blocking Node.js exit
    if (entry.idleTimer.unref) entry.idleTimer.unref()
  }

  /**
   * Creates a new session entry for the given tokenId.
   * Called immediately after generateToken() in the login flow.
   *
   * @param {string} tokenId  - UUID token ID (from lib/auth.js generateToken)
   * @param {string} role     - 'admin' | 'readonly'
   */
  function createSession(tokenId, role) {
    if (sessionStore.has(tokenId)) {
      // Should not happen under normal operation; guard against double-login
      logger.warn(`createSession called for already-existing tokenId=${tokenId.substring(0, 8)}... — replacing`)
      _destroyEntry(tokenId, sessionStore.get(tokenId))
    }

    logger.info(`Creating session for tokenId=${tokenId.substring(0, 8)}... role=${role}`)

    const winccoaBase = new WinccoaManager()
    const winccoa     = wrapWinccoa(winccoaBase)
    const { oldResolvers, v2Resolvers } = buildResolvers(winccoa)

    const entry = {
      winccoa,
      oldResolvers,
      v2Resolvers,
      role,
      idleTimer: null,
      // Tracks open SSE/dpConnect/dpQueryConnect IDs so destroySession can
      // disconnect them even if the HTTP client is still connected.
      sseConnections: new Set()  // Set<{ id: number|string, type: 'dpConnect'|'dpQueryConnect' }>
    }

    resetIdleTimer(tokenId, entry)
    sessionStore.set(tokenId, entry)
    logger.debug(`Session created — active sessions: ${sessionStore.size}`)
    return entry
  }

  /**
   * Retrieves a session by tokenId and resets its idle timer.
   * Returns null for unknown/expired tokenIds (caller should 401).
   *
   * @param {string} tokenId
   * @returns {{ winccoa, oldResolvers, v2Resolvers, sseConnections }|null}
   */
  function getSession(tokenId) {
    const entry = sessionStore.get(tokenId)
    if (!entry) return null
    resetIdleTimer(tokenId, entry)
    return entry
  }

  /**
   * Tears down a session:
   * 1. Clears the idle timer
   * 2. Disconnects all tracked SSE/dpConnect subscriptions
   * 3. Removes the token from the auth tokenStore
   * 4. Removes the session entry
   *
   * Safe to call multiple times (idempotent after first call).
   *
   * @param {string} tokenId
   */
  function destroySession(tokenId) {
    const entry = sessionStore.get(tokenId)
    if (!entry) return
    _destroyEntry(tokenId, entry)
    sessionStore.delete(tokenId)
    logger.debug(`Session destroyed — active sessions: ${sessionStore.size}`)
  }

  /**
   * Internal: performs the actual teardown of a session entry without
   * removing it from the map (so the caller can do that atomically).
   */
  function _destroyEntry(tokenId, entry) {
    // 1. Cancel the idle timer
    if (entry.idleTimer) {
      clearTimeout(entry.idleTimer)
      entry.idleTimer = null
    }

    // 2. Disconnect all open WinCC OA subscriptions
    for (const conn of entry.sseConnections) {
      try {
        if (conn.type === 'dpConnect') {
          entry.winccoa.dpDisconnect(conn.id)
          logger.debug(`Session cleanup: dpDisconnect(${conn.id})`)
        } else if (conn.type === 'dpQueryConnect') {
          entry.winccoa.dpQueryDisconnect(conn.id)
          logger.debug(`Session cleanup: dpQueryDisconnect(${conn.id})`)
        }
      } catch (err) {
        // Log but do not rethrow — cleanup must be best-effort
        logger.warn(`Session cleanup error disconnecting ${conn.type}(${conn.id}): ${err.message}`)
      }
    }
    entry.sseConnections.clear()

    // 3. Remove the token from the auth store (if it is still there)
    tokenStore.delete(tokenId)
  }

  /**
   * Destroys all active sessions.
   * Called during graceful server shutdown.
   */
  function destroyAll() {
    logger.info(`Destroying all ${sessionStore.size} active session(s) on shutdown`)
    for (const [tokenId, entry] of sessionStore.entries()) {
      _destroyEntry(tokenId, entry)
    }
    sessionStore.clear()
  }

  /**
   * Returns the number of active sessions.
   * Useful for health checks and logging.
   */
  function sessionCount() {
    return sessionStore.size
  }

  return {
    createSession,
    getSession,
    destroySession,
    destroyAll,
    sessionCount
  }
}

module.exports = { createSessionManager }
