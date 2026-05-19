// Mutation resolvers - Namespaced by domain

const { createExtrasMutationResolvers } = require('./extras')

function createMutationResolvers(existingResolvers) {
  return {
    // API mutations namespace
    api() {
      return {} // APIMutations resolvers will handle fields
    },

    // Extras namespace
    extras() {
      return {} // ExtrasMutations resolvers will handle fields
    }
    // login is defined at the top level in index.js via mergeResolvers
  }
}

// APIMutations resolver - groups all API-level mutations
function createAPIMutationResolvers() {
  return {
    dp() {
      return {} // DataPointMutations resolvers will handle fields
    },

    dpType() {
      return {} // DataPointTypeMutations resolvers will handle fields
    },

    alert() {
      return {} // AlertMutations resolvers will handle fields
    },

    cns() {
      return {} // CnsMutations resolvers will handle fields
    }
  }
}

// DataPoint mutation namespace resolvers
function createDataPointMutationResolvers(existingResolvers) {
  return {
    create: existingResolvers.Mutation.dpCreate,
    delete: existingResolvers.Mutation.dpDelete,
    copy: existingResolvers.Mutation.dpCopy,
    set: existingResolvers.Mutation.dpSet,
    setWait: existingResolvers.Mutation.dpSetWait,
    setTimed: existingResolvers.Mutation.dpSetTimed,
    setTimedWait: existingResolvers.Mutation.dpSetTimedWait,
    setAlias: existingResolvers.Mutation.dpSetAlias,
    setDescription: existingResolvers.Mutation.dpSetDescription,
    setFormat: existingResolvers.Mutation.dpSetFormat,
    setUnit: existingResolvers.Mutation.dpSetUnit
  }
}

// DataPointType mutation namespace resolvers
function createDataPointTypeMutationResolvers(existingResolvers) {
  return {
    create: existingResolvers.Mutation.dpTypeCreate,
    change: existingResolvers.Mutation.dpTypeChange,
    delete: existingResolvers.Mutation.dpTypeDelete
  }
}

// Alert mutation namespace resolvers
function createAlertMutationResolvers(existingResolvers) {
  return {
    set: existingResolvers.Mutation.alertSet,
    setWait: existingResolvers.Mutation.alertSetWait,
    setTimed: existingResolvers.Mutation.alertSetTimed,
    setTimedWait: existingResolvers.Mutation.alertSetTimedWait
  }
}

// CNS mutation namespace resolvers
function createCnsMutationResolvers(existingResolvers) {
  return {
    createView: existingResolvers.Mutation.createView,
    addTree: existingResolvers.Mutation.addTree,
    addNode: existingResolvers.Mutation.addNode,
    changeTree: existingResolvers.Mutation.changeTree,
    deleteTree: existingResolvers.Mutation.deleteTree,
    deleteView: existingResolvers.Mutation.deleteView,
    setProperty: existingResolvers.Mutation.setProperty
  }
}

module.exports = {
  createMutationResolvers,
  createAPIMutationResolvers,
  createDataPointMutationResolvers,
  createDataPointTypeMutationResolvers,
  createAlertMutationResolvers,
  createCnsMutationResolvers,
  createExtrasMutationResolvers
}
