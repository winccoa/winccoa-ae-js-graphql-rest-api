// CNS (Central Navigation Service) GraphQL resolver functions for WinCC OA

const { WinccoaCnsTreeNode } = require('winccoa-manager');

// Maps GraphQL CtrlType enum string → WinccoaCtrlType numeric value
// (matches CtrlTypeMap in common.js and WinccoaCtrlType in ctrl-types.js)
const CTRL_TYPE_TO_NUMBER = {
  TIME_VAR:           196608,
  BOOL_VAR:           262144,
  INT_VAR:            327680,
  UINT_VAR:           393216,
  FLOAT_VAR:          458752,
  STRING_VAR:         524288,
  BIT32_VAR:          589824,
  CHAR_VAR:           655360,
  DYN_TIME_VAR:       851968,
  DYN_BOOL_VAR:       917504,
  DYN_INT_VAR:        983040,
  DYN_UINT_VAR:      1048576,
  DYN_FLOAT_VAR:     1114112,
  DYN_STRING_VAR:    1179648,
  DYN_BIT32_VAR:     1245184,
  DYN_CHAR_VAR:      1310720,
  ATIME_VAR:         2424832,
  LANGSTRING_VAR:    2621440,
  BLOB_VAR:          3014656,
  LONG_VAR:          4587520,
  ULONG_VAR:         4784128,
  BIT64_VAR:         5242880,
};

/**
 * Converts GraphQL TreeNodeInput to WinccoaCnsTreeNode object.
 * Used as input converter for CNS tree-related WinCC OA functions.
 *
 * @param {object} treeNodeInput - Input tree node with name, displayName, dp, and children
 * @returns {WinccoaCnsTreeNode} WinCC OA CNS tree node object
 */
function convertTreeNodeInput(treeNodeInput) {
  const node = new WinccoaCnsTreeNode(
    treeNodeInput.name,
    treeNodeInput.displayName,
    treeNodeInput.dp,
    treeNodeInput.children ? treeNodeInput.children.map(convertTreeNodeInput) : undefined
  );
  return node;
}

/**
 * Converts WinccoaCnsTreeNode object to GraphQL output format.
 *
 * @param {WinccoaCnsTreeNode} treeNode - WinCC OA CNS tree node object
 * @returns {object} Tree node object with name, displayName, dp, and children
 */
function convertTreeNodeOutput(treeNode) {
  return {
    name: treeNode.name,
    displayName: treeNode.displayName,
    dp: treeNode.dp || '',
    children: treeNode.children ? treeNode.children.map(convertTreeNodeOutput) : []
  };
}

/**
 * Creates resolver functions for WinCC OA CNS (Central Navigation Service) operations.
 * Wraps WinCC OA CNS management functions through the winccoa-manager Node.js binding.
 *
 * @param {WinccoaManager} winccoa - WinCC OA manager instance for API access
 * @returns {object} Resolver object with Query and Mutation resolvers
 */
