// Data point routes for REST API
const express = require('express')

module.exports = function(logger, requireAdmin) {
  const router = express.Router()

  /**
   * GET /restapi/datapoints
   * Search data points by pattern
   *
   * Query params:
   *   pattern: string (optional) - Search pattern for data point names
   *   dpType: string (optional) - Specific data point type to filter
   *   ignoreCase: boolean (optional) - Case-insensitive search
   *
   * Response: { datapoints: string[] }
   */
  router.get('/', async (req, res, next) => {
    try {
      const { pattern, dpType, ignoreCase } = req.query
      const result = await req.resolvers.Query.dpNames(
        null,
        {
          dpPattern: pattern,
          dpType,
          ignoreCase: ignoreCase === 'true'
        }
      )
      res.json({ datapoints: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /restapi/datapoints
   * Create a new data point
   *
   * Body:
   * {
   *   "dpeName": "string",
   *   "dpType": "string",
   *   "systemId": number (optional),
   *   "dpId": number (optional)
   * }
   *
   * Response: { success: boolean }
   */
  router.post('/', requireAdmin, async (req, res, next) => {
    try {
      const { dpeName, dpType, systemId, dpId } = req.body

      if (!dpeName || !dpType) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'dpeName and dpType are required'
        })
      }

      const result = await req.resolvers.Mutation.dpCreate(
        null,
        { dpeName, dpType, systemId, dpId }
      )

      res.status(201).json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/datapoints/:dpeName/value
   * Get current value of a data point element
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Response: { value: any }
   */
  router.get('/:dpeName/value', async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const result = await req.resolvers.Query.dpGet(null, { dpeNames: [dpeName] })
      res.json({ value: result[0] })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/datapoints/:dpeName/value
   * Set value of a data point element
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Body:
   * { "value": any }
   *
   * Response: { success: boolean }
   */
  router.put('/:dpeName/value', requireAdmin, async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const { value } = req.body

      if (value === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'value is required'
        })
      }

      const result = await req.resolvers.Mutation.dpSet(
        null,
        { dpeNames: [dpeName], values: [value] }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/datapoints/:dpeName/value/wait
   * Set value with wait for confirmation
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Body:
   * { "value": any }
   *
   * Response: { success: boolean }
   */
  router.put('/:dpeName/value/wait', requireAdmin, async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const { value } = req.body

      if (value === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'value is required'
        })
      }

      const result = await req.resolvers.Mutation.dpSetWait(
        null,
        { dpeNames: [dpeName], values: [value] }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/datapoints/:dpeName/value/timed
   * Set value with specific timestamp
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Body:
   * {
   *   "value": any,
   *   "time": "ISO8601 timestamp"
   * }
   *
   * Response: { success: boolean }
   */
  router.put('/:dpeName/value/timed', requireAdmin, async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const { value, time } = req.body

      if (value === undefined || !time) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'value and time are required'
        })
      }

      const result = await req.resolvers.Mutation.dpSetTimed(
        null,
        { time, dpeNames: [dpeName], values: [value] }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/datapoints/:dpeName/value/timed-wait
   * Set value with timestamp and wait for confirmation
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Body:
   * {
   *   "value": any,
   *   "time": "ISO8601 timestamp"
   * }
   *
   * Response: { success: boolean }
   */
  router.put('/:dpeName/value/timed-wait', requireAdmin, async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const { value, time } = req.body

      if (value === undefined || !time) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'value and time are required'
        })
      }

      const result = await req.resolvers.Mutation.dpSetTimedWait(
        null,
        { time, dpeNames: [dpeName], values: [value] }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * DELETE /restapi/datapoints/:dpName
   * Delete a data point
   *
   * URL params:
   *   dpName: string - Name of the data point to delete (URL encoded)
   *
   * Response: { success: boolean }
   */
  router.delete('/:dpName', requireAdmin, async (req, res, next) => {
    try {
      const dpName = decodeURIComponent(req.params.dpName)
      const result = await req.resolvers.Mutation.dpDelete(null, { dpName })
      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /restapi/datapoints/:source/copy
   * Copy a data point
   *
   * URL params:
   *   source: string - Source data point name (URL encoded)
   *
   * Body:
   * {
   *   "destination": "string",
   *   "driver": number (optional)
   * }
   *
   * Response: { success: boolean }
   */
  router.post('/:source/copy', requireAdmin, async (req, res, next) => {
    try {
      const source = decodeURIComponent(req.params.source)
      const { destination, driver } = req.body

      if (!destination) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'destination is required'
        })
      }

      const result = await req.resolvers.Mutation.dpCopy(
        null,
        { source, destination, driver }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/datapoints/:dpeName/exists
   * Check if data point exists
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Response: { exists: boolean }
   */
  router.get('/:dpeName/exists', async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const result = await req.resolvers.Query.dpExists(null, { dpeName })
      res.json({ exists: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/datapoints/:dpeName/type
   * Get element type of data point element
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Response: { elementType: string }
   */
  router.get('/:dpeName/type', async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const result = await req.resolvers.Query.dpElementType(null, { dpeName })
      res.json({ elementType: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/datapoints/:dpeName/dp-type
   * Get data point type name
   *
   * URL params:
   *   dpeName: string - Name of the data point (URL encoded)
   *
   * Response: { dpType: string }
   */
  router.get('/:dpeName/dp-type', async (req, res, next) => {
    try {
      const dp = decodeURIComponent(req.params.dpeName)
      const result = await req.resolvers.Query.dpTypeName(null, { dp })
      res.json({ dpType: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/datapoints/:dpeName/type-ref
   * Get type reference name
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Response: { typeRef: string }
   */
  router.get('/:dpeName/type-ref', async (req, res, next) => {
    try {
      const dpe = decodeURIComponent(req.params.dpeName)
      const result = await req.resolvers.Query.dpTypeRefName(null, { dpe })
      res.json({ typeRef: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/datapoints/:dpeName/value/max-age
   * Get value if older than specified age
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Query params:
   *   age: number - Maximum age in milliseconds
   *
   * Response: { value: any }
   */
  router.get('/:dpeName/value/max-age', async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const age = parseInt(req.query.age)

      if (isNaN(age)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'age query parameter is required and must be a number'
        })
      }

      const result = await req.resolvers.Query.dpGetMaxAge(
        null,
        { age, dpeNames: [dpeName] }
      )

      res.json({ value: result[0] })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/datapoints/:dpeName/history
   * Get historic values for a time period
   *
   * URL params:
   *   dpeName: string - Name of the data point element (URL encoded)
   *
   * Query params:
   *   startTime: string - Start time (ISO8601)
   *   endTime: string - End time (ISO8601)
   *
   * Response: { values: any[] }
   */
  router.get('/:dpeName/history', async (req, res, next) => {
    try {
      const dpeName = decodeURIComponent(req.params.dpeName)
      const { startTime, endTime } = req.query

      if (!startTime || !endTime) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'startTime and endTime query parameters are required'
        })
      }

      const result = await req.resolvers.Query.dpGetPeriod(
        null,
        { startTime, endTime, dpeNames: [dpeName] }
      )

      res.json({ values: result[0] })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/datapoints/:dpAttributeName/attribute-type
   * Get data type of a data point attribute
   *
   * URL params:
   *   dpAttributeName: string - Name of the data point attribute (URL encoded)
   *
   * Response: { ctrlType: string }
   */
  router.get('/:dpAttributeName/attribute-type', async (req, res, next) => {
    try {
      const dpAttributeName = decodeURIComponent(req.params.dpAttributeName)
      const result = await req.resolvers.Query.dpAttributeType(null, { dpAttributeName })
      res.json({ ctrlType: result })
    } catch (error) {
      next(error)
    }
  })

  return router
}

// Create a separate router for dpQuery to avoid conflicts with parameterized routes
module.exports.createQueryRouter = function(logger) {
  const router = express.Router()

  /**
   * GET /restapi/query?query=<sql>
   * POST /restapi/query  { "query": "<sql>" }
   * Execute SQL-like query on data points
   *
   * Query parameter (GET) or body field (POST):
   *   query - SQL statement (e.g., "SELECT '_original.._value' FROM 'ExampleDP_Arg*'")
   *
   * Response:
   * {
   *   "result": [[any]] - Table-like structure where [0][0] is empty, [0][1..n] are column headers,
   *                        [1..n][0] are line names (data point names), [1..n][1..n] are values
   * }
   */
  async function handleQuery(query, req, res, next) {
    try {
      if (!query) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'query is required'
        })
      }

      const result = await req.resolvers.Query.dpQuery(null, { query })
      res.json({ result })
    } catch (error) {
      next(error)
    }
  }

  router.get('/', (req, res, next) => handleQuery(req.query.query, req, res, next))

  router.post('/', (req, res, next) => handleQuery(req.body.query, req, res, next))

  return router
}
