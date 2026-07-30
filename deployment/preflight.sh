#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: Docker Compose v2 is not installed." >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "ERROR: deployment/.env is missing. Copy .env.example to .env first." >&2
  exit 1
fi

if grep -Eq '(^|=)(CHANGE_ME|your_|change-me)' .env; then
  echo "ERROR: deployment/.env still contains placeholder values." >&2
  exit 1
fi

required_vars="
STUDENT_DOMAIN
ADMIN_DOMAIN
STUDENT_API_DOMAIN
ADMIN_API_DOMAIN
MYSQL_DATABASE
MYSQL_USER
MYSQL_PASSWORD
MYSQL_ROOT_PASSWORD
JWT_SECRET
ADMIN_SETUP_TOKEN
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASSWORD
SMTP_FROM_EMAIL
"

for name in $required_vars; do
  value=$(grep -E "^${name}=" .env | tail -n 1 | cut -d= -f2- || true)
  if [ -z "$value" ]; then
    echo "ERROR: $name is missing or empty in deployment/.env." >&2
    exit 1
  fi
done

jwt_secret=$(grep '^JWT_SECRET=' .env | tail -n 1 | cut -d= -f2-)
if [ "${#jwt_secret}" -lt 32 ]; then
  echo "ERROR: JWT_SECRET must contain at least 32 characters." >&2
  exit 1
fi

if grep -E '^(STUDENT_DOMAIN|ADMIN_DOMAIN|STUDENT_API_DOMAIN|ADMIN_API_DOMAIN)=.*(localhost|127\.0\.0\.1|https?://|/)' .env >/dev/null; then
  echo "ERROR: Domain values must be plain public hostnames without scheme, path, or localhost." >&2
  exit 1
fi

docker compose --env-file .env config --quiet
echo "OK: Cyber Academy production configuration passed preflight checks."
