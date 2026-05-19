// REST API Router for WinCC OA GraphQL Server
const express = require('express')

// Route modules (loaded at module level, not inside the factory function)
const authRoutes = require('./routes/auth-routes')
const datapointRoutes = require('./routes/datapoint-routes')
const { createQueryRouter } = datapointRoutes
const datapointTypeRoutes = require('./routes/datapoint-type-routes')
const tagRoutes = require('./routes/tag-routes')
const alertRoutes = require('./routes/alert-routes')
const cnsRoutes = require('./routes/cns-routes')
const systemRoutes = require('./routes/system-routes')
const extrasRoutes = require('./routes/extras-routes')
const subscriptionRoutes = require('./routes/subscription-routes')

/**
 * Creates the main REST API router for WinCC OA operations.
 *
 * Provides RESTful endpoints that wrap WinCC OA functions and GraphQL resolvers.
 * Includes authentication, authorization, and usage tracking middleware.
 *
 * Each authenticated request gets its own per-session WinccoaManager and resolver
 * set (looked up via SessionManager using the token's tokenId).
 * Static bypass tokens (DIRECT_ACCESS_TOKEN / READONLY_TOKEN) and DISABLE_AUTH
 * mode fall back to the global winccoa instance passed in as the first argument.
 *
 * @param {WinccoaManager} globalWinccoa   - Global WinCC OA manager instance (fallback for no-auth / static tokens)
 * @param {object}         logger          - Logger instance for error reporting
 * @param {object}         globalResolvers - Global resolver set (fallback for no-auth / static tokens)
 * @param {boolean}        DISABLE_AUTH    - Whether to disable authentication
 * @param {object}         sessionManager  - SessionManager instance (may be null when DISABLE_AUTH=true)
 * @returns {express.Router} Express router with all REST API endpoints
 */
function createRestApi(globalWinccoa, logger, globalResolvers, DISABLE_AUTH, sessionManager) {
  const router = express.Router()

  /**
   * Authentication middleware for REST API.
   * Validates bearer token, attaches req.user, req.winccoa, and req.resolvers.
   *
   * - DISABLE_AUTH=true   → anonymous user, global winccoa + resolvers
   * - Static bypass token → static user, global winccoa + resolvers
   * - Normal JWT session  → per-session winccoa + resolvers from SessionManager
   */
  const restAuthMiddleware = (req, res, next) => {
    // Skip authentication if disabled
    if (DISABLE_AUTH) {
      req.user     = { userId: 'anonymous', tokenId: 'no-auth', role: 'admin' }
      req.winccoa  = globalWinccoa
      req.resolvers = globalResolvers
      return next()
    }

    // Check for Authorization header
    const authHeader = req.headers.authorization || req.headers.Authorization

    if (!authHeader) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing Authorization header' })
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid Authorization header format' })
    }

    const token = authHeader.substring(7)
    const user  = req.app.locals.validateToken(token)

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' })
    }

    req.user = user

    // Attach per-session resources (winccoa + resolvers)
    const isStaticToken = user.tokenId === 'direct' || user.tokenId === 'readonly'
    if (isStaticToken || !sessionManager) {
      req.winccoa   = globalWinccoa
      req.resolvers = globalResolvers
    } else {
      const session = sessionManager.getSession(user.tokenId)
      if (session) {
        req.winccoa   = session.winccoa
        req.resolvers = session.oldResolvers
      } else {
        logger.warn(`REST: no session for tokenId=${user.tokenId.substring(0, 8)}... — rejecting request`)
        return res.status(401).json({ error: 'Unauthorized', message: 'Session expired or invalid' })
      }
    }

    next()
  }

  /**
   * Middleware to check for admin role.
   * Returns 403 Forbidden if user doesn't have admin privileges.
   */
  const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin role required' })
    }
    next()
  }

  /**
   * Usage tracking middleware for all REST API calls.
   * Records the matched route template (e.g. GET /datapoints/:dpeName/value) rather than
   * the expanded path, so stats stay bounded regardless of how many unique DP names are used.
   * Tracking is deferred to res.on('finish') so that req.route is available after routing.
   */
  router.use((req, res, next) => {
    // Capture mount point before next() changes req.baseUrl
    const middlewareBase = req.baseUrl
    res.on('finish', () => {
      const usageTracker = req.app.locals.usageTracker
      if (!usageTracker) return
      let endpoint
      if (req.route) {
        // req.baseUrl at finish time is the subrouter prefix (e.g. '/restapi/v1/datapoints')
        // req.route.path is the local template   (e.g. '/:dpeName/value')
        const fullPattern = req.baseUrl + req.route.path
        // Strip the outer router prefix to get a path relative to this router
        endpoint = fullPattern.startsWith(middlewareBase)
          ? fullPattern.slice(middlewareBase.length)
          : fullPattern
      } else {
        // Unmatched route (404) — req.path carries no dynamic DP names here
        endpoint = req.path
      }
      usageTracker.track('restapi', `${req.method} ${endpoint}`)
    })
    next()
  })

  /**
   * Health check endpoint (no auth required).
   * Returns service status and uptime.
   */
  router.get('/health', (req, res) => {
    const sm = req.app.locals.sessionManager
    res.json({
      status: 'healthy',
      service: 'WinCC OA REST API',
      uptime: process.uptime(),
      activeSessions: sm ? sm.sessionCount() : 0
    })
  })

  /**
   * Usage statistics endpoint (no auth required).
   * Returns API call statistics tracked by UsageTracker.
   * Query parameter 'sortBy' can be 'name' or 'count' to control sort order.
   */
  router.get('/stats', (req, res) => {
    const usageTracker = req.app.locals.usageTracker
    if (!usageTracker) {
      return res.status(500).json({ error: 'Usage tracker not available' })
    }

    const sortBy = req.query.sortBy || 'name' // 'name' or 'count'
    const stats = sortBy === 'count'
      ? usageTracker.getStatsSortedByCount()
      : usageTracker.getStatsSortedByName()

    res.json({
      stats,
      total: stats.length,
      sortBy
    })
  })

  // Mount authentication routes (no auth required for login / logout)
  router.use('/auth', authRoutes)

  // Apply authentication middleware to all routes below
  router.use(restAuthMiddleware)

  // Mount route modules — routes use req.winccoa and req.resolvers set by restAuthMiddleware
  router.use('/datapoints',      datapointRoutes(logger, requireAdmin))
  router.use('/datapoint-types', datapointTypeRoutes(logger, requireAdmin))
  router.use('/tags',            tagRoutes(logger))
  router.use('/alerts',          alertRoutes(logger, requireAdmin))
  router.use('/cns',             cnsRoutes(logger, requireAdmin))
  router.use('/system',          systemRoutes(logger))
  router.use('/extras',          extrasRoutes(logger, requireAdmin))
  router.use('/query',           createQueryRouter(logger))
  router.use('/subscriptions',   subscriptionRoutes(logger))

  // 404 handler
  router.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Endpoint ${req.method} ${req.path} not found`
    })
  })

  // Error handler
  router.use((err, req, res, next) => {
    // WinCC OA "not found" errors are expected client errors — the response
    // already carries the information, so a SEVERE server log is noise.
    const msg = err.message || ''
    const isExpected = /\b(71|57|76),/.test(msg) || /not found/i.test(msg)
    if (isExpected) {
      logger.debug('REST API not-found (expected):', msg)
    } else {
      logger.error('REST API Error:', err)
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    })
  })

  return router
}

module.exports = { createRestApi }
