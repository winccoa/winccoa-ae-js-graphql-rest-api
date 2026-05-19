// Extras routes for REST API — customers can extend these endpoints
const express = require('express')

module.exports = function(logger, requireAdmin) {
  const router = express.Router()

  /**
   * GET /restapi/extras/test-dummy
   * Test dummy endpoint — placeholder for custom REST extensions
   *
   * Response: { success: boolean, message: string, timestamp: string }
   */
  router.get('/test-dummy', async (req, res, next) => {
    try {
      res.json({
        success: true,
        message: 'Test dummy GET executed successfully',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /restapi/extras/test-dummy
   * Test dummy endpoint — placeholder for custom REST extensions
   *
   * Response: { success: boolean, message: string, timestamp: string }
   */
  router.post('/test-dummy', async (req, res, next) => {
    try {
      logger.info('REST testDummy called with body:', req.body)
      res.json({
        success: true,
        message: 'Test dummy POST executed successfully',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      next(error)
    }
  })

  return router
}
