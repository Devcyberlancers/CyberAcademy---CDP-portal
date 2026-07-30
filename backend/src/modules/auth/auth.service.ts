import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { admin_users_role, Prisma, users_role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomInt, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  LoginDto,
  PasswordResetConfirmDto,
  RegisterDto,
  VerifyOtpDto,
} from './dto/auth.dto';

const OTP_EXPIRY_MINUTES = 10;
const RESET_EXPIRY_MINUTES = 15;
const MAX_OTP_RESENDS = 5;
const MAX_OTP_VERIFY_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private hashSecret(value: string) {
    return createHash('sha256')
      .update(`${this.config.get<string>('jwt.secret')}:${value}`, 'utf8')
      .digest('hex');
  }

  private hashMatches(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async logEmail(recipient: string, subject: string, template: string, success: boolean, error?: string) {
    await this.prisma.email_send_logs.create({
      data: { recipient, subject, template, success, error_message: error ?? null, created_at: new Date() },
    });
  }

  async signToken(email: string, role: string, extra: Record<string, unknown> = {}) {
    return this.jwt.signAsync({ sub: email, role, ...extra });
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.users.findFirst({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.hashed_password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.is_active) throw new ForbiddenException('Account is not active. Verify your email OTP first.');
    const domain = this.config.get<string>('studentEmailDomain');
    if (user.role === users_role.student && !user.email.toLowerCase().endsWith(`@${domain}`)) {
      throw new ForbiddenException(`Student email must end with @${domain}`);
    }
    const profile = await this.prisma.student_profiles.findUnique({ where: { email: user.email } });
    const name = profile?.full_name || user.email.split('@')[0];
    return {
      access_token: await this.signToken(user.email, user.role),
      token_type: 'bearer',
      role: user.role,
      name,
    };
  }

  async validateLocal(email: string, password: string) {
    const user = await this.prisma.users.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.hashed_password))) return null;
    return user;
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const pendingHash = await bcrypt.hash(randomBytes(32).toString('base64url'), 12);
    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    try {
      await this.prisma.$transaction(async (tx) => {
        let user = await tx.users.findUnique({ where: { email } });
        if (user?.is_active) throw new ConflictException('Account already exists');
        user = user
          ? await tx.users.update({
              where: { id: user.id },
              data: { hashed_password: pendingHash, role: users_role.student, is_active: false },
            })
          : await tx.users.create({
              data: {
                email,
                hashed_password: pendingHash,
                role: users_role.student,
                is_active: false,
                created_at: new Date(),
              },
            });

        let department = await tx.departments.findUnique({ where: { code: 'CYBER' } });
        if (!department) {
          department = await tx.departments.create({ data: { name: 'Cyber Security', code: 'CYBER' } });
        }
        const fullName = dto.full_name.trim() || email.split('@')[0];
        const usn = (dto.cyberlancers_id.trim() || email.split('@')[0]).slice(0, 40);
        const academic = await tx.students.findFirst({ where: { user_id: user.id } });
        if (academic) {
          await tx.students.update({
            where: { id: academic.id },
            data: { department_id: department.id, full_name: fullName, usn },
          });
        } else {
          await tx.students.create({
            data: {
              user_id: user.id,
              department_id: department.id,
              full_name: fullName,
              usn,
              cgpa: new Prisma.Decimal(0),
              skills: '',
              resume_url: null,
            },
          });
        }
        await tx.student_profiles.upsert({
          where: { email },
          update: {
            full_name: dto.full_name.trim(),
            first_name: dto.full_name.trim().split(' ')[0] || '',
            cyberlancers_id: dto.cyberlancers_id.trim(),
            registration_number: dto.cyberlancers_id.trim(),
            personal_email: email,
            status: 'Registration Verified - Awaiting Admin Account',
            updated_at: new Date(),
          },
          create: {
            email,
            full_name: dto.full_name.trim(),
            first_name: dto.full_name.trim().split(' ')[0] || '',
            cyberlancers_id: dto.cyberlancers_id.trim(),
            registration_number: dto.cyberlancers_id.trim(),
            phone: '',
            gender: '',
            date_of_birth: '',
            tag: '',
            batch: '',
            course: '',
            college: '',
            department: '',
            status: 'Registration Verified - Awaiting Admin Account',
            resume_url: '',
            mentor_name: '',
            personal_email: email,
            updated_at: new Date(),
          },
        });
        await tx.email_otps.updateMany({
          where: { email, purpose: 'registration', consumed_at: null },
          data: { consumed_at: new Date() },
        });
        await tx.email_otps.create({
          data: {
            email,
            purpose: 'registration',
            code_hash: this.hashSecret(otp),
            expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000),
            resend_count: 0,
            verify_attempts: 0,
            consumed_at: null,
            last_sent_at: new Date(),
            created_at: new Date(),
          },
        });
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This email or Cyberlancers ID is already registered. Use the existing registration or contact Admin.');
      }
      throw new ServiceUnavailableException('Registration is temporarily unavailable. Please try again shortly.');
    }
    try {
      await this.mail.sendVerification(email, otp);
      await this.logEmail(email, 'Verify your Cyber Academy email', 'email_verification', true);
    } catch (error) {
      await this.logEmail(email, 'Verify your Cyber Academy email', 'email_verification', false, error instanceof Error ? error.message : String(error));
      throw error;
    }
    return { ok: true, message: 'OTP sent to your email' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const email = dto.email.toLowerCase();
    const otp = dto.otp.trim();
    if (!/^\d{6}$/.test(otp)) throw new UnprocessableEntityException('OTP must be 6 digits');
    const record = await this.prisma.email_otps.findFirst({
      where: { email, purpose: 'registration', consumed_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (!record || record.expires_at < new Date()) throw new BadRequestException('OTP expired. Please resend a new OTP.');
    if (record.verify_attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      throw new HttpException('Too many OTP attempts. Please resend a new OTP.', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!this.hashMatches(record.code_hash, this.hashSecret(otp))) {
      await this.prisma.email_otps.update({ where: { id: record.id }, data: { verify_attempts: { increment: 1 } } });
      throw new BadRequestException('Invalid OTP');
    }
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Account not found');
    await this.prisma.email_otps.update({ where: { id: record.id }, data: { consumed_at: new Date() } });
    const profile = await this.prisma.student_profiles.findUnique({ where: { email } });
    try {
      await this.mail.sendWelcome(email, profile?.full_name || 'Student');
      await this.logEmail(email, 'Cyber Academy registration received', 'registration_received', true);
    } catch {
      // FastAPI intentionally accepts verification even if the welcome email fails.
    }
    return { ok: true, message: 'Email verified. Your registration is awaiting Admin approval and portal credentials.' };
  }

  async resendOtp(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('Account not found');
    if (user.is_active) return { ok: true, message: 'Account is already active' };
    const previous = await this.prisma.email_otps.findFirst({
      where: { email, purpose: 'registration', consumed_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (previous && previous.resend_count >= MAX_OTP_RESENDS) {
      throw new HttpException('Maximum OTP resend attempts reached', HttpStatus.TOO_MANY_REQUESTS);
    }
    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.prisma.$transaction([
      ...(previous
        ? [this.prisma.email_otps.update({ where: { id: previous.id }, data: { consumed_at: new Date() } })]
        : []),
      this.prisma.email_otps.create({
        data: {
          email,
          purpose: 'registration',
          code_hash: this.hashSecret(otp),
          expires_at: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000),
          resend_count: (previous?.resend_count ?? 0) + 1,
          verify_attempts: 0,
          last_sent_at: new Date(),
          created_at: new Date(),
        },
      }),
    ]);
    await this.mail.sendVerification(email, otp);
    await this.logEmail(email, 'Your Cyber Academy OTP', 'otp_verification', true);
    return { ok: true, message: 'OTP resent' };
  }

  async requestPasswordReset(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('No account exists for this email. Register first, then try forgot password.');
    const token = randomBytes(32).toString('base64url');
    await this.prisma.password_reset_tokens.create({
      data: {
        email,
        token_hash: this.hashSecret(token),
        expires_at: new Date(Date.now() + RESET_EXPIRY_MINUTES * 60_000),
        used_at: null,
        created_at: new Date(),
      },
    });
    const resetLink = `${this.config.get<string>('studentFrontendUrl')?.replace(/\/+$/, '')}/reset-password?token=${token}`;
    await this.mail.sendPasswordReset(email, resetLink);
    await this.logEmail(email, 'Reset your Cyber Academy password', 'password_reset', true);
    return { ok: true, message: 'Password reset link sent' };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto) {
    const record = await this.prisma.password_reset_tokens.findFirst({
      where: { token_hash: this.hashSecret(dto.token), used_at: null },
      orderBy: { created_at: 'desc' },
    });
    if (!record || record.expires_at < new Date()) throw new BadRequestException('Password reset link is invalid or expired');
    const user = await this.prisma.users.findUnique({ where: { email: record.email } });
    if (!user) throw new NotFoundException('Account not found');
    await this.prisma.$transaction([
      this.prisma.users.update({
        where: { id: user.id },
        data: { hashed_password: await bcrypt.hash(dto.new_password, 12) },
      }),
      this.prisma.password_reset_tokens.update({ where: { id: record.id }, data: { used_at: new Date() } }),
    ]);
    return { ok: true, message: 'Password updated' };
  }

  async registerAdmin(name: string, emailInput: string, password: string, setupToken?: string) {
    const configured = this.config.get<string>('adminSetupToken') ?? '';
    if (!configured || !setupToken || !this.hashMatches(this.hashSecret(setupToken), this.hashSecret(configured))) {
      throw new ForbiddenException('A valid administrator setup token is required');
    }
    const email = emailInput.toLowerCase();
    const existing = await this.prisma.admin_users.findUnique({ where: { email } });
    if (existing) throw new ConflictException('An admin account already exists for this email');
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await this.prisma.$transaction(async (tx) => {
      const created = await tx.admin_users.create({
        data: {
          name: name.trim(), email, password_hash: passwordHash,
          role: admin_users_role.course_admin, is_active: true,
        },
      });
      await tx.users.upsert({
        where: { email },
        create: { email, hashed_password: passwordHash, role: users_role.admin, is_active: true, created_at: new Date() },
        update: { hashed_password: passwordHash, role: users_role.admin, is_active: true },
      });
      return created;
    });
    return {
      access_token: await this.signToken(admin.email, admin.role, { name: admin.name }),
      token_type: 'bearer',
      role: admin.role,
      name: admin.name,
    };
  }

  async adminMe(email: string) {
    const admin = await this.prisma.admin_users.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin) throw new NotFoundException('Admin account not found');
    return { email: admin.email, name: admin.name, role: admin.role };
  }

  async requestAdminReset(emailInput: string) {
    const email = emailInput.toLowerCase();
    const admin = await this.prisma.admin_users.findUnique({ where: { email } });
    if (admin) {
      const token = randomBytes(32).toString('base64url');
      await this.prisma.admin_password_resets.create({
        data: {
          admin_id: admin.id,
          token_hash: createHash('sha256').update(token).digest('hex'),
          expires_at: new Date(Date.now() + 30 * 60_000),
        },
      });
      const link = `${this.config.get<string>('adminFrontendUrl')?.replace(/\/+$/, '')}/admin/login?reset_token=${token}`;
      await this.mail.sendPasswordReset(admin.email, link);
    }
    return { message: 'If the account exists, a reset link has been sent.' };
  }

  async confirmAdminReset(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await this.prisma.admin_password_resets.findUnique({ where: { token_hash: tokenHash } });
    if (!row || row.used_at || row.expires_at < new Date()) {
      throw new BadRequestException('This reset link is invalid or expired');
    }
    const admin = await this.prisma.admin_users.findUnique({ where: { id: row.admin_id } });
    if (!admin) throw new BadRequestException('Admin account not found');
    const hash = await bcrypt.hash(password, 12);
    await this.prisma.$transaction([
      this.prisma.admin_users.update({ where: { id: admin.id }, data: { password_hash: hash } }),
      this.prisma.users.upsert({
        where: { email: admin.email },
        create: { email: admin.email, hashed_password: hash, role: users_role.admin, is_active: true, created_at: new Date() },
        update: { hashed_password: hash, role: users_role.admin, is_active: true },
      }),
      this.prisma.admin_password_resets.update({ where: { id: row.id }, data: { used_at: new Date() } }),
    ]);
    return { message: 'Password reset successful. You can now sign in.' };
  }
}
