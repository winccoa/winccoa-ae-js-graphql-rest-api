// CNS (Central Navigation Service) routes for REST API
const express = require('express')

module.exports = function(logger, requireAdmin) {
  const router = express.Router()

  /**
   * GET /restapi/cns/views/:systemName
   * Get all views for a system
   *
   * URL params:
   *   systemName: string - System name (URL encoded)
   *
   * Response: { views: string[] }
   */
  router.get('/views/:systemName', async (req, res, next) => {
    try {
      const systemName = decodeURIComponent(req.params.systemName)
      const result = await req.resolvers.Query.getViews(null, { systemName })
      res.json({ views: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /restapi/cns/views
   * Create a new view
   *
   * Body:
   * {
   *   "view": "string",
   *   "displayName": {},
   *   "separator": {} (optional)
   * }
   *
   * Response: { success: boolean }
   */
  router.post('/views', requireAdmin, async (req, res, next) => {
    try {
      const { view, displayName, separator } = req.body

      if (!view || !displayName) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'view and displayName are required'
        })
      }

      const result = await req.resolvers.Mutation.createView(
        null,
        { view, displayName, separator }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * DELETE /restapi/cns/views/:view
   * Delete a view with all its trees
   *
   * URL params:
   *   view: string - ID path of the view (URL encoded)
   *
   * Response: { success: boolean }
   */
  router.delete('/views/:view', requireAdmin, async (req, res, next) => {
    try {
      const view = decodeURIComponent(req.params.view)
      const result = await req.resolvers.Mutation.deleteView(null, { view })
      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/views/:view/exists
   * Check if view exists
   *
   * URL params:
   *   view: string - CNS ID path (URL encoded)
   *
   * Response: { exists: boolean }
   */
  router.get('/views/:view/exists', async (req, res, next) => {
    try {
      const path = decodeURIComponent(req.params.view)
      const result = await req.resolvers.Query.viewExists(null, { path })
      res.json({ exists: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/trees/:view
   * Get all trees in a view
   *
   * URL params:
   *   view: string - View name (URL encoded)
   *
   * Response: { trees: string[] }
   */
  router.get('/trees/:view', async (req, res, next) => {
    try {
      const view = decodeURIComponent(req.params.view)
      const result = await req.resolvers.Query.getTrees(null, { view })
      res.json({ trees: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /restapi/cns/trees
   * Create a tree or sub-tree
   *
   * Body:
   * {
   *   "cnsParentPath": "string",
   *   "tree": {
   *     "name": "string",
   *     "displayName": {},
   *     "dp": "string" (optional),
   *     "children": [] (optional)
   *   }
   * }
   *
   * Response: { success: boolean }
   */
  router.post('/trees', requireAdmin, async (req, res, next) => {
    try {
      const { cnsParentPath, tree } = req.body

      if (!cnsParentPath || !tree) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'cnsParentPath and tree are required'
        })
      }

      const result = await req.resolvers.Mutation.addTree(
        null,
        { cnsParentPath, tree }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/cns/trees/:cnsPath
   * Replace a tree or sub-tree
   *
   * URL params:
   *   cnsPath: string - ID path of tree/node to replace (URL encoded)
   *
   * Body:
   * {
   *   "tree": {
   *     "name": "string",
   *     "displayName": {},
   *     "dp": "string" (optional),
   *     "children": [] (optional)
   *   }
   * }
   *
   * Response: { success: boolean }
   */
  router.put('/trees/:cnsPath', requireAdmin, async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const { tree } = req.body

      if (!tree) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'tree is required'
        })
      }

      const result = await req.resolvers.Mutation.changeTree(
        null,
        { cnsPath, tree }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * DELETE /restapi/cns/trees/:cnsPath
   * Delete a tree, sub-tree, or node
   *
   * URL params:
   *   cnsPath: string - ID path of element to delete (URL encoded)
   *
   * Response: { success: boolean }
   */
  router.delete('/trees/:cnsPath', requireAdmin, async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Mutation.deleteTree(null, { cnsPath })
      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/trees/:cnsPath/exists
   * Check if tree exists
   *
   * URL params:
   *   cnsPath: string - CNS ID path (URL encoded)
   *
   * Response: { exists: boolean }
   */
  router.get('/trees/:cnsPath/exists', async (req, res, next) => {
    try {
      const path = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.treeExists(null, { path })
      res.json({ exists: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /restapi/cns/nodes
   * Add a new node to a tree or sub-tree
   *
   * Body:
   * {
   *   "cnsParentPath": "string",
   *   "name": "string",
   *   "displayName": {},
   *   "dp": "string" (optional)
   * }
   *
   * Response: { success: boolean }
   */
  router.post('/nodes', requireAdmin, async (req, res, next) => {
    try {
      const { cnsParentPath, name, displayName, dp } = req.body

      if (!cnsParentPath || !name || !displayName) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'cnsParentPath, name, and displayName are required'
        })
      }

      const result = await req.resolvers.Mutation.addNode(
        null,
        { cnsParentPath, name, displayName, dp }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/children
   * Get all children nodes
   *
   * URL params:
   *   cnsPath: string - ID path of the node (URL encoded)
   *
   * Response: { children: string[] }
   */
  router.get('/nodes/:cnsPath/children', async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.getChildren(null, { cnsPath })
      res.json({ children: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/parent
   * Get parent node path
   *
   * URL params:
   *   cnsPath: string - ID path of the node (URL encoded)
   *
   * Response: { parent: string }
   */
  router.get('/nodes/:cnsPath/parent', async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.getParent(null, { cnsPath })
      res.json({ parent: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/root
   * Get root node path of tree
   *
   * URL params:
   *   cnsPath: string - ID path of the node (URL encoded)
   *
   * Response: { root: string }
   */
  router.get('/nodes/:cnsPath/root', async (req, res, next) => {
    try {
      const cnsNodePath = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.getRoot(null, { cnsNodePath })
      res.json({ root: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/display-name
   * Get display names for node
   *
   * URL params:
   *   cnsPath: string - CNS path for the node (URL encoded)
   *
   * Response: { displayName: {} }
   */
  router.get('/nodes/:cnsPath/display-name', async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.getDisplayNames(null, { cnsPath })
      res.json({ displayName: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/display-path
   * Get display path for node
   *
   * URL params:
   *   cnsPath: string - CNS path for the node (URL encoded)
   *
   * Response: { displayPath: {} }
   */
  router.get('/nodes/:cnsPath/display-path', async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.getDisplayPath(null, { cnsPath })
      res.json({ displayPath: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/id
   * Get linked data point element name
   *
   * URL params:
   *   cnsPath: string - CNS path of data point element (URL encoded)
   *
   * Response: { id: string }
   */
  router.get('/nodes/:cnsPath/id', async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.getId(null, { cnsPath })
      res.json({ id: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/exists
   * Check if node exists
   *
   * URL params:
   *   cnsPath: string - CNS ID path (URL encoded)
   *
   * Response: { exists: boolean }
   */
  router.get('/nodes/:cnsPath/exists', async (req, res, next) => {
    try {
      const path = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.nodeExists(null, { path })
      res.json({ exists: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/search/by-name
   * Search nodes by name pattern
   *
   * Query params:
   *   pattern: string - Search pattern with wildcards
   *   viewPath: string (optional) - Path to view to search
   *   searchMode: number (optional) - Search mode flags
   *   langIdx: number (optional) - Language index
   *   type: number (optional) - Node type filter
   *
   * Response: { nodes: string[] }
   */
  router.get('/nodes/search/by-name', async (req, res, next) => {
    try {
      const { pattern, viewPath, searchMode, langIdx, type } = req.query

      if (!pattern) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'pattern query parameter is required'
        })
      }

      const result = await req.resolvers.Query.getNodesByName(
        null,
        {
          pattern,
          viewPath,
          searchMode: searchMode ? parseInt(searchMode) : undefined,
          langIdx: langIdx ? parseInt(langIdx) : undefined,
          type: type ? parseInt(type) : undefined
        }
      )

      res.json({ nodes: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/search/by-data
   * Search nodes by linked data point
   *
   * Query params:
   *   dpName: string - Data point (element) name
   *   type: number (optional) - Node type filter
   *   viewPath: string (optional) - View path to search
   *
   * Response: { nodes: string[] }
   */
  router.get('/nodes/search/by-data', async (req, res, next) => {
    try {
      const { dpName, type, viewPath } = req.query

      if (!dpName) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'dpName query parameter is required'
        })
      }

      const result = await req.resolvers.Query.getNodesByData(
        null,
        {
          dpName,
          type: type ? parseInt(type) : undefined,
          viewPath
        }
      )

      res.json({ nodes: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/search/id-set
   * Get data point element names linked to nodes matching pattern
   *
   * Query params:
   *   pattern: string - Search pattern with wildcards
   *   viewPath: string (optional) - Path to view to search
   *   searchMode: number (optional) - Search mode flags
   *   langIdx: number (optional) - Language index
   *   type: number (optional) - Node type filter
   *
   * Response: { ids: string[] }
   */
  router.get('/nodes/search/id-set', async (req, res, next) => {
    try {
      const { pattern, viewPath, searchMode, langIdx, type } = req.query

      if (!pattern) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'pattern query parameter is required'
        })
      }

      const result = await req.resolvers.Query.getIdSet(
        null,
        {
          pattern,
          viewPath,
          searchMode: searchMode ? parseInt(searchMode) : undefined,
          langIdx: langIdx ? parseInt(langIdx) : undefined,
          type: type ? parseInt(type) : undefined
        }
      )

      res.json({ ids: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/property/:key
   * Get property value for a node
   *
   * URL params:
   *   cnsPath: string - CNS path of the node (URL encoded)
   *   key: string - Property key (URL encoded)
   *
   * Response: { value: any }
   */
  router.get('/nodes/:cnsPath/property/:key', async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const key = decodeURIComponent(req.params.key)
      const result = await req.resolvers.Query.getProperty(null, { cnsPath, key })
      res.json({ value: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/nodes/:cnsPath/properties
   * Get all property keys for a node
   *
   * URL params:
   *   cnsPath: string - CNS path of the node (URL encoded)
   *
   * Response: { keys: string[] }
   */
  router.get('/nodes/:cnsPath/properties', async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const result = await req.resolvers.Query.getPropertyKeys(null, { cnsPath })
      res.json({ keys: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * PUT /restapi/cns/nodes/:cnsPath/property
   * Set/add property for a node
   *
   * URL params:
   *   cnsPath: string - ID path of the node (URL encoded)
   *
   * Body:
   * {
   *   "key": "string",
   *   "value": any,
   *   "valueType": "CtrlType"
   * }
   *
   * Response: { success: boolean }
   */
  router.put('/nodes/:cnsPath/property', requireAdmin, async (req, res, next) => {
    try {
      const cnsPath = decodeURIComponent(req.params.cnsPath)
      const { key, value, valueType } = req.body

      if (!key || value === undefined || !valueType) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'key, value, and valueType are required'
        })
      }

      const result = await req.resolvers.Mutation.setProperty(
        null,
        { cnsPath, key, value, valueType }
      )

      res.json({ success: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/validation/check-id
   * Check if ID is valid CNS ID
   *
   * Query params:
   *   id: string - ID to check
   *
   * Response: { valid: boolean }
   */
  router.get('/validation/check-id', async (req, res, next) => {
    try {
      const { id } = req.query

      if (!id) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'id query parameter is required'
        })
      }

      const result = await req.resolvers.Query.checkId(null, { id })
      res.json({ valid: result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * POST /restapi/cns/validation/check-name
   * Check if name is valid CNS display name
   *
   * Body:
   * { "name": {} }
   *
   * Response: { result: number }
   * (0=valid, -1=incomplete, -2=invalid chars)
   */
  router.post('/validation/check-name', async (req, res, next) => {
    try {
      const { name } = req.body

      if (!name) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'name is required'
        })
      }

      const result = await req.resolvers.Query.checkName(null, { name })
      res.json({ result })
    } catch (error) {
      next(error)
    }
  })

  /**
   * GET /restapi/cns/validation/check-separator
   * Check if separator is valid CNS separator
   *
   * Query params:
   *   separator: string - Separator to check
   *
   * Response: { valid: boolean }
   */
  router.get('/validation/check-separator', async (req, res, next) => {
    try {
      const { separator } = req.query

      if (!separator) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'separator query parameter is required'
        })
      }

      const result = await req.resolvers.Query.checkSeparator(null, { separator })
      res.json({ valid: result })
    } catch (error) {
      next(error)
    }
  })

  return router
}
