// Tag routes for REST API
const express = require('express')

module.exports = function(logger) {
  const router = express.Router()

  /**
   * GET /restapi/tags
   * Get multiple tags with value, timestamp, and status
   *
   * Query params:
   *   dpeNames: string - Comma-separated list of data point element names
   *
   * Response: { tags: Tag[] }
   */
  router.get('/', async (req, res, next) => {
    try {
      const { dpeNames } = req.query

      if (!dpeNames) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'dpeNames query parameter is required (comma-separated list)'
        })
      }

      const dpeNamesList = dpeNames.split(',').map(name => name.trim())
      const result = await req.resolvers.Query.tagGet(null, { dpeNames: dpeNamesList })

      res.json({ tags: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/tags/history
   * Get historical data for multiple tags
   *
   * Query params:
   *   dpeNames: string - Comma-separated list of data point element names
   *   startTime: string - Start time (ISO8601)
   *   endTime: string - End time (ISO8601)
   *   limit: number (optional) - Maximum number of rows per tag
   *   offset: number (optional) - Number of rows to skip
   *
   * Response: { history: TagHistory[] }
   */
  router.get('/history', async (req, res, next) => {
    try {
      const { dpeNames, startTime, endTime, limit, offset } = req.query

      if (!dpeNames || !startTime || !endTime) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'dpeNames, startTime, and endTime query parameters are required'
        })
      }

      const dpeNamesList = dpeNames.split(',').map(name => name.trim())
      const result = await req.resolvers.Query.tagGetHistory(
        null,
        {
          dpeNames: dpeNamesList,
          startTime,
          endTime,
          limit: limit ? parseInt(limit) : undefined,
          offset: offset ? parseInt(offset) : undefined
        }
      )

      res.json({ history: result })
    } catch (error) {
      next(error)
    }
  })

  return router
}
