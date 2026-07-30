import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  EmailDto,
  LoginDto,
  MailCodeDto,
  PasswordResetConfirmDto,
  RegisterDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { MailService } from '../mail/mail.service';

@Controller('api')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly mail: MailService,
  ) {}

  @Post('auth/login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('auth/register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('auth/verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto);
  }

  @Post('auth/resend-otp')
  resendOtp(@Body() dto: EmailDto) {
    return this.auth.resendOtp(dto.email);
  }

  @Post('auth/password-reset/request')
  requestReset(@Body() dto: EmailDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('auth/password-reset/confirm')
  confirmReset(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.confirmPasswordReset(dto);
  }

  @Post('email/test')
  async emailTest(@Body() dto: EmailDto) {
    try {
      await this.mail.sendWelcome(dto.email.toLowerCase(), 'SMTP Test');
      return { ok: true, message: 'SMTP test email sent' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  @Post('mail/verification')
  async mailVerification(@Body() dto: MailCodeDto) {
    await this.mail.sendVerification(dto.email.toLowerCase(), dto.code);
    return { ok: true, message: 'Verification email sent' };
  }

  @Post('mail/password-reset')
  async mailPasswordReset(@Body() dto: MailCodeDto) {
    await this.mail.sendPasswordReset(dto.email.toLowerCase(), dto.code);
    return { ok: true, message: 'Password reset email sent' };
  }
}
