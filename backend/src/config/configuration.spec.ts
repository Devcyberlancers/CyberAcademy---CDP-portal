import { validateEnvironment } from './configuration';

describe('production configuration validation', () => {
  const valid = {
    NODE_ENV: 'production',
    DATABASE_URL: 'mysql://user:password@db.example.com:3306/cyber_academy',
    JWT_SECRET: 'a-unique-production-secret-that-is-longer-than-32-characters',
    CORS_ORIGINS: 'https://academy.example.com,https://admin.example.com',
    TRUSTED_HOSTS: 'api.example.com',
    STUDENT_FRONTEND_URL: 'https://academy.example.com',
    ADMIN_FRONTEND_URL: 'https://admin.example.com',
  };

  it('accepts a secure production configuration', () => {
    expect(validateEnvironment(valid)).toEqual(valid);
  });

  it('rejects a missing database URL', () => {
    expect(() => validateEnvironment({ ...valid, DATABASE_URL: '' })).toThrow('DATABASE_URL is required');
  });

  it('rejects weak JWT secrets', () => {
    expect(() => validateEnvironment({ ...valid, JWT_SECRET: 'short' })).toThrow('JWT_SECRET');
  });

  it('rejects localhost CORS origins in production', () => {
    expect(() => validateEnvironment({ ...valid, CORS_ORIGINS: 'http://localhost:3000' })).toThrow('CORS_ORIGINS');
  });
});
