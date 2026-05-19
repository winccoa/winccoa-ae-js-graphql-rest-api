# GraphQL to WinCC OA Function - Quick Reference

## Quick Navigation

| Document | Purpose |
|----------|---------|
| [GRAPHQL_MAPPING.md](GRAPHQL_MAPPING.md) | Complete detailed mapping of all 120+ GraphQL operations to WinCC OA functions |
| [GRAPHQL_SUMMARY.md](GRAPHQL_SUMMARY.md) | Architecture overview, design patterns, and implementation details |
| QUICK_REFERENCE.md | This document - quick lookup tables |

## All WinCC OA Functions Called

### Data Point Functions (27 functions)
| Function | File | GraphQL Operation |
|----------|------|-------------------|
| dpGet | common.js | Query api.dp.get, api.dp.get* |
| dpNames | common.js | Query api.dp.names |
| dpTypes | common.js | Query api.dp.types |
| dpGetMaxAge | common.js | Query api.dp.getMaxAge |
| dpElementType | common.js | Query api.dp.elementType |
| dpAttributeType | common.js | Query api.dp.attributeType |
| dpTypeName | common.js | Query api.dp.typeName |
| dpTypeRefName | common.js | Query api.dp.typeRefName |
| dpExists | common.js | Query api.dp.exists |
| dpGetPeriod | common.js | Query api.dp.getPeriod |
| dpQuery | common.js | Query api.dp.query |
| dpGetAlias | common.js | Query api.dp.getAlias |
| dpGetDescription | common.js | Query api.dp.getDescription |
| dpGetFormat | common.js | Query api.dp.getFormat |
| dpGetUnit | common.js | Query api.dp.getUnit |
| dpCreate | common.js | Mutation api.dp.create |
| dpDelete | common.js | Mutation api.dp.delete |
| dpCopy | common.js | Mutation api.dp.copy |
| dpSet | common.js | Mutation api.dp.set |
| dpSetWait | common.js | Mutation api.dp.setWait |
| dpSetTimed | common.js | Mutation api.dp.setTimed |
| dpSetTimedWait | common.js | Mutation api.dp.setTimedWait |
| dpSetAlias | common.js | Mutation api.dp.setAlias |
| dpSetDescription | common.js | Mutation api.dp.setDescription |
| dpSetFormat | common.js | Mutation api.dp.setFormat |
| dpSetUnit | common.js | Mutation api.dp.setUnit |

### Data Point Type Functions (6 functions)
| Function | File | GraphQL Operation |
|----------|------|-------------------|
| dpTypeGet | common.js | Query api.dpType.dpTypeGet |
| dpGetDpTypeRefs | common.js | Query api.dpType.dpGetDpTypeRefs |
| dpGetRefsToDpType | common.js | Query api.dpType.dpGetRefsToDpType |
| dpTypeCreate | common.js | Mutation api.dpType.create |
| dpTypeChange | common.js | Mutation api.dpType.change |
| dpTypeDelete | common.js | Mutation api.dpType.delete |

### Alert Functions (6 functions)
| Function | File | GraphQL Operation |
|----------|------|-------------------|
| alertGet | alerting.js | Query api.alert.alertGet |
| alertGetPeriod | alerting.js | Query api.alert.alertGetPeriod |
| alertSet | alerting.js | Mutation api.alert.set |
| alertSetWait | alerting.js | Mutation api.alert.setWait |
| alertSetTimed | alerting.js | Mutation api.alert.setTimed |
| alertSetTimedWait | alerting.js | Mutation api.alert.setTimedWait |

### CNS Read Functions (20 functions)
| Function | File | GraphQL Operation |
|----------|------|-------------------|
| cnsGetViews | cns.js | Query api.cns.getViews |
| cnsGetTrees | cns.js | Query api.cns.getTrees |
| cnsGetChildren | cns.js | Query api.cns.getChildren |
| cnsGetParent | cns.js | Query api.cns.getParent |
| cnsGetRoot | cns.js | Query api.cns.getRoot |
| cnsGetDisplayNames | cns.js | Query api.cns.getDisplayNames |
| cnsGetDisplayPath | cns.js | Query api.cns.getDisplayPath |
| cnsGetId | cns.js | Query api.cns.getId |
| cnsGetIdSet | cns.js | Query api.cns.getIdSet |
| cnsGetNodesByName | cns.js | Query api.cns.getNodesByName |
| cnsGetNodesByData | cns.js | Query api.cns.getNodesByData |
| cnsGetProperty | cns.js | Query api.cns.getProperty |
| cnsGetPropertyKeys | cns.js | Query api.cns.getPropertyKeys |
| cns_nodeExists | cns.js | Query api.cns.nodeExists |
| cns_treeExists | cns.js | Query api.cns.treeExists |
| cns_viewExists | cns.js | Query api.cns.viewExists |
| cns_isNode | cns.js | Query api.cns.isNode |
| cns_isTree | cns.js | Query api.cns.isTree |
| cns_isView | cns.js | Query api.cns.isView |
| cns_checkId | cns.js | Query api.cns.checkId |
| cns_checkName | cns.js | Query api.cns.checkName |
| cns_checkSeparator | cns.js | Query api.cns.checkSeparator |

