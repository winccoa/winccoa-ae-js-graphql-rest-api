// System routes for REST API
const express = require('express')

module.exports = function(logger) {
  const router = express.Router()

  /**
   * GET /restapi/system/version
   * Get WinCC OA and API version information
   *
   * Response: { api: {...}, winccoa: {...} }
   */
  router.get('/version', async (req, res, next) => {
    try {
      const result = await req.resolvers.Query.getVersionInfo()
      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/system/redundancy/active
   * Check if redundancy is currently active
   *
   * Response: { active: boolean }
   */
  router.get('/redundancy/active', async (req, res, next) => {
    try {
      const result = await req.resolvers.Query.isReduActive()
      res.json({ active: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/system/redundancy/configured
   * Check if project is configured as redundant
   *
   * Response: { configured: boolean }
   */
  router.get('/redundancy/configured', async (req, res, next) => {
    try {
      const result = await req.resolvers.Query.isRedundant()
      res.json({ configured: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/system/id
   * Get system ID for specified system or current system
   *
   * Query params:
   *   systemName: string (optional) - Name of the system
   *
   * Response: { systemId: number }
   */
  router.get('/id', async (req, res, next) => {
    try {
      const { systemName } = req.query
      const result = await req.resolvers.Query.getSystemId(null, { systemName })
      res.json({ systemId: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/system/name
   * Get system name for specified system ID or current system
   *
   * Query params:
   *   systemId: number (optional) - System ID
   *
   * Response: { systemName: string }
   */
  router.get('/name', async (req, res, next) => {
    try {
      const { systemId } = req.query
      const result = await req.resolvers.Query.getSystemName(
        null,
        { systemId: systemId ? parseInt(systemId) : undefined }
      )
      res.json({ systemName: result })
    } catch (error) {
      next(error)
    }
  })

  return router
}
