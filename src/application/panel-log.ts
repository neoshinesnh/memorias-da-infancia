const INFO_LOG_LEVEL = 'info'
const WARN_LOG_LEVEL = 'warn'
const PANEL_LOGIN_FAILED_EVENT = 'panel_login_failed'
const PANEL_LOGIN_SUCCEEDED_EVENT = 'panel_login_succeeded'
const EDITION_RESET_EVENT = 'edition_reset'
const CONNECTED_STREAM_EVENT = 'sse_client_connected'
const DISCONNECTED_STREAM_EVENT = 'sse_client_disconnected'

type PanelLoginFailedLog = {
  level: typeof WARN_LOG_LEVEL
  event: typeof PANEL_LOGIN_FAILED_EVENT
}

type PanelLoginSucceededLog = {
  level: typeof INFO_LOG_LEVEL
  event: typeof PANEL_LOGIN_SUCCEEDED_EVENT
}

type EditionResetLog = {
  level: typeof INFO_LOG_LEVEL
  event: typeof EDITION_RESET_EVENT
}

type ConnectedStreamLog = {
  level: typeof INFO_LOG_LEVEL
  event: typeof CONNECTED_STREAM_EVENT
}

type DisconnectedStreamLog = {
  level: typeof INFO_LOG_LEVEL
  event: typeof DISCONNECTED_STREAM_EVENT
}

type PanelLogEntry =
  | PanelLoginFailedLog
  | PanelLoginSucceededLog
  | EditionResetLog
  | ConnectedStreamLog
  | DisconnectedStreamLog

export function logPanelLoginFailed(): void {
  writeLogLine({
    level: WARN_LOG_LEVEL,
    event: PANEL_LOGIN_FAILED_EVENT,
  })
}

export function logPanelLoginSucceeded(): void {
  writeLogLine({
    level: INFO_LOG_LEVEL,
    event: PANEL_LOGIN_SUCCEEDED_EVENT,
  })
}

export function logEditionReset(): void {
  writeLogLine({
    level: INFO_LOG_LEVEL,
    event: EDITION_RESET_EVENT,
  })
}

export function logStreamClientConnected(): void {
  writeLogLine({
    level: INFO_LOG_LEVEL,
    event: CONNECTED_STREAM_EVENT,
  })
}

export function logStreamClientDisconnected(): void {
  writeLogLine({
    level: INFO_LOG_LEVEL,
    event: DISCONNECTED_STREAM_EVENT,
  })
}

function writeLogLine(entry: PanelLogEntry): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`)
}
