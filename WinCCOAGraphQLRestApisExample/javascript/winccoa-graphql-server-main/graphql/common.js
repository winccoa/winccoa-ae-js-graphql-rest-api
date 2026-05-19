// Common GraphQL resolver functions for WinCC OA

const {
  ONLINE_VALUE_ATTR,
  ONLINE_STIME_ATTR,
  ONLINE_STATUS_ATTR,
  extractHistoryValues,
  applyPagination
} = require('./helpers')
const {
  needsCtrlScript,
  typedDpSet,
  typedDpSetWait,
  typedDpSetTimed,
  typedDpSetTimedWait,
} = require('./ctrl-type-utils')

// WinCC OA error codes that are "not found" / expected client errors.
// These are logged at debug level only — the GraphQL error response already
// carries the information, so a SEVERE server log entry is unnecessary noise.
const EXPECTED_NOT_FOUND_CODES = new Set([
  57,   // Datapoint type does not exist
  71,   // DP does not exist
  76,   // Invalid argument (e.g. alias does not exist for a DP)
  248,  // DP type has invalid references (primitive type, no refs)
])

/**
 * Log a resolver error at the appropriate level.
 * "Not found" errors are debug-only; everything else is error.
 */
function logResolverError(logger, label, error) {
  if (EXPECTED_NOT_FOUND_CODES.has(error.code)) {
    logger.debug(`${label} (expected): ${error.message}`)
  } else {
    logger.error(`${label}:`, error)
  }
}

// Element type mapping from WinCC OA numeric values to GraphQL enum
// Based on WinccoaElementType enum values from winccoa-manager
const ElementTypeMap = {
  1: 'STRUCT',
  3: 'DYN_CHAR',
  4: 'DYN_UINT',
  5: 'DYN_INT',
  6: 'DYN_FLOAT',
  7: 'DYN_BOOL',
  8: 'DYN_BIT32',
  9: 'DYN_STRING',
  10: 'DYN_TIME',
  11: 'CHAR_STRUCT',
  12: 'UINT_STRUCT',
  13: 'INT_STRUCT',
  14: 'FLOAT_STRUCT',
  15: 'BOOL_STRUCT',
  16: 'BIT32_STRUCT',
  17: 'STRING_STRUCT',
  18: 'TIME_STRUCT',
  19: 'CHAR',
  20: 'UINT',
  21: 'INT',
  22: 'FLOAT',
  23: 'BOOL',
  24: 'BIT32',
  25: 'STRING',
  26: 'TIME',
  27: 'DPID',
  29: 'DYN_DPID',
  30: 'DYN_CHAR_STRUCT',
  31: 'DYN_UINT_STRUCT',
  32: 'DYN_INT_STRUCT',
  33: 'DYN_FLOAT_STRUCT',
  34: 'DYN_BOOL_STRUCT',
  35: 'DYN_BIT32_STRUCT',
  36: 'DYN_STRING_STRUCT',
  37: 'DYN_TIME_STRUCT',
  38: 'DYN_DPID_STRUCT',
  39: 'DPID_STRUCT',
  41: 'TYPEREF',
  42: 'LANGSTRING',
  43: 'LANGSTRING_STRUCT',
  44: 'DYN_LANGSTRING',
  45: 'DYN_LANGSTRING_STRUCT',
  46: 'BLOB',
  47: 'BLOB_STRUCT',
  48: 'DYN_BLOB',
  49: 'DYN_BLOB_STRUCT',
  50: 'BIT64',
  51: 'DYN_BIT64',
  52: 'BIT64_STRUCT',
  53: 'DYN_BIT64_STRUCT',
  54: 'LONG',
  55: 'DYN_LONG',
  56: 'LONG_STRUCT',
  57: 'DYN_LONG_STRUCT',
  58: 'ULONG',
  59: 'DYN_ULONG',
  60: 'ULONG_STRUCT',
  61: 'DYN_ULONG_STRUCT'
};

// Reverse mapping from enum names to numeric IDs for ElementType
const ElementTypeReverseMap = Object.entries(ElementTypeMap).reduce((acc, [key, value]) => {
  acc[value] = parseInt(key)
  return acc
}, {});

