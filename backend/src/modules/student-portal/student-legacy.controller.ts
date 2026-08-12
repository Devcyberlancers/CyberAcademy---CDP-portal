import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  StudentLegacyLoginDto, StudentProfileCompleteDto, StudentSubmissionDto,
} from './dto/student-portal.dto';
import { StudentPortalService } from './student-portal.service';

@Controller('api/student')
export class StudentLegacyController {
  constructor(private readonly service: StudentPortalService) {}

  @Post('auth/login')
  login(@Body() dto: StudentLegacyLoginDto) { return this.service.legacyLogin(dto.username, dto.password); }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) { return this.service.studentMe(user.sub); }

  @Post('profile')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: AuthenticatedUser, @Body() dto: StudentProfileCompleteDto) {
    return this.service.completeProfile(user.sub, dto);
  }

  @Get('courses/:course/assessments')
  @UseGuards(JwtAuthGuard)
  assessments(@Param('course') course: string, @CurrentUser() user: AuthenticatedUser) { return this.service.courseAssessments(course, user.sub); }

  @Post('courses/:course/assessment-submissions')
  @UseGuards(JwtAuthGuard)
  submit(
    @Param('course') course: string, @Body() dto: StudentSubmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.service.submitCourseAssessment(course, dto.submission, user); }
}
