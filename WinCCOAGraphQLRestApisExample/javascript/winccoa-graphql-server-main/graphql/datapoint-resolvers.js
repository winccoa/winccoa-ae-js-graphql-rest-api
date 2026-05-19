// DataPoint and DataPointElement resolvers

const {
  parseDataPointName,
  ONLINE_VALUE_ATTR,
  ONLINE_STIME_ATTR,
  ONLINE_STATUS_ATTR,
  resolveTimeRange,
  extractHistoryValues,
  applyPagination,
  getElementFullPath
} = require('./helpers')
const { ElementTypeMap } = require('./common')
const { ALERT_ATTRIBUTE_MAP } = require('./alert-resolvers')

// Element status bit mapping (0-23)
const STATUS_BIT_NAMES = [
  'ACTIVE',              // 0
  'EXP_DEFAULT',         // 1
  'AUT_DEFAULT',         // 2
  'OUT_PRANGE',          // 3
  'OUT_RANGE',           // 4
  'EXP_INV',             // 5
  'AUT_INV',             // 6
  'ONLINE_BAD',          // 7
  'DEFAULT_BAD',         // 8
  'FROM_GI',             // 9
  'FROM_SI',             // 10
  'PER_ACTIVE',          // 11
  'CORR',                // 12
  'COMPR',               // 13
  'COMP_CORR',           // 14
  'CORR_ADD',            // 15
  'COMP_INV',            // 16
  'STIME_INV',           // 17
  'TRANSITION',          // 18
  'LAST_VALUE_STORAGE_OFF', // 19
  'VALUE_CHANGED',       // 20
  'VALUE_UP',            // 21
  'UNCERTAIN',           // 22
  'RESERVED'             // 23
]

function decodeStatusBits(statusValue) {
  if (statusValue === null || statusValue === undefined) {
    return { value: 0, bits: '0', on: [], off: STATUS_BIT_NAMES }
  }

  const value = typeof statusValue === 'number' ? statusValue : parseInt(statusValue, 10)
  const bits = value.toString(2).padStart(24, '0')
  const on = []
  const off = []

  for (let i = 0; i < 24; i++) {
    const bitSet = (value & (1 << i)) !== 0
    if (bitSet) {
      on.push(STATUS_BIT_NAMES[i])
    } else {
      off.push(STATUS_BIT_NAMES[i])
    }
  }

  return { value, bits, on, off }
}

