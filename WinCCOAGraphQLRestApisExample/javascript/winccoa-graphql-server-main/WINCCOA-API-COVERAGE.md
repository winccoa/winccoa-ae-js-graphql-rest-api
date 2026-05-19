# WinCC OA API Function Coverage

This document provides a comprehensive overview of all WinCC OA Node.js API functions and their availability in the GraphQL and REST APIs.

## Summary Statistics

- **Total WinCC OA Functions**: 134
- **Available in Both APIs**: 55 (41%)
- **GraphQL Only**: 12 (9%)
- **REST Only**: 0 (0%)
- **Not Implemented**: 67 (50%)
- **Overall Coverage**: 50%

## Coverage by Category

| Category | Total | Implemented | Coverage |
|----------|-------|-------------|----------|
| Alert | 6 | 6 | 100% |
| Data Point Type | 8 | 8 | 100% |
| Redundancy | 4 | 2 | 50% |
| CNS (Central Navigation Service) | 47 | 26 | 55% |
| Data Point | 44 | 18 | 41% |
| Manager | 14 | 3 | 21% |
| Cryptography | 5 | 0 | 0% |
| Logging | 6 | 0 | 0% |

---

## Detailed Function List

Legend:
- ✅ = Implemented
- ❌ = Not implemented
- 🔵 = GraphQL Subscription (real-time)

### Alert Functions (6/6 - 100%)

| Function | GraphQL | REST API | Notes |
|----------|---------|----------|-------|
| alertGet | ✅ | ✅ | Get alert attributes |
| alertGetPeriod | ✅ | ✅ | Get alerts for time period |
| alertSet | ✅ | ✅ | Set alert values |
| alertSetTimed | ✅ | ✅ | Set alert with timestamp |
| alertSetTimedWait | ✅ | ✅ | Set alert with timestamp (wait) |
| alertSetWait | ✅ | ✅ | Set alert and wait |

---

### Central Navigation Service (CNS) Functions (26/47 - 55%)

| Function | GraphQL | REST API | Notes |
|----------|---------|----------|-------|
| cns_checkId | ✅ | ❌ | Validate CNS ID |
| cns_checkName | ✅ | ❌ | Validate CNS name |
| cns_checkSeparator | ✅ | ❌ | Validate separator |
| cns_getNodeIcon | ❌ | ❌ | Get node icon |
| cns_getNodeTypeDisplayName | ❌ | ❌ | Get node type display name |
| cns_getNodeTypes | ❌ | ❌ | Get available node types |
| cns_getNodeTypeValue | ❌ | ❌ | Get node type value |
| cns_getReadableViews | ❌ | ❌ | Get readable views |
| cns_getViewPermission | ❌ | ❌ | Get view permissions |
| cns_isNode | ✅ | ❌ | Check if path is node |
| cns_isTree | ✅ | ❌ | Check if path is tree |
| cns_isView | ✅ | ❌ | Check if path is view |
| cns_nodeExists | ✅ | ❌ | Check if node exists |
| cns_treeExists | ✅ | ❌ | Check if tree exists |
| cns_viewDpToName | ❌ | ❌ | Convert DP to view name |
| cns_viewExists | ✅ | ❌ | Check if view exists |
| cns_viewNameToDpName | ❌ | ❌ | Convert view name to DP |
| cnsAddNode | ✅ | ✅ | Add CNS node |
| cnsAddObserver | ❌ | ❌ | Add CNS observer (callback) |
| cnsAddTree | ✅ | ✅ | Add CNS tree |
| cnsChangeTree | ✅ | ✅ | Modify CNS tree |
| cnsCreateView | ✅ | ✅ | Create CNS view |
| cnsDeleteTree | ✅ | ✅ | Delete CNS tree |
| cnsDeleteView | ✅ | ✅ | Delete CNS view |
| cnsGetAccessRight | ❌ | ❌ | Get access rights |
| cnsGetChildren | ✅ | ✅ | Get child nodes |
| cnsGetDisplayNames | ✅ | ✅ | Get display names |
| cnsGetDisplayPath | ✅ | ✅ | Get display path |
| cnsGetId | ✅ | ✅ | Get node data point |
| cnsGetIdSet | ✅ | ✅ | Search nodes by ID |
| cnsGetNodesByData | ✅ | ✅ | Find nodes by data point |
| cnsGetNodesByName | ✅ | ✅ | Search nodes by name |
| cnsGetOPCAccessRight | ❌ | ❌ | Get OPC access rights |
| cnsGetParent | ✅ | ✅ | Get parent node |
| cnsGetProperty | ✅ | ✅ | Get node property |
| cnsGetPropertyKeys | ✅ | ✅ | Get property keys |
| cnsGetRoot | ✅ | ✅ | Get root node |
| cnsGetSystemNames | ❌ | ❌ | Get system names |
| cnsGetTrees | ✅ | ✅ | Get all trees |
| cnsGetUserData | ❌ | ❌ | Get user data |
| cnsGetViewDisplayNames | ❌ | ❌ | Get view display names |
| cnsGetViews | ✅ | ✅ | Get all views |
| cnsGetViewSeparators | ❌ | ❌ | Get view separators |
| cnsRemoveObserver | ❌ | ❌ | Remove CNS observer |
| cnsSetProperty | ✅ | ✅ | Set node property |
| cnsSetUserData | ❌ | ❌ | Set user data |
| cnsSubStr | ❌ | ❌ | Parse CNS path |

