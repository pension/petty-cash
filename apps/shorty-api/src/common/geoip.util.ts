import * as geoip from 'geoip-lite';

// Reused across lookups — Intl.DisplayNames construction isn't free.
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

export interface GeoLookupResult {
  countryCode: string | null;
  countryName: string | null;
  cityName: string | null;
}

const EMPTY_RESULT: GeoLookupResult = {
  countryCode: null,
  countryName: null,
  cityName: null,
};

// geoip-lite ships a bundled, periodically-updated MaxMind GeoLite2-style
// DB — in-process lookup, no network call, no API key. It (correctly)
// can't resolve loopback/private ranges (127.0.0.1, ::1, 10.x, etc.), so
// this always returns nulls for local dev traffic — only verifiable
// against a real public IP.
export function lookupGeo(ipAddress: string | null): GeoLookupResult {
  if (!ipAddress) return EMPTY_RESULT;

  // Strip the IPv4-mapped-IPv6 prefix some proxies/sockets add
  // (e.g. "::ffff:203.0.113.5") — geoip-lite doesn't handle it itself.
  const ip = ipAddress.startsWith('::ffff:') ? ipAddress.slice(7) : ipAddress;

  const result = geoip.lookup(ip);
  if (!result) return EMPTY_RESULT;

  let countryName: string | null = null;
  try {
    countryName = regionNames.of(result.country) ?? null;
  } catch {
    countryName = null;
  }

  return {
    countryCode: result.country || null,
    countryName,
    cityName: result.city || null,
  };
}
