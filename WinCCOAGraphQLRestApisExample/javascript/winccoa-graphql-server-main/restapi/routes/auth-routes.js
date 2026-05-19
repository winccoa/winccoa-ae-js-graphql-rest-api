// Authentication routes for REST API
const express = require('express')
const router = express.Router()

/**
 * POST /restapi/v1/auth/login
 * Login with username and password
 *
 * Body:
 * {
 *   "username": "string",
 *   "password": "string"
 * }
 *
 * Response:
 * {
 *   "token": "string",
 *   "expiresAt": "ISO8601 timestamp"
 * }
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Username and password are required'
      })
    }

    // Use the authenticateUser and generateToken functions from app.locals
    const user = req.app.locals.authenticateUser(username, password)

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid username or password'
      })
    }

    const { token, expiresAt, tokenId } = req.app.locals.generateToken(user.id, user.role)

    // Create a per-session WinccoaManager for the new token (if auth is enabled)
    const sessionManager = req.app.locals.sessionManager
    if (sessionManager) {
      sessionManager.createSession(tokenId, user.role)
    }

    res.json({
      token,
      expiresAt: new Date(expiresAt).toISOString()
    })
  } catch (error) {
    next(error)
  }
})

/**
 * POST /restapi/v1/auth/logout
 * Logout and destroy the current session.
 * Requires a valid Authorization: Bearer <token> header.
 *
 * Response:
 * {
 *   "success": true
 * }
 */
router.post('/logout', (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header'
      })
    }

    const token = authHeader.substring(7)
    const user  = req.app.locals.validateToken(token)

    if (!user) {
      // Token already expired or invalid — treat as success (idempotent)
      return res.json({ success: true })
    }

    const isStaticToken = user.tokenId === 'direct' || user.tokenId === 'readonly' || user.tokenId === 'no-auth'
    const sessionManager = req.app.locals.sessionManager

    if (!isStaticToken && sessionManager) {
      sessionManager.destroySession(user.tokenId)
    }

    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

module.exports = router
