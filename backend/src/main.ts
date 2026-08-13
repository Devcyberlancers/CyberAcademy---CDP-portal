import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { FastApiExceptionFilter } from './common/filters/fastapi-exception.filter';
import { PrismaService } from './prisma/prisma.service';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';

const CURRENT_STUDENT_BATCH_MIGRATION = 'CONSOLIDATE_EXISTING_STUDENTS_TO_2026_A_V1';
const CURRENT_CONTENT_BATCH_MIGRATION = 'ASSIGN_EXISTING_CONTENT_TO_2026_A_V1';
const DELETE_SNEHA_CA08 = 'DELETE_SNEHA_CA08_V1';

async function deleteSnehaCa08(prisma: PrismaService) {
  if (await prisma.audit_logs.findFirst({ where: { action: DELETE_SNEHA_CA08 }, select: { id: true } })) return;
  const email = 'snehajaaanu2@cyberlancers.in';
  const profile = await prisma.student_profiles.findFirst({
    where: {
      email,
      personal_email: 'snehajaaanu2@gmail.com',
      registration_number: 'CA08',
    },
  });
  if (!profile) return;
  const user = await prisma.users.findUnique({ where: { email }, include: { students: true } });
  const studentIds = user?.students.map((student) => student.id) ?? [];
  await prisma.$transaction(async (tx) => {
    const attempts = await tx.assignment_attempts.findMany({
      where: {
        OR: [
          { student_email: email },
          ...(studentIds.length ? [{ student_id: { in: studentIds } }] : []),
        ],
      },
      select: { id: true },
    });
    await tx.assignment_events.deleteMany({ where: { attempt_id: { in: attempts.map((attempt) => attempt.id) } } });
    await tx.assignment_attempts.deleteMany({ where: { id: { in: attempts.map((attempt) => attempt.id) } } });
    if (studentIds.length) {
      await tx.student_course_assignments.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.resume_analyses.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.assessment_submissions.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.applications.deleteMany({ where: { student_id: { in: studentIds } } });
      await tx.students.deleteMany({ where: { id: { in: studentIds } } });
    }
    await tx.admin_student_messages.deleteMany({ where: { student_email: email } });
    await tx.student_daily_reminders.deleteMany({ where: { student_email: email } });
    await tx.student_job_search_preferences.deleteMany({ where: { student_email: email } });
    await tx.portal_access_settings.deleteMany({ where: { scope_key: email } });
    await tx.email_otps.deleteMany({ where: { email } });
    await tx.password_reset_tokens.deleteMany({ where: { email } });
    await tx.admin_snapshots.deleteMany({ where: { key: { endsWith: email } } });
    await tx.student_profiles.delete({ where: { id: profile.id } });
    if (user) await tx.users.delete({ where: { id: user.id } });
    await tx.audit_logs.create({
      data: {
        actor_email: 'system', action: DELETE_SNEHA_CA08,
        target_type: 'student', target_id: String(profile.id),
        details: JSON.stringify({ name: 'Sneha S', email, personal_email: profile.personal_email, registration_number: 'CA08', permanently_deleted: true }),
        created_at: new Date(),
      },
    });
  });
}

async function consolidateExistingStudentsIntoCurrentBatch(prisma: PrismaService) {
  const alreadyApplied = await prisma.audit_logs.findFirst({
    where: { action: CURRENT_STUDENT_BATCH_MIGRATION },
    select: { id: true },
  });
  if (alreadyApplied) return;

  await prisma.$transaction(async (tx) => {
    const result = await tx.student_profiles.updateMany({
      data: { batch: '2026 A', updated_at: new Date() },
    });
    await tx.audit_logs.create({
      data: {
        actor_email: 'system',
        action: CURRENT_STUDENT_BATCH_MIGRATION,
        target_type: 'student_profiles',
        target_id: '2026 A',
        details: JSON.stringify({ updated_students: result.count, batch: '2026 A' }),
        created_at: new Date(),
      },
    });
  });
}

async function assignExistingContentToCurrentBatch(prisma: PrismaService) {
  if (await prisma.audit_logs.findFirst({ where: { action: CURRENT_CONTENT_BATCH_MIGRATION }, select: { id: true } })) return;
  await prisma.$transaction(async (tx) => {
    const courses = await tx.courses.findMany();
    for (const course of courses) {
      const metadata = course.metadata_json && typeof course.metadata_json === 'object' && !Array.isArray(course.metadata_json) ? course.metadata_json : {};
      await tx.courses.update({ where: { id: course.id }, data: { metadata_json: { ...metadata, target_batch: '2026 A' }, updated_at: new Date() } });
    }
    const collections = await tx.assessment_collections.findMany({ where: { storage_key: { not: { contains: ':batch:' } } } });
    for (const collection of collections) {
      await tx.assessment_collections.upsert({
        where: { storage_key: `${collection.storage_key}:batch:2026 A` },
        create: { storage_key: `${collection.storage_key}:batch:2026 A`, kind: collection.kind, course_key: collection.course_key, payload: collection.payload, updated_at: new Date() },
        update: { payload: collection.payload, updated_at: new Date() },
      });
    }
    await tx.jobs.updateMany({ data: { platform: 'admin:2026 A', updated_at: new Date() } });
    await tx.audit_logs.create({ data: { actor_email: 'system', action: CURRENT_CONTENT_BATCH_MIGRATION, target_type: 'content', target_id: '2026 A', details: JSON.stringify({ courses: courses.length, assessments: collections.length }), created_at: new Date() } });
  });
}

function normalizeEmailFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeEmailFields);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    if (typeof item === 'string' && /(^|_)email$/i.test(key)) {
      record[key] = item.trim().toLowerCase();
    } else {
      record[key] = normalizeEmailFields(item);
    }
  }
  return record;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get(ConfigService);
  await consolidateExistingStudentsIntoCurrentBatch(app.get(PrismaService));
  await assignExistingContentToCurrentBatch(app.get(PrismaService));
  await deleteSnehaCa08(app.get(PrismaService));
  app.useLogger(app.get(Logger));
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));
  app.use((request: Request, _response: Response, next: NextFunction) => {
    if (request.body) normalizeEmailFields(request.body);
    next();
  });
  app.use(helmet({ contentSecurityPolicy: false }));
  app.enableCors({
    origin: config.get<string[]>('corsOrigins') ?? [],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Setup-Token'],
  });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: false }));
  app.useGlobalFilters(new FastApiExceptionFilter());
  app.enableShutdownHooks();

  if (config.get<string>('nodeEnv') !== 'production' || config.get<boolean>('enableSwagger')) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Cyber Academy API').setVersion('1.0').addBearerAuth().build(),
    );
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(config.get<number>('port') ?? 8000, '0.0.0.0');
}

void bootstrap();
