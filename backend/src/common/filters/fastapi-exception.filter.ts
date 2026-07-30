import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class FastApiExceptionFilter implements ExceptionFilter {
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
    return response.status(500).json({ detail: 'Internal server error' });
  }
}
