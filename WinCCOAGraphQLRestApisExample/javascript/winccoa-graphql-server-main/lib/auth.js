// Authentication utilities for WinCC OA GraphQL / REST Server

const jwt = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')

const JWT_SECRET      = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const TOKEN_EXPIRY_MS = parseInt(process.env.TOKEN_EXPIRY_MS || '1200000') // default 20 minutes
const DEFAULT_JWT_SECRET = 'your-secret-key-change-in-production'
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const ALLOW_DEV_LOGIN = process.env.ALLOW_DEV_LOGIN === 'true'

// Auth credentials from environment
const ADMIN_USERNAME    = process.env.ADMIN_USERNAME
const ADMIN_PASSWORD    = process.env.ADMIN_PASSWORD
const READONLY_USERNAME = process.env.READONLY_USERNAME
const READONLY_PASSWORD = process.env.READONLY_PASSWORD
const DIRECT_ACCESS_TOKEN = process.env.DIRECT_ACCESS_TOKEN
const READONLY_TOKEN    = process.env.READONLY_TOKEN

// AUTH_MODE controls how username/password logins are validated:
//   'config'  (default) — only env-var credentials (ADMIN_USERNAME / READONLY_USERNAME)
//   'winccoa'           — only WinCC OA user database (getUserId + setUserId on a throwaway instance)
//   'both'              — try env-var first, fall back to WinCC OA
const AUTH_MODE = (process.env.AUTH_MODE || 'config').toLowerCase()

// Comma-separated list of WinCC OA usernames that should receive 'readonly' role.
// Only relevant when AUTH_MODE includes 'winccoa'.
// Example: WINCCOA_READONLY_USERS=guest,viewer,monitor
const WINCCOA_READONLY_USERS = new Set(
  (process.env.WINCCOA_READONLY_USERS || '').split(',').map(u => u.trim()).filter(Boolean)
)

// In-memory token store (replace with Redis or database in production)
const tokenStore = new Map()

/**
 * Generates a JWT token for user authentication.
 *
 * @param {string} userId - The user identifier
 * @param {string} [role='admin'] - The user role (admin or readonly)
 * @returns {{ token: string, expiresAt: number, tokenId: string }}
 */
function generateToken(userId, role = 'admin') {
  const tokenId  = uuidv4()
  const expiresAt = Date.now() + TOKEN_EXPIRY_MS

  const token = jwt.sign(
    { userId, tokenId, expiresAt, role },
    JWT_SECRET,
    { expiresIn: Math.floor(TOKEN_EXPIRY_MS / 1000) + 's' }
  )

  tokenStore.set(tokenId, { userId, role, expiresAt, lastActivity: Date.now() })

  // tokenId is returned so callers (e.g. SessionManager) can associate the
  // new token with a per-session WinccoaManager instance.
  return { token, expiresAt, tokenId }
}

/**
 * Validates a JWT token or direct access token.
 *
 * @param {string} token
 * @param {object} logger
 * @returns {object|null} Token data if valid, null otherwise
 */
function validateToken(token, logger) {
  logger.debug(`Validating token: ${token ? token.substring(0, 20) + '...' : 'null'}`)

  if (DIRECT_ACCESS_TOKEN && token === DIRECT_ACCESS_TOKEN) {
    logger.debug('Direct access token matched')
    return { userId: 'direct-access', tokenId: 'direct', role: 'admin' }
  }

  if (READONLY_TOKEN && token === READONLY_TOKEN) {
    logger.debug('Read-only direct token matched')
    return { userId: 'readonly-direct', tokenId: 'readonly', role: 'readonly' }
  }

  try {
    const decoded   = jwt.verify(token, JWT_SECRET)
    const tokenData = tokenStore.get(decoded.tokenId)

    if (!tokenData) {
      logger.debug('Token not found in store')
      return null
    }

    if (Date.now() > tokenData.expiresAt) {
      logger.debug('Token expired, removing from store')
      tokenStore.delete(decoded.tokenId)
      return null
    }

    // Slide expiry on activity
    tokenData.lastActivity = Date.now()
    tokenData.expiresAt    = Date.now() + TOKEN_EXPIRY_MS
    tokenStore.set(decoded.tokenId, tokenData)

    logger.debug(`JWT token validated for user: ${tokenData.userId}, role: ${tokenData.role}`)
    return { userId: tokenData.userId, tokenId: decoded.tokenId, role: tokenData.role || 'admin' }
  } catch (error) {
    logger.debug(`JWT validation failed: ${error.message}`)
    return null
  }
}

/**
 * Validates a username/password pair against WinCC OA's own user database.
 *
 * A **throwaway** WinccoaManager instance is created for the user lookup so
 * that setUserId() does not alter the user context of any long-lived manager.
 * The throwaway instance is discarded after this function returns.
 *
 * **Important limitation — password is NOT verified without server-side auth:**
 * `setUserId(id, password)` only enforces the password when WinCC OA
 * "Server-side Authentication for Managers" is active AND the manager process
 * is not running as root. When the manager runs as root (the typical case for
 * a server process), the password parameter is silently ignored and any value
 * is accepted. In that case this function only checks that the *user exists*
 * in the WinCC OA user management — it cannot distinguish a correct password
 * from a wrong one.
 *
 * If strict password verification is required, enable WinCC OA server-side
 * authentication and ensure the manager does not run as root.
 *
 * @param {string} username
 * @param {string} password
 * @param {object} logger
 * @returns {{ id: string, username: string, role: string }|null}
 */
