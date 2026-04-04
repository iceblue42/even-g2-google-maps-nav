/** Format a duration in seconds to a human-readable string. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return '< 1 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

/** Format a distance in meters to a readable string. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Format a unix timestamp to HH:MM. */
export function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Get minutes remaining from now to a unix timestamp. */
export function minutesUntil(timestamp: number): number {
  return Math.max(0, Math.round((timestamp - Date.now() / 1000) / 60));
}

/** Format an ETA as "ETA HH:MM | X min left". */
export function formatEta(etaTimestamp: number, etaMinutes: number): string {
  return `ETA ${formatTime(etaTimestamp)} | ${formatDuration(etaMinutes * 60)} left`;
}