---

### Cryptography Functions (0/5 - 0%)

| Function | GraphQL | REST API | Notes |
|----------|---------|----------|-------|
| checkCrypt | ❌ | ❌ | Verify encrypted text |
| crypt | ❌ | ❌ | Encrypt text |
| decryptToBuffer | ❌ | ❌ | Decrypt to buffer |
| decryptToString | ❌ | ❌ | Decrypt to string |
| encrypt | ❌ | ❌ | Encrypt data |

---

### Data Point Functions (18/44 - 41%)

| Function | GraphQL | REST API | Notes |
|----------|---------|----------|-------|
| dpAliasToName | ❌ | ❌ | Convert alias to name |
| dpAttributeType | ✅ | ✅ | Get attribute type |
| dpCancelSplitRequest | ❌ | ❌ | Cancel split request |
| dpConnect | 🔵 | ❌ | Subscribe to DP changes |
| dpCopy | ✅ | ✅ | Copy data point |
| dpCreate | ✅ | ✅ | Create data point |
| dpDelete | ✅ | ✅ | Delete data point |
| dpDisconnect | ❌ | ❌ | Disconnect subscription |
| dpElementType | ✅ | ✅ | Get element type |
| dpExists | ✅ | ✅ | Check if DP exists |
| dpGet | ✅ | ✅ | Get DP values |
| dpGetAlias | ❌ | ❌ | Get DP alias |
| dpGetAllAliases | ❌ | ❌ | Get all aliases |
| dpGetAllAttributes | ❌ | ❌ | Get all attributes |
| dpGetAllConfigs | ❌ | ❌ | Get all configs |
| dpGetAllDescriptions | ❌ | ❌ | Get all descriptions |
| dpGetAllDetails | ❌ | ❌ | Get all details |
| dpGetDescription | ❌ | ❌ | Get DP description |
| dpGetFormat | ❌ | ❌ | Get display format |
| dpGetId | ❌ | ❌ | Get DP ID |
| dpGetMaxAge | ✅ | ✅ | Get value with max age |
| dpGetName | ❌ | ❌ | Get DP name from ID |
| dpGetPeriod | ✅ | ✅ | Get historical values |
| dpGetPeriodSplit | ❌ | ❌ | Get historical (chunked) |
| dpGetUnit | ❌ | ❌ | Get unit |
| dpNames | ✅ | ✅ | Search data points |
| dpQuery | ✅ | ✅ | SQL-like query |
| dpQueryConnectAll | 🔵 | ❌ | Subscribe to query (all) |
| dpQueryConnectSingle | 🔵 | ❌ | Subscribe to query (single) |
| dpQueryDisconnect | ❌ | ❌ | Disconnect query |
| dpQuerySplit | ❌ | ❌ | Split query request |
| dpSet | ✅ | ✅ | Set DP values |
| dpSetAlias | ❌ | ❌ | Set DP alias |
| dpSetAndWaitForValue | ❌ | ❌ | Set and wait for value |
| dpSetDescription | ❌ | ❌ | Set description |
| dpSetFormat | ❌ | ❌ | Set display format |
| dpSetTimed | ✅ | ✅ | Set with timestamp |
| dpSetTimedWait | ✅ | ✅ | Set with timestamp (wait) |
| dpSetUnit | ❌ | ❌ | Set unit |
| dpSetWait | ✅ | ✅ | Set and wait |
| dpSubStr | ❌ | ❌ | Parse DP string |
| dpTypes | ✅ | ✅ | List DP types |
| dpWaitForValue | ❌ | ❌ | Wait for value condition |
| nameCheck | ❌ | ❌ | Validate DP name |

---

### Data Point Type Functions (8/8 - 100%)

| Function | GraphQL | REST API | Notes |
|----------|---------|----------|-------|
| dpGetDpTypeRefs | ✅ | ✅ | Get type references |
| dpGetRefsToDpType | ✅ | ✅ | Get references to type |
| dpTypeChange | ✅ | ✅ | Modify DP type |
| dpTypeCreate | ✅ | ✅ | Create DP type |
| dpTypeDelete | ✅ | ✅ | Delete DP type |
| dpTypeGet | ✅ | ✅ | Get type structure |
| dpTypeName | ✅ | ✅ | Get DP type name |
| dpTypeRefName | ✅ | ✅ | Get type reference name |

---

### Logging Functions (0/6 - 0%)

