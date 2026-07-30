# Migration status

## Compatibility

- Legacy FastAPI declarations: 118
- Unique legacy method/path routes: 113
- Duplicate method/path declarations across the two Python services: 5
- NestJS route declarations: 113
- Missing unique routes: 0
- Extra unique routes: 0

Run `npm run audit:routes` to reproduce the comparison.

## Migrated feature groups

- Unified student/admin authentication
- Registration, OTP and password reset
- Admin setup, identity and password reset
- Student profiles and statistics
- Student account provisioning, credential email, password reset, status and deletion
- Global and per-student access controls
- Courses, nested modules/lessons, assignment and publish/draft lifecycle
- Assessment collections and native assessment synchronization
- Secure attempts, question/option randomization, autosave, events, submission, termination and scoring
- Admin result, answer and security-event inspection
- Jobs, application history, recommendations and applied status
- Playwright job refresh and IST scheduling
- Student-configured job-search schedule
- Announcements and direct student messages
- IST daily reminders
- Resume PDF/DOCX extraction, three-day quota, scoring and persisted analysis
- Dashboard, reports, settings, snapshots, audit and integration placeholders
- SMTP, Swagger, Pino, CORS, Helmet, trusted hosts and rate limiting

## Database policy

Prisma was generated with `prisma db pull` from the existing MySQL schema. No migration or destructive seed is executed by build or startup.

## Remaining rollout gate

The code migration is complete and the legacy FastAPI services have been removed. Production-like staging acceptance should still validate real accounts and mail/job providers before public launch.
