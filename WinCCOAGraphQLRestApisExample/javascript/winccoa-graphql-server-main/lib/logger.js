// Logger factory — reads LOG_LEVEL from environment

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }

/**
 * Creates a logger instance that respects the LOG_LEVEL environment variable.
 *
 * @returns {object} Logger with error / warn / info / debug methods
 */
function createLogger() {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase()
  const current = LOG_LEVELS[level] ?? LOG_LEVELS.info

  return {
    error: (...args) => { if (current >= LOG_LEVELS.error) console.error(...args) },
    warn:  (...args) => { if (current >= LOG_LEVELS.warn)  console.warn(...args)  },
    info:  (...args) => { if (current >= LOG_LEVELS.info)  console.log(...args)   },
    debug: (...args) => { if (current >= LOG_LEVELS.debug) console.log(...args)   }
  }
}

module.exports = { createLogger }
