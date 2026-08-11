import { resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  it('prefers the Cloudflare visitor address over proxy addresses', () => {
    expect(resolveClientIp({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '10.0.0.5' }, '127.0.0.1')).toBe('203.0.113.9');
  });

  it('takes the first valid forwarded address and normalizes mapped IPv4', () => {
    expect(resolveClientIp({ 'x-forwarded-for': 'unknown, ::ffff:198.51.100.21, 10.0.0.4' }, '127.0.0.1')).toBe('198.51.100.21');
  });

  it('prefers the forwarded visitor over a reverse-proxy x-real-ip address', () => {
    expect(resolveClientIp({ 'x-forwarded-for': '198.51.100.42, 10.0.0.4', 'x-real-ip': '10.0.0.8' }, '127.0.0.1')).toBe('198.51.100.42');
  });

  it('falls back safely when forwarding headers are invalid', () => {
    expect(resolveClientIp({ 'x-forwarded-for': 'not-an-ip' }, '::ffff:127.0.0.1')).toBe('127.0.0.1');
  });
});
