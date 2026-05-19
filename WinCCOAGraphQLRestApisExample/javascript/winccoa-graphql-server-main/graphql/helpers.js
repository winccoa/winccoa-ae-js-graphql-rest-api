// Common helper functions for V2 resolvers

/**
 * Parses a data point name to extract system prefix and local name.
 * WinCC OA data points can be prefixed with system name (e.g., "SystemName:DpName").
 * This helper separates the system name from the actual data point name.
 *
 * @param {string} fullName - Full data point name, optionally with system prefix
 * @returns {object} Object with systemName (string or null) and dpName (string)
 */
function parseDataPointName(fullName) {
  const match = fullName.match(/^(?:([^:]+):)?(.+)$/)
  return {
    systemName: match[1] || null,
    dpName: match[2]
  }
}

// ─── Online attribute name constants ────────────────────────────────────────
const ONLINE_VALUE_ATTR  = ':_online.._value'
const ONLINE_STIME_ATTR  = ':_online.._stime'
const ONLINE_STATUS_ATTR = ':_online.._status'

/**
 * Resolves a time range from either an explicit start/end or a "last N minutes" shorthand.
 *
 * @param {string|undefined} startTime  - ISO start time string
 * @param {string|undefined} endTime    - ISO end time string
 * @param {number|undefined} lastMinutes - Minutes before now
 * @returns {{ rangeStart: Date, rangeEnd: Date }}
 * @throws {Error} If neither pair is supplied
 */
function resolveTimeRange(startTime, endTime, lastMinutes) {
  if (lastMinutes) {
    const rangeEnd = new Date()
    return { rangeStart: new Date(rangeEnd.getTime() - lastMinutes * 60 * 1000), rangeEnd }
  }
  if (startTime && endTime) {
    return { rangeStart: new Date(startTime), rangeEnd: new Date(endTime) }
  }
  throw new Error('Either provide (startTime and endTime) or lastMinutes')
}

/**
 * Extracts { timestamp, value } pairs from a dpGetPeriod result array.
 *
 * dpGetPeriod returns an array where each element corresponds to one requested DPE.
 * Each element has parallel `times` and `values` arrays.
 *
 * @param {Array} result  - Raw return value from winccoa.dpGetPeriod
 * @param {number} [index=0] - Which DPE entry to extract (default: first)
 * @returns {Array<{ timestamp: Date, value: any }>}
 */
function extractHistoryValues(result, index = 0) {
  const values = []
  if (Array.isArray(result) && result.length > index) {
    const entry = result[index]
    if (entry?.times && entry?.values &&
        Array.isArray(entry.times) && Array.isArray(entry.values)) {
      const len = Math.min(entry.times.length, entry.values.length)
      for (let i = 0; i < len; i++) {
        values.push({ timestamp: new Date(entry.times[i]), value: entry.values[i] })
      }
    }
  }
  return values
}

/**
 * Applies offset/limit pagination to an array.
 *
 * @param {Array}           arr
 * @param {number|undefined} offset - Number of items to skip (falsy = 0)
 * @param {number|undefined} limit  - Maximum items to return (falsy = all)
 * @returns {Array}
 */
function applyPagination(arr, offset, limit) {
  const start = offset > 0 ? offset : 0
  const sliced = arr.slice(start)
  return limit > 0 ? sliced.slice(0, limit) : sliced
}

/**
 * Returns the full DPE path for a DataPointElement object.
 * Elements may carry an optional sub-path relative to their parent data point.
 *
 * @param {{ path?: string, dataPoint: { fullName: string } }} element
 * @returns {string}
 */
function getElementFullPath(element) {
  return element.path
    ? `${element.dataPoint.fullName}.${element.path}`
    : element.dataPoint.fullName
}

module.exports = {
  parseDataPointName,
  ONLINE_VALUE_ATTR,
  ONLINE_STIME_ATTR,
  ONLINE_STATUS_ATTR,
  resolveTimeRange,
  extractHistoryValues,
  applyPagination,
  getElementFullPath
}
