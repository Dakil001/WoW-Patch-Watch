'use strict';

const NOTIFICATION_MODE_INTERFACE = 'interface';
const NOTIFICATION_MODE_ALL = 'all';

function normalizeNotificationMode(value) {
  return value === NOTIFICATION_MODE_ALL ? NOTIFICATION_MODE_ALL : NOTIFICATION_MODE_INTERFACE;
}

function deriveInterfaceId(version) {
  const parts = String(version || '').match(/\d+/g)?.map(Number) || [];
  if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isInteger(part) || part < 0)) {
    return null;
  }
  return (parts[0] * 10000) + (parts[1] * 100) + parts[2];
}

function interfaceIdForSnapshot(snapshot) {
  if (!snapshot) return null;
  const explicit = Number(snapshot.interfaceId);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  return deriveInterfaceId(snapshot.version);
}

function hasVersionOrBuildUpdate(change) {
  if (!change?.previous || !change?.current) return false;
  return change.previous.version !== change.current.version
    || Number(change.previous.buildId) !== Number(change.current.buildId);
}

function hasInterfaceIdUpdate(change) {
  if (!hasVersionOrBuildUpdate(change)) return false;
  const previousId = interfaceIdForSnapshot(change.previous);
  const currentId = interfaceIdForSnapshot(change.current);
  return previousId !== null && currentId !== null && previousId !== currentId;
}

function shouldNotifyChange(change, mode) {
  if (!change?.notify) return false;
  const normalizedMode = normalizeNotificationMode(mode);
  return normalizedMode === NOTIFICATION_MODE_ALL
    ? hasVersionOrBuildUpdate(change)
    : hasInterfaceIdUpdate(change);
}

module.exports = {
  NOTIFICATION_MODE_INTERFACE,
  NOTIFICATION_MODE_ALL,
  normalizeNotificationMode,
  interfaceIdForSnapshot,
  hasVersionOrBuildUpdate,
  hasInterfaceIdUpdate,
  shouldNotifyChange
};
