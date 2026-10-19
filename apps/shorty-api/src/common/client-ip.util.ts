import type { Request } from 'express';

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// Resolves the real visitor IP through a proxy chain, not the proxy's own
// socket IP. Priority: cf-connecting-ip (set directly by Cloudflare's edge,
// stripped from anything the client itself sends — safe to trust as long as
// this app is only reachable via Cloudflare and not also directly) →
// x-forwarded-for (first hop — the original client in a well-formed proxy
// chain; spoofable if traffic can bypass the trusted proxy, but there's no
// stronger signal available for a non-Cloudflare deployment) → the raw
// socket address (direct connections, e.g. local dev with no proxy at all).
export function getClientIp(req: Request): string | null {
  const cfConnectingIp = firstHeaderValue(req.headers['cf-connecting-ip']);
  if (cfConnectingIp) return cfConnectingIp;

  const forwardedFor = firstHeaderValue(req.headers['x-forwarded-for']);
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return req.socket.remoteAddress ?? null;
}
