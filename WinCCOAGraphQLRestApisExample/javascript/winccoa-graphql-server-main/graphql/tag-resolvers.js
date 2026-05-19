// Tag type resolvers

const {} = require('./helpers')

function createTagResolvers(winccoa, logger, existingResolvers) {
  return {
    // Re-use existing Tag resolver from v1
    ...existingResolvers.Tag,

    async element(tag) {
      return {
        name: tag.name,
        path: '',
        dataPoint: {
          name: tag.name,
          fullName: tag.name,
          
          typeName: null
        },
        value: tag.value
      }
    }
  }
}

module.exports = { createTagResolvers }
