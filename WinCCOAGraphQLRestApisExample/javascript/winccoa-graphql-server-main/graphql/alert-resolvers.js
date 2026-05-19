// Alert type resolvers

const { parseDataPointName } = require('./helpers')

// Map GraphQL enum values to WinCC OA attribute names
const ALERT_ATTRIBUTE_MAP = {
  // Basic alert information
  TEXT: '_alert_hdl.._text',
  ABBR: '_alert_hdl.._abbr',
  VALUE: '_alert_hdl.._value',
  VALUE_STATUS64: '_alert_hdl.._value_status64',
  PRIORITY: '_alert_hdl.._prior',
  CLASS: '_alert_hdl.._class',
  COMMENT: '_alert_hdl.._comment',

  // Acknowledgement related
  ACK_STATE: '_alert_hdl.._ack_state',
  ACK_USER: '_alert_hdl.._ack_user',
  ACK_TIME: '_alert_hdl.._ack_time',
  ACK_TYPE: '_alert_hdl.._ack_type',
  ACK_OBLIG: '_alert_hdl.._ack_oblig',
  ACKABLE: '_alert_hdl.._ackable',
  SINGLE_ACK: '_alert_hdl.._single_ack',
  OLDEST_ACK: '_alert_hdl.._oldest_ack',
  INACT_ACK: '_alert_hdl.._inact_ack',

  // Timing
  CAME_TIME: '_alert_hdl.._came_time',
  CAME_TIME_IDX: '_alert_hdl.._came_time_idx',
  GONE_TIME: '_alert_hdl.._gone_time',
  GONE_TIME_IDX: '_alert_hdl.._gone_time_idx',
  SYSTEM_TIME: '_alert_hdl.._system_time',
  DEL_DATE: '_alert_hdl.._del_date',

  // State
  STATE: '_alert_hdl.._state',
  ACTIVE: '_alert_hdl.._active',
  INACTIVE: '_alert_hdl.._inactive',
  DIRECTION: '_alert_hdl.._direction',
  VISIBLE: '_alert_hdl.._visible',
  OBSOLETE: '_alert_hdl.._obsolete',

  // Actual state information
  ACT_TEXT: '_alert_hdl.._act_text',
  ACT_PRIOR: '_alert_hdl.._act_prior',
  ACT_STATE: '_alert_hdl.._act_state',
  ACT_STATE_TEXT: '_alert_hdl.._act_state_text',
  ACT_STATE_PRIOR: '_alert_hdl.._act_state_prior',
  ACT_STATE_COLOR: '_alert_hdl.._act_state_color',
  ACT_STATE_FORE_COLOR: '_alert_hdl.._act_state_fore_color',
  ACT_STATE_FONT_STYLE: '_alert_hdl.._act_state_font_style',
  ACT_RANGE: '_alert_hdl.._act_range',
  ACT_STATE_RANGE: '_alert_hdl.._act_state_range',

  // Display/Formatting
  ALERT_COLOR: '_alert_hdl.._alert_color',
  ALERT_FORE_COLOR: '_alert_hdl.._alert_fore_color',
  ALERT_FONT_STYLE: '_alert_hdl.._alert_font_style',
  MAPPED_TEXT: '_alert_hdl.._mapped_text',

  // Filtering and organization
  FILTER_ACTIVE: '_alert_hdl.._filter_active',
  ORDER: '_alert_hdl.._order',
  PARAM: '_alert_hdl.._param',
  DISCRETE_STATES: '_alert_hdl.._discrete_states',
  NUM_RANGES: '_alert_hdl.._num_ranges',

  // Destination
  DEST: '_alert_hdl.._dest',
  DEST_TEXT: '_alert_hdl.._dest_text',

  // Archiving and deletion
  ARCHIVE: '_alert_hdl.._archive',
  DELETE: '_alert_hdl.._delete',
  LAST: '_alert_hdl.._last',
  LAST_OF_ALL: '_alert_hdl.._last_of_all',

  // Escalation and partner
  ESCALATION_CLASS: '_alert_hdl.._escalation_class',
  PARTNER: '_alert_hdl.._partner',
  PARTNER_ALERT_ID: '_alert_hdl.._partner_alert_id',
  PARTN_IDX: '_alert_hdl.._partn_idx',

  // Summary/aggregation
  SUM: '_alert_hdl.._sum',
  SUMALERTS: '_alert_hdl.._sumalerts',
  ALERTS: '_alert_hdl.._alerts',
  SUMMED_ALERTS: '_alert_hdl.._summed_alerts',
  SUMMED_ALERTS_COUNT: '_alert_hdl.._summed_alerts_count',
  SUMMED_ABBR: '_alert_hdl.._summed_abbr',
  SUMMED_CLASSES: '_alert_hdl.._summed_classes',
  SUMMED_COLORS: '_alert_hdl.._summed_colors',
  SUMMED_PRIOS: '_alert_hdl.._summed_prios',
  SUMMED_STATES: '_alert_hdl.._summed_states'
}

// Reverse map: WinCC OA attribute name to enum value
const ALERT_ATTRIBUTE_REVERSE_MAP = Object.fromEntries(
  Object.entries(ALERT_ATTRIBUTE_MAP).map(([k, v]) => [v, k])
)

function createAlertResolvers(winccoa, logger) {
  return {
    dpeName(alert) {
      return alert.dpeName
    },

    async dp(alert) {
      if (!alert.system) {
        logger.error('Alert.dp error: alert.system is not set')
        return null
      }

      const parsed = parseDataPointName(alert.dpeName)
      const typeName = await winccoa.dpTypeName(parsed.dpName)

      return {
        name: parsed.dpName,
        fullName: alert.dpeName,
        system: alert.system,
        typeName
      }
    },

    attribute(alert, { name }) {
      const attrName = ALERT_ATTRIBUTE_MAP[name]
      return alert.values && alert.values[attrName] !== undefined ? alert.values[attrName] : null
    },

    text(alert) {
      return alert.values && alert.values['_alert_hdl.._text'] || null
    },

    acknowledged(alert) {
      const ackState = alert.values && alert.values['_alert_hdl.._ack_state']
      return ackState !== undefined && ackState !== 0
    },

    acknowledgedBy(alert) {
      return alert.values && alert.values['_alert_hdl.._ack_user'] || null
    },

    acknowledgedAt(alert) {
      return alert.values && alert.values['_alert_hdl.._ack_time'] || null
    },

    priority(alert) {
      return alert.values && alert.values['_alert_hdl.._prior'] || null
    },

    severity(alert) {
      const priority = alert.values && alert.values['_alert_hdl.._prior']
      if (priority === undefined || priority === null) return null

      // Map priority to severity string
      if (priority >= 0 && priority <= 20) return 'INFO'
      if (priority <= 40) return 'WARNING'
      if (priority <= 60) return 'ERROR'
      return 'CRITICAL'
    }
  }
}

module.exports = { createAlertResolvers, ALERT_ATTRIBUTE_MAP }
