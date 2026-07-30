# Cyber Academy Student Portal

Full-stack Student Portal for Cyber Academy / CDP Assessment Portal.

The project contains a Next.js frontend connected to the shared NestJS backend, MySQL database integration, job scraping/storage, profile management, resume intelligence, secure assessments, and email/OTP flows.

## Project Structure

```text
Students portal/
├─ ../../backend/        Shared NestJS backend, Prisma models, services, APIs
├─ frontend/             Next.js 15 frontend app
├─ database/             Database notes, exports, SQL/migration references
├─ docs/                 Documentation and project notes
├─ scripts/              Development helper scripts
├─ node_modules/         Root frontend dependencies
├─ package.json          Root npm scripts
└─ package-lock.json
```

## Tech Stack

Frontend:

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Lucide React
- Recharts

Backend:

- NestJS
- SQLAlchemy
- MySQL
- PyMySQL
- Playwright job scraper
- Gmail SMTP email service
- NVIDIA/OpenAI-compatible resume intelligence client

## Prerequisites

Install:

- Node.js 20+
- npm
- Python 3.11+
- MySQL 8+

## Environment Setup

Backend environment file:

```text
backend/.env
```

Important variables:

```env
APP_NAME=Cyber Academy Student Portal

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=cyber_portal
DB_PASSWORD=your_mysql_password
DB_NAME=cyber_academy

JWT_SECRET=change_this_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_MINUTES=1440

STUDENT_EMAIL_DOMAIN=cyberlancers.in

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=True
SMTP_USER=your_gmail@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_gmail@gmail.com
SMTP_FROM_NAME=Cyber Academy

NVIDIA_API_KEY=your_key
NVIDIA_MODEL=your_model
```

Frontend environment variables can be placed in:

```text
frontend/.env.local
```

Example:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_ADMIN_PORTAL_URL=http://localhost:3001
```

## Install Dependencies

From project root:

```bash
npm install
```

Backend dependencies are installed automatically by:

```bash
npm run dev:all
```

Or install the unified backend manually:

```bash
cd ../../backend
npm ci
npm run playwright:install
```

## Run the Project

Run frontend only:

```bash
npm run dev
```

Run backend + frontend together:

```bash
npm run dev:all
```

Frontend:

```text
http://localhost:3000
```

Backend:

```text
http://127.0.0.1:8000
```

API docs (development only):

```text
http://127.0.0.1:8000/docs
```

## Useful Commands

Typecheck frontend:

```bash
npm run typecheck
```

Build frontend:

```bash
npm run build
```

Start production frontend:

```bash
npm run start
```

Clean Next cache:

```bash
npm run clean:next
```

Run backend manually:

```bash
npm --prefix ../../backend run start:dev:shared
```

## Database

Main database:

```sql
cyber_academy
```

Common tables:

- `users`
- `students`
- `student_profiles`
- `jobs`
- `courses`
- `applications`
- `assignment_security_settings`
- `assignment_attempts`
- `assignment_events`
- `resume_analyses`
- `email_otps`
- `password_reset_tokens`
- `email_send_logs`

Connect to MySQL:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u cyber_portal -p
```

Then:

```sql
USE cyber_academy;
SHOW TABLES;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM student_profiles;
SELECT COUNT(*) FROM jobs;
SELECT COUNT(*) FROM courses;
```

The backend creates missing tables on startup through SQLAlchemy.

## Main Features

### Authentication

- Student login
- Registration with OTP
- Email verification
- Forgot password
- Password reset
- Admin-created student login credentials

### Profile

- Student profile details
- Profile photo persistence
- Resume upload persistence
- Resume saved in DB as data URL
- Profile changes saved to MySQL

### Jobs

- Real cybersecurity jobs stored in MySQL
- Entry-level jobs endpoint
- Job search
- Job refresh/scraping
- Job details page
- Admin-ready job upsert endpoints

### Courses

- Courses tab reads from DB using `/api/courses`
- Admin-ready course upsert endpoint
- Dummy courses are only fallback if DB has no courses
- Course cards open course details/content panel

### Resume Intelligence

- Upload PDF/DOCX resume
- Analyze saved profile resume
- Deterministic ATS score
- AI improvement suggestions
- Resume roadmap
- Copy-ready replacement lines
- Duplicate suggestions removed before display

### Secure Assessments

- Safe Mode assessment flow
- Fullscreen requirement
- Tab switch / blur / fullscreen exit monitoring
- Keyboard shortcut blocking
- Auto-save answers
- Auto-submit on timer end
- Attempt tracking
- Admin-ready endpoints for attempts and submitted answers

### Email

Uses Gmail SMTP.

Email templates:

- Email verification
- OTP verification
- Password reset
- Welcome email
- Login credentials email

## Important API Areas

Student/profile:

```text
GET  /api/student-profile
PUT  /api/student-profile
GET  /api/courses
```

Authentication:

```text
POST /api/auth/login
POST /api/auth/register
POST /api/auth/verify-otp
POST /api/auth/resend-otp
POST /api/auth/password-reset/request
POST /api/auth/password-reset/confirm
```

Jobs:

```text
GET  /api/jobs/entry-level
GET  /api/jobs/search
GET  /api/jobs/locations
GET  /api/jobs/{job_id}
POST /api/jobs/refresh
```

Resume:

```text
POST /api/resume/analyze
POST /api/resume/analyze-profile
```

Assessments:

```text
GET  /api/assignments
POST /api/assignments/{assignment_id}/start
POST /api/assignments/{attempt_id}/save-answer
POST /api/assignments/{attempt_id}/event
POST /api/assignments/{attempt_id}/terminate
POST /api/assignments/{attempt_id}/submit
```

Admin-ready APIs:

```text
POST /api/admin/students/login-credentials

GET  /api/admin/courses
POST /api/admin/courses

GET  /api/admin/jobs
POST /api/admin/jobs

GET  /api/admin/assessments
POST /api/admin/assessments

GET  /api/assignments/admin/attempts
GET  /api/assignments/admin/attempts/{attempt_id}
GET  /api/assignments/admin/attempts/{attempt_id}/answers
GET  /api/assignments/admin/assignments/{assignment_id}/attempts
```

## Seed Test Student

Development seed script:

```bash
cd backend
python seed_test_student.py
```

Default test login:

```text
Email: vikas@cyberlancers.in
Password: 12345678
```

## Development Notes

- Do not hardcode SMTP passwords.
- Gmail requires App Passwords for SMTP.
- Restart backend after changing SQLAlchemy models.
- If frontend data looks stale, restart Next.js and clear `.next`.
- If profile or resume data is not updating, verify `student_profiles` rows in MySQL.
- If admin-pushed courses do not appear, check `GET /api/courses` and `courses` table.

## Troubleshooting

Check backend health:

```text
GET /api/health
```

Check frontend type errors:

```bash
npm run typecheck
```

Check MySQL data:

```sql
USE cyber_academy;
SELECT id, email, role, is_active FROM users;
SELECT id, email, full_name, resume_file_name FROM student_profiles;
SELECT id, title, status FROM courses;
SELECT id, title, company FROM jobs ORDER BY id DESC LIMIT 20;
```

If Python fails with a Windows logon/session error, restart the terminal or Windows session and retry.
