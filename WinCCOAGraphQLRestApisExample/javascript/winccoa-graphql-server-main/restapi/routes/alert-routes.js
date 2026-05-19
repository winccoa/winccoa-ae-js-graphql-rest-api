// Alert routes for REST API
const express = require('express')

module.exports = function(logger, requireAdmin) {
  const router = express.Router()

  /**
   * GET /restapi/alerts
   * Get alert attributes
   *
   * Body (JSON):
   * {
   *   "alertsTime": [{ "time": "ISO8601", "count": number, "dpe": "string" }],
   *   "dpeNames": ["string"],
   *   "alertCount": number (optional)
   * }
   *
   * Response: { values: any }
   */
  router.get('/', async (req, res, next) => {
    try {
      // For GET request, we expect query params to be JSON-encoded
      const { alertsTime, dpeNames, alertCount } = req.query

      if (!alertsTime || !dpeNames) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'alertsTime and dpeNames are required'
        })
      }

      const parsedAlertsTime = JSON.parse(alertsTime)
      const parsedDpeNames = JSON.parse(dpeNames)

      const result = await req.resolvers.Query.alertGet(
        null,
        {
          alertsTime: parsedAlertsTime,
          dpeNames: parsedDpeNames,
          alertCount: alertCount ? parseInt(alertCount) : undefined
        }
      )

      res.json({ values: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/alerts/period
   * Get alerts for a time period
   *
   * Query params:
   *   startTime: string - Start time (ISO8601)
   *   endTime: string - End time (ISO8601)
   *   names: string - Comma-separated list of alert handling attribute names
   *
   * Response: { alertTimes: AlertTime[], values: any[] }
   */
  router.get('/period', async (req, res, next) => {
    try {
      const { startTime, endTime, names } = req.query

      if (!startTime || !endTime || !names) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startTime, endTime, and names are required'
        })
      }

      const namesList = names.split(',').map(name => name.trim())
      const result = await req.resolvers.Query.alertGetPeriod(
        null,
        { startTime, endTime, names: namesList }
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/alerts
   * Set alert attributes
   *
   * Body:
   * {
   *   "alerts": [{ "time": "ISO8601", "count": number, "dpe": "string" }],
   *   "values": [any]
   * }
   *
   * Response: { success: boolean }
   */
  router.put('/', requireAdmin, async (req, res, next) => {
    try {
      const { alerts, values } = req.body

      if (!alerts || !values) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'alerts and values are required'
        })
      }

      const result = await req.resolvers.Mutation.alertSet(
        null,
        { alerts, values }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/alerts/wait
   * Set alert attributes with wait for confirmation
   *
   * Body:
   * {
   *   "alerts": [{ "time": "ISO8601", "count": number, "dpe": "string" }],
   *   "values": [any]
   * }
   *
   * Response: { success: boolean }
   */
  router.put('/wait', requireAdmin, async (req, res, next) => {
    try {
      const { alerts, values } = req.body

      if (!alerts || !values) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'alerts and values are required'
        })
      }

      const result = await req.resolvers.Mutation.alertSetWait(
        null,
        { alerts, values }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/alerts/timed
   * Set alert attributes with specific timestamp
   *
   * Body:
   * {
   *   "time": "ISO8601",
   *   "alerts": [{ "time": "ISO8601", "count": number, "dpe": "string" }],
   *   "values": [any]
   * }
   *
   * Response: { success: boolean }
   */
  router.put('/timed', requireAdmin, async (req, res, next) => {
    try {
      const { time, alerts, values } = req.body

      if (!time || !alerts || !values) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'time, alerts, and values are required'
        })
      }

      const result = await req.resolvers.Mutation.alertSetTimed(
        null,
        { time, alerts, values }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/alerts/timed-wait
   * Set alert attributes with timestamp and wait for confirmation
   *
   * Body:
   * {
   *   "time": "ISO8601",
   *   "alerts": [{ "time": "ISO8601", "count": number, "dpe": "string" }],
   *   "values": [any]
   * }
   *
   * Response: { success: boolean }
   */
  router.put('/timed-wait', requireAdmin, async (req, res, next) => {
    try {
      const { time, alerts, values } = req.body

      if (!time || !alerts || !values) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'time, alerts, and values are required'
        })
      }

      const result = await req.resolvers.Mutation.alertSetTimedWait(
        null,
        { time, alerts, values }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  return router
}
