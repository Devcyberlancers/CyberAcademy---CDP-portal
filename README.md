# Cyber Academy

Cyber Academy is a full-stack learning and placement platform with a Student Portal, an Admin Portal, one unified NestJS API, and one shared MySQL database.

## Applications

| Application | Technology | Local address |
| --- | --- | --- |
| Student Portal | Next.js 15, React 19, TypeScript | `http://localhost:3000` |
| Admin Portal | Next.js 15, React 19, TypeScript | `http://localhost:3001` |
| Unified API | NestJS 11, Prisma, MySQL | `http://localhost:8000` |
| API documentation | Swagger, development only | `http://localhost:8000/docs` |

Both portals authenticate through the same API and use the same `cyber_academy` database. The legacy FastAPI services have been removed.

## Repository structure

```text
CyberAcademy/
├── backend/                         Unified NestJS API and Prisma schema
├── Student/Students portal/
│   └── frontend/                    Student Next.js App Router application
├── Admin/Admin_panel/
│   └── i-need-the-full-working-of/
│       └── frontend/                Admin Next.js App Router application
├── deployment/                      Docker Compose, Caddy and Hostinger guide
├── .github/workflows/ci.yml         GitHub Actions validation
└── package.json                     Workspace-level start command
```

## Prerequisites

Install:

- Node.js 22 or newer
- npm 10 or newer
- MySQL 8
- Git
- Docker with Docker Compose v2 for production deployment

The backend uses Playwright for job collection. Local development may require Chromium:

```powershell
cd backend
npm run playwright:install
```

## Installation

Clone the repository:

```powershell
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

Install the unified backend:

```powershell
cd backend
npm ci
cd ..
```

Install the Student Portal:

```powershell
cd "Student\Students portal"
npm ci
cd ..\..
```

Install the Admin Portal:

```powershell
cd "Admin\Admin_panel\i-need-the-full-working-of\frontend"
npm ci
cd ..\..\..\..
```

## MySQL setup

Create the database and a dedicated user:

```sql
CREATE DATABASE cyber_academy
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'cyber_portal'@'localhost' IDENTIFIED BY 'REPLACE_WITH_A_STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON cyber_academy.* TO 'cyber_portal'@'localhost';
FLUSH PRIVILEGES;
```

If the existing Student database already contains production data, back it up and use that database. Do not create a second Admin database.

## Environment configuration

Create the backend environment file:

```powershell
Copy-Item backend\.env.example backend\.env
```

Set at least:

```dotenv
NODE_ENV=development
PORT=8000
DATABASE_URL=mysql://cyber_portal:URL_ENCODED_PASSWORD@127.0.0.1:3306/cyber_academy
JWT_SECRET=GENERATE_A_LONG_RANDOM_SECRET
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
TRUSTED_HOSTS=localhost,127.0.0.1
STUDENT_EMAIL_DOMAIN=cyberlancers.in
ADMIN_EMAIL_DOMAIN=cyberlancers.in
ADMIN_SETUP_TOKEN=GENERATE_A_DIFFERENT_RANDOM_SETUP_TOKEN
ENABLE_SWAGGER=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-authorized-cyberlancers-account
SMTP_PASSWORD=your-smtp-app-password
SMTP_FROM_EMAIL=admin@cyberlancers.in
SMTP_FROM_NAME=Cyber Academy
SMTP_TLS=true
STUDENT_FRONTEND_URL=http://localhost:3000
ADMIN_FRONTEND_URL=http://localhost:3001
```

URL-encode special characters in the MySQL username and password. Never commit `.env` files.

Create frontend configuration files:

```powershell
Copy-Item "Student\Students portal\frontend\.env.local.example" "Student\Students portal\frontend\.env.local"
Copy-Item "Admin\Admin_panel\i-need-the-full-working-of\frontend\.env.local.example" "Admin\Admin_panel\i-need-the-full-working-of\frontend\.env.local"
```

These local templates already point both portals to `http://127.0.0.1:8000`.

## Database schema

The Prisma schema mirrors the existing shared MySQL schema. Generate the client after installing:

```powershell
cd backend
npm run prisma:generate
```

For a new or changed database, review the target database before running:

```powershell
npm run prisma:pull
```

