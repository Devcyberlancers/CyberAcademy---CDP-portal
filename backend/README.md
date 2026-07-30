# Cyber Academy Unified Backend

Unified production NestJS backend for the Cyber Academy Student and Admin portals.

The original Python services remain in the repository during rollout. This backend uses the existing `cyber_academy` MySQL database without schema migrations or destructive seed operations.

## Technology

- NestJS 11 and TypeScript
- Prisma ORM with the existing MySQL schema
- Passport JWT/local-compatible authentication
- bcrypt-compatible legacy password verification
- Nodemailer
- Playwright Chromium job collection
- Multer PDF/DOCX uploads
- `@nestjs/schedule`
- Helmet, CORS, throttling and Pino
- Swagger
- Jest

## Local setup

1. Copy `.env.example` to `.env` and enter the existing database and service credentials.
2. Install packages:

   ```powershell
   npm ci
   ```

3. Install Chromium for job collection:

   ```powershell
   npm run playwright:install
   ```

4. Generate Prisma Client and build:

   ```powershell
   npm run deploy:build
   ```

5. Start:

   ```powershell
   npm run start:production
   ```

Health checks are available at `/health` and `/api/health`. Swagger is available at `/docs` only when `ENABLE_SWAGGER=true`.

## Verification

```powershell
npm test -- --runInBand
npm run typecheck
npm run build
npm run audit:routes
npm audit --omit=dev
```

The route audit checks the unified NestJS backend for duplicate method/path declarations.

## Cutover rule

The legacy FastAPI backends have been retired. This service is the only application API.

See [HOSTINGER_DEPLOYMENT.md](./HOSTINGER_DEPLOYMENT.md) for deployment and rollback instructions.
