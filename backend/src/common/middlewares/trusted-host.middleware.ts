import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class TrustedHostMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: Request, _response: Response, next: NextFunction) {
    const allowed = this.config.get<string[]>('trustedHosts') ?? [];
    const hostname = request.hostname.toLowerCase();
    if (allowed.length && !allowed.includes(hostname)) throw new BadRequestException('Invalid host header');
    next();
  }
}
