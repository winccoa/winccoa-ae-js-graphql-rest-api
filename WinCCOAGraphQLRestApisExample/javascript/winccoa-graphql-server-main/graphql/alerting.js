// Alert GraphQL resolver functions for WinCC OA

const { WinccoaAlertTime } = require('winccoa-manager')
const { typedAlertSet, typedAlertSetTimed } = require('./ctrl-type-utils')


/**
 * Converts GraphQL AlertTimeInput to WinccoaAlertTime object.
 * Used as input converter for alertGet(), alertSet(), and related WinCC OA functions.
 * @param {object} alertTimeInput - Alert time input with time, count, and dpe properties
 * @returns {WinccoaAlertTime} WinCC OA alert time object
 */
function convertAlertTimeInput(alertTimeInput) {
  return new WinccoaAlertTime(
    new Date(alertTimeInput.time),
    alertTimeInput.count,
    alertTimeInput.dpe
  );
}

/**
 * Converts single or array of AlertTimeInput objects.
 * @param {object|Array<object>} alertTimeInputs - Single or array of alert time inputs
 * @returns {WinccoaAlertTime|Array<WinccoaAlertTime>} Converted alert time object(s)
 */
function convertAlertTimeInputs(alertTimeInputs) {
  if (Array.isArray(alertTimeInputs)) {
    return alertTimeInputs.map(convertAlertTimeInput);
  }
  return convertAlertTimeInput(alertTimeInputs);
}

/**
 * Converts WinccoaAlertTime object to GraphQL output format.
 * @param {WinccoaAlertTime} alertTime - WinCC OA alert time object
 * @returns {object} Alert time object with time (ISO string), count, and dpe
 */
function convertAlertTime(alertTime) {
  return {
    time: alertTime.time.toISOString(),
    count: alertTime.count,
    dpe: alertTime.dpe
  };
}

/**
 * Converts single or array of WinccoaAlertTime objects to output format.
 * @param {WinccoaAlertTime|Array<WinccoaAlertTime>} alertTimes - Single or array of alert times
 * @returns {Array<object>} Array of converted alert time objects
 */
function convertAlertTimes(alertTimes) {
  if (Array.isArray(alertTimes)) {
    return alertTimes.map(convertAlertTime);
  }
  return [convertAlertTime(alertTimes)];
}

/**
 * Creates resolver functions for WinCC OA alert operations.
 * Wraps WinCC OA alert management functions through the winccoa-manager Node.js binding.
 *
 * @param {WinccoaManager} winccoa - WinCC OA manager instance for API access
 * @returns {object} Resolver object with Query and Mutation resolvers
 */
