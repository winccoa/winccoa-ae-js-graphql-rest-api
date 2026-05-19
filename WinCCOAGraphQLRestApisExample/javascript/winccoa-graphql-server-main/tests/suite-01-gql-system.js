// tests/suite-01-system.js — System & Health checks (GraphQL)

const { gql, assertEqual, assertNotNull, assertTypeOf, assertNoErrors, dig, writeResult } = require('./helpers')

module.exports = {
  name: 'Suite 1 — System / Health (GraphQL)',

  async run(t) {

    await t('1.1', 'api.system.getSystemName → "System1:"', async () => {
      const res = await gql('{ api { system { getSystemName } } }')
      assertNoErrors(res, '1.1')
      assertEqual(dig(res, 'data.api.system.getSystemName'), 'System1:', 'getSystemName')
    })

    await t('1.2', 'api.system.getSystemId → 1', async () => {
      const res = await gql('{ api { system { getSystemId } } }')
      assertNoErrors(res, '1.2')
      assertEqual(dig(res, 'data.api.system.getSystemId'), 1, 'getSystemId')
    })

    await t('1.3', 'api.system.getVersionInfo → api.version + winccoa.version', async () => {
      const res = await gql('{ api { system { getVersionInfo { api { version } winccoa { version display } } } } }')
      assertNoErrors(res, '1.3')
      const info = dig(res, 'data.api.system.getVersionInfo')
      assertNotNull(info, 'getVersionInfo')
      assertTypeOf(info.api.version, 'number', 'api.version')
      assertTypeOf(info.winccoa.version, 'string', 'winccoa.version')
      writeResult('01-03-version-info', info)
    })

    await t('1.4', 'api.redundancy.isRedundant → Boolean', async () => {
      const res = await gql('{ api { redundancy { isRedundant } } }')
      assertNoErrors(res, '1.4')
      assertTypeOf(dig(res, 'data.api.redundancy.isRedundant'), 'boolean', 'isRedundant')
    })

    await t('1.5', 'api.redundancy.isReduActive → Boolean', async () => {
      const res = await gql('{ api { redundancy { isReduActive } } }')
      assertNoErrors(res, '1.5')
      assertTypeOf(dig(res, 'data.api.redundancy.isReduActive'), 'boolean', 'isReduActive')
    })
  }
}
