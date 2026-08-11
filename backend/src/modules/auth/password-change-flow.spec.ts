import * as bcrypt from 'bcryptjs';
import { users_role } from '@prisma/client';
import { AuthService } from './auth.service';

describe('student password change flow', () => {
  async function fixture(mustChangePassword: boolean) {
    const user = {
      id: 7,
      email: 'student@cyberlancers.in',
      role: users_role.student,
      is_active: true,
      hashed_password: await bcrypt.hash('Temporary!123', 4),
    };
    const prisma = {
      users: {
        findFirst: jest.fn().mockResolvedValue(user),
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user),
      },
      student_password_security: {
        upsert: jest.fn().mockResolvedValue({ user_id: user.id, must_change_password: mustChangePassword }),
      },
      student_profiles: {
        findUnique: jest.fn().mockResolvedValue({ full_name: 'Student' }),
      },
      admin_snapshots: {
        upsert: jest.fn().mockResolvedValue({}),
      },
      password_reset_tokens: {
        findFirst: jest.fn().mockResolvedValue({
          id: 11,
          email: user.email,
          token_hash: 'ignored-by-mock',
          expires_at: new Date(Date.now() + 60_000),
          used_at: null,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
    const config = {
      get: jest.fn((key: string) => ({
        studentEmailDomain: 'cyberlancers.in',
        studentFrontendUrl: 'http://localhost:3000',
        'jwt.secret': 'test-secret',
      })[key]),
    };
    const mail = { sendPasswordReset: jest.fn().mockResolvedValue(undefined) };
    return {
      service: new AuthService(prisma as any, jwt as any, config as any, mail as any),
      prisma,
      jwt,
    };
  }

  it('does not issue a portal token while a temporary password must be changed', async () => {
    const { service, jwt } = await fixture(true);
    const result = await service.login({
      email: 'STUDENT@CYBERLANCERS.IN',
      password: 'Temporary!123',
    });

    expect(result).toMatchObject({
      access_token: null,
      role: users_role.student,
      password_change_required: true,
      email: 'student@cyberlancers.in',
    });
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('issues a normal login token after the password has been changed', async () => {
    const { service, jwt } = await fixture(false);
    const result = await service.login({
      email: 'student@cyberlancers.in',
      password: 'Temporary!123',
    });

    expect(result).toMatchObject({ access_token: 'signed-token', role: users_role.student });
    expect(jwt.signAsync).toHaveBeenCalled();
  });

  it('marks the student password as changed after a valid one-time reset', async () => {
    const { service, prisma } = await fixture(true);
    const result = await service.confirmPasswordReset({
      email: 'student@cyberlancers.in',
      token: 'one-time-token',
      new_password: 'A-NewStrong!Password123',
    });

    expect(result).toEqual({ ok: true, message: 'Password updated successfully' });
    expect(prisma.student_password_security.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 7 },
      update: expect.objectContaining({ must_change_password: false }),
    }));
    expect(prisma.password_reset_tokens.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: 'student@cyberlancers.in', used_at: null },
    }));
  });
});
