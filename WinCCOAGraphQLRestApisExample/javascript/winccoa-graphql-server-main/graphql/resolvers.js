// GraphQL V2 Resolvers - Main resolver combiner

const { createQueryResolvers } = require('./query-resolvers')
const { createDataPointResolvers } = require('./datapoint-resolvers')
const { createTagResolvers } = require('./tag-resolvers')
const { createAlertResolvers } = require('./alert-resolvers')
const { createCnsResolvers } = require('./cns-resolvers')
const { createMethodsResolvers } = require('./methods-resolvers')
const {
  createMutationResolvers,
  createAPIMutationResolvers,
  createDataPointMutationResolvers,
  createDataPointTypeMutationResolvers,
  createAlertMutationResolvers,
  createCnsMutationResolvers,
  createExtrasMutationResolvers
} = require('./mutation-resolvers')

function createV2Resolvers(winccoa, logger, existingResolvers) {
  const queryResolvers = createQueryResolvers(winccoa, logger, existingResolvers)
  const dataPointResolvers = createDataPointResolvers(winccoa, logger)
  const tagResolvers = createTagResolvers(winccoa, logger, existingResolvers)
  const alertResolvers = createAlertResolvers(winccoa, logger)
  const cnsResolvers = createCnsResolvers(winccoa, logger)
  const methodsResolvers = createMethodsResolvers(existingResolvers, winccoa, logger)

  // Mutation namespaces
  const mutationResolvers = createMutationResolvers(existingResolvers)
  const apiMutations = createAPIMutationResolvers()
  const dataPointMutations = createDataPointMutationResolvers(existingResolvers)
  const dataPointTypeMutations = createDataPointTypeMutationResolvers(existingResolvers)
  const alertMutations = createAlertMutationResolvers(existingResolvers)
  const cnsMutations = createCnsMutationResolvers(existingResolvers)
  const extrasMutations = createExtrasMutationResolvers(winccoa, logger)

  return {
    Query: queryResolvers,
    ...dataPointResolvers,
    Tag: tagResolvers,
    Alert: alertResolvers,
    ...cnsResolvers,
    ...methodsResolvers,

    // Version info types
    VersionInfo: {
      api(info) {
        return info.api
      },
      winccoa(info) {
        return info.winccoa
      }
    },

    // Mutations - namespaced by domain
    Mutation: mutationResolvers,
    APIMutations: apiMutations,
    DataPointMutations: dataPointMutations,
    DataPointTypeMutations: dataPointTypeMutations,
    AlertMutations: alertMutations,
    CnsMutations: cnsMutations,
    ExtrasMutations: extrasMutations,
    TestDummyResult: {
      success(result) {
        return result.success
      },
      message(result) {
        return result.message
      },
      timestamp(result) {
        return result.timestamp
      }
    },

    TestDummyQueryResult: {
      success(result) {
        return result.success
      },
      message(result) {
        return result.message
      },
      timestamp(result) {
        return result.timestamp
      }
    },

    // Subscriptions - keep all existing subscriptions from V1
    Subscription: existingResolvers.Subscription
  }
}

module.exports = { createV2Resolvers }
