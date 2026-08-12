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
