import {
  Body, Controller, Get, GoneException, Headers, Post, UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { AdminRegisterDto, AdminResetConfirmDto, EmailDto, LoginDto } from './dto/auth.dto';

const ADMIN_ROLES = ['admin', 'super_admin', 'course_admin', 'placement_admin', 'student_admin'];

@Controller('api/admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() dto: AdminRegisterDto, @Headers('x-admin-setup-token') token?: string) {
    return this.auth.registerAdmin(dto.name, dto.email, dto.password, token);
  }

  @Post('login')
  login(@Body() _dto: LoginDto) {
    throw new GoneException('Use the unified Cyber Academy login');
  }

  @Post('password-reset/request')
  resetRequest(@Body() dto: EmailDto) { return this.auth.requestAdminReset(dto.email); }

  @Post('password-reset/confirm')
  resetConfirm(@Body() dto: AdminResetConfirmDto) {
    return this.auth.confirmAdminReset(dto.token, dto.password);
  }

  @Post('logout')
  logout() { return { message: 'Logged out' }; }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...ADMIN_ROLES)
  me(@CurrentUser() user: AuthenticatedUser) { return this.auth.adminMe(user.sub); }
}
