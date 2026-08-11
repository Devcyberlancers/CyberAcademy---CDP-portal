import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: AuthenticatedUser) {
    if (payload.role === 'student') {
      const user = await this.prisma.users.findUnique({
        where: { email: payload.sub },
        include: { password_security: true },
      });
      if (!user || !user.is_active || user.role !== 'student') {
        throw new UnauthorizedException('Student account no longer exists or is inactive');
      }
      if (!user.password_security || user.password_security.must_change_password) {
        throw new UnauthorizedException('Password change required before portal access');
      }
      const passwordChangedAt = user.password_security.password_changed_at;
      if (passwordChangedAt && (!payload.iat || payload.iat * 1000 < passwordChangedAt.getTime())) {
        throw new UnauthorizedException('Session expired because the password was changed');
      }
    }
    if (['admin', 'super_admin', 'course_admin', 'placement_admin', 'student_admin'].includes(payload.role)) {
      const admin = await this.prisma.admin_users.findUnique({ where: { email: payload.sub } });
      if (!admin || !admin.is_active) throw new UnauthorizedException('Admin account no longer exists or is inactive');
    }
    return payload;
  }
}