function createCnsOperationResolvers(winccoa) {
  return {
    Query: {
      /**
       * Retrieves available CNS views for a system.
       * Wraps WinCC OA function: cnsGetViews(systemName)
       *
       * @param {string} systemName - WinCC OA system name
       * @returns {Promise<Array>} Promise resolving to array of view names
       */
      async getViews(_, { systemName }) {
        try {
          const result = await winccoa.cnsGetViews(systemName);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS views: ${error.message}`);
        }
      },

      /**
       * Retrieves available CNS trees for a view.
       * Wraps WinCC OA function: cnsGetTrees(view)
       *
       * @param {string} view - View name
       * @returns {Promise<Array>} Promise resolving to array of tree names
       */
      async getTrees(_, { view }) {
        try {
          const result = await winccoa.cnsGetTrees(view);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS trees: ${error.message}`);
        }
      },

      /**
       * Retrieves child nodes of a CNS path.
       * Wraps WinCC OA function: cnsGetChildren(cnsPath)
       *
       * @param {string} cnsPath - CNS node path
       * @returns {Promise<Array>} Promise resolving to array of child nodes
       */
      async getChildren(_, { cnsPath }) {
        try {
          const result = await winccoa.cnsGetChildren(cnsPath);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS children: ${error.message}`);
        }
      },

      /**
       * Retrieves parent node of a CNS path.
       * Wraps WinCC OA function: cnsGetParent(cnsPath)
       *
       * @param {string} cnsPath - CNS node path
       * @returns {Promise<object>} Promise resolving to parent node
       */
      async getParent(_, { cnsPath }) {
        try {
          const result = await winccoa.cnsGetParent(cnsPath);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS parent: ${error.message}`);
        }
      },

      /**
       * Retrieves root node of a CNS tree.
       * Wraps WinCC OA function: cnsGetRoot(cnsNodePath)
       *
       * @param {string} cnsNodePath - CNS node path
       * @returns {Promise<object>} Promise resolving to root node
       */
      async getRoot(_, { cnsNodePath }) {
        try {
          const result = await winccoa.cnsGetRoot(cnsNodePath);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS root: ${error.message}`);
        }
      },

      /**
       * Retrieves display names for a CNS path.
       * Wraps WinCC OA function: cnsGetDisplayNames(cnsPath)
       *
       * @param {string} cnsPath - CNS node path
       * @returns {Promise<Array>} Promise resolving to array of display names
       */
      async getDisplayNames(_, { cnsPath }) {
        try {
          const result = await winccoa.cnsGetDisplayNames(cnsPath);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS display names: ${error.message}`);
        }
      },

      /**
       * Retrieves display path for a CNS path.
       * Wraps WinCC OA function: cnsGetDisplayPath(cnsPath)
       *
       * @param {string} cnsPath - CNS node path
       * @returns {Promise<string>} Promise resolving to display path
       */
      async getDisplayPath(_, { cnsPath }) {
        try {
          const result = await winccoa.cnsGetDisplayPath(cnsPath);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS display path: ${error.message}`);
        }
      },

      async getId(_, { cnsPath }) {
        try {
          const result = await winccoa.cnsGetId(cnsPath);
          return result || '';
        } catch (error) {
          throw new Error(`Failed to get CNS ID: ${error.message}`);
        }
      },

      // Search Functions
      async getIdSet(_, { pattern, viewPath, searchMode, langIdx, type }) {
        try {
          const result = await winccoa.cnsGetIdSet(pattern, viewPath, searchMode, langIdx, type);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS ID set: ${error.message}`);
        }
      },

      async getNodesByName(_, { pattern, viewPath, searchMode, langIdx, type }) {
        try {
          const result = await winccoa.cnsGetNodesByName(pattern, viewPath, searchMode, langIdx, type);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS nodes by name: ${error.message}`);
        }
      },

      async getNodesByData(_, { dpName, type, viewPath }) {
        try {
          const result = await winccoa.cnsGetNodesByData(dpName, type, viewPath);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS nodes by data: ${error.message}`);
        }
      },

      // Property Functions
      async getProperty(_, { cnsPath, key }) {
        try {
          const result = await winccoa.cnsGetProperty(cnsPath, key);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS property: ${error.message}`);
        }
      },

      async getPropertyKeys(_, { cnsPath }) {
        try {
          const result = await winccoa.cnsGetPropertyKeys(cnsPath);
          return result;
        } catch (error) {
          throw new Error(`Failed to get CNS property keys: ${error.message}`);
        }
      },

      // Utility Functions
      async nodeExists(_, { path }) {
        try {
          const result = await winccoa.cns_nodeExists(path);
          return result;
        } catch (error) {
          throw new Error(`Failed to check if CNS node exists: ${error.message}`);
        }
      },

      async treeExists(_, { path }) {
        try {
          const result = await winccoa.cns_treeExists(path);
          return result;
        } catch (error) {
          throw new Error(`Failed to check if CNS tree exists: ${error.message}`);
        }
      },

      async viewExists(_, { path }) {
        try {
          const result = await winccoa.cns_viewExists(path);
          return result;
        } catch (error) {
          throw new Error(`Failed to check if CNS view exists: ${error.message}`);
        }
      },

      async isNode(_, { path }) {
        try {
          const result = await winccoa.cns_isNode(path);
          return result;
        } catch (error) {
          throw new Error(`Failed to check if path is CNS node: ${error.message}`);
        }
      },

      async isTree(_, { path }) {
        try {
          const result = await winccoa.cns_isTree(path);
          return result;
        } catch (error) {
          throw new Error(`Failed to check if path is CNS tree: ${error.message}`);
        }
      },

      async isView(_, { path }) {
        try {
          const result = await winccoa.cns_isView(path);
          return result;
        } catch (error) {
          throw new Error(`Failed to check if path is CNS view: ${error.message}`);
        }
      },

      async checkId(_, { id }) {
        try {
          const result = await winccoa.cns_checkId(id);
          return result;
        } catch (error) {
          throw new Error(`Failed to check CNS ID: ${error.message}`);
        }
      },

      async checkName(_, { name }) {
        try {
          const result = await winccoa.cns_checkName(name);
          return result;
        } catch (error) {
          throw new Error(`Failed to check CNS name: ${error.message}`);
        }
      },

      async checkSeparator(_, { separator }) {
        try {
          const result = await winccoa.cns_checkSeparator(separator);
          return result;
        } catch (error) {
          throw new Error(`Failed to check CNS separator: ${error.message}`);
        }
      }
    },

    Mutation: {
      // Creation Functions
      async createView(_, { view, displayName, separator }) {
        try {
          const result = await winccoa.cnsCreateView(view, displayName, separator);
          return result;
        } catch (error) {
          throw new Error(`Failed to create CNS view: ${error.message}`);
        }
      },

      async addTree(_, { cnsParentPath, tree }) {
        try {
          const winccoaTree = convertTreeNodeInput(tree);
          const result = await winccoa.cnsAddTree(cnsParentPath, winccoaTree);
          return result;
        } catch (error) {
          throw new Error(`Failed to add CNS tree: ${error.message}`);
        }
      },

      async addNode(_, { cnsParentPath, name, displayName, dp }) {
        try {
          const result = await winccoa.cnsAddNode(cnsParentPath, name, displayName, dp);
          return result;
        } catch (error) {
          throw new Error(`Failed to add CNS node: ${error.message}`);
        }
      },

      // Modification Functions
      async changeTree(_, { cnsPath, tree }) {
        try {
          const winccoaTree = convertTreeNodeInput(tree);
          const result = await winccoa.cnsChangeTree(cnsPath, winccoaTree);
          return result;
        } catch (error) {
          throw new Error(`Failed to change CNS tree: ${error.message}`);
        }
      },

      async deleteTree(_, { cnsPath }) {
        try {
          const result = await winccoa.cnsDeleteTree(cnsPath);
          return result;
        } catch (error) {
          throw new Error(`Failed to delete CNS tree: ${error.message}`);
        }
      },

      async deleteView(_, { view }) {
        try {
          const result = await winccoa.cnsDeleteView(view);
          return result;
        } catch (error) {
          throw new Error(`Failed to delete CNS view: ${error.message}`);
        }
      },

      // Property Functions
      async setProperty(_, { cnsPath, key, value, valueType }) {
        try {
          // WinCC OA cnsSetProperty expects a numeric WinccoaCtrlType, not a string
          const typeNum = CTRL_TYPE_TO_NUMBER[valueType];
          if (typeNum === undefined)
            throw new Error(`Unknown CtrlType: ${valueType}`);
          const result = await winccoa.cnsSetProperty(cnsPath, key, value, typeNum);
          return result;
        } catch (error) {
          throw new Error(`Failed to set CNS property: ${error.message}`);
        }
      }
    }
  };
}

module.exports = {
  createCnsOperationResolvers,
  convertTreeNodeInput,
  convertTreeNodeOutput
};