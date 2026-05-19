// SimplePubSub — lightweight in-process pub/sub for GraphQL subscriptions

/**
 * Simple pub/sub implementation for GraphQL subscriptions.
 *
 * Implements the async iterator protocol for streaming subscription data
 * to connected WebSocket clients.
 */
class SimplePubSub {
  constructor() {
    this.subscribers = new Map()
  }

  /**
   * Publishes a payload to all subscribers on a channel.
   *
   * @param {string} channel
   * @param {*} payload
   */
  publish(channel, payload) {
    const subs = this.subscribers.get(channel) || []
    subs.forEach(sub => {
      try {
        sub(payload)
      } catch (error) {
        // Errors in individual subscribers must not affect others
        console.error(`[PubSub] Error publishing to channel ${channel}:`, error)
      }
    })
  }

  /**
   * Creates an async iterator for a channel.
   *
   * @param {string} channel
   * @returns {AsyncIterator}
   */
  asyncIterator(channel) {
    const queue = []
    let pullFn  = null
    let running = true

    const push = (value) => {
      if (pullFn) {
        pullFn({ value, done: false })
        pullFn = null
      } else {
        queue.push(value)
      }
    }

    // Subscribe
    const subs = this.subscribers.get(channel) || []
    subs.push(push)
    this.subscribers.set(channel, subs)

    const self = this

    const iterator = {
      async next() {
        if (!running) return { done: true, value: undefined }
        if (queue.length > 0) return { value: queue.shift(), done: false }
        return new Promise((resolve) => { pullFn = resolve })
      },

      async return() {
        running = false
        const activeSubs = self.subscribers.get(channel) || []
        const idx = activeSubs.indexOf(push)
        if (idx !== -1) {
          activeSubs.splice(idx, 1)
          if (activeSubs.length === 0) {
            self.subscribers.delete(channel)
          } else {
            self.subscribers.set(channel, activeSubs)
          }
        }
        if (pullFn) { pullFn({ done: true, value: undefined }); pullFn = null }
        return { done: true, value: undefined }
      },

      async throw(error) {
        await iterator.return()
        throw error
      },

      [Symbol.asyncIterator]() { return this }
    }

    return iterator
  }
}

module.exports = { SimplePubSub }
