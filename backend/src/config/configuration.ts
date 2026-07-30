export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 8000),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'change-me-in-production',
    expiresMinutes: Number(process.env.ACCESS_TOKEN_MINUTES ?? 1440),
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  trustedHosts: (process.env.TRUSTED_HOSTS ?? 'localhost,127.0.0.1')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
  studentEmailDomain: (process.env.STUDENT_EMAIL_DOMAIN ?? 'cyberlancers.in').replace(/^@/, ''),
  adminEmailDomain: (process.env.ADMIN_EMAIL_DOMAIN ?? 'cyberlancers.in').replace(/^@/, ''),
  enableSwagger: (process.env.ENABLE_SWAGGER ?? 'true').toLowerCase() === 'true',
  studentFrontendUrl: process.env.STUDENT_FRONTEND_URL ?? 'http://localhost:3000',
  adminFrontendUrl: process.env.ADMIN_FRONTEND_URL ?? 'http://localhost:3001',
  adminSetupToken: process.env.ADMIN_SETUP_TOKEN ?? '',
  smtp: {
    host: process.env.SMTP_HOST ?? '',
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? '',
    password: process.env.SMTP_PASSWORD ?? '',
    fromEmail: process.env.SMTP_FROM_EMAIL ?? '',
    fromName: process.env.SMTP_FROM_NAME ?? 'Cyber Academy',
    tls: (process.env.SMTP_TLS ?? 'true').toLowerCase() === 'true',
  },
  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY ?? '',
    model: process.env.NVIDIA_MODEL ?? 'meta/llama-3.3-70b-instruct',
  },
});

export function validateEnvironment(config: Record<string, unknown>) {
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const databaseUrl = String(config.DATABASE_URL ?? '');
  const jwtSecret = String(config.JWT_SECRET ?? '');
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  if (!/^mysql:\/\//i.test(databaseUrl)) throw new Error('DATABASE_URL must be a MySQL connection URL.');
  if (nodeEnv === 'production') {
    if (jwtSecret.length < 32 || jwtSecret === 'change-me-in-production') {
      throw new Error('JWT_SECRET must be a unique production secret of at least 32 characters.');
    }
    const origins = String(config.CORS_ORIGINS ?? '').split(',');
    if (!origins.length || origins.some((origin) => !origin.startsWith('https://') || /localhost|127\.0\.0\.1/.test(origin))) {
      throw new Error('CORS_ORIGINS must contain only deployed HTTPS origins in production.');
    }
    const trustedHosts = String(config.TRUSTED_HOSTS ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    if (!trustedHosts.length || trustedHosts.some((host) => /localhost|127\.0\.0\.1|https?:\/\//i.test(host))) {
      throw new Error('TRUSTED_HOSTS must contain deployed hostnames without schemes in production.');
    }
    for (const key of ['STUDENT_FRONTEND_URL', 'ADMIN_FRONTEND_URL']) {
      if (!String(config[key] ?? '').startsWith('https://')) throw new Error(`${key} must use HTTPS in production.`);
    }
    if (config.SMTP_HOST) {
      for (const key of ['SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM_EMAIL']) {
        if (!String(config[key] ?? '').trim()) throw new Error(`${key} is required when SMTP_HOST is configured.`);
      }
      const senderDomain = String(config.STUDENT_EMAIL_DOMAIN ?? 'cyberlancers.in').replace(/^@/, '').toLowerCase();
      if (!String(config.SMTP_FROM_EMAIL).toLowerCase().endsWith(`@${senderDomain}`)) {
        throw new Error(`SMTP_FROM_EMAIL must use the @${senderDomain} domain.`);
      }
    }
  }
  return config;
}
