// tests/suite-10-extras.js — Extras query & mutation

const {
  gql,
  assertNoErrors, assertEqual, assertTypeOf, assertNotNull, dig,
  writeResult
} = require('./helpers')

module.exports = {
  name: 'Suite 10 — Extras',

  async run(t) {

    await t('10.1', 'extras.testDummy query → success: true', async () => {
      const res = await gql('{ extras { testDummy { success message timestamp } } }')
      assertNoErrors(res, '10.1')
      const result = dig(res, 'data.extras.testDummy')
      assertNotNull(result, 'extras.testDummy')
      assertEqual(result.success, true, 'success')
      assertTypeOf(result.message, 'string', 'message')
      assertNotNull(result.timestamp, 'timestamp')
      writeResult('10-01-extras-testdummy-query', result)
    })

    await t('10.2', 'extras.testDummy mutation → success: true', async () => {
      const res = await gql('mutation { extras { testDummy { success message timestamp } } }')
      assertNoErrors(res, '10.2')
      const result = dig(res, 'data.extras.testDummy')
      assertNotNull(result, 'extras.testDummy mutation')
      assertEqual(result.success, true, 'success')
      assertTypeOf(result.message, 'string', 'message')
      assertNotNull(result.timestamp, 'timestamp')
      writeResult('10-02-extras-testdummy-mutation', result)
    })
  }
}
