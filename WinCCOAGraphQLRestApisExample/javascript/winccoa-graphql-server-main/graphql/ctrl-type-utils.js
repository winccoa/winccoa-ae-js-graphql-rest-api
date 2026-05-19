// Utilities for passing dyn_anytype values to WinCC OA via WinccoaCtrlScript.
//
// The WinCC OA Node.js binding cannot infer the target CTRL type for anytype /
// dyn_anytype elements (error 9301). WinccoaCtrlScript.start() accepts explicit
// per-element type hints via its paramTypes argument, so we route complex values
// through thin CTRL wrappers that call dpSet / alertSet with the correct types.

const { WinccoaCtrlScript, WinccoaCtrlType } = require('winccoa-manager')

// Primitive WinccoaCtrlType → its dyn_ counterpart (for homogeneous arrays)
const PRIM_TO_DYN = new Map([
  [WinccoaCtrlType.bool,   WinccoaCtrlType.dyn_bool],
  [WinccoaCtrlType.int,    WinccoaCtrlType.dyn_int],
  [WinccoaCtrlType.float,  WinccoaCtrlType.dyn_float],
  [WinccoaCtrlType.string, WinccoaCtrlType.dyn_string],
  [WinccoaCtrlType.uint,   WinccoaCtrlType.dyn_uint],
  [WinccoaCtrlType.long,   WinccoaCtrlType.dyn_long],
  [WinccoaCtrlType.ulong,  WinccoaCtrlType.dyn_ulong],
])

/**
 * Recursively infer a WinccoaCtrlType hint from a JS value.
 *
 * Returns:
 *   - A WinccoaCtrlType number for primitives (bool, int, float, string)
 *   - A WinccoaCtrlType number for homogeneous arrays (dyn_bool, dyn_int, …)
 *   - An array  [type, type, …] for mixed or nested arrays (dyn_anytype)
 *   - An object { key: type, … } for mappings
 */
function inferCtrlType(value) {
  if (value === null || value === undefined) return WinccoaCtrlType.string
  if (typeof value === 'boolean') return WinccoaCtrlType.bool
  if (typeof value === 'number')  return Number.isInteger(value) ? WinccoaCtrlType.int : WinccoaCtrlType.float
  if (typeof value === 'string')  return WinccoaCtrlType.string

  if (Array.isArray(value)) {
    if (value.length === 0) return WinccoaCtrlType.dyn_string // safe fallback for empty
    const types = value.map(inferCtrlType)
    // Homogeneous primitive array → use dyn_<type> (more efficient per docs)
    const allSamePrimitive = types.every(t => t === types[0]) && typeof types[0] === 'number' && PRIM_TO_DYN.has(types[0])
    if (allSamePrimitive) return PRIM_TO_DYN.get(types[0])
    // Mixed or nested → per-element type array (dyn_anytype style)
    return types
  }

  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, inferCtrlType(v)]))
  }

  return WinccoaCtrlType.string // fallback
}

/**
 * Returns true if the value requires WinccoaCtrlScript for conversion.
 * The binding handles flat homogeneous arrays (dyn_string, dyn_int, …) fine;
 * it fails on mixed-type arrays and arrays containing arrays / objects.
 */
function needsCtrlScript(value) {
  if (!Array.isArray(value)) return false
  if (value.some(v => Array.isArray(v) || (v !== null && typeof v === 'object'))) return true
  if (value.length > 1) {
    const firstType = typeof value[0]
    if (value.some(v => typeof v !== firstType)) return true
  }
  return false
}

