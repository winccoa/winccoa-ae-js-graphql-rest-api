// lib/graphql-factories.js — re-exports all per-session resolver factory functions
// so that lib/session-manager.js can import them without fragile relative paths
// that depend on the caller's location.

const { createCommonResolvers }         = require('../graphql/common')
const { createAlertOperationResolvers } = require('../graphql/alerting')
const { createSubscriptionResolvers }   = require('../graphql/subscriptions')
const { createCnsOperationResolvers }   = require('../graphql/cns')
const { createExtrasResolvers }         = require('../graphql/extras')
const { createV2Resolvers }             = require('../graphql/resolvers')

module.exports = {
  common:        { createCommonResolvers },
  alerting:      { createAlertOperationResolvers },
  subscriptions: { createSubscriptionResolvers },
  cns:           { createCnsOperationResolvers },
  extras:        { createExtrasResolvers },
  resolvers:     { createV2Resolvers }
}
