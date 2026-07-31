import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const backend = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const playwrightCli = path.join(path.dirname(require.resolve('playwright')), 'cli.js');

// Keep browser binaries inside the project. This makes local setup portable,
// avoids machine-global cache permission problems, and matches the Docker image.
execFileSync(process.execPath, [playwrightCli, 'install', 'chromium'], {
  cwd: backend,
  stdio: 'inherit',
  env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: path.join(backend, '.playwright') },
});