| Function | GraphQL | REST API | Notes |
|----------|---------|----------|-------|
| logDebugF | ❌ | ❌ | Log debug with flag |
| logFatal | ❌ | ❌ | Log fatal error |
| logInfo | ❌ | ❌ | Log information |
| logSevere | ❌ | ❌ | Log severe error |
| logWarning | ❌ | ❌ | Log warning |
| securityEvent | ❌ | ❌ | Log security event |

---

### Manager Functions (3/14 - 21%)

| Function | GraphQL | REST API | Notes |
|----------|---------|----------|-------|
| cfgReadContent | ❌ | ❌ | Read config file |
| exit | ❌ | ❌ | Exit manager |
| findFile | ❌ | ❌ | Find file in project |
| getOptions | ❌ | ❌ | Get manager options |
| getPaths | ❌ | ❌ | Get project paths |
| getProjectLangs | ❌ | ❌ | Get project languages |
| getSystemId | ✅ | ✅ | Get system ID |
| getSystemName | ✅ | ✅ | Get system name |
| getUserId | ❌ | ❌ | Get user ID |
| getUserName | ❌ | ❌ | Get user name |
| getVersionInfo | ✅ | ✅ | Get version info |
| isDbgFlag | ❌ | ❌ | Check debug flag |
| setOptions | ❌ | ❌ | Set manager options |
| setUserId | ❌ | ❌ | Change user ID |

---

### Redundancy Functions (2/4 - 50%)

| Function | GraphQL | REST API | Notes |
|----------|---------|----------|-------|
| isReduActive | ✅ | ✅ | Check if redundancy active |
| isRedundant | ✅ | ✅ | Check if system redundant |
| myReduHost | ❌ | ❌ | Get redundancy host |
| myReduHostNum | ❌ | ❌ | Get redundancy host number |

---

## Additional Features

### Custom API Extensions

The GraphQL/REST API includes additional features not in the base WinCC OA API:

- **Tag API**: Convenience wrapper combining value, timestamp, and status
  - `tagGet()` - Get tags with metadata
  - `tagGetHistory()` - Get historical tag data
  - `tagSubscribe()` - Real-time tag updates (GraphQL subscription)

- **Authentication & Authorization**
  - JWT token-based authentication
  - Role-based access control (admin/readonly)
  - Token refresh mechanism

- **GraphQL Subscriptions** (Real-time)
  - `dpConnect` - Subscribe to data point changes
  - `dpQueryConnectAll` - Subscribe to query results (all updates)
  - `dpQueryConnectSingle` - Subscribe to query results (single update)
  - `tagSubscribe` - Subscribe to tag changes

- **REST API Extensions**
  - OpenAPI 3.0 specification
  - Interactive Swagger UI documentation
  - Comprehensive error handling
  - Health check endpoint

---

## Implementation Notes

### Functions Not Suitable for REST/GraphQL

Some functions are not implemented because they are not suitable for a stateless HTTP/GraphQL API:

- **Observer/Callback Functions**: Functions requiring persistent callbacks (e.g., `cnsAddObserver`, `cnsRemoveObserver`)
  - **Alternative**: Use GraphQL subscriptions for real-time updates

- **Manager Lifecycle Functions**: Functions that control the manager itself (e.g., `exit`, `setOptions`)
  - **Reason**: These would affect the server itself, not the client

- **Split Request Functions**: Functions for chunking large requests (e.g., `dpQuerySplit`, `dpCancelSplitRequest`)
  - **Alternative**: Use pagination parameters in queries

### Priority for Future Implementation

High priority candidates for implementation:

1. **Alias Functions** (`dpGetAlias`, `dpSetAlias`, `dpGetAllAliases`)
2. **Description Functions** (`dpGetDescription`, `dpSetDescription`)
3. **Format/Unit Functions** (`dpGetFormat`, `dpSetFormat`, `dpGetUnit`, `dpSetUnit`)
4. **DP ID Functions** (`dpGetId`, `dpGetName`)
5. **CNS View Display Functions** (`cnsGetViewDisplayNames`, `cnsGetViewSeparators`)

---

## Usage Examples

### GraphQL Query
```graphql
query {
  methods {
    dpQuery(query: "SELECT '_original.._value' FROM 'ExampleDP*'")
  }
}
```

### REST API
```bash
curl -X POST http://localhost:4000/restapi/query \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT '\''_original.._value'\'' FROM '\''ExampleDP*'\''"}'
```

### GraphQL Subscription
```graphql
subscription {
  dpConnect(dpeNames: ["Pump1.value", "Pump2.value"], answer: true) {
    dpeNames
    values
    type
  }
}
```

---

## Related Documentation

- [GraphQL V2 Schema](./GRAPHQL-V2.md) - New hierarchical GraphQL API
- [REST API Documentation](./restapi/REST-API.md) - Complete REST API reference
- [OpenAPI Specification](./restapi/openapi-full.yaml) - OpenAPI 3.0 spec
- [dpQuery Implementation](./DPQUERY-IMPLEMENTATION.md) - Recent dpQuery addition

---

*Last Updated: 2025-10-07*
*Generated from WinCC OA Node.js API v3.19 documentation*