`prisma:pull` updates the local Prisma schema from the database; it does not create a second database.

## Running locally

From the repository root, Student Portal folder, Admin Portal folder, or backend folder:

```powershell
npm run start:all
```

The command performs a clean restart of ports `8000`, `3000`, and `3001`, then prints all portal links.

For detailed logs:

```powershell
$env:CYBER_VERBOSE=1
npm run start:all
```

Press `Ctrl+C` to stop services started by the command.

### Run services separately

Backend:

```powershell
cd backend
npm run start:dev:shared
```

Student Portal:

```powershell
cd "Student\Students portal"
npm run dev:frontend
```

Admin Portal:

```powershell
cd "Admin\Admin_panel\i-need-the-full-working-of\frontend"
npm run dev
```

## Creating the first administrator

All users sign in through the unified login at `http://localhost:3000`.

Create the first administrator through the protected setup endpoint:

```powershell
$headers = @{
  "Content-Type" = "application/json"
  "X-Admin-Setup-Token" = "YOUR_ADMIN_SETUP_TOKEN"
}
$body = @{
  name = "Administrator"
  email = "admin@cyberlancers.in"
  password = "REPLACE_WITH_A_STRONG_PASSWORD"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/api/admin/auth/register" `
  -Headers $headers `
  -Body $body
```

Use a real `@cyberlancers.in` administrator address. Replace or remove the setup token after creating the first account.

## Bulk student creation

Open Admin Dashboard → Add Students → Bulk Approval.

The CSV importer previews:

- the recipient address;
- student name;
- generated portal username;
- temporary password;
- sender, subject, and complete credential email.

No account or email is created until the administrator selects **Approve, Create & Send Emails**. Download the CSV template from the interface and preserve its column headings.

## Validation

Run all checks before opening a pull request:

```powershell
cd backend
npm run typecheck
npm run build

cd "..\Student\Students portal"
npm run typecheck
npm run build

cd "..\..\Admin\Admin_panel\i-need-the-full-working-of\frontend"
npm run typecheck
npm run build
```

GitHub Actions performs these checks automatically on pushes and pull requests.

## Hostinger production deployment

The complete application requires a Hostinger VPS with Docker. Ordinary shared hosting or a frontend-only hosting plan is insufficient because the project requires MySQL, the NestJS API, Playwright, scheduled jobs, and two Next.js servers.

Recommended starting VPS:

- Ubuntu 24.04
- 2 vCPU
- 4 GB RAM
- 50 GB storage

Configure these DNS records to the VPS:

| Host | Purpose |
| --- | --- |
| `academy.cyberlancers.in` | Unified login and Student Portal |
| `admin.academy.cyberlancers.in` | Admin Portal |
| `api.academy.cyberlancers.in` | Unified API |
| `admin-api.academy.cyberlancers.in` | Unified API compatibility hostname |

On the VPS:

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git CyberAcademy
cd CyberAcademy/deployment
cp .env.example .env
chmod 600 .env
```

Replace every `CHANGE_ME` value, then run:

```bash
bash preflight.sh
docker compose --env-file .env config
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f --tail=100
```

Caddy terminates HTTPS automatically after the DNS records resolve. Only ports `80` and `443` should be publicly open. Do not publicly expose MySQL or ports `3000`, `3001`, and `8000`.

See [deployment/README.md](deployment/README.md) for operational checks, backups, administrator setup, updates, and SMTP requirements.

## Email delivery

The visible sender is configured as:

```text
Cyber Academy <admin@cyberlancers.in>
```

The SMTP account must be authorized to send as that address. Personal Gmail SMTP can replace the visible sender with the authenticated Gmail account. Use the Cyber Lancers mail provider, Google Workspace account, or a verified sender alias.

## Security checklist

- Never commit `.env` files, SMTP passwords, database dumps, private keys, or JWT secrets.
- Use different strong values for `JWT_SECRET`, database passwords, and `ADMIN_SETUP_TOKEN`.
- Set production CORS origins to the exact HTTPS frontend origins.
- Disable Swagger in production.
- Back up MySQL before the first deployment and before every schema-related update.
- Keep MySQL and internal application ports private.
- Rotate any credential that was previously copied into source control or shared publicly.

## License

This project is private and proprietary unless the repository owner adds a separate license.
