export function createCorrelationId(prefix = 'wdc-ui'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

export function formatTime(value: number | string): string {
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