/**
 * Converts DpTypeNodeInput enum values to WinCC OA numeric type IDs.
 * Used as input converter for dpTypeCreate() and dpTypeChange() WinCC OA functions.
 *
 * @param {object} node - The node with enum type values to convert
 * @returns {object} Node with numeric type IDs
 * @throws {Error} If an unknown element type is provided
 */
function convertDpTypeNodeInputToNumeric(node) {
  const converted = { ...node }
  if (converted.type && typeof converted.type === 'string') {
    converted.type = ElementTypeReverseMap[converted.type]
    if (converted.type === undefined) {
      throw new Error(`Unknown element type: ${node.type}`)
    }
  }
  if (converted.children && Array.isArray(converted.children)) {
    converted.children = converted.children.map(child => convertDpTypeNodeInputToNumeric(child))
  }
  return converted
}

// WinCC OA Control type mapping with correct IDs from WinccoaCtrlType documentation
const CtrlTypeMap = {
  196608: 'TIME_VAR',
  262144: 'BOOL_VAR',
  327680: 'INT_VAR',
  393216: 'UINT_VAR',
  458752: 'FLOAT_VAR',
  524288: 'STRING_VAR',
  589824: 'BIT32_VAR',
  655360: 'CHAR_VAR',
  851968: 'DYN_TIME_VAR',
  917504: 'DYN_BOOL_VAR',
  983040: 'DYN_INT_VAR',
  1048576: 'DYN_UINT_VAR',
  1114112: 'DYN_FLOAT_VAR',
  1179648: 'DYN_STRING_VAR',
  1245184: 'DYN_BIT32_VAR',
  1310720: 'DYN_CHAR_VAR',
  1703936: 'DYN_DYN_TIME_VAR',
  1769472: 'DYN_DYN_BOOL_VAR',
  1835008: 'DYN_DYN_INT_VAR',
  1900544: 'DYN_DYN_UINT_VAR',
  1966080: 'DYN_DYN_FLOAT_VAR',
  2031616: 'DYN_DYN_STRING_VAR',
  2097152: 'DYN_DYN_BIT32_VAR',
  2162688: 'DYN_DYN_CHAR_VAR',
  2424832: 'ATIME_VAR',
  2490368: 'DYN_ATIME_VAR',
  2555904: 'DYN_DYN_ATIME_VAR',
  2621440: 'LANGSTRING_VAR',
  2686976: 'DYN_LANGSTRING_VAR',
  2752512: 'DYN_DYN_LANGSTRING_VAR',
  3014656: 'BLOB_VAR',
  4587520: 'LONG_VAR',
  4653056: 'DYN_LONG_VAR',
  4718592: 'DYN_DYN_LONG_VAR',
  4784128: 'ULONG_VAR',
  4849664: 'DYN_ULONG_VAR',
  4915200: 'DYN_DYN_ULONG_VAR',
  4980736: 'BIT64_VAR',
  5046272: 'DYN_BIT64_VAR',
  5111808: 'DYN_DYN_BIT64_VAR'
};

/**
 * Creates resolver functions for WinCC OA data point and system operations.
 *
 * Wraps WinCC OA manager functions through the winccoa-manager Node.js binding.
 * Each resolver corresponds to an original WinCC OA C++ function.
 *
 * @param {WinccoaManager} winccoa - WinCC OA manager instance for API access
 * @param {object} logger - Logger instance for error reporting
 * @returns {object} Resolver object with Query and Mutation resolvers
 */
