# Hostinger Cloud deployment

Hostinger Cloud runs managed Node.js web apps. It does not run this repository's
`deployment/compose.yaml`, because Docker Compose requires a VPS. Deploy the
same Git repository as **three Node.js Web Apps** in hPanel instead.

## Before deploying

1. Use Node.js 22 in every app.
2. Create a Hostinger MySQL database and import the existing Cyber Academy
   database schema and data. Do not point production at the local `127.0.0.1`
   database URL.
3. Add the DNS records for these domains before assigning them in hPanel:

   - `academy.your-domain.com` - Student portal
   - `admin.academy.your-domain.com` - Admin portal
   - `api.academy.your-domain.com` - NestJS API

4. Use a single, long random JWT secret for the API. Never use the example
   values from `.env.example`.

## App 1: API

Create a Node.js Web App for `api.academy.your-domain.com` from this repository.
Set its build command to:

```text
npm run hostinger:build:api
```

Set its start command to:

```text
npm run hostinger:start:api
```

Set these environment variables in hPanel. Replace every placeholder with the
values supplied by Hostinger MySQL and your real domains:

```dotenv
NODE_ENV=production
DATABASE_URL=mysql://DATABASE_USER:URL_ENCODED_PASSWORD@DATABASE_HOST:3306/DATABASE_NAME
JWT_SECRET=GENERATE_A_UNIQUE_SECRET_AT_LEAST_64_CHARACTERS
ACCESS_TOKEN_MINUTES=1440
CORS_ORIGINS=https://academy.your-domain.com,https://admin.academy.your-domain.com
TRUSTED_HOSTS=api.academy.your-domain.com
STUDENT_FRONTEND_URL=https://academy.your-domain.com
ADMIN_FRONTEND_URL=https://admin.academy.your-domain.com
STUDENT_EMAIL_DOMAIN=cyberlancers.in
ADMIN_EMAIL_DOMAIN=cyberlancers.in
ADMIN_SETUP_TOKEN=GENERATE_A_DIFFERENT_LONG_RANDOM_TOKEN
ENABLE_SWAGGER=false
SMTP_HOST=YOUR_SMTP_HOST
SMTP_PORT=587
SMTP_USER=YOUR_SMTP_USERNAME
SMTP_PASSWORD=YOUR_SMTP_APP_PASSWORD
SMTP_FROM_EMAIL=no-reply@your-domain.com
SMTP_FROM_NAME=Cyber Academy
SMTP_TLS=true
NVIDIA_API_KEY=
NVIDIA_MODEL=meta/llama-3.3-70b-instruct
```

Do not set `PORT`; Hostinger supplies it to the managed process.

## App 2: Student portal

Create a second Node.js Web App for `academy.your-domain.com`, using the same
repository. Set:

```text
Build: npm run hostinger:build:student
Start: npm run hostinger:start:student
```

Set these build/runtime environment variables:

```dotenv
NEXT_PUBLIC_API_URL=https://api.academy.your-domain.com
NEXT_PUBLIC_ADMIN_PORTAL_URL=https://admin.academy.your-domain.com
```

## App 3: Admin portal

Create a third Node.js Web App for `admin.academy.your-domain.com`, using the
same repository. Set:

```text
Build: npm run hostinger:build:admin
Start: npm run hostinger:start:admin
```

Set:

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://api.academy.your-domain.com
NEXT_PUBLIC_STUDENT_API_BASE_URL=https://api.academy.your-domain.com
NEXT_PUBLIC_STUDENT_PORTAL_URL=https://academy.your-domain.com
NEXT_PUBLIC_STUDENT_PORTAL_LINK=https://academy.your-domain.com
NEXT_PUBLIC_DEFAULT_SENDER_EMAIL=no-reply@your-domain.com
```

## Verification after each deployment

1. Confirm `https://api.academy.your-domain.com/health` returns a JSON `ok`
   response.
2. Sign in through the Student portal and save a profile with a photo/resume.
3. Sign in through the Admin portal, create a course and an assessment, then
   reload the page to confirm the data is still present.
4. Send one non-production test credential email and verify delivery before
   inviting real students.
5. Check the Node.js runtime logs in hPanel after the first profile save and
   the first SMTP message.

Hostinger manages TLS certificates and reverse-proxy routing for these Node.js
apps. Do not deploy the Docker Compose/Caddy configuration on a Cloud plan.