### CNS Write Functions (7 functions)
| Function | File | GraphQL Operation |
|----------|------|-------------------|
| cnsCreateView | cns.js | Mutation api.cns.createView |
| cnsAddTree | cns.js | Mutation api.cns.addTree |
| cnsAddNode | cns.js | Mutation api.cns.addNode |
| cnsChangeTree | cns.js | Mutation api.cns.changeTree |
| cnsDeleteTree | cns.js | Mutation api.cns.deleteTree |
| cnsDeleteView | cns.js | Mutation api.cns.deleteView |
| cnsSetProperty | cns.js | Mutation api.cns.setProperty |

### System Functions (5 functions)
| Function | File | GraphQL Operation |
|----------|------|-------------------|
| getSystemId | common.js | Query api.system.getSystemId |
| getSystemName | common.js | Query api.system.getSystemName |
| getVersionInfo | common.js | Query api.system.getVersionInfo |
| isReduActive | common.js | Query api.redundancy.isReduActive |
| isRedundant | common.js | Query api.redundancy.isRedundant |

### Subscription Functions (4 functions)
| Function | File | GraphQL Operation |
|----------|------|-------------------|
| dpConnect / dpDisconnect | subscriptions.js | Subscription dpConnect |
| dpQueryConnectSingle / dpQueryDisconnect | subscriptions.js | Subscription dpQueryConnectSingle |
| dpQueryConnectAll / dpQueryDisconnect | subscriptions.js | Subscription dpQueryConnectAll |
| tagConnect / dpDisconnect | subscriptions.js | Subscription tagSubscribe |

## Resolver Files Quick Index

```
common.js (1050 lines)
  - Query: 30 resolver functions
    - dpGet, dpNames, dpTypes, dpGetMaxAge, dpElementType, dpAttributeType
    - dpTypeName, dpTypeRefName, dpExists, dpGetPeriod, dpQuery
    - dpGetAlias, dpGetDescription, dpGetFormat, dpGetUnit
    - dpTypeGet, dpGetDpTypeRefs, dpGetRefsToDpType
    - getSystemId, getSystemName, getVersionInfo
    - isReduActive, isRedundant
    - tagGet, tagGetHistory
  - Mutation: 16 resolver functions
    - dpCreate, dpDelete, dpCopy
    - dpSet, dpSetWait, dpSetTimed, dpSetTimedWait
    - dpSetAlias, dpSetDescription, dpSetFormat, dpSetUnit
    - dpTypeCreate, dpTypeChange, dpTypeDelete
  - Type resolvers: Tag.history

alerting.js (200 lines)
  - Query: 2 resolver functions
    - alertGet, alertGetPeriod
  - Mutation: 4 resolver functions
    - alertSet, alertSetWait, alertSetTimed, alertSetTimedWait

cns.js (400 lines)
  - Query: 22 resolver functions
    - All cns*/cns_* functions above
  - Mutation: 7 resolver functions
    - cnsCreateView, cnsAddTree, cnsAddNode
    - cnsChangeTree, cnsDeleteTree, cnsDeleteView
    - cnsSetProperty

datapoint-resolvers.js (630 lines)
  - Type resolvers: DataPoint (12 fields)
    - type, exists, element, elements, value, tag
    - tagHistory, alerts, cnsNodes
    - alias, description, format, unit
  - Type resolvers: DataPointElement (5 fields)
    - value, timestamp, status, elementType, history
  - Type resolvers: DataPointType (5 fields)
    - structure, references, usedBy, dataPoints, count
  - Type resolvers: DataPointTypeNode, ElementStatus

alert-resolvers.js (165 lines)
  - Type resolvers: Alert (8 fields)
    - dpeName, dp, attribute, text
    - acknowledged, acknowledgedBy, acknowledgedAt
    - priority, severity
  - ALERT_ATTRIBUTE_MAP: 60+ mappings

cns-resolvers.js (380 lines)
  - Type resolvers: CNS (4 fields)
    - view, views, searchNodes, searchByDataPoint
  - Type resolvers: CNSView (3 fields)
    - tree, trees, exists
  - Type resolvers: CNSTree (4 fields)
    - displayName, root, exists
  - Type resolvers: CNSNode (14 fields)
    - displayName, displayPath, parent, children, root, tree
    - dp, dpName, property, properties, exists

subscriptions.js (250 lines)
  - Subscription setup for: dpConnect, dpQueryConnectSingle
    - dpQueryConnectAll, tagSubscribe
```