function createCommonResolvers(winccoa, logger) {
  return {
    Query: {
      /**
       * Retrieves data point values.
       * Wraps WinCC OA function: dpGet(dpeNames)
       *
       * @param {Array<string>} dpeNames - Array of data point element names
       * @returns {Promise<Array>} Promise resolving to array of data point values
       */
      async dpGet(_, { dpeNames }) {
        try {
          const result = await winccoa.dpGet(dpeNames);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGet error:', error);
          throw new Error(`Failed to get data points: ${error.message}`);
        }
      },
      
      /**
       * Retrieves data point names matching a pattern.
       * Wraps WinCC OA function: dpNames(dpPattern, dpType)
       *
       * @param {string} dpPattern - Pattern to match data point names
       * @param {string} [dpType] - Optional data point type filter
       * @returns {Promise<Array<string>>} Promise resolving to array of matching data point names
       */
      async dpNames(_, { dpPattern, dpType }) {
        try {
          const result = await winccoa.dpNames(dpPattern, dpType);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpNames error:', error);
          throw new Error(`Failed to get data point names: ${error.message}`);
        }
      },

      /**
       * Retrieves data point types matching a pattern.
       * Wraps WinCC OA function: dpTypes(pattern, systemId)
       *
       * @param {string} pattern - Pattern to match data point type names
       * @param {number} [systemId] - Optional system ID filter
       * @returns {Promise<Array>} Promise resolving to array of data point types
       */
      async dpTypes(_, { pattern, systemId }) {
        try {
          const result = await winccoa.dpTypes(pattern, systemId);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpTypes error:', error);
          throw new Error(`Failed to get data point types: ${error.message}`);
        }
      },

      /**
       * Retrieves data point values not older than specified age.
       * Wraps WinCC OA function: dpGetMaxAge(age, dpeNames)
       *
       * @param {number} age - Maximum age in milliseconds
       * @param {Array<string>} dpeNames - Array of data point element names
       * @returns {Promise<Array>} Promise resolving to array of data point values
       */
      async dpGetMaxAge(_, { age, dpeNames }) {
        try {
          const result = await winccoa.dpGetMaxAge(age, dpeNames);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGetMaxAge error:', error);
          throw new Error(`Failed to get data points with max age: ${error.message}`);
        }
      },

      /**
       * Retrieves the element type of a data point.
       * Wraps WinCC OA function: dpElementType(dpeName)
       *
       * @param {string} dpeName - Data point element name
       * @returns {Promise<string>} Promise resolving to element type enum value
       */
      async dpElementType(_, { dpeName }) {
        try {
          const result = await winccoa.dpElementType(dpeName);
          const enumValue = ElementTypeMap[result];
          if (enumValue === undefined) {
            logger.warn(`Unknown element type value: ${result} for ${dpeName}`);
            throw new Error(`Unknown element type value: ${result}`);
          }
          return enumValue;
        } catch (error) {
          logResolverError(logger, 'dpElementType error:', error);
          throw new Error(`Failed to get element type: ${error.message}`);
        }
      },

      /**
       * Retrieves the control type of a data point attribute.
       * Wraps WinCC OA function: dpAttributeType(dpAttributeName)
       *
       * @param {string} dpAttributeName - Data point attribute name
       * @returns {Promise<string>} Promise resolving to control type enum value
       */
      async dpAttributeType(_, { dpAttributeName }) {
        try {
          const result = await winccoa.dpAttributeType(dpAttributeName);
          const ctrlType = CtrlTypeMap[result];
          if (ctrlType === undefined) {
            logger.warn(`Unknown control type value: ${result} for ${dpAttributeName}`);
            throw new Error(`Unknown control type value: ${result}`);
          }
          return ctrlType;
        } catch (error) {
          logResolverError(logger, 'dpAttributeType error:', error);
          throw new Error(`Failed to get attribute type: ${error.message}`);
        }
      },

      /**
       * Retrieves the data point type name.
       * Wraps WinCC OA function: dpTypeName(dp)
       *
       * @param {string} dp - Data point name
       * @returns {Promise<string>} Promise resolving to data point type name
       */
      async dpTypeName(_, { dp }) {
        try {
          const result = await winccoa.dpTypeName(dp);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpTypeName error:', error);
          throw new Error(`Failed to get type name: ${error.message}`);
        }
      },

      /**
       * Retrieves the type reference name for a data point element.
       * Wraps WinCC OA function: dpTypeRefName(dpe)
       *
       * @param {string} dpe - Data point element name
       * @returns {Promise<string>} Promise resolving to type reference name
       */
      async dpTypeRefName(_, { dpe }) {
        try {
          const result = await winccoa.dpTypeRefName(dpe);
          return result || '';
        } catch (error) {
          // WinCC OA error 248: DP type has no valid references (e.g. simple/primitive types like FLOAT).
          // This is expected for leaf DPs — return empty string instead of throwing.
          if (error.code === 248) return '';
          logResolverError(logger, 'dpTypeRefName error:', error);
          throw new Error(`Failed to get type reference name: ${error.message}`);
        }
      },

      /**
       * Checks if a data point exists.
       * Wraps WinCC OA function: dpExists(dpeName)
       *
       * @param {string} dpeName - Data point name
       * @returns {Promise<boolean>} Promise resolving to existence check result
       */
      async dpExists(_, { dpeName }) {
        try {
          const result = await winccoa.dpExists(dpeName);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpExists error:', error);
          throw new Error(`Failed to check if data point exists: ${error.message}`);
        }
      },
      
      /**
       * Retrieves historic data point values for a time period.
       * Wraps WinCC OA function: dpGetPeriod(startTime, endTime, dpeNames)
       *
       * @param {string} startTime - Start time as ISO string
       * @param {string} endTime - End time as ISO string
       * @param {Array<string>} dpeNames - Array of data point element names
       * @returns {Promise<Array>} Promise resolving to historic data point values
       */
      async dpGetPeriod(_, { startTime, endTime, dpeNames }) {
        try {
          const result = await winccoa.dpGetPeriod(new Date(startTime), new Date(endTime), dpeNames);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGetPeriod error:', error);
          throw new Error(`Failed to get historic data point values: ${error.message}`);
        }
      },

      /**
       * Executes a dpQuery and returns the result.
       * Wraps WinCC OA function: dpQuery(query)
       *
       * @param {string} query - dpQuery query string
       * @returns {Promise<Array>} Promise resolving to query result
       */
      async dpQuery(_, { query }) {
        try {
          const result = await winccoa.dpQuery(query);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpQuery error:', error);
          throw new Error(`Failed to execute dpQuery: ${error.message}`);
        }
      },

      /**
       * Retrieves the alias of a data point.
       * Wraps WinCC OA function: dpGetAlias(dpeName)
       *
       * @param {string} dpeName - Data point name
       * @returns {Promise<string>} Promise resolving to data point alias
       */
      async dpGetAlias(_, { dpeName }) {
        try {
          const result = await winccoa.dpGetAlias(dpeName);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGetAlias error:', error);
          throw new Error(`Failed to get data point alias: ${error.message}`);
        }
      },

      /**
       * Retrieves the description of a data point.
       * Wraps WinCC OA function: dpGetDescription(dpeName)
       *
       * @param {string} dpeName - Data point name
       * @returns {Promise<string>} Promise resolving to data point description
       */
      async dpGetDescription(_, { dpeName }) {
        try {
          const result = await winccoa.dpGetDescription(dpeName);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGetDescription error:', error);
          throw new Error(`Failed to get data point description: ${error.message}`);
        }
      },

      /**
       * Retrieves the format of a data point.
       * Wraps WinCC OA function: dpGetFormat(dpeName)
       *
       * @param {string} dpeName - Data point name
       * @returns {Promise<string>} Promise resolving to data point format
       */
      async dpGetFormat(_, { dpeName }) {
        try {
          const result = await winccoa.dpGetFormat(dpeName);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGetFormat error:', error);
          throw new Error(`Failed to get data point format: ${error.message}`);
        }
      },

      /**
       * Retrieves the unit of a data point.
       * Wraps WinCC OA function: dpGetUnit(dpeName)
       *
       * @param {string} dpeName - Data point name
       * @returns {Promise<string>} Promise resolving to data point unit
       */
      async dpGetUnit(_, { dpeName }) {
        try {
          const result = await winccoa.dpGetUnit(dpeName);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGetUnit error:', error);
          throw new Error(`Failed to get data point unit: ${error.message}`);
        }
      },

      /**
       * Checks if the local system is active in a redundancy setup.
       * Wraps WinCC OA function: isReduActive()
       *
       * @returns {boolean} True if redundancy is active
       */
      isReduActive() {
        try {
          const result = winccoa.isReduActive();
          return result;
        } catch (error) {
          logResolverError(logger, 'isReduActive error:', error);
          throw new Error(`Failed to check redundancy active status: ${error.message}`);
        }
      },

      /**
       * Checks if the system is configured for redundancy.
       * Wraps WinCC OA function: isRedundant()
       *
       * @returns {boolean} True if redundancy is configured
       */
      isRedundant() {
        try {
          const result = winccoa.isRedundant();
          return result;
        } catch (error) {
          logResolverError(logger, 'isRedundant error:', error);
          throw new Error(`Failed to check redundancy configuration: ${error.message}`);
        }
      },

      /**
       * Retrieves the numeric system ID for a system name.
       * Wraps WinCC OA function: getSystemId(systemName)
       *
       * @param {string} systemName - WinCC OA system name
       * @returns {number} System ID
       */
      getSystemId(_, { systemName }) {
        try {
          const result = winccoa.getSystemId(systemName);
          return result;
        } catch (error) {
          logResolverError(logger, 'getSystemId error:', error);
          throw new Error(`Failed to get system ID: ${error.message}`);
        }
      },

      /**
       * Retrieves the system name for a numeric system ID.
       * Wraps WinCC OA function: getSystemName(systemId)
       *
       * @param {number} systemId - Numeric system ID
       * @returns {string} System name
       */
      getSystemName(_, { systemId }) {
        try {
          const result = winccoa.getSystemName(systemId);
          return result;
        } catch (error) {
          logResolverError(logger, 'getSystemName error:', error);
          throw new Error(`Failed to get system name: ${error.message}`);
        }
      },

      /**
       * Retrieves version information for WinCC OA.
       * Wraps WinCC OA function: getVersionInfo()
       *
       * @returns {object} Version information object
       */
      getVersionInfo() {
        try {
          const result = winccoa.getVersionInfo();
          return result;
        } catch (error) {
          logResolverError(logger, 'getVersionInfo error:', error);
          throw new Error(`Failed to get version information: ${error.message}`);
        }
      },

      /**
       * Retrieves the structure of a data point type.
       * Wraps WinCC OA function: dpTypeGet(dpt, includeSubTypes)
       *
       * @param {string} dpt - Data point type name
       * @param {boolean} [includeSubTypes=false] - Whether to include subtypes
       * @returns {Promise<object>} Promise resolving to data point type structure
       */
      async dpTypeGet(_, { dpt, includeSubTypes = false }) {
        try {
          const result = await winccoa.dpTypeGet(dpt, includeSubTypes);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpTypeGet error:', error);
          throw new Error(`Failed to get data point type structure: ${error.message}`);
        }
      },

      /**
       * Retrieves references within a data point type.
       * Wraps WinCC OA function: dpGetDpTypeRefs(dpt)
       *
       * @param {string} dpt - Data point type name
       * @returns {Promise<Array>} Promise resolving to array of type references
       */
      async dpGetDpTypeRefs(_, { dpt }) {
        try {
          const result = await winccoa.dpGetDpTypeRefs(dpt);
          // WinCC OA returns null when a type has no references — normalise to empty arrays
          if (!result || !result.dptNames) {
            return { dptNames: [], dpePaths: [] };
          }
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGetDpTypeRefs error:', error);
          throw new Error(`Failed to get data point type references: ${error.message}`);
        }
      },

      /**
       * Retrieves all data points that reference a given type.
       * Wraps WinCC OA function: dpGetRefsToDpType(reference)
       *
       * @param {string} reference - Type reference name
       * @returns {Promise<Array>} Promise resolving to array of data points referencing the type
       */
      async dpGetRefsToDpType(_, { reference }) {
        try {
          const result = await winccoa.dpGetRefsToDpType(reference);
          // WinCC OA returns null when no references exist — normalise to empty arrays
          if (!result || !result.dptNames) {
            return { dptNames: [], dpePaths: [] };
          }
          return result;
        } catch (error) {
          logResolverError(logger, 'dpGetRefsToDpType error:', error);
          throw new Error(`Failed to get references to data point type: ${error.message}`);
        }
      },

      /**
       * Retrieves complete tag information (value, timestamp, status).
       * Wraps WinCC OA function: dpGet() with special attributes.
       *
       * @param {Array<string>} dpeNames - Array of data point element names
       * @returns {Promise<Array<object>>} Promise resolving to array of tag objects with value, timestamp, status
       */
      async tagGet(_, { dpeNames }) {
         try {
           const results = [];

           for (const dpeName of dpeNames) {
             const valueAttr  = `${dpeName}${ONLINE_VALUE_ATTR}`;
             const timeAttr   = `${dpeName}${ONLINE_STIME_ATTR}`;
             const statusAttr = `${dpeName}${ONLINE_STATUS_ATTR}`;

             const [value, timestamp, status] = await winccoa.dpGet([valueAttr, timeAttr, statusAttr]);

             results.push({ name: dpeName, value, timestamp, status });
           }

           return results;
         } catch (error) {
           logResolverError(logger, 'tagGet error:', error);
           throw new Error(`Failed to get typed tags: ${error.message}`);
         }
       },

      /**
       * Retrieves historic tag data for a time period.
       * Wraps WinCC OA function: dpGetPeriod(startTime, endTime, dpeNames)
       *
       * @param {string} startTime - Start time as ISO string
       * @param {string} endTime - End time as ISO string
       * @param {Array<string>} dpeNames - Array of data point element names
       * @param {number} [limit] - Maximum number of results to return
       * @param {number} [offset] - Offset for pagination
       * @returns {Promise<Array<object>>} Promise resolving to array of tag history objects
       */
      async tagGetHistory(_, { startTime, endTime, dpeNames, limit, offset }) {
        try {
          const result = await winccoa.dpGetPeriod(new Date(startTime), new Date(endTime), dpeNames);

          return dpeNames.map((dpeName, index) => ({
            name: dpeName,
            values: applyPagination(extractHistoryValues(result, index), offset, limit)
          }));
        } catch (error) {
          logResolverError(logger, 'tagGetHistory error:', error);
          throw new Error(`Failed to get tag history: ${error.message}`);
        }
      }
     },
    
    Mutation: {
      /**
       * Creates a new data point.
       * Wraps WinCC OA function: dpCreate(dpeName, dpType, systemId, dpId)
       *
       * @param {string} dpeName - Data point name
       * @param {string} dpType - Data point type
       * @param {number} [systemId] - Optional system ID
       * @param {number} [dpId] - Optional data point ID
       * @returns {Promise<object>} Promise resolving to creation result
       */
      async dpCreate(_, { dpeName, dpType, systemId, dpId }) {
        try {
          const result = await winccoa.dpCreate(dpeName, dpType, systemId, dpId);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpCreate error:', error);
          throw new Error(`Failed to create data point: ${error.message}`);
        }
      },

      /**
       * Deletes a data point.
       * Wraps WinCC OA function: dpDelete(dpName)
       *
       * @param {string} dpName - Data point name to delete
       * @returns {Promise<object>} Promise resolving to deletion result
       */
      async dpDelete(_, { dpName }) {
        try {
          const result = await winccoa.dpDelete(dpName);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpDelete error:', error);
          throw new Error(`Failed to delete data point: ${error.message}`);
        }
      },

      /**
       * Copies a data point.
       * Wraps WinCC OA function: dpCopy(source, destination, driver)
       *
       * @param {string} source - Source data point name
       * @param {string} destination - Destination data point name
       * @param {number} [driver=1] - Driver ID
       * @returns {Promise<object>} Promise resolving to copy result
       */
      async dpCopy(_, { source, destination, driver = 1 }) {
        try {
          const result = await winccoa.dpCopy(source, destination, driver);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpCopy error:', error);
          throw new Error(`Failed to copy data point: ${error.message}`);
        }
      },

      /**
       * Sets data point values immediately (non-blocking).
       * Wraps WinCC OA function: dpSet(dpeNames, values)
       *
       * @param {Array<string>} dpeNames - Array of data point element names
       * @param {Array} values - Values to set
       * @returns {Promise<object>} Promise resolving to set result
       */
      async dpSet(_, { dpeNames, values }) {
        try {
          const simpleDpes = [], simpleVals = [], complexOps = []
          for (let i = 0; i < dpeNames.length; i++) {
            if (needsCtrlScript(values[i])) {
              complexOps.push(typedDpSet(winccoa, dpeNames[i], values[i]))
            } else {
              simpleDpes.push(dpeNames[i])
              simpleVals.push(values[i])
            }
          }
          const ops = complexOps
          if (simpleDpes.length > 0) ops.push(winccoa.dpSet(simpleDpes, simpleVals))
          await Promise.all(ops)
          return true
        } catch (error) {
          logResolverError(logger, 'dpSet error:', error);
          throw new Error(`Failed to set data point values: ${error.message}`);
        }
      },

      /**
       * Sets data point values and waits for confirmation.
       * Wraps WinCC OA function: dpSetWait(dpeNames, values)
       *
       * @param {Array<string>} dpeNames - Array of data point element names
       * @param {Array} values - Values to set
       * @returns {Promise<object>} Promise resolving to set result
       */
      async dpSetWait(_, { dpeNames, values }) {
        try {
          const simpleDpes = [], simpleVals = [], complexOps = []
          for (let i = 0; i < dpeNames.length; i++) {
            if (needsCtrlScript(values[i])) {
              complexOps.push(typedDpSetWait(winccoa, dpeNames[i], values[i]))
            } else {
              simpleDpes.push(dpeNames[i])
              simpleVals.push(values[i])
            }
          }
          const ops = complexOps
          if (simpleDpes.length > 0) ops.push(winccoa.dpSetWait(simpleDpes, simpleVals))
          const results = await Promise.all(ops)
          return results.every(r => r !== false)
        } catch (error) {
          logResolverError(logger, 'dpSetWait error:', error);
          throw new Error(`Failed to set data point values with wait: ${error.message}`);
        }
      },

      /**
       * Sets data point values at a specific future time (non-blocking).
       * Wraps WinCC OA function: dpSetTimed(time, dpeNames, values)
       *
       * @param {string} time - Future time as ISO string
       * @param {Array<string>} dpeNames - Array of data point element names
       * @param {Array} values - Values to set
       * @returns {Promise<object>} Promise resolving to set result
       */
      async dpSetTimed(_, { time, dpeNames, values }) {
        try {
          const t = new Date(time)
          const simpleDpes = [], simpleVals = [], complexOps = []
          for (let i = 0; i < dpeNames.length; i++) {
            if (needsCtrlScript(values[i])) {
              complexOps.push(typedDpSetTimed(winccoa, t, dpeNames[i], values[i]))
            } else {
              simpleDpes.push(dpeNames[i])
              simpleVals.push(values[i])
            }
          }
          const ops = complexOps
          if (simpleDpes.length > 0) ops.push(winccoa.dpSetTimed(t, simpleDpes, simpleVals))
          await Promise.all(ops)
          return true
        } catch (error) {
          logResolverError(logger, 'dpSetTimed error:', error);
          throw new Error(`Failed to set timed data point values: ${error.message}`);
        }
      },

      /**
       * Sets data point values at a specific future time and waits for confirmation.
       * Wraps WinCC OA function: dpSetTimedWait(time, dpeNames, values)
       *
       * @param {string} time - Future time as ISO string
       * @param {Array<string>} dpeNames - Array of data point element names
       * @param {Array} values - Values to set
       * @returns {Promise<object>} Promise resolving to set result
       */
      async dpSetTimedWait(_, { time, dpeNames, values }) {
        try {
          const t = new Date(time)
          const simpleDpes = [], simpleVals = [], complexOps = []
          for (let i = 0; i < dpeNames.length; i++) {
            if (needsCtrlScript(values[i])) {
              complexOps.push(typedDpSetTimedWait(winccoa, t, dpeNames[i], values[i]))
            } else {
              simpleDpes.push(dpeNames[i])
              simpleVals.push(values[i])
            }
          }
          const ops = complexOps
          if (simpleDpes.length > 0) ops.push(winccoa.dpSetTimedWait(t, simpleDpes, simpleVals))
          const results = await Promise.all(ops)
          return results.every(r => r !== false)
        } catch (error) {
          logResolverError(logger, 'dpSetTimedWait error:', error);
          throw new Error(`Failed to set timed data point values with wait: ${error.message}`);
        }
      },

      /**
       * Creates a new data point type.
       * Wraps WinCC OA function: dpTypeCreate(startNode)
       *
       * @param {object} startNode - Root node of the data point type structure
       * @returns {Promise<object>} Promise resolving to creation result
       */
      async dpTypeCreate(_, { startNode }) {
        try {
          const convertedNode = convertDpTypeNodeInputToNumeric(startNode);
          logger.debug('dpTypeCreate converted node:', JSON.stringify(convertedNode, null, 2));
          const result = await winccoa.dpTypeCreate(convertedNode);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpTypeCreate error:', error);
          throw new Error(`Failed to create data point type: ${error.message}`);
        }
      },

      /**
       * Modifies an existing data point type.
       * Wraps WinCC OA function: dpTypeChange(startNode)
       *
       * @param {object} startNode - Modified root node of the data point type structure
       * @returns {Promise<object>} Promise resolving to modification result
       */
      async dpTypeChange(_, { startNode }) {
        try {
          const convertedNode = convertDpTypeNodeInputToNumeric(startNode);
          const result = await winccoa.dpTypeChange(convertedNode);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpTypeChange error:', error);
          throw new Error(`Failed to change data point type: ${error.message}`);
        }
      },

      /**
       * Deletes a data point type.
       * Wraps WinCC OA function: dpTypeDelete(dpt)
       *
       * @param {string} dpt - Data point type name to delete
       * @returns {Promise<object>} Promise resolving to deletion result
       */
      async dpTypeDelete(_, { dpt }) {
        try {
          const result = await winccoa.dpTypeDelete(dpt);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpTypeDelete error:', error);
          throw new Error(`Failed to delete data point type: ${error.message}`);
        }
      },

      /**
       * Sets the alias of a data point.
       * Wraps WinCC OA function: dpSetAlias(dpeName, alias)
       *
       * @param {string} dpeName - Data point name
       * @param {string} alias - New alias value
       * @returns {Promise<object>} Promise resolving to set result
       */
      async dpSetAlias(_, { dpeName, alias }) {
        try {
          const result = await winccoa.dpSetAlias(dpeName, alias);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpSetAlias error:', error);
          throw new Error(`Failed to set data point alias: ${error.message}`);
        }
      },

      /**
       * Sets the description of a data point.
       * Wraps WinCC OA function: dpSetDescription(dpeName, description)
       *
       * @param {string} dpeName - Data point name
       * @param {string} description - New description value
       * @returns {Promise<object>} Promise resolving to set result
       */
      async dpSetDescription(_, { dpeName, description }) {
        try {
          const result = await winccoa.dpSetDescription(dpeName, description);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpSetDescription error:', error);
          throw new Error(`Failed to set data point description: ${error.message}`);
        }
      },

      /**
       * Sets the format of a data point.
       * Wraps WinCC OA function: dpSetFormat(dpeName, format)
       *
       * @param {string} dpeName - Data point name
       * @param {string} format - New format value
       * @returns {Promise<object>} Promise resolving to set result
       */
      async dpSetFormat(_, { dpeName, format }) {
        try {
          const result = await winccoa.dpSetFormat(dpeName, format);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpSetFormat error:', error);
          throw new Error(`Failed to set data point format: ${error.message}`);
        }
      },

      /**
       * Sets the unit of a data point.
       * Wraps WinCC OA function: dpSetUnit(dpeName, unit)
       *
       * @param {string} dpeName - Data point name
       * @param {string} unit - New unit value
       * @returns {Promise<object>} Promise resolving to set result
       */
      async dpSetUnit(_, { dpeName, unit }) {
        try {
          const result = await winccoa.dpSetUnit(dpeName, unit);
          return result;
        } catch (error) {
          logResolverError(logger, 'dpSetUnit error:', error);
          throw new Error(`Failed to set data point unit: ${error.message}`);
        }
      }
     },

     Tag: {
        /**
         * Retrieves historical data for a tag within a time range.
         * Wraps WinCC OA function: dpGetPeriod(startTime, endTime, dpeNames)
         */
        async history(tag, { startTime, endTime, limit, offset }) {
          try {
            logger.info(`Getting history for tag ${tag.name} from ${startTime} to ${endTime}`);
            const result = await winccoa.dpGetPeriod(new Date(startTime), new Date(endTime), [tag.name]);
            const values = extractHistoryValues(result, 0);
            logger.info(`Returning ${values.length} historical values for ${tag.name}`);
            return { name: tag.name, values: applyPagination(values, offset, limit) };
          } catch (error) {
            logResolverError(logger, 'Tag.history error:', error);
            logger.warn(`Returning empty history for ${tag.name} due to error: ${error.message}`);
            return { name: tag.name, values: [] };
          }
        }
     }
   };
 }

module.exports = {
  ElementTypeMap,
  ElementTypeReverseMap,
  CtrlTypeMap,
  createCommonResolvers,
  convertDpTypeNodeInputToNumeric
};