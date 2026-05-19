// CNS hierarchy resolvers

const { parseDataPointName } = require('./helpers')

function createCnsResolvers(winccoa, logger) {
  return {
    CNS: {
      async view(cns, { name }) {
        try {
          // Always use empty string for local system
          const systemPrefix = ''
          const viewPaths = await winccoa.cnsGetViews(systemPrefix)

          // Build full path for checking
          const fullPath = systemPrefix + name
          if (!viewPaths.includes(fullPath)) return null

          const displayNames = await winccoa.cnsGetViewDisplayNames(fullPath)

          return {
            name,
            displayName: displayNames,
            separator: '/',
            
          }
        } catch (error) {
          logger.error('CNS.view error:', error)
          return null
        }
      },

      async views(cns) {
        try {
          // Always use empty string for local system
          const systemPrefix = ''
          logger.debug(`CNS.views: Getting views for local system`)
          const viewPaths = await winccoa.cnsGetViews(systemPrefix)
          logger.debug(`CNS.views: Found ${viewPaths.length} views: ${JSON.stringify(viewPaths)}`)

          const views = []
          for (const fullPath of viewPaths) {
            try {
              // Strip system prefix from view path
              // e.g., "System1.Test:" -> "Test:" or "Test:" -> "Test:"
              const viewName = systemPrefix ? fullPath.replace(systemPrefix, '') : fullPath
              logger.debug(`CNS.views: Processing fullPath='${fullPath}', systemPrefix='${systemPrefix}', viewName='${viewName}'`)

              // Get actual multi-language display names from CNS
              logger.debug(`CNS.views: Calling cnsGetViewDisplayNames('${fullPath}')`)
              const displayNames = await winccoa.cnsGetViewDisplayNames(fullPath)
              logger.debug(`CNS.views: Got displayNames: ${JSON.stringify(displayNames)}`)

              views.push({
                name: viewName,  // e.g., "Test:"
                displayName: displayNames,
                separator: '/',
                
              })
            } catch (e) {
              logger.warn(`Failed to get display names for view ${fullPath}:`, e)
            }
          }

          return views
        } catch (error) {
          logger.error('CNS.views error:', error)
          return []
        }
      },

      async searchNodes(cns, { pattern, viewPath, searchMode, langIdx, type }) {
        try {
          const paths = await winccoa.cnsGetNodesByName(pattern, viewPath, searchMode, langIdx, type)

          return paths.map(path => ({
            path,
            
          }))
        } catch (error) {
          logger.error('CNS.searchNodes error:', error)
          return []
        }
      },

      async searchByDataPoint(cns, { dataPoint, type, viewPath }) {
        try {
          const paths = await winccoa.cnsGetNodesByData(dataPoint, type, viewPath)

          return paths.map(path => ({
            path,
            dpName: dataPoint,
            
          }))
        } catch (error) {
          logger.error('CNS.searchByDataPoint error:', error)
          return []
        }
      }
    },

    CNSView: {
      async tree(view, { name }) {
        try {
          const treePath = `${view.name}/${name}`
          const exists = await winccoa.cns_treeExists(treePath)
          if (!exists) return null

          const displayNames = await winccoa.cnsGetDisplayNames(treePath)
          const rootPath = await winccoa.cnsGetRoot(treePath)

          return {
            name,
            displayName: displayNames,
            rootPath,
            view
          }
        } catch (error) {
          logger.error('CNSView.tree error:', error)
          return null
        }
      },

      async trees(view) {
        try {
          const treePaths = await winccoa.cnsGetTrees(view.name)

          const trees = []
          for (const path of treePaths) {
            try {
              const name = path.split('/').pop()
              const displayNames = await winccoa.cnsGetDisplayNames(path)
              const rootPath = await winccoa.cnsGetRoot(path)

              trees.push({
                name,
                displayName: displayNames,
                rootPath,
                view
              })
            } catch (e) {
              logger.warn(`Failed to get tree info for ${path}:`, e)
            }
          }

          return trees
        } catch (error) {
          logger.error('CNSView.trees error:', error)
          return []
        }
      },

      async exists(view) {
        try {
          return await winccoa.cns_viewExists(view.name)
        } catch (error) {
          return false
        }
      }
    },

    CNSTree: {
      view(tree) {
        return tree.view
      },

      async displayName(tree) {
        if (tree.displayName) return tree.displayName

        try {
          const rootPath = tree.rootPath || `${tree.viewPath}${tree.name}`
          return await winccoa.cnsGetDisplayNames(rootPath)
        } catch (error) {
          logger.error('CNSTree.displayName error:', error)
          return tree.name // Fallback to tree name
        }
      },

      async root(tree) {
        try {
          const rootPath = tree.rootPath || await winccoa.cnsGetRoot(`${tree.view.name}/${tree.name}`)

          return {
            path: rootPath,
            tree
          }
        } catch (error) {
          logger.error('CNSTree.root error:', error)
          throw error
        }
      },

      async exists(tree) {
        try {
          const treePath = `${tree.view.name}/${tree.name}`
          return await winccoa.cns_treeExists(treePath)
        } catch (error) {
          return false
        }
      }
    },

    CNSNode: {
      async name(node) {
        if (node.name) return node.name
        return node.path.split('/').pop()
      },

      async displayName(node) {
        if (node.displayName) return node.displayName

        try {
          return await winccoa.cnsGetDisplayNames(node.path)
        } catch (error) {
          logger.error('CNSNode.displayName error:', error)
          return {}
        }
      },

      async displayPath(node) {
        if (node.displayPath) return node.displayPath

        try {
          return await winccoa.cnsGetDisplayPath(node.path)
        } catch (error) {
          logger.error('CNSNode.displayPath error:', error)
          return {}
        }
      },

      async parent(node) {
        try {
          const parentPath = await winccoa.cnsGetParent(node.path)
          if (!parentPath || parentPath === node.path) return null

          return {
            path: parentPath,
            tree: node.tree
          }
        } catch (error) {
          logger.error('CNSNode.parent error:', error)
          return null
        }
      },

      async children(node) {
        try {
          const childPaths = await winccoa.cnsGetChildren(node.path)

          return childPaths.map(path => ({
            path,
            tree: node.tree
          }))
        } catch (error) {
          logger.error('CNSNode.children error:', error)
          return []
        }
      },

      async root(node) {
        if (node.tree && node.tree.rootPath) {
          return {
            path: node.tree.rootPath,
            tree: node.tree
          }
        }

        try {
          const rootPath = await winccoa.cnsGetRoot(node.path)
          return {
            path: rootPath,
            tree: node.tree
          }
        } catch (error) {
          logger.error('CNSNode.root error:', error)
          throw error
        }
      },

      async tree(node) {
        if (node.tree) return node.tree

        try {
          // Get the root node path to determine the tree
          const rootPath = await winccoa.cnsGetRoot(node.path)

          // Extract view and tree name from the root path
          // Format: "System.ViewName:TreeRootNode"
          const match = rootPath.match(/^(.+?):(.+)$/)
          if (!match) {
            logger.warn(`Unable to parse CNS root path: ${rootPath}`)
            return null
          }

          const viewPath = match[1] + ':'
          const treeName = match[2]

          return {
            name: treeName,
            rootPath: rootPath,
            viewPath: viewPath
          }
        } catch (error) {
          logger.error('CNSNode.tree error:', error)
          return null
        }
      },

      async dp(node) {
        const dpeName = node.dpName || (await winccoa.cnsGetId(node.path))
        if (!dpeName) return null

        try {
          const parsed = parseDataPointName(dpeName)
          const typeName = await winccoa.dpTypeName(parsed.dpName)

          return {
            name: parsed.dpName,
            fullName: dpeName,
            typeName
          }
        } catch (error) {
          logger.error('CNSNode.dp error:', error)
          return null
        }
      },

      async dpName(node) {
        if (node.dpName) return node.dpName

        try {
          return await winccoa.cnsGetId(node.path)
        } catch (error) {
          return null
        }
      },

      async property(node, { key }) {
        try {
          return await winccoa.cnsGetProperty(node.path, key)
        } catch (error) {
          logger.error('CNSNode.property error:', error)
          return null
        }
      },

      async properties(node) {
        try {
          const keys = await winccoa.cnsGetPropertyKeys(node.path)

          const properties = []
          for (const key of keys) {
            try {
              const value = await winccoa.cnsGetProperty(node.path, key)
              properties.push({
                key,
                value,
                type: 'STRING_VAR' // Default, could be enhanced
              })
            } catch (e) {
              logger.warn(`Failed to get property ${key}:`, e)
            }
          }

          return properties
        } catch (error) {
          logger.error('CNSNode.properties error:', error)
          return []
        }
      },

      async exists(node) {
        try {
          return await winccoa.cns_nodeExists(node.path)
        } catch (error) {
          return false
        }
      }
    }
  }
}

module.exports = { createCnsResolvers }
