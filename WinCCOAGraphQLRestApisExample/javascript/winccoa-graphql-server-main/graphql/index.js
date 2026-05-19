// GraphQL V2 Schema - Module loader
// Loads and combines all schema modules

const { readFileSync } = require('fs');
const { join } = require('path');

// Load all schema modules
const core = readFileSync(join(__dirname, 'core.gql'), 'utf-8');
const query = readFileSync(join(__dirname, 'query.gql'), 'utf-8');
const system = readFileSync(join(__dirname, 'system.gql'), 'utf-8');
const datapoint = readFileSync(join(__dirname, 'datapoint.gql'), 'utf-8');
const tag = readFileSync(join(__dirname, 'tag.gql'), 'utf-8');
const alert = readFileSync(join(__dirname, 'alert.gql'), 'utf-8');
const cns = readFileSync(join(__dirname, 'cns.gql'), 'utf-8');
const methods = readFileSync(join(__dirname, 'methods.gql'), 'utf-8');
const mutations = readFileSync(join(__dirname, 'mutations.gql'), 'utf-8');
const subscriptions = readFileSync(join(__dirname, 'subscriptions.gql'), 'utf-8');

// Export combined schema
module.exports = {
  typeDefs: [
    core,
    query,
    system,
    datapoint,
    tag,
    alert,
    cns,
    methods,
    mutations,
    subscriptions
  ]
};
