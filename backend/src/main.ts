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
const RECOVER_CA08_ADMIN_PROFILE = 'RECOVER_CA08_ADMIN_PROFILE_V1';

async function recoverCa08AdminProfile(prisma: PrismaService) {
  if (await prisma.audit_logs.findFirst({ where: { action: RECOVER_CA08_ADMIN_PROFILE }, select: { id: true } })) return;

  const email = 'snehajaaanu2@cyberlancers.in';
  const account = await prisma.users.findUnique({
    where: { email },
    include: { students: { include: { departments: true }, orderBy: { id: 'asc' } } },
  });
  const academic = account?.students[0];
  if (!account || !academic) return;
  const existingProfile = await prisma.student_profiles.findUnique({ where: { email } });
  if (existingProfile) {
    if (existingProfile.batch === '2026 A') return;
    await prisma.$transaction([
      prisma.student_profiles.update({ where: { id: existingProfile.id }, data: { batch: '2026 A', updated_at: new Date() } }),
      prisma.audit_logs.create({
        data: {
          actor_email: 'system', action: RECOVER_CA08_ADMIN_PROFILE,
          target_type: 'student', target_id: String(existingProfile.id),
          details: JSON.stringify({ email, previous_batch: existingProfile.batch, batch: '2026 A', recovery: 'existing-profile-batch' }),
          created_at: new Date(),
        },
      }),
    ]);
    return;
  }

  const storedUsn = academic.usn.trim().replace(/\s+/g, ' ');
  const registrationNumber = /^(?:2026)\s*[-\u2013\u2014]\s*(.+)$/.exec(storedUsn)?.[1]?.trim() || storedUsn;
  const registrationOwner = await prisma.student_profiles.findFirst({
    where: { OR: [{ registration_number: registrationNumber }, { cyberlancers_id: registrationNumber }] },
    select: { id: true },
  });
  if (registrationOwner) return;

  await prisma.$transaction(async (tx) => {
    const profile = await tx.student_profiles.create({
      data: {
        email,
        full_name: academic.full_name.trim() || 'Sneha S',
        first_name: academic.full_name.trim().split(/\s+/)[0] || 'Sneha',
        cyberlancers_id: '', registration_number: registrationNumber,
        phone: '', gender: '', date_of_birth: '', tag: 'Profile Pending',
        batch: '2026 A', course: '', college: '',
        department: academic.departments?.name ?? '',
        status: 'Waiting for Student', resume_url: academic.resume_url ?? '',
        mentor_name: '', updated_at: new Date(),
      },
    });
    await tx.portal_access_settings.upsert({
      where: { scope_key: email },
      create: {
        scope_key: email, courses_enabled: false, assessments_enabled: false,
        jobs_enabled: false, updated_by: 'system-recovery', updated_at: new Date(),
      },
      update: {},
    });
    await tx.audit_logs.create({
      data: {
        actor_email: 'system', action: RECOVER_CA08_ADMIN_PROFILE,
        target_type: 'student', target_id: String(profile.id),
        details: JSON.stringify({ email, academic_student_id: academic.id, registration_number: registrationNumber, batch: '2026 A' }),
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
  await recoverCa08AdminProfile(app.get(PrismaService));
  await assignExistingContentToCurrentBatch(app.get(PrismaService));
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
