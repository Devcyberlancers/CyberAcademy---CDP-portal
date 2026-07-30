# Hostinger Web Apps deployment

This backend is compatible with Hostinger's managed Node.js Web Apps deployment model and does not require Docker.

## Application settings

- Application root: `backend`
- Framework: NestJS
- Node.js: 22.x
- Package manager: npm
- Install: `npm ci`
- Build: `npm run playwright:install && npm run deploy:build`
- Start: `npm run start:production`
- Health check: `/health`

The application listens on `0.0.0.0` and uses Hostinger's injected `PORT`.

## Required environment variables

Import values based on `.env.example` through hPanel. Do not upload a production `.env` to source control.

Required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `TRUSTED_HOSTS`
- `STUDENT_EMAIL_DOMAIN`
- `ADMIN_EMAIL_DOMAIN`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME=Cyber Academy`
- `STUDENT_FRONTEND_URL`
- `ADMIN_FRONTEND_URL`

Optional:

- `ADMIN_SETUP_TOKEN`
- `NVIDIA_API_KEY`
- `NVIDIA_MODEL`
- `ENABLE_SWAGGER=false`

`DATABASE_URL` must use the existing MySQL database:

```text
mysql://USER:URL_ENCODED_PASSWORD@HOST:3306/cyber_academy
```

URL-encode special characters in the username and password.

Set `CORS_ORIGINS` to the exact HTTPS origins of both frontends, comma-separated. Set `TRUSTED_HOSTS` to the API domain and any Hostinger temporary domain used during staging.

## Playwright

The build command installs Chromium. Set `PLAYWRIGHT_BROWSERS_PATH=0` so the browser is installed with the application bundle. If the managed Web Apps runtime prevents Chromium from launching because OS libraries or sandbox features are unavailable, deploy this backend on a Hostinger VPS; the rest of the application remains unchanged.

Job refresh failures are returned as structured source errors and do not crash the API.

## Safe rollout

1. Back up the existing `cyber_academy` database.
2. Deploy NestJS to a staging API subdomain.
3. Run the verification commands and health check.
5. Test both frontends against staging without changing their application code; change only deployment environment API base URLs.
6. Verify emails use the Cyber Academy sender and reach the intended recipient.
7. Verify existing bcrypt credentials and admin-issued credentials.
8. Verify course publishing, assessment attempt limits/results, access toggles, student deletion and applied-job history.
9. Switch the API DNS/base URL only after acceptance.
9. Keep a database backup and the previous NestJS container image as the rollback target until production acceptance is complete.

## Process considerations

Use one backend instance while the built-in reminder and job-refresh schedules are active. Multiple replicas would require a distributed scheduler lock before scaling horizontally.
