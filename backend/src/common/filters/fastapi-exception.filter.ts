import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class FastApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(FastApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') return response.status(status).json({ detail: body });
      const record = body as Record<string, unknown>;
      const message = record.message;
      if (Array.isArray(message)) {
        return response.status(status === HttpStatus.BAD_REQUEST ? 422 : status).json({
          detail: message.map((item) => ({
            type: 'value_error',
            loc: ['body'],
            msg: String(item),
          })),
        });
      }
      if (record.error && Object.keys(record).some((key) => !['statusCode', 'message'].includes(key))) {
        const detail = { ...record };
        delete detail.statusCode;
        return response.status(status).json({ detail });
      }
      return response.status(status).json({
        detail: record.detail ?? message ?? exception.message,
      });
    }

    // Prisma's expected data-integrity failures are user-actionable, not server
    // crashes. Returning a clear 4xx response prevents CRUD screens from showing
    // a misleading "Internal server error" for duplicate or invalid records.
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const target = Array.isArray(exception.meta?.target)
        ? exception.meta.target.join(', ')
        : String(exception.meta?.target ?? 'record');
      if (exception.code === 'P2002') {
        return response.status(HttpStatus.CONFLICT).json({ detail: `A record with the same ${target} already exists.` });
      }
      if (exception.code === 'P2003') {
        return response.status(HttpStatus.CONFLICT).json({ detail: 'This change conflicts with related records.' });
      }
      if (exception.code === 'P2025') {
        return response.status(HttpStatus.NOT_FOUND).json({ detail: 'The requested record no longer exists.' });
      }
    }
    if (exception instanceof Prisma.PrismaClientValidationError || exception instanceof Prisma.PrismaClientUnknownRequestError) {
      this.logger.error(exception.message, exception.stack);
      return response.status(HttpStatus.UNPROCESSABLE_ENTITY).json({ detail: 'The submitted data could not be stored. Check field lengths and required values.' });
    }
    this.logger.error(exception instanceof Error ? exception.message : String(exception), exception instanceof Error ? exception.stack : undefined);
    return response.status(500).json({ detail: 'Internal server error' });
  }
}