function createDataPointResolvers(winccoa, logger) {
  return {
    DataPoint: {
      async type(dataPoint) {
        try {
          const typeName = dataPoint.typeName || await winccoa.dpTypeName(dataPoint.name)
          return {
            name: typeName
          }
        } catch (error) {
          logger.error('DataPoint.type error:', error)
          throw error
        }
      },

      async exists(dataPoint) {
        try {
          return await winccoa.dpExists(dataPoint.fullName)
        } catch (error) {
          logger.error('DataPoint.exists error:', error)
          return false
        }
      },

      async element(dataPoint, { path }) {
        try {
          const fullPath = path ? `${dataPoint.fullName}.${path}` : dataPoint.fullName
          const value = await winccoa.dpGet([fullPath])
          const elementType = await winccoa.dpElementType(fullPath)

          return {
            name: path || dataPoint.name,
            path: path || '',
            dataPoint,
            value: value[0],
            elementTypeValue: elementType
          }
        } catch (error) {
          logger.error('DataPoint.element error:', error)
          return null
        }
      },

      async elements(dataPoint, { pattern }) {
        try {
          // Use dpNames to get all elements matching the pattern
          // ** gets all elements at all levels
          const searchPattern = pattern || '**'
          const fullPattern = `${dataPoint.fullName}.${searchPattern}`

          const elementNames = await winccoa.dpNames(fullPattern)

          return elementNames.map(fullDpeName => {
            // Extract the element path relative to the data point
            // e.g., "pump1.status.value" -> "status.value"
            const elementPath = fullDpeName.replace(`${dataPoint.fullName}.`, '')
            const elementName = elementPath.split('.').pop()

            return {
              name: elementName,
              path: elementPath,
              dataPoint
            }
          })
        } catch (error) {
          logger.error('DataPoint.elements error:', error)
          return []
        }
      },

      async value(dataPoint) {
        try {
          const result = await winccoa.dpGet([dataPoint.fullName])
          return result[0]
        } catch (error) {
          logger.error('DataPoint.value error:', error)
          return null
        }
      },

      async tag(dataPoint) {
        try {
          // Get tag with value, timestamp, and status
          const valueAttr = `${dataPoint.fullName}${ONLINE_VALUE_ATTR}`
          const timeAttr  = `${dataPoint.fullName}${ONLINE_STIME_ATTR}`
          const statusAttr = `${dataPoint.fullName}${ONLINE_STATUS_ATTR}`

          const results = await winccoa.dpGet([valueAttr, timeAttr, statusAttr])

          return {
            name: dataPoint.fullName,
            value: results[0],
            timestamp: results[1],
            status: decodeStatusBits(results[2])
          }
        } catch (error) {
          logger.error('DataPoint.tag error:', error)
          return null
        }
      },

      async tagHistory(dataPoint, { startTime, endTime, lastMinutes, limit, offset }) {
        try {
          const { rangeStart, rangeEnd } = resolveTimeRange(startTime, endTime, lastMinutes)
          const result = await winccoa.dpGetPeriod(rangeStart, rangeEnd, [dataPoint.fullName])
          const values = extractHistoryValues(result, 0)
          return {
            name: dataPoint.fullName,
            values: applyPagination(values, offset, limit)
          }
        } catch (error) {
          logger.error('DataPoint.tagHistory error:', error)
          return { name: dataPoint.fullName, values: [] }
        }
      },

      async alerts(dataPoint, { startTime, endTime, lastMinutes, limit, offset }, context, info) {
        try {
          const { rangeStart, rangeEnd } = resolveTimeRange(startTime, endTime, lastMinutes)
          const { convertAlertTimes } = require('./alerting')

          // Collect alert attributes based on requested fields
          const selections = info.fieldNodes[0].selectionSet?.selections || []
          const alertAttributes = []

          for (const selection of selections) {
            const fieldName = selection.name.value

            // Map GraphQL fields to WinCC OA alert attributes
            if (fieldName === 'text') {
              alertAttributes.push(ALERT_ATTRIBUTE_MAP.TEXT)
            } else if (fieldName === 'acknowledged') {
              alertAttributes.push(ALERT_ATTRIBUTE_MAP.ACK_STATE)
            } else if (fieldName === 'acknowledgedBy') {
              alertAttributes.push(ALERT_ATTRIBUTE_MAP.ACK_STATE)
              alertAttributes.push(ALERT_ATTRIBUTE_MAP.ACK_USER)
            } else if (fieldName === 'acknowledgedAt') {
              alertAttributes.push(ALERT_ATTRIBUTE_MAP.ACK_STATE)
              alertAttributes.push(ALERT_ATTRIBUTE_MAP.ACK_TIME)
            } else if (fieldName === 'priority' || fieldName === 'severity') {
              alertAttributes.push(ALERT_ATTRIBUTE_MAP.PRIORITY)
            } else if (fieldName === 'attribute') {
              // Extract the specific attribute name from arguments
              const args = selection.arguments || []
              const nameArg = args.find(arg => arg.name.value === 'name')
              if (nameArg && nameArg.value.value) {
                const attrEnum = nameArg.value.value
                if (ALERT_ATTRIBUTE_MAP[attrEnum]) {
                  alertAttributes.push(ALERT_ATTRIBUTE_MAP[attrEnum])
                }
              }
            }
          }

          // Remove duplicates and build the full attribute paths with data point
          const uniqueAttributes = [...new Set(alertAttributes)]
          const names = uniqueAttributes.length > 0
            ? uniqueAttributes.map(attr => `${dataPoint.fullName}:${attr}`)
            : [dataPoint.fullName]

          logger.info(`alertGetPeriod args: startTime=${rangeStart.toISOString()}, endTime=${rangeEnd.toISOString()}, names=${JSON.stringify(names)}`)
          const result = await winccoa.alertGetPeriod(rangeStart, rangeEnd, names)
          const alertTimes = convertAlertTimes(result.alertTimes)

          // Group alert results by time+count to reconstruct alert objects
          // alertGetPeriod returns one entry per attribute, we need to group them
          const alertMap = new Map()

          alertTimes.forEach((at, index) => {
            const key = `${at.time}_${at.count}`
            if (!alertMap.has(key)) {
              alertMap.set(key, {
                time: at.time,
                count: at.count,
                dpeName: at.dpe.replace(/:_alert_hdl\.\..*$/, ''), // Remove attribute suffix
                values: {},
                
              })
            }

            // Extract attribute name from dpe (e.g., "System1:ExampleDP.:_alert_hdl.._text" -> "_alert_hdl.._text")
            const attrMatch = at.dpe.match(/:(_alert_hdl\.\..+)$/)
            if (attrMatch) {
              const attrName = attrMatch[1]
              alertMap.get(key).values[attrName] = result.values[index]
            }
          })

          const alerts = Array.from(alertMap.values())
          return applyPagination(alerts, offset, limit)
        } catch (error) {
          logger.error('DataPoint.alerts error:', error)
          return []
        }
      },

      async cnsNodes(dataPoint) {
        try {
          // cnsGetNodesByData expects type and viewPath parameters
          // type: optional (default searches all types)
          // viewPath: optional (default '' searches all views)
          const paths = await winccoa.cnsGetNodesByData(dataPoint.fullName)

          if (!paths || paths.length === 0) {
            logger.debug(`No CNS nodes found for data point: ${dataPoint.fullName}`)
            return []
          }

          return paths.map(path => ({
            path,
            dpName: dataPoint.fullName,
            dataPoint
          }))
        } catch (error) {
          logger.error('DataPoint.cnsNodes error:', error)
          return []
        }
      },

      async alias(dataPoint) {
        try {
          return await winccoa.dpGetAlias(dataPoint.fullName)
        } catch (error) {
          logger.error('DataPoint.alias error:', error)
          return null
        }
      },

      async description(dataPoint) {
        try {
          return await winccoa.dpGetDescription(dataPoint.fullName)
        } catch (error) {
          logger.error('DataPoint.description error:', error)
          return null
        }
      },

      async format(dataPoint) {
        try {
          return await winccoa.dpGetFormat(dataPoint.fullName)
        } catch (error) {
          logger.error('DataPoint.format error:', error)
          return null
        }
      },

      async unit(dataPoint) {
        try {
          return await winccoa.dpGetUnit(dataPoint.fullName)
        } catch (error) {
          logger.error('DataPoint.unit error:', error)
          return null
        }
      }
    },

    DataPointElement: {
      dataPoint(element) {
        return element.dataPoint
      },

      async value(element) {
        if (element.value !== undefined) return element.value

        try {
          const fullPath = getElementFullPath(element)
          const result = await winccoa.dpGet([fullPath])
          return result[0]
        } catch (error) {
          logger.error('DataPointElement.value error:', error)
          return null
        }
      },

      async timestamp(element) {
        try {
          const fullPath = getElementFullPath(element)
          const timeAttr = `${fullPath}${ONLINE_STIME_ATTR}`
          const result = await winccoa.dpGet([timeAttr])
          return result[0]
        } catch (error) {
          logger.error('DataPointElement.timestamp error:', error)
          return null
        }
      },

      async status(element) {
        try {
          const fullPath = getElementFullPath(element)
          const statusAttr = `${fullPath}${ONLINE_STATUS_ATTR}`
          const result = await winccoa.dpGet([statusAttr])
          return decodeStatusBits(result[0])
        } catch (error) {
          logger.error('DataPointElement.status error:', error)
          return decodeStatusBits(0)
        }
      },

      async elementType(element) {
        try {
          if (element.elementTypeValue !== undefined) {
            return ElementTypeMap[element.elementTypeValue] || 'MIXED'
          }
          const fullPath = getElementFullPath(element)
          const typeValue = await winccoa.dpElementType(fullPath)
          return ElementTypeMap[typeValue] || 'MIXED'
        } catch (error) {
          logger.error('DataPointElement.elementType error:', error)
          return 'MIXED'
        }
      },

      async history(element, { startTime, endTime, lastMinutes, limit, offset }) {
        try {
          const fullPath = getElementFullPath(element)
          const { rangeStart, rangeEnd } = resolveTimeRange(startTime, endTime, lastMinutes)
          const result = await winccoa.dpGetPeriod(rangeStart, rangeEnd, [fullPath])
          const values = extractHistoryValues(result, 0)
          return {
            element,
            values: applyPagination(values, offset, limit),
            totalCount: values.length
          }
        } catch (error) {
          logger.error('DataPointElement.history error:', error)
          return { element, values: [], totalCount: 0 }
        }
      },

      parent(element) {
        // Extract parent path
        if (!element.path || !element.path.includes('.')) return null

        const parts = element.path.split('.')
        parts.pop()
        const parentPath = parts.join('.')

        return {
          name: parts[parts.length - 1] || element.dataPoint.name,
          path: parentPath,
          dataPoint: element.dataPoint
        }
      },

      children(element) {
        // Would need type introspection to list children
        return []
      }
    },

    ElementHistory: {
      element(history) {
        return history.element
      },
      values(history) {
        return history.values
      },
      totalCount(history) {
        return history.totalCount
      }
    },

    DataPointType: {
      async structure(dpType) {
        try {
          const structure = await winccoa.dpTypeGet(dpType.name, false)
          return structure
        } catch (error) {
          logger.error('DataPointType.structure error:', error)
          return {
            name: dpType.name,
            elementType: 'MIXED',
            children: []
          }
        }
      },

      async references(dpType) {
        try {
          const refs = await winccoa.dpGetDpTypeRefs(dpType.name)
          return refs.dptNames.map(name => ({
            name,
            
          }))
        } catch (error) {
          logger.error('DataPointType.references error:', error)
          return []
        }
      },

      async usedBy(dpType) {
        try {
          const refs = await winccoa.dpGetRefsToDpType(dpType.name)
          return refs.dptNames.map(name => ({
            name,
            
          }))
        } catch (error) {
          logger.error('DataPointType.usedBy error:', error)
          return []
        }
      },

      async dataPoints(dpType, { limit, offset }) {
        try {
          const names = await winccoa.dpNames('*', dpType.name)
          return applyPagination(names, offset, limit).map(name => {
            const parsed = parseDataPointName(name)
            return { name: parsed.dpName, fullName: name, typeName: dpType.name }
          })
        } catch (error) {
          logger.error('DataPointType.dataPoints error:', error)
          return []
        }
      },

      async count(dpType) {
        try {
          const names = await winccoa.dpNames('*', dpType.name)
          return names.length
        } catch (error) {
          logger.error('DataPointType.count error:', error)
          return 0
        }
      }
    },

    DataPointTypeNode: {
      elementType(node) {
        return node.type
      },
      refType(node) {
        if (!node.refName) return null
        return {
          name: node.refName,
          system: null // Context not available here
        }
      },
      children(node) {
        return node.children || []
      }
    },

    ElementStatus: {
      value(status) {
        return status.value
      },
      bits(status) {
        return status.bits
      },
      on(status) {
        return status.on
      },
      off(status) {
        return status.off
      },
      status(status, { bit }) {
        const bitIndex = STATUS_BIT_NAMES.indexOf(bit)
        if (bitIndex === -1) return false
        return (status.value & (1 << bitIndex)) !== 0
      }
    }
  }
}

module.exports = { createDataPointResolvers, decodeStatusBits }
