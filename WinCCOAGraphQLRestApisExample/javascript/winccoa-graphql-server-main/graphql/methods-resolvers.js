// API type resolvers - Backward compatibility layer
// Delegates to existing V1 resolvers, grouped by category

const { createExtrasMethods } = require('./extras')

function createMethodsResolvers(existingResolvers, winccoa, logger) {
  return {
    API: {
      alert: () => ({}),
      cns: () => ({}),
      dp: () => ({}),
      dpType: () => ({}),
      system: () => ({}),
      redundancy: () => ({})
    },

    AlertMethods: {
      alertGet: existingResolvers.Query.alertGet,
      alertGetPeriod: existingResolvers.Query.alertGetPeriod
    },

    CnsMethods: {
      getViews: existingResolvers.Query.getViews,
      getTrees: existingResolvers.Query.getTrees,
      getChildren: existingResolvers.Query.getChildren,
      getParent: existingResolvers.Query.getParent,
      getRoot: existingResolvers.Query.getRoot,
      getDisplayNames: existingResolvers.Query.getDisplayNames,
      getDisplayPath: existingResolvers.Query.getDisplayPath,
      getId: existingResolvers.Query.getId,
      getIdSet: existingResolvers.Query.getIdSet,
      getNodesByName: existingResolvers.Query.getNodesByName,
      getNodesByData: existingResolvers.Query.getNodesByData,
      getProperty: existingResolvers.Query.getProperty,
      getPropertyKeys: existingResolvers.Query.getPropertyKeys,
      nodeExists: existingResolvers.Query.nodeExists,
      treeExists: existingResolvers.Query.treeExists,
      viewExists: existingResolvers.Query.viewExists,
      isNode: existingResolvers.Query.isNode,
      isTree: existingResolvers.Query.isTree,
      isView: existingResolvers.Query.isView,
      checkId: existingResolvers.Query.checkId,
      checkName: existingResolvers.Query.checkName,
      checkSeparator: existingResolvers.Query.checkSeparator
    },

    DataPointMethods: {
      get: existingResolvers.Query.dpGet,
      names: existingResolvers.Query.dpNames,
      types: existingResolvers.Query.dpTypes,
      getMaxAge: existingResolvers.Query.dpGetMaxAge,
      elementType: existingResolvers.Query.dpElementType,
      attributeType: existingResolvers.Query.dpAttributeType,
      typeName: existingResolvers.Query.dpTypeName,
      typeRefName: existingResolvers.Query.dpTypeRefName,
      exists: existingResolvers.Query.dpExists,
      getPeriod: existingResolvers.Query.dpGetPeriod,
      query: existingResolvers.Query.dpQuery,
      getAlias: existingResolvers.Query.dpGetAlias,
      getDescription: existingResolvers.Query.dpGetDescription,
      getFormat: existingResolvers.Query.dpGetFormat,
      getUnit: existingResolvers.Query.dpGetUnit
    },

    DataPointTypeMethods: {
      dpTypeGet: existingResolvers.Query.dpTypeGet,
      dpGetDpTypeRefs: existingResolvers.Query.dpGetDpTypeRefs,
      dpGetRefsToDpType: existingResolvers.Query.dpGetRefsToDpType
    },

    SystemMethods: {
      getSystemId: existingResolvers.Query.getSystemId,
      getSystemName: existingResolvers.Query.getSystemName,
      getVersionInfo: existingResolvers.Query.getVersionInfo
    },

    RedundancyMethods: {
      isReduActive: existingResolvers.Query.isReduActive,
      isRedundant: existingResolvers.Query.isRedundant
    },

    ExtrasMethods: createExtrasMethods(winccoa, logger)
  }
}

module.exports = { createMethodsResolvers }
