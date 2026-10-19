import { Injectable } from '@nestjs/common';
import { EngagementEvent, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const REFERRER_LABELS: Array<{ match: string; label: string }> = [
  { match: 'twitter.com', label: 'Twitter / X' },
  { match: 'x.com', label: 'Twitter / X' },
  { match: 'linkedin.com', label: 'LinkedIn' },
  { match: 'facebook.com', label: 'Facebook' },
  { match: 'google.', label: 'Google Search' },
];

function classifyReferrer(referrer: string | null): string {
  if (!referrer) return 'Direct / Email';
  const hit = REFERRER_LABELS.find((r) => referrer.includes(r.match));
  return hit ? hit.label : 'Other';
}

function bucketDates(days: number): string[] {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split('T')[0];
  });
}

function tally(
  events: EngagementEvent[],
  key: (e: EngagementEvent) => string | null,
  fallback = 'Unknown',
) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const label = key(event) ?? fallback;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const total = events.length || 1;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / total) * 100),
    }));
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async build(
    where: Prisma.EngagementEventWhereInput,
    range: '7d' | '30d' | 'all',
  ) {
    const days = range === '7d' ? 7 : 30;
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const events = await this.prisma.engagementEvent.findMany({
      where: range === 'all' ? where : { ...where, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });

    const dates = bucketDates(days);
    const clicks = dates.map(
      (date) =>
        events.filter(
          (e) =>
            e.type === 'click' && e.createdAt.toISOString().startsWith(date),
        ).length,
    );
    const scans = dates.map(
      (date) =>
        events.filter(
          (e) =>
            e.type === 'scan' && e.createdAt.toISOString().startsWith(date),
        ).length,
    );
    const engagements = clicks.map((c, i) => c + scans[i]);

    return {
      totalEngagements: events.length,
      totalClicks: events.filter((e) => e.type === 'click').length,
      totalScans: events.filter((e) => e.type === 'scan').length,
      dates,
      clicks,
      scans,
      engagements,
      countries: tally(events, (e) => e.countryName).map((c) => ({
        ...c,
        code:
          events.find((e) => e.countryName === c.name)?.countryCode ??
          undefined,
      })),
      cities: tally(events, (e) => e.cityName),
      devices: tally(events, (e) => e.deviceType),
      referrers: tally(events, (e) => classifyReferrer(e.referrer)),
    };
  }

  getGlobal(range: '7d' | '30d' | 'all') {
    return this.build({}, range);
  }

  getForLink(linkId: string, range: '7d' | '30d' | 'all') {
    return this.build({ linkId }, range);
  }

  getForQrCode(qrCodeId: string, range: '7d' | '30d' | 'all') {
    return this.build({ qrCodeId }, range);
  }
}
