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

## What is included

- **Database-backed administration:** student approval, profiles, courses, modules, module resources, course quizzes, standalone assessments, bulk student operations, SMTP delivery, and reports are saved through the shared API and MySQL database.
- **Student learning flow:** every course card shows its real module/quiz count, publishing date, optional end date, and personal progress. The first module is available immediately; passing its course quiz unlocks the next module. Course quizzes stay inside the course experience and do not appear in the Assessments area.
- **Course resources:** students can play an uploaded or YouTube video and open or download the PDF/link resources supplied for the selected module.
- **Live progress reports:** completion and quiz results are persisted per student and course. Admin course/student reports derive their values from that saved progress rather than browser-only state.
- **Jobs:** student job summaries and applications use API data. The backend refreshes due job preferences and performs a daily refresh check; the current refresh status is persisted for administrators.
- **Resilient portals:** both Next.js apps have recovery pages for unexpected rendering failures, and portal-access polling handles temporary API/network failures without crashing the dashboard.

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

## Quick start for a new laptop

Install Node.js 22+, Docker Desktop, and Git. Then, after cloning this repository, run only:

```powershell
npm run setup
npm run start:all
```

The first command installs all three applications, installs the local Playwright
browser used by job collection, creates a local-only backend configuration,
starts an isolated MySQL 8 container, and creates the development schema. The
second starts the Student portal, Admin portal, and API. Open
`http://localhost:3000` when it finishes.

`npm run setup` never overwrites an existing `backend/.env.local`; contributors
with an existing database simply get dependency installation. To check the code
before a pull request, run `npm run verify`.

## Prerequisites

Install:

- Node.js 22 or newer
- npm 10 or newer
- Git
- Docker Desktop with Docker Compose v2 for the automatic local setup

MySQL is supplied by the local Docker container when using `npm run setup`.
Install MySQL yourself only when you deliberately want to use a separate local
database.

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
SMTP_FROM_EMAIL=info@cyberlancers.in
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

## Course and batch leaderboards

Open **Admin -> Courses** and choose **Batch Leaderboard & Written Results** for
the selected batch, or choose **Leaderboard** on an individual course. Student
course pages show the matching live course ranking, while the Student Courses
tab exposes the complete ranking for that student's batch.

Written examination results can be imported from the repository CSV template
at templates/written-exam-leaderboard-template.csv, or by downloading the same
template from the admin leaderboard. Use either student_email or
registration_number to identify a student. Set course_id or course_title to
include the written exam in a course leaderboard; leave both blank for a
batch-wide written exam. Re-importing the same batch, exam, student, and attempt
updates the saved result instead of creating a duplicate.

The leaderboard table is created by Prisma. Production deployments must use
the existing backend command npm --prefix backend run deploy:build so the
database schema is synchronized before the API build starts.

## Validation

Run all checks before opening a pull request:

```powershell
npm run verify
```

GitHub Actions performs these checks automatically on pushes and pull requests.

For a practical end-to-end smoke test after starting the apps, create or publish
a course in Admin, add module content and a quiz, then sign in as an approved
student. Reload after each step: the course, module content, quiz result, and
progress should remain available because they are stored in MySQL. Verify a
standalone assessment separately in the Assessments tab.

## Hostinger production deployment

Hostinger Cloud supports the Student portal, Admin portal, and NestJS API as
managed Node.js Web Apps. Deploy the same Git repository as **three separate
apps** with their own domains and environment variables; do not use Docker
Compose or the VPS deployment files on a Cloud plan.

Use the exact build/start commands and environment variables in
[HOSTINGER_CLOUD_DEPLOYMENT.md](HOSTINGER_CLOUD_DEPLOYMENT.md). The deployment
guide also includes the post-deploy checks for profile saving, persisted course
content, email delivery, and API health.

The API deployment installs Playwright's project-local Chromium automatically.
If Hostinger's managed runtime disallows browser execution or a job source blocks
automated collection, the learning portals continue to run; inspect the saved
job refresh status/logs and use an allowed external worker for that integration.

## Email delivery

The visible sender is configured as:

```text
Cyber Academy <info@cyberlancers.in>
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
