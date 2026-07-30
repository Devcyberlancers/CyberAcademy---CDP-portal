import { execFileSync, spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const backendRoot = path.resolve(import.meta.dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');
const studentRoot = path.join(projectRoot, 'Student', 'Students portal');
const adminRoot = path.join(projectRoot, 'Admin', 'Admin_panel', 'i-need-the-full-working-of');
const children = [];
const verbose = process.env.CYBER_VERBOSE === '1';

const links = [
  ['Unified login', 'http://localhost:3000'],
  ['Student dashboard', 'http://localhost:3000/dashboard/student'],
  ['Student courses', 'http://localhost:3000/dashboard/student?section=courses'],
  ['Student assessments', 'http://localhost:3000/dashboard/student?section=assessments'],
  ['Student jobs', 'http://localhost:3000/dashboard/student?section=jobs'],
  ['Admin dashboard', 'http://localhost:3001/admin/dashboard'],
  ['Admin courses', 'http://localhost:3001/admin/courses'],
  ['Admin assessments', 'http://localhost:3001/admin/assignments'],
  ['Admin jobs', 'http://localhost:3001/admin/jobs'],
  ['Admin students', 'http://localhost:3001/admin/students'],
  ['API', 'http://localhost:8000'],
  ['API health', 'http://localhost:8000/health'],
  ['API documentation', 'http://localhost:8000/docs'],
];

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = (inUse) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(inUse);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function stopOldCyberAcademyProcesses() {
  const ports = [8000, 3000, 3001];
  if (process.platform === 'win32') {
    const command = [
      `$ports = @(${ports.join(',')});`,
      '$processIds = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue',
      '| Where-Object { $_.LocalPort -in $ports }',
      '| Select-Object -ExpandProperty OwningProcess -Unique);',
      'foreach ($processId in $processIds) {',
      `if ($processId -and $processId -ne ${process.pid}) {`,
      'Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue;',
      '}',
      '}',
      'exit 0;',
    ].join(' ');
    try {
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } catch {
      // Port availability is verified below and produces a useful message if cleanup really failed.
    }
  } else {
    for (const port of ports) {
      try {
        execFileSync('fuser', ['-k', `${port}/tcp`], { stdio: 'ignore' });
      } catch {
        // No listener (or fuser is unavailable); the verification below gives a clear error.
      }
    }
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    const occupied = await Promise.all(ports.map(portInUse));
    if (occupied.every((value) => !value)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const blocked = [];
  for (const port of ports) if (await portInUse(port)) blocked.push(port);
  throw new Error(`Could not release Cyber Academy port(s): ${blocked.join(', ')}. Run PowerShell as Administrator once and retry.`);
}

function writeImportantLogs(stream, label) {
  let pending = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      const clean = line.replace(/\u001b\[[0-9;]*m/g, '').trim();
      if (!clean) continue;
      if (verbose || /\b(error|fatal|exception|failed|eaddrinuse|eacces)\b/i.test(clean)) {
        console.log(`[${label}] ${clean}`);
      }
    }
  });
}

function npmProcess(args, cwd, label, environment = {}) {
  const executable = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(executable, args, {
    cwd,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: process.platform === 'win32',
  });
  writeImportantLogs(child.stdout, label);
  writeImportantLogs(child.stderr, label);
  children.push(child);
  child.on('exit', (code) => {
    if (code && code !== 0) console.error(`[${label}] stopped with exit code ${code}.`);
  });
  return child;
}

function printLinks() {
  const width = Math.max(...links.map(([name]) => name.length));
  console.log('');
  console.log('CYBER ACADEMY LINKS');
  console.log('='.repeat(68));
  for (const [name, url] of links) console.log(`${name.padEnd(width)}  ${url}`);
  console.log('='.repeat(68));
  console.log('Press Ctrl+C to stop services started by this command.');
  console.log('For full service logs: $env:CYBER_VERBOSE=1; npm run start:all');
  console.log('');
}

console.log('');
console.log('Cyber Academy clean restart...');
console.log('[CLEAN] Stopping old services on ports 8000, 3000 and 3001');
await stopOldCyberAcademyProcesses();

console.log('[START] API                 port 8000');
npmProcess(['run', 'start:dev:shared'], backendRoot, 'API', { ENABLE_SWAGGER: 'true' });

console.log('[START] Student portal      port 3000');
npmProcess(['run', 'dev:frontend'], studentRoot, 'STUDENT', {
  NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8000',
});

console.log('[START] Admin portal        port 3001');
npmProcess(['run', 'dev:frontend'], adminRoot, 'ADMIN', {
  NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8000',
  NEXT_PUBLIC_STUDENT_API_BASE_URL: 'http://127.0.0.1:8000',
});

printLinks();

function stop() {
  for (const child of children) {
    if (child.killed) continue;
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    } else {
      child.kill('SIGTERM');
    }
  }
}

process.on('SIGINT', () => {
  stop();
  process.exit(0);
});
process.on('SIGTERM', () => {
  stop();
  process.exit(0);
});

await new Promise((resolve) => {
  Promise.all(children.map((child) => new Promise((done) => child.once('exit', done)))).then(resolve);
});
