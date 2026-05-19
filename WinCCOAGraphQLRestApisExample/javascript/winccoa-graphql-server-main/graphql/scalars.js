// GraphQL Scalar Type Definitions
// Implements custom scalar types for the GraphQL API

const { GraphQLScalarType, GraphQLError } = require('graphql')

/**
 * Anytype scalar - accepts any JSON-serializable value
 * Supports primitives (string, number, boolean, null) and complex types (objects, arrays)
 * Unlike JSON scalar, this explicitly represents "any type" in the schema
 */
const AnytypeScalar = new GraphQLScalarType({
  name: 'Anytype',
  description: 'Any JSON-serializable value',
  parseValue(value) {
    // Handle incoming values from client (JSON)
    // Accepts any value and passes it through
    return value
  },
  serialize(value) {
    // Handle outgoing values to client
    // Simply return the value as-is (GraphQL will serialize to JSON)
    return value
  },
  parseLiteral(ast) {
    // Handle GraphQL query literal values
    switch (ast.kind) {
      case 'StringValue':
        return ast.value
      case 'IntValue':
        return parseInt(ast.value, 10)
      case 'FloatValue':
        return parseFloat(ast.value)
      case 'BooleanValue':
        return ast.value
      case 'NullValue':
        return null
      case 'ListValue':
        // Recursively parse list items
        return ast.values.map(item => AnytypeScalar.parseLiteral(item))
      case 'ObjectValue':
        // Recursively parse object fields
        const obj = {}
        for (const field of ast.fields) {
          obj[field.name.value] = AnytypeScalar.parseLiteral(field.value)
        }
        return obj
      default:
        return undefined
    }
  }
})

module.exports = {
  AnytypeScalar
}
