import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { FastApiExceptionFilter } from './common/filters/fastapi-exception.filter';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });
  const config = app.get(ConfigService);
  app.useLogger(app.get(Logger));
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(json({ limit: '12mb' }));
  app.use(urlencoded({ extended: true, limit: '12mb' }));
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
