# Cyber Academy production deployment on Hostinger

This deployment runs one unified NestJS API, one shared MySQL database, both Next.js applications, and Caddy for automatic HTTPS.

## Required Hostinger product

Use a Hostinger VPS with Ubuntu 24.04 and Docker. A Next.js-only Web App plan is not enough because the system also requires the NestJS API, MySQL, scheduled background jobs, Playwright, and a shared private network.

Recommended minimum for initial production use:

- 4 GB RAM
- 2 vCPU
- 50 GB SSD
- Ubuntu 24.04 with Docker

## DNS records

Create four `A` records pointing to the VPS public IPv4 address:

| Host | Purpose |
| --- | --- |
| `academy.cyberlancers.in` | Unified Student/Admin login and Student portal |
| `admin.academy.cyberlancers.in` | Admin portal |
| `api.academy.cyberlancers.in` | Unified API (Student hostname) |
| `admin-api.academy.cyberlancers.in` | Unified API (Admin-compatible hostname) |

Ports 80 and 443 must be open in the Hostinger firewall. Do not expose ports 3000, 3001, 8000, or 3306 publicly.

## First deployment

1. Upload or clone the complete `CyberAcademy` directory onto the VPS.
2. Open the deployment directory:

   ```bash
   cd CyberAcademy/deployment
   ```

3. Create the production environment file:

   ```bash
   cp .env.example .env
   chmod 600 .env
   ```

4. Replace every `CHANGE_ME` value. Generate secrets with:

   ```bash
   openssl rand -base64 48
   ```

   Use the exact same `JWT_SECRET` for both APIs. Use URL-safe database passwords without spaces.

5. Run the production preflight check:

   ```bash
   bash preflight.sh
   ```

   This rejects missing values, placeholder or short secrets, malformed domain entries, and invalid Compose configuration without printing secrets.

6. Build and start:

   ```bash
   docker compose config
   docker compose build
   docker compose up -d
   docker compose ps
   ```

7. Watch startup:

   ```bash
   docker compose logs -f --tail=100
   ```

Caddy automatically requests and renews TLS certificates after all DNS records resolve to the VPS.

## Create the first administrator

After all containers are healthy, create the first administrator through the protected setup endpoint:

```bash
curl -X POST "https://api.academy.cyberlancers.in/api/admin/auth/register" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Setup-Token: YOUR_ADMIN_SETUP_TOKEN" \
  -d '{"name":"Administrator","email":"admin@cyberlancers.in","password":"CHANGE_THIS_PASSWORD"}'
```

The Admin email must be a real `@cyberlancers.in` account. Sign in through `https://academy.cyberlancers.in`; Admin users are redirected to the Admin portal.

## Updating

```bash
cd CyberAcademy
git pull
cd deployment
docker compose build
docker compose up -d --remove-orphans
docker image prune -f
```

Next.js `NEXT_PUBLIC_*` values are build-time values, so rebuild both web images whenever a domain changes.

## Backups

Create a database backup:

```bash
docker compose exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction "$MYSQL_DATABASE"' > cyber_academy-$(date +%F).sql
```

Keep encrypted backups outside the VPS. Test restoration before launch and at least monthly.

## Operational checks

```bash
curl -fsS https://api.academy.cyberlancers.in/health
curl -fsS https://admin-api.academy.cyberlancers.in/health
docker compose ps
docker compose logs --since=30m api
```

Production safeguards included in the application:

- refuses placeholder/short JWT secrets;
- refuses localhost CORS origins;
- APIs trust only configured production hosts;
- API documentation is disabled;
- MySQL and internal services are not published to the internet;
- containers run as non-root users where application execution permits;
- health checks and automatic restarts are enabled;
- `.env`, virtual environments, build output, and logs are excluded from Docker build contexts.

## SMTP sender requirement

To display `Cyber Academy <bhargav@cyberlancers.in>`, the SMTP account must be authorized to send as `bhargav@cyberlancers.in`. A personal Gmail SMTP account can rewrite the visible sender address. Use Cyber Lancers/Google Workspace SMTP credentials or configure the address as a verified sender alias.
