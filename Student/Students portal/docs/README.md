# Cyber Academy Student Portal

A simplified student portal flow:

- `/` opens the student login page.
- Student email must end with `@cyberlancers.in`.
- Successful login opens `/dashboard/student`.
- The dashboard shows the student assessment interface.
- The Jobs section searches external job platforms through the unified NestJS backend.
- External jobs are normalized and de-duplicated before being shown.

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS
- UI: lucide-react icons, custom responsive dashboard/profile components
- Forms and validation: react-hook-form, Zod
- Backend: NestJS, Prisma, MySQL
- Database: MySQL with SQLAlchemy ORM and PyMySQL driver
- Auth/security groundwork: JWT helpers, passlib bcrypt, restricted student email domain
- Job search: Playwright-powered external scraping with de-duplication
- Tooling: ESLint, TypeScript compiler, PowerShell/Node dev scripts

## Run

Configure MySQL credentials in `backend/.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_NAME=cyber_academy
DB_USER=root
DB_PASSWORD=your_mysql_password
```

The backend creates the `cyber_academy` database and missing tables automatically on startup when the MySQL credentials are valid.


# Daily Database Access Guide

## 1. Start MySQL Service (Windows)

```powershell
net start MySQL80
```

Check if MySQL is running:

```powershell
Get-Service MySQL80
```

Expected output:

```
Status   Name      DisplayName
------   ----      -----------
Running  MySQL80   MySQL80
```

---

## 2. Login to MySQL

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u cyber_portal -p
```

Enter your MySQL password.

---

## 3. Select the Project Database

```sql
USE cyber_academy;
```

---

## 4. Verify Tables

```sql
SHOW TABLES;
```

Expected tables:

```
announcements
applications
companies
departments
email_otps
email_send_logs
jobs
password_reset_tokens
student_profiles
students
users
```

---

## 5. Useful Queries

### Total Jobs

```sql
SELECT COUNT(*) FROM jobs;
```

### Total Students

```sql
SELECT COUNT(*) FROM students;
```

### Total Users

```sql
SELECT COUNT(*) FROM users;
```

### View Latest Jobs

```sql
SELECT id, title, company, platform
FROM jobs
ORDER BY id DESC
LIMIT 10;
```

### View Registered Students

```sql
SELECT * FROM students;
```

### View Registered Users

```sql
SELECT * FROM users;
```

### View OTP Logs

```sql
SELECT * FROM email_otps;
```

### View Email Logs

```sql
SELECT * FROM email_send_logs;
```

---

## 6. Exit MySQL

```sql
EXIT;
```

---

## 7. Start the Project

From the project root:

```powershell
npm run dev:all
```

The backend should report:

```
Checking MySQL connection...
MySQL connection successful.
Starting backend...
Starting frontend...
```

---

## Notes

- Always use the **`cyber_portal`** MySQL user for development.
- Do **not** use the `root` account for running the application.
- Keep MySQL (`MySQL80`) running before starting the backend.
- If the backend reports `Access denied for user`, verify the username/password in `backend/.env`.

```bash
npm install
npm run dev:all
```

Frontend: `http://localhost:3000`

Backend: `http://127.0.0.1:8000`

`npm run dev:all` starts the unified NestJS backend and both portals.

The backend uses Playwright for external job search. On first setup it installs Playwright dependencies and Chromium. Some job platforms may block automated access; the UI will show source warnings instead of duplicate or fake job cards.