## Key Data Structures

### Alert Attribute Mapping
60+ attributes under `_alert_hdl..` prefix:
- TEXT, ABBR, VALUE, PRIORITY, CLASS, COMMENT
- ACK_STATE, ACK_USER, ACK_TIME, ACK_TYPE, ACK_OBLIG
- CAME_TIME, GONE_TIME, STATE, ACTIVE, INACTIVE
- And 45+ more...

### ElementType Enum (62 values)
Maps numeric IDs to GraphQL enums:
- CHAR, INT, UINT, FLOAT, BOOL, STRING, TIME, DPID
- STRUCT, LANGSTRING, BLOB
- DYN_* variants (15 base types)
- *_STRUCT variants

### CtrlType Enum (40+ values)
Maps large numeric IDs to control type enums:
- TIME_VAR, BOOL_VAR, INT_VAR, UINT_VAR, FLOAT_VAR, STRING_VAR
- CHAR_VAR, BIT32_VAR, ATIME_VAR, LANGSTRING_VAR, BLOB_VAR
- DYN_* variants

### Status Bit Fields (24 bits)
```
Bit 0:  ACTIVE
Bit 1:  EXP_DEFAULT
Bit 2:  AUT_DEFAULT
Bit 3:  OUT_PRANGE
Bit 4:  OUT_RANGE
Bit 5:  EXP_INV
Bit 6:  AUT_INV
Bit 7:  ONLINE_BAD
Bit 8:  DEFAULT_BAD
Bit 9:  FROM_GI
Bit 10: FROM_SI
Bit 11: PER_ACTIVE
Bit 12: CORR
Bit 13: COMPR
Bit 14: COMP_CORR
Bit 15: CORR_ADD
Bit 16: COMP_INV
Bit 17: STIME_INV
Bit 18: TRANSITION
Bit 19: LAST_VALUE_STORAGE_OFF
Bit 20: VALUE_CHANGED
Bit 21: VALUE_UP
Bit 22: UNCERTAIN
Bit 23: RESERVED
```

## Common Query Patterns

### Get Current Value
```graphql
query {
  api {
    dp {
      get(dpeNames: ["MyDP.value"])
    }
  }
}
```

### Get Historical Data
```graphql
query {
  api {
    dp {
      getPeriod(
        startTime: "2024-01-01T00:00:00Z"
        endTime: "2024-01-02T00:00:00Z"
        dpeNames: ["MyDP.value"]
      )
    }
  }
}
```

### Set Data Point Value
```graphql
mutation {
  api {
    dp {
      set(
        dpeNames: ["MyDP.value"]
        values: [42]
      )
    }
  }
}
```

### Get CNS Hierarchy
```graphql
query {
  api {
    cns {
      getViews(systemName: "")
      getTrees(view: "MyView:")
      getChildren(cnsPath: "MyView:Root")
    }
  }
}
```

## Performance Tips

1. **Use batch dpGet** for multiple values instead of individual queries
2. **Use pagination** on history queries with `limit` and `offset`
3. **Use pattern matching** with dpNames instead of fetching all and filtering
4. **Limit time ranges** on getPeriod to reasonable intervals
5. **Use dpGetMaxAge** instead of full dpGet when value freshness matters

## Common Error Patterns

| Error | Cause | Solution |
|-------|-------|----------|
| "Failed to get data points" | Invalid DPE name | Check spelling, verify DP exists |
| "Unknown element type" | Invalid enum value | Use correct ElementType value |
| "Either provide (startTime and endTime) or lastMinutes" | Missing time range | Provide one method of time specification |
| "Failed to check if data point exists" | DP doesn't exist | Create DP or verify name |
| "Failed to create CNS view" | View already exists or invalid name | Check CNS naming rules |

## File Locations

All resolver files located in:
- `/graphql/common.js` - Core functions
- `/graphql/alerting.js` - Alert operations
- `/graphql/cns.js` - CNS operations
- `/graphql/*-resolvers.js` - Type-specific resolvers
- `/graphql/subscriptions.js` - Real-time subscriptions

All schema files located in:
- `/graphql/*.gql` - GraphQL schema definitions

## Next Steps for Developers

1. **For new mutations**: Add to appropriate `*.gql` schema, implement in resolver file
2. **For new queries**: Add to schema, implement as async function in resolver
3. **For new types**: Create schema definition, implement field resolvers
4. **For documentation**: Update GRAPHQL_MAPPING.md with new operation details
5. **For testing**: Use `extras.testDummy` as reference for test functions

