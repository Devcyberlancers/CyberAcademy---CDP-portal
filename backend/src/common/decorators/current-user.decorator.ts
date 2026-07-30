import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  sub: string;
  role: string;
  name?: string;
  student_id?: number | null;
  profile_id?: number | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user,
);