// CTRL wrappers — dpSet variants + alertSet variants
//
// alertSet CTRL signature (WinCC OA docs):
//   int alertSet(time alertTime, int alertCount, string alertDpe, anytype value)
// alertSetTimed adds a source timestamp as the first argument.
// The *Wait variants use the synchronous CTRL alertSet/alertSetTimed (CTRL scripts
// are inherently synchronous per thread, so the Promise resolves after completion).
const TYPED_CTRL_CODE = `
void typedDpSet(string dpe, dyn_anytype value) {
  dpSet(dpe, value);
}
int typedDpSetWait(string dpe, dyn_anytype value) {
  return dpSetWait(dpe, value);
}
void typedDpSetTimed(time t, string dpe, dyn_anytype value) {
  dpSetTimed(t, dpe, value);
}
int typedDpSetTimedWait(time t, string dpe, dyn_anytype value) {
  return dpSetTimedWait(t, dpe, value);
}
int typedAlertSet(time alertTime, int alertCount, string alertDpe, dyn_anytype value) {
  return alertSet(alertTime, alertCount, alertDpe, value);
}
int typedAlertSetTimed(time srcTime, time alertTime, int alertCount, string alertDpe, dyn_anytype value) {
  return alertSetTimed(srcTime, alertTime, alertCount, alertDpe, value);
}
`

// Cache one WinccoaCtrlScript per winccoa instance
const scriptCache = new WeakMap()

function getScript(winccoa) {
  if (!scriptCache.has(winccoa)) {
    scriptCache.set(winccoa, new WinccoaCtrlScript(winccoa, TYPED_CTRL_CODE, 'typed-set'))
  }
  return scriptCache.get(winccoa)
}

// dpSet variants

async function typedDpSet(winccoa, dpe, value) {
  await getScript(winccoa).start(
    'typedDpSet',
    [dpe, value],
    [WinccoaCtrlType.string, inferCtrlType(value)]
  )
  return true
}

async function typedDpSetWait(winccoa, dpe, value) {
  const result = await getScript(winccoa).start(
    'typedDpSetWait',
    [dpe, value],
    [WinccoaCtrlType.string, inferCtrlType(value)]
  )
  return result !== -1
}

async function typedDpSetTimed(winccoa, time, dpe, value) {
  await getScript(winccoa).start(
    'typedDpSetTimed',
    [time, dpe, value],
    [WinccoaCtrlType.time, WinccoaCtrlType.string, inferCtrlType(value)]
  )
  return true
}

async function typedDpSetTimedWait(winccoa, time, dpe, value) {
  const result = await getScript(winccoa).start(
    'typedDpSetTimedWait',
    [time, dpe, value],
    [WinccoaCtrlType.time, WinccoaCtrlType.string, inferCtrlType(value)]
  )
  return result !== -1
}

// alertSet variants — call alertSet in CTRL with explicit type hints for value.
// alertTime/alertCount/alertDpe come from WinccoaAlertTime; srcTime from alertSetTimed.

async function typedAlertSet(winccoa, alertTime, value) {
  // alertTime.time may be a Date or an ISO string — normalise to Date
  const t = alertTime.time instanceof Date ? alertTime.time : new Date(alertTime.time)
  const result = await getScript(winccoa).start(
    'typedAlertSet',
    [t, alertTime.count, alertTime.dpe, value],
    [WinccoaCtrlType.time, WinccoaCtrlType.int, WinccoaCtrlType.string, inferCtrlType(value)]
  )
  return result !== -1
}

async function typedAlertSetTimed(winccoa, srcTime, alertTime, value) {
  const t = alertTime.time instanceof Date ? alertTime.time : new Date(alertTime.time)
  const result = await getScript(winccoa).start(
    'typedAlertSetTimed',
    [srcTime, t, alertTime.count, alertTime.dpe, value],
    [WinccoaCtrlType.time, WinccoaCtrlType.time, WinccoaCtrlType.int, WinccoaCtrlType.string, inferCtrlType(value)]
  )
  return result !== -1
}

module.exports = {
  inferCtrlType,
  needsCtrlScript,
  typedDpSet,
  typedDpSetWait,
  typedDpSetTimed,
  typedDpSetTimedWait,
  typedAlertSet,
  typedAlertSetTimed,
}