function authenticateWinccoaUser(username, password, logger) {
  try {
    const { WinccoaManager } = require('winccoa-manager')
    const tmp = new WinccoaManager()

    const userId = tmp.getUserId(username)
    if (userId === undefined) {
      logger.debug(`WinCC OA user not found: ${username}`)
      return null
    }

    // setUserId with password validates the credentials.
    // It changes the user context of `tmp` only — `tmp` is discarded afterwards.
    const ok = tmp.setUserId(userId, password)
    if (!ok) return null

    const role = WINCCOA_READONLY_USERS.has(username) ? 'readonly' : 'admin'
    logger.info(`WinCC OA user authenticated: ${username} (id=${userId}) role=${role}`)
    return { id: username, username, role }
  } catch (err) {
    logger.debug(`WinCC OA auth failed for ${username}: ${err.message}`)
    return null
  }
}

/**
 * Authenticates a user by username/password.
 *
 * Behaviour is controlled by the AUTH_MODE environment variable:
 *
 *   'config'  (default) — Check ADMIN_USERNAME/ADMIN_PASSWORD and
 *                         READONLY_USERNAME/READONLY_PASSWORD env vars only.
 *                         Falls back to dev/dev only when ALLOW_DEV_LOGIN=true
 *                         and NODE_ENV is not production.
 *
 *   'winccoa'           — Validate against WinCC OA's own user database using a
 *                         throwaway WinccoaManager (getUserId + setUserId). No
 *                         env-var credential check. Role is 'readonly' if the
 *                         username appears in WINCCOA_READONLY_USERS, else 'admin'.
 *
 *   'both'              — Try env-var credentials first; if they don't match,
 *                         fall through to WinCC OA user database.
 *
 * The DIRECT_ACCESS_TOKEN / READONLY_TOKEN static bypass tokens are handled in
 * validateToken() and are not affected by AUTH_MODE.
 *
 * @param {string} username
 * @param {string} password
 * @param {object} logger
 * @returns {{ id: string, username: string, role: string }|null}
 */
function authenticateUser(username, password, logger) {
  logger.debug(`Authentication attempt for username: ${username} (AUTH_MODE=${AUTH_MODE})`)

  // ── env-var credential check ─────────────────────────────────────────────
  if (AUTH_MODE === 'config' || AUTH_MODE === 'both') {
    if (ADMIN_USERNAME && ADMIN_PASSWORD) {
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        logger.info(`Admin user authenticated: ${username}`)
        return { id: username, username, role: 'admin' }
      }
    }

    if (READONLY_USERNAME && READONLY_PASSWORD) {
      if (username === READONLY_USERNAME && password === READONLY_PASSWORD) {
        logger.info(`Read-only user authenticated: ${username}`)
        return { id: username, username, role: 'readonly' }
      }
    }

    // Development fallback: allow dev/dev only when explicitly enabled.
    if (AUTH_MODE === 'config' && ALLOW_DEV_LOGIN && !IS_PRODUCTION && !ADMIN_USERNAME && !READONLY_USERNAME) {
      if (username === 'dev' && password === 'dev') {
        logger.warn('Using explicit development credentials — configure proper credentials in .env for production')
        return { id: username, username, role: 'admin' }
      }
    }

    // In 'config' mode, stop here — do not fall through to WinCC OA
    if (AUTH_MODE === 'config') {
      logger.debug(`Authentication failed for username: ${username}`)
      return null
    }
  }

  // ── WinCC OA user database check ─────────────────────────────────────────
  if (AUTH_MODE === 'winccoa' || AUTH_MODE === 'both') {
    return authenticateWinccoaUser(username, password, logger)
  }

  logger.warn(`Unknown AUTH_MODE "${AUTH_MODE}" — treating as 'config'`)
  logger.debug(`Authentication failed for username: ${username}`)
  return null
}

/**
 * Removes expired tokens from the in-memory store.
 * Call periodically (e.g. setInterval every 60 s).
 */
function purgeExpiredTokens() {
  const now = Date.now()
  for (const [tokenId, data] of tokenStore.entries()) {
    if (now > data.expiresAt) tokenStore.delete(tokenId)
  }
}

module.exports = {
  JWT_SECRET,
  DEFAULT_JWT_SECRET,
  TOKEN_EXPIRY_MS,
  AUTH_MODE,
  ALLOW_DEV_LOGIN,
  WINCCOA_READONLY_USERS,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  READONLY_USERNAME,
  READONLY_PASSWORD,
  DIRECT_ACCESS_TOKEN,
  READONLY_TOKEN,
  tokenStore,
  generateToken,
  validateToken,
  authenticateUser,
  purgeExpiredTokens
}
