import { formatMoney as kitMoney, formatDate as kitDate } from '@pension/ui-kit';
export const formatMoney = (...args: Parameters<typeof kitMoney>): string =>
  kitMoney(...args) ?? '';
const maldives = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Indian/Maldives',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
export function formatDate(...args: Parameters<typeof kitDate>): string {
  const [value, ...options] = args;
  // UI-kit preserves UTC on Z timestamps. Convert instants to Maldives wall time
  // before applying its established display format; date-only fields stay intact.
  const instant = /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  const normalized =
    instant && !Number.isNaN(Date.parse(value)) ? maldives.format(new Date(value)) : value;
  return kitDate(normalized, ...options) ?? '';
}
