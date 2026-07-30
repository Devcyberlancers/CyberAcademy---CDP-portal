import path from 'node:path';
import { spawn } from 'node:child_process';

const backendRoot = path.resolve(import.meta.dirname, '..');

const environment = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: process.env.PORT || '8000',
  CORS_ORIGINS: process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001',
  TRUSTED_HOSTS: process.env.TRUSTED_HOSTS || 'localhost,127.0.0.1',
  STUDENT_FRONTEND_URL: process.env.STUDENT_FRONTEND_URL || 'http://localhost:3000',
  ADMIN_FRONTEND_URL: process.env.ADMIN_FRONTEND_URL || 'http://localhost:3001',
  ENABLE_SWAGGER: process.env.ENABLE_SWAGGER || 'true',
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(backendRoot, '.playwright'),
};

const nestEntry = path.join(backendRoot, 'node_modules', '@nestjs', 'cli', 'bin', 'nest.js');
console.log('Starting the unified NestJS backend with backend/.env.');
console.log(`API: http://localhost:${environment.PORT}`);
console.log(`Health: http://localhost:${environment.PORT}/health`);

const child = spawn(process.execPath, [nestEntry, 'start', '--watch'], {
  cwd: backendRoot,
  env: environment,
  stdio: 'inherit',
  windowsHide: false,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
