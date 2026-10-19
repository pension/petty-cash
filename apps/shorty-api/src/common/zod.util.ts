import { z } from 'zod';

// Accepts both a plain date (what <input type="date"> sends, e.g.
// "2026-09-01") and a full ISO datetime — zod's built-in .datetime()
// only accepts the latter, which rejects every value petty-cash-ui's
// expiration date picker actually sends.
export const dateStringSchema = z
  .string()
  .refine((value) => !isNaN(Date.parse(value)), { message: 'Invalid date' });

// Plain z.string().url() accepts any scheme the WHATWG URL parser accepts
// (javascript:, data:, file:, etc). Destination/redirect URLs should never
// be anything but http(s) — the redirect engine 302s straight to this
// value, so restrict it explicitly rather than relying on browsers to
// refuse to act on an exotic scheme from a Location header.
export const httpUrlSchema = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'URL must start with http:// or https://',
  });

// Defense in depth alongside @petty-cash/qr-render's own escaping — these
// values end up interpolated into SVG markup, so reject anything that
// isn't a plausible CSS color at the API boundary too, rather than relying
// solely on the renderer to neutralize whatever comes through.
export const cssColorSchema = z
  .string()
  .max(30)
  .regex(/^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/, {
    message: 'Must be a hex color (e.g. #000000) or CSS color name',
  });
