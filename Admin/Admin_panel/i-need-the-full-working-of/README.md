# Cyber Academy Admin Portal

This repository now contains a starter implementation for the admin panel requested for the existing student web portal.

## Tech Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- UI: lucide-react icons and custom responsive admin components
- Forms and validation: react-hook-form and Zod
- Backend: shared NestJS API with Prisma
- Database: MySQL with Prisma
- Auth: JWT, bcrypt, restricted admin email domain, protected admin write APIs
- Job scraping groundwork: Playwright service module with de-duplication boundary

## Run Both With One Command

From this folder:

```powershell
npm run start:all
```

This starts:

- Unified login and Student frontend: `http://localhost:3000`
- Unified API: `http://localhost:8000`
- Admin frontend: `http://localhost:3001`
- Unified backend: `http://localhost:8000/health`

Press `Ctrl+C` in the same terminal to stop both servers.

## Frontend Only

```powershell
cd frontend
npm install
npm.cmd run dev
```

Open:

```text
http://localhost:3001/admin/login
```

Administrators use the same login page as students. No predictable administrator is created
automatically; create an administrator through the account setup API or migrate an existing
`admin_users` account, then sign in at `http://localhost:3000`.

For the first administrator, set a long random `ADMIN_SETUP_TOKEN` in `backend/.env`, call
`POST /api/admin/auth/register` once with that value in the `X-Admin-Setup-Token` header, and then
remove the token. The created account is written to shared `users` with role `admin`, so all future
sign-ins happen through the unified Student Portal login.

## Backend Only

```powershell
npm --prefix ../../../backend run start:dev:shared
```

Health check:

```text
http://localhost:8000/health
```

## MySQL + Email Setup

Copy the example env files before deployment:

```powershell
copy ..\..\..\backend\.env.example ..\..\..\backend\.env
copy frontend\.env.local.example frontend\.env.local
```

Update the root `backend\.env`:

```text
DATABASE_URL=mysql://cyber_portal:your_mysql_password@127.0.0.1:3306/cyber_academy
JWT_SECRET=use-a-long-random-secret-before-deploy
```

Both portals use the Student Portal's `cyber_academy` database. The Admin backend maps the shared
`users`, `students`, `student_profiles`, `courses`, `jobs`, and `applications` tables using the same
column definitions. The unified NestJS backend uses the same database for both portals and does
not maintain a second Admin database.

For real outgoing credential emails, fill:

```text
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_TLS=true
SMTP_FROM_EMAIL=admin@cyberlancers.in
SMTP_FROM_NAME=Cyber Academy
```

If SMTP is not filled, the backend returns email preview mode instead of crashing.

## Implemented Admin Pages

- `/admin/login`
- `/admin/dashboard`
- `/admin/courses`
- `/admin/courses/new`
- `/admin/courses/[id]/edit`
- `/admin/assignments`
- `/admin/jobs`
- `/admin/students`
- `/admin/students/[id]`
- `/admin/security`
- `/admin/reports`
- `/admin/settings`

## Client Testing And Database Mode

The dashboard still updates immediately for smooth client demos, but important deployment data now syncs to the backend:

- Admin login uses the unified NestJS API and stores a JWT token.
- Student account creation writes to the MySQL `students` table.
- Credential email sending calls the backend SMTP/preview mail service.
- Course banners, course modules, and course assessments persist in the MySQL `admin_snapshots` table per course.
- Browser `localStorage` remains only as a quick offline fallback.

Testable flows:

- Approve/reject new student registrations from Dashboard.
- Watch Dashboard counts update after approval/rejection.
- Approved registrations appear in Students as normal student accounts.
- Search and tab-filter students.
- Open student details from the Students table.
- Send message, assign course, reset password, and suspend account from Student Details.
- Student activity notes update after admin actions.
- Change course banner and keep it after navigating away and back.
- Build course modules with YouTube or uploaded teaching videos.
- Upload module images and supporting resource files.
- Generate a 7-question quiz after each module based on the module/video context.
- Lock the next module until video completion, quiz pass, or manual admin unlock.
- Store different course banners/modules/assessments for each course id.

Course editor requirements inspired by common LMS patterns:

- Infosys Springboard style: module-by-module learning path with completion gates.
- Udemy style: video lecture source, resources, and lecture-level content management.
- Coursera style: quiz after lesson/module and controlled progression.

## Backend API Groups

- `/api/admin/auth`
- `/api/admin/dashboard`
- `/api/admin/courses`
- `/api/admin/jobs`
- `/api/admin/students`
- `/api/admin/snapshots`
- `/api/admin/security`
- `/api/admin/reports`
- `/api/admin/settings`

## Next Work

1. Replace demo admin user with database-backed admin users.
2. Add Alembic migrations for production schema changes.
3. Move uploaded files/videos from browser data URLs to object storage or server file storage.
4. Add real Playwright scraping rules for selected job sources.
5. Add audit log writes for every admin action.
6. Connect the separate student portal frontend to the same `/api/admin/students` and course snapshot data.
