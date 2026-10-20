import { BadRequestException } from '@nestjs/common';
import type { ListQuery } from './pagination';
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Indian/Maldives',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export function dateFilter(q: Pick<ListQuery, 'from' | 'to'>, field: string) {
  const range: { gte?: Date; lte?: Date } = {};
  for (const key of ['from', 'to'] as const)
    if (q[key]) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(q[key]) ||
        Number.isNaN(Date.parse(q[key])) ||
        new Date(q[key]).toISOString().slice(0, 10) !== q[key]
      )
        throw new BadRequestException('Use YYYY-MM-DD report dates.');
      range[key === 'from' ? 'gte' : 'lte'] = new Date(
        `${q[key]}T${key === 'from' ? '00:00:00.000' : '23:59:59.999'}+05:00`,
      );
    }
  return Object.keys(range).length ? { [field]: range } : {};
}
