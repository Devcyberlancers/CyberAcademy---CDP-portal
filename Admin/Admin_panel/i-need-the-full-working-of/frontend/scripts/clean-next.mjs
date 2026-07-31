import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';

for (const directory of ['.next', '.next-dev']) {
  const target = path.join(process.cwd(), directory);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
