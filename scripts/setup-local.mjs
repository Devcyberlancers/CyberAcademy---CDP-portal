import { copyFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const docker = process.platform === 'win32' ? 'docker.exe' : 'docker';
const backend = path.join(root, 'backend');
const packages = [
  backend,
  path.join(root, 'Student', 'Students portal'),
  path.join(root, 'Admin', 'Admin_panel', 'i-need-the-full-working-of', 'frontend'),
];

function run(command, args, cwd = root, environment = {}) {
  execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...environment } });
}

if (Number(process.versions.node.split('.')[0]) < 22) {
  throw new Error(`Node.js 22+ is required; found ${process.version}.`);
}

for (const directory of packages) run(npm, ['ci'], directory);
// The job-refresh service uses Playwright. Download its pinned Chromium once
// during setup so scheduled refreshes work on a freshly cloned repository.
run(npm, ['run', 'playwright:install'], backend);

const localEnv = path.join(backend, '.env.local');
const localEnvTemplate = path.join(backend, '.env.local.example');
const createdLocalEnvironment = !existsSync(localEnv);
if (createdLocalEnvironment) {
  copyFileSync(localEnvTemplate, localEnv);
  console.log('Created backend/.env.local for the isolated local database.');
}

if (!createdLocalEnvironment) {
  console.log('Existing backend/.env.local found; dependencies are ready. Database setup was not changed.');
  process.exit(0);
}

try {
  run(docker, ['compose', 'version']);
} catch {
  throw new Error('Docker Compose is required for the first local setup. Install Docker Desktop, then run `npm run setup` again.');
}

const composeFile = path.join(root, 'development', 'compose.yaml');
run(docker, ['compose', '-f', composeFile, 'up', '-d']);

let pushed = false;
for (let attempt = 1; attempt <= 30; attempt++) {
  try {
    run(npm, ['run', 'prisma:push'], backend, {
      // Prisma CLI reads .env rather than Nest's .env.local. Pin its target to
      // the container created above so setup cannot touch a contributor's DB.
      DATABASE_URL: 'mysql://cyber_portal:cyber_portal@127.0.0.1:3306/cyber_academy',
    });
    pushed = true;
    break;
  } catch {
    if (attempt === 30) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
if (!pushed) throw new Error('The local MySQL container did not become ready. Run `docker compose -f development/compose.yaml logs mysql` for details.');

console.log('\nSetup complete. Run `npm run start:all` to start the Student portal, Admin portal, and API.');
