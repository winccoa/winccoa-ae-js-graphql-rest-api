// Usage Tracker Module
// Tracks GraphQL and REST API function calls

const fs = require('fs')
const path = require('path')

const USAGE_FILE = path.join(__dirname, 'usage-stats.json')
const SAVE_INTERVAL_MS = 10000 // Save every 10 seconds

/**
 * Tracks usage statistics for GraphQL and REST API operations.
 *
 * Maintains statistics in memory with periodic persistence to JSON file.
 */
class UsageTracker {
  constructor(logger) {
    this.logger = logger
    this.stats = new Map()
    this.saveTimer = null

    // Load existing stats from file
    this.loadStats()

    // Start periodic saving
    this.startPeriodicSave()
  }

  /**
   * Loads statistics from persistent JSON file.
   */
  loadStats() {
    try {
      if (fs.existsSync(USAGE_FILE)) {
        const data = fs.readFileSync(USAGE_FILE, 'utf8')
        const parsed = JSON.parse(data)

        // Convert object to Map
        for (const [key, value] of Object.entries(parsed)) {
          this.stats.set(key, value)
        }

        this.logger.info(`📊 Loaded ${this.stats.size} usage statistics from file`)
      } else {
        this.logger.info('📊 No existing usage statistics file found, starting fresh')
      }
    } catch (error) {
      this.logger.error('Failed to load usage statistics:', error.message)
    }
  }

  /**
   * Saves statistics to persistent JSON file.
   */
  saveStats() {
    try {
      // Convert Map to object for JSON serialization
      const statsObject = {}
      for (const [key, value] of this.stats.entries()) {
        statsObject[key] = value
      }

      fs.writeFileSync(USAGE_FILE, JSON.stringify(statsObject, null, 2), 'utf8')
      this.logger.debug(`💾 Saved ${this.stats.size} usage statistics to file`)
    } catch (error) {
      this.logger.error('Failed to save usage statistics:', error.message)
    }
  }

  /**
   * Starts periodic saving of statistics to file.
   */
  startPeriodicSave() {
    this.saveTimer = setInterval(() => {
      this.saveStats()
    }, SAVE_INTERVAL_MS)
  }

  /**
   * Stops periodic saving of statistics.
   */
  stopPeriodicSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
      this.saveTimer = null
    }
  }

  /**
   * Records a single function call to statistics.
   *
   * @param {string} type - The API type (graphql or rest)
   * @param {string} name - The operation name
   */
  track(type, name) {
    const key = `${type}/${name}`
    const current = this.stats.get(key) || 0
    this.stats.set(key, current + 1)
  }

  /**
   * Retrieves all statistics as an array.
   *
   * @returns {Array} Array of stat objects with name and count properties
   */
  getStats() {
    const result = []

    for (const [key, count] of this.stats.entries()) {
      result.push({ name: key, count })
    }

    return result
  }

  /**
   * Retrieves statistics sorted alphabetically by operation name.
   *
   * @returns {Array} Sorted array of stat objects
   */
  getStatsSortedByName() {
    return this.getStats().sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * Retrieves statistics sorted by call count (descending).
   *
   * @returns {Array} Array sorted by count in descending order
   */
  getStatsSortedByCount() {
    return this.getStats().sort((a, b) => b.count - a.count)
  }

  /**
   * Gracefully shuts down the tracker - stops periodic saving and persists final data.
   */
  shutdown() {
    this.stopPeriodicSave()
    this.saveStats()
    this.logger.info('📊 Usage tracker shutdown complete')
  }
}

module.exports = { UsageTracker }
