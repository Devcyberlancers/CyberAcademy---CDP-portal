import { isIP } from 'node:net';

export type RequestHeaders = Record<string, string | string[] | undefined>;

function headerValue(headers: RequestHeaders, name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(',') : value;
}

function normalizeIp(value: string | undefined) {
  if (!value) return '';
  let candidate = value.trim().replace(/^|$/g, '');
  if (/^for=/i.test(candidate)) candidate = candidate.slice(4).trim().replace(/^|$/g, '');
  if (candidate.startsWith('[')) candidate = candidate.slice(1, candidate.indexOf(']'));
  if (candidate.startsWith('::ffff:')) candidate = candidate.slice(7);
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) candidate = candidate.replace(/:\d+$/, '');
  return isIP(candidate) ? candidate : '';
}

function firstValid(value: string | undefined, forwarded = false) {
  if (!value) return '';
  const entries = forwarded ? value.split(';').filter((part) => /^\s*for=/i.test(part)) : value.split(',');
  for (const entry of entries) {
    const candidate = normalizeIp(entry);
    if (candidate) return candidate;
  }
  return '';
}

export function resolveClientIp(headers: RequestHeaders, requestIp?: string) {
  const candidates = [headerValue(headers, 'cf-connecting-ip'), headerValue(headers, 'true-client-ip'), headerValue(headers, 'x-real-ip'), headerValue(headers, 'x-forwarded-for')];
  for (const candidate of candidates) {
    const resolved = firstValid(candidate);
    if (resolved) return resolved;
  }
  const forwarded = firstValid(headerValue(headers, 'forwarded'), true);
  return forwarded || normalizeIp(requestIp) || 'Unavailable';
}
