// Extra GraphQL resolvers for WinCC OA — customers can extend these functions
// Combines what was previously: extras.js, extras-methods.js, extras-mutations.js

/**
 * V1 extras resolvers (backward-compatibility layer used by oldResolvers in index.js).
 * The dummyExtrasMutation is here for legacy schema support.
 */
function createExtrasResolvers(winccoa, logger) {
  return {
    Mutation: {
      async dummyExtrasMutation(_, args) {
        try {
          logger.info('dummyExtrasMutation called with args:', args)
          return {
            success: true,
            message: 'Dummy extras mutation executed successfully'
          }
        } catch (error) {
          logger.error('dummyExtrasMutation error:', error)
          throw new Error(`Dummy extras mutation failed: ${error.message}`)
        }
      }
    }
  }
}

/**
 * V2 extras query methods (exposed under the ExtrasMethods GraphQL type).
 * Add custom query functions here.
 */
function createExtrasMethods(winccoa, logger) {
  return {
    testDummy: () => ({
      success: true,
      message: 'Test dummy query executed successfully',
      timestamp: new Date().toISOString()
    })
  }
}

/**
 * V2 extras mutation resolvers (exposed under the ExtrasMutations GraphQL type).
 * Add custom mutation functions here.
 */
function createExtrasMutationResolvers(winccoa, logger) {
  return {
    async testDummy() {
      try {
        logger.info('testDummy mutation called')
        return {
          success: true,
          message: 'Test dummy mutation executed successfully',
          timestamp: new Date().toISOString()
        }
      } catch (error) {
        logger.error('testDummy mutation error:', error)
        throw new Error(`Test dummy mutation failed: ${error.message}`)
      }
    }
  }
}

module.exports = {
  createExtrasResolvers,
  createExtrasMethods,
  createExtrasMutationResolvers
}