function createAlertOperationResolvers(winccoa) {
  return {
    Query: {
      /**
       * Retrieves alert attributes.
       * Wraps WinCC OA function: alertGet(alertsTime, dpeNames, alertAttributeNames)
       *
       * @param {Array<object>} alertsTime - Array of alert time objects
       * @param {Array<string>} dpeNames - Array of data point element names
       * @param {Array<string>|null} alertAttributeNames - Alert attribute names to retrieve;
       *        WinCC OA expects an array (e.g. ["ACK_STATE", "VALUE"]).
       *        Pass null/omit to retrieve all configured attributes (empty array []).
       * @returns {Promise} Promise resolving to alert data
       */
      async alertGet(_, { alertsTime, dpeNames }) {
        try {
          const winccoaAlertTimes = convertAlertTimeInputs(alertsTime);
          // winccoa.alertGet(alertsTime, dpeNames, alertCount?)
          // dpeNames must include full config path e.g. 'Dp.:_alert_hdl.._value'
          // For a single alertTime with multiple configs on the same DP, pass
          // one alertTime and multiple dpeNames (same DP, different configs).
          // For multiple alertTimes + multiple DPs, arrays must be same length.
          const result = await winccoa.alertGet(winccoaAlertTimes, dpeNames);
          return result;
        } catch (error) {
          throw new Error(`Failed to get alert attributes: ${error.message}`);
        }
      },

      /**
       * Retrieves alert data for a time period.
       * Wraps WinCC OA function: alertGetPeriod(startTime, endTime, names)
       *
       * @param {string} startTime - Start time as ISO string
       * @param {string} endTime - End time as ISO string
       * @param {Array<string>} names - Alert names
       * @returns {Promise<object>} Promise resolving to alert period data with alertTimes and values
       */
      async alertGetPeriod(_, { startTime, endTime, names }) {
        try {
          const start = new Date(startTime);
          const end = new Date(endTime);
          const result = await winccoa.alertGetPeriod(start, end, names);
          // WinCC OA returns null when no alerts exist in the period — normalise
          if (!result || !result.alertTimes) return { alertTimes: [], values: [] }
          return {
            alertTimes: convertAlertTimes(result.alertTimes),
            values: result.values || []
          };
        } catch (error) {
          // 9302 = "Cannot convert NULL Variable" — WinCC OA throws this when
          // no alerts exist in the requested period. Return empty result silently.
          if (error.code === 9302) return { alertTimes: [], values: [] }
          throw new Error(`Failed to get alert period data: ${error.message}`);
        }
      }
    },

    Mutation: {
      /**
       * Sets alert attributes immediately.
       * Wraps WinCC OA function: alertSet(alerts, values)
       *
       * @param {Array<object>} alerts - Array of alert objects
       * @param {Array} values - Values to set for the alerts
       * @returns {Promise<boolean>} Promise resolving to true on success
       */
      async alertSet(_, { alerts, values }) {
        try {
          const winccoaAlertTimes = convertAlertTimeInputs(alerts);
          // alertSet binding cannot convert any JS array to dyn_anytype (error 9301) —
          // it has no DPE type lookup to infer element types. Route any array value
          // through typedDpSet (WinccoaCtrlScript) which accepts explicit type hints.
          if (values.some(Array.isArray)) {
            const ops = winccoaAlertTimes.map((at, i) =>
              Array.isArray(values[i])
                ? typedAlertSet(winccoa, at, values[i])
                : winccoa.alertSet(at, values[i])
            )
            await Promise.all(ops)
            return true
          }
          return await winccoa.alertSet(winccoaAlertTimes, values);
        } catch (error) {
          throw new Error(`Failed to set alert attributes: ${error.message}`);
        }
      },

      /**
       * Sets alert attributes and waits for confirmation.
       * Wraps WinCC OA function: alertSetWait(alerts, values)
       *
       * @param {Array<object>} alerts - Array of alert objects
       * @param {Array} values - Values to set for the alerts
       * @returns {Promise} Promise resolving to result of alert set operation
       */
      async alertSetWait(_, { alerts, values }) {
        try {
          const winccoaAlertTimes = convertAlertTimeInputs(alerts);
          if (values.some(Array.isArray)) {
            // alertSetWait: use typedAlertSet (CTRL alertSet is synchronous per thread)
            const ops = winccoaAlertTimes.map((at, i) =>
              Array.isArray(values[i])
                ? typedAlertSet(winccoa, at, values[i])
                : winccoa.alertSetWait(at, values[i])
            )
            const results = await Promise.all(ops)
            return results.every(r => r !== false)
          }
          return await winccoa.alertSetWait(winccoaAlertTimes, values);
        } catch (error) {
          throw new Error(`Failed to set alert attributes with wait: ${error.message}`);
        }
      },

      /**
       * Sets alert attributes at a specific future time.
       * Wraps WinCC OA function: alertSetTimed(time, alerts, values)
       *
       * @param {string} time - Future time as ISO string
       * @param {Array<object>} alerts - Array of alert objects
       * @param {Array} values - Values to set for the alerts
       * @returns {Promise} Promise resolving to result of timed alert set operation
       */
      async alertSetTimed(_, { time, alerts, values }) {
        try {
          const winccoaTime = new Date(time);
          const winccoaAlertTimes = convertAlertTimeInputs(alerts);
          if (values.some(Array.isArray)) {
            const ops = winccoaAlertTimes.map((at, i) =>
              Array.isArray(values[i])
                ? typedAlertSetTimed(winccoa, winccoaTime, at, values[i])
                : winccoa.alertSetTimed(winccoaTime, at, values[i])
            )
            await Promise.all(ops)
            return true
          }
          return await winccoa.alertSetTimed(winccoaTime, winccoaAlertTimes, values);
        } catch (error) {
          throw new Error(`Failed to set timed alert attributes: ${error.message}`);
        }
      },

      /**
       * Sets alert attributes at a specific future time and waits for confirmation.
       * Wraps WinCC OA function: alertSetTimedWait(time, alerts, values)
       *
       * @param {string} time - Future time as ISO string
       * @param {Array<object>} alerts - Array of alert objects
       * @param {Array} values - Values to set for the alerts
       * @returns {Promise} Promise resolving to result of timed alert set operation
       */
      async alertSetTimedWait(_, { time, alerts, values }) {
        try {
          const winccoaTime = new Date(time);
          const winccoaAlertTimes = convertAlertTimeInputs(alerts);
          if (values.some(Array.isArray)) {
            // alertSetTimedWait: use typedAlertSetTimed (CTRL alertSetTimed is synchronous per thread)
            const ops = winccoaAlertTimes.map((at, i) =>
              Array.isArray(values[i])
                ? typedAlertSetTimed(winccoa, winccoaTime, at, values[i])
                : winccoa.alertSetTimedWait(winccoaTime, at, values[i])
            )
            const results = await Promise.all(ops)
            return results.every(r => r !== false)
          }
          return await winccoa.alertSetTimedWait(winccoaTime, winccoaAlertTimes, values);
        } catch (error) {
          throw new Error(`Failed to set timed alert attributes with wait: ${error.message}`);
        }
      }
    }
  };
}

module.exports = {
  createAlertOperationResolvers,
  convertAlertTimeInput,
  convertAlertTimeInputs,
  convertAlertTime,
  convertAlertTimes
};