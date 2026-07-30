import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(error: unknown, user: TUser): TUser {
    if (error || !user) throw error || new UnauthorizedException('Invalid token');
    return user;
  }
}
