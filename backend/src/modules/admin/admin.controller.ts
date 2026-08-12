import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import {
  AccessDto, AdminBatchDto, ApplicationDecisionDto, CourseDto, JobCreateDto, PortalSettingsDto, SnapshotDto,
  CredentialSendDto, StudentAccountDto, StudentCourseDto, StudentMessageDto, StudentReminderDto,
  LegacyStudentLoginDto,
} from './dto/admin.dto';

const ADMIN_ROLES = ['admin', 'super_admin', 'course_admin', 'placement_admin', 'student_admin'];

@Controller('api/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('batches') batches(@CurrentUser() user: AuthenticatedUser) { return this.service.batchContext(user.sub); }
  @Post('batches') createBatch(@Body() dto: AdminBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createBatch(dto.name, user.sub);
  }
  @Put('batches/selection') selectBatch(@Body() dto: AdminBatchDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.selectBatch(dto.name, user.sub);
  }

  @Get('access/global') globalAccess(@Query('batch') batch?: string) { return this.service.getGlobalAccess(batch); }
  @Put('access/global') setGlobal(@Body() dto: AccessDto, @CurrentUser() user: AuthenticatedUser, @Query('batch') batch?: string) {
    return this.service.setGlobalAccess(dto, user.sub, batch);
  }
  @Get('access/students/:id') studentAccess(@Param('id', ParseIntPipe) id: number) { return this.service.getStudentAccess(id); }
  @Put('access/students/:id') setStudentAccess(
    @Param('id', ParseIntPipe) id: number, @Body() dto: AccessDto, @CurrentUser() user: AuthenticatedUser,
  ) { return this.service.setStudentAccess(id, dto, user.sub); }

  @Get('courses') courses(@Query('batch') batch?: string) { return this.service.courses(batch); }
  @Get('courses/overview') courseOverview(@Query('batch') batch?: string) { return this.service.courseOverview(batch); }
  @Get('courses/:id/students') courseStudents(@Param('id', ParseIntPipe) id: number, @Query('batch') batch?: string) {
    return this.service.courseStudents(id, batch);
  }
  @Post('courses') createCourse(@Body() dto: CourseDto, @Query('batch') batch?: string) { return this.service.createCourse(dto, batch); }
  @Post('courses/:id/publish') publish(@Param('id', ParseIntPipe) id: number) { return this.service.setCourseStatus(id, 'active'); }
  @Post('courses/:id/draft') draft(@Param('id', ParseIntPipe) id: number) { return this.service.setCourseStatus(id, 'draft'); }
  @Put('courses/:id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: CourseDto, @Query('batch') batch?: string) { return this.service.updateCourse(id, dto, batch); }
  @Delete('courses/:id') remove(@Param('id', ParseIntPipe) id: number) { return this.service.deleteCourse(id); }

  @Get('dashboard') dashboard(@Query('batch') batch?: string) { return this.service.dashboard(batch); }
  @Get('dashboard/stats') dashboardStats(@Query('batch') batch?: string) { return this.service.dashboardStats(batch); }
  @Get('dashboard/activity') dashboardActivity(@Query('batch') batch?: string) { return this.service.dashboardActivity(batch); }

  @Get('settings') settings() { return this.service.getSettings(); }
  @Get('settings/overview') settingsOverview() { return this.service.settingsOverview(); }
  @Put('settings') setSettings(@Body() dto: PortalSettingsDto) { return this.service.setSettings(dto); }

  @Get('snapshots/:key') snapshot(@Param('key') key: string) { return this.service.snapshot(key); }
  @Put('snapshots/:key') saveSnapshot(
    @Param('key') key: string, @Body() dto: SnapshotDto, @CurrentUser() user: AuthenticatedUser,
  ) { return this.service.saveSnapshot(key, dto, user.sub); }

  @Get('reports') reports() { return this.service.reports(); }
  @Get('security/events') securityEvents() { return this.service.securityEvents(); }
  @Get('security/audit-logs') auditLogs() { return this.service.auditLogs(); }

  @Get('ide') ide() {
    return {
      section: 'ide', status: 'not_configured', title: 'Open IDE',
      summary: { enabled: false, active_sessions: 0, available_templates: [] },
      endpoints: { overview: '/api/admin/ide', launch_session: '/api/admin/ide/sessions' },
      message: 'Open IDE section is intentionally empty until coding workspace integration is configured.',
    };
  }
  @Post('ide/sessions') ideSession() {
    return { section: 'ide', created: false, message: 'IDE session launch is not configured yet.' };
  }
  @Get('nerd') nerd() {
    return {
      section: 'nerd', status: 'not_configured', title: 'NERD Integration',
      summary: { enabled: false, connected_students: 0, pending_sync: 0 },
      endpoints: { overview: '/api/admin/nerd', sync: '/api/admin/nerd/sync' },
      message: 'NERD section is intentionally empty until the client provides integration details.',
    };
  }
  @Post('nerd/sync') nerdSync() {
    return { section: 'nerd', synced: false, message: 'NERD integration is not configured yet.' };
  }

  @Get('jobs') jobs(@Query('batch') batch?: string) { return this.service.adminJobs(batch); }
  @Get('jobs/overview') jobsOverview(@Query('batch') batch?: string) { return this.service.jobsOverview(batch); }
  @Get('jobs/applications') applications(@Query('batch') batch?: string) { return this.service.applicationActivity(batch); }
  @Post('jobs') createJob(@Body() dto: JobCreateDto, @Query('batch') batch?: string) { return this.service.createJob(dto, batch); }
  @Post('jobs/scrape') scrapeJobs(@Body() urls: string[]) { return this.service.scrapeJobs(urls); }
  @Post('jobs/applications/:id/approve') approve(
    @Param('id', ParseIntPipe) id: number, @Body() dto: ApplicationDecisionDto,
  ) { return this.service.decideApplication(id, 'approved', dto.review_note); }
  @Post('jobs/applications/:id/reject') reject(
    @Param('id', ParseIntPipe) id: number, @Body() dto: ApplicationDecisionDto,
  ) { return this.service.decideApplication(id, 'rejected', dto.review_note); }

  @Get('students') students(@Query('batch') batch?: string) { return this.service.students(batch); }
  @Get('students/overview') studentsOverview(@Query('batch') batch?: string) { return this.service.studentsOverview(batch); }
  @Get('students/:id/profile') studentProfile(@Param('id', ParseIntPipe) id: number, @Query('batch') batch?: string) { return this.service.studentProfile(id, batch); }
  @Get('students/:id/learning') studentLearning(@Param('id', ParseIntPipe) id: number, @Query('batch') batch?: string) {
    return this.service.studentLearning(id, batch);
  }
  @Post('students/accounts') createStudent(@Body() dto: StudentAccountDto, @CurrentUser() user: AuthenticatedUser) { return this.service.createStudent(dto, user.sub); }
  @Delete('students/accounts/:id') deleteStudent(@Param('id', ParseIntPipe) id: number, @Query('confirm') confirmation: string, @CurrentUser() user: AuthenticatedUser) { return this.service.deleteStudent(id, confirmation || '', user.sub); }
  @Post('students/:id/messages') messageStudent(
    @Param('id', ParseIntPipe) id: number, @Body() dto: StudentMessageDto, @CurrentUser() user: AuthenticatedUser,
  ) { return this.service.messageStudent(id, dto.message, user.sub); }
  @Post('students/:id/daily-reminder') reminder(
    @Param('id', ParseIntPipe) id: number, @Body() dto: StudentReminderDto, @CurrentUser() user: AuthenticatedUser,
  ) { return this.service.scheduleReminder(id, dto, user.sub); }
  @Post('students/:id/courses') assignCourse(
    @Param('id', ParseIntPipe) id: number, @Body() dto: StudentCourseDto, @CurrentUser() user: AuthenticatedUser,
  ) { return this.service.assignCourse(id, dto, user.sub); }
  @Post('students/:id/reset-password') resetStudentPassword(@Param('id', ParseIntPipe) id: number) {
    return this.service.resetStudentPassword(id);
  }
  @Post('students/:id/send-credentials') sendCredentials(
    @Param('id', ParseIntPipe) id: number, @Body() dto: CredentialSendDto,
  ) { return this.service.sendCredentials(id, dto); }
  @Post('students/:id/profile-completed') completeProfile(@Param('id', ParseIntPipe) id: number) {
    return this.service.setStudentStatus(id, 'Completed');
  }
  @Post('students/:id/approve') approveStudent(@Param('id', ParseIntPipe) id: number) {
    return this.service.setStudentStatus(id, 'Approved');
  }
  @Post('students/:id/suspend') suspendStudent(@Param('id', ParseIntPipe) id: number) {
    return this.service.suspendStudent(id);
  }

  @Post('students/login-credentials')
  provisionLogin(@Body() dto: LegacyStudentLoginDto) { return this.service.provisionStudentLogin(dto); }

  @Get('endpoints')
  endpoints() {
    return {
      dashboard: { overview: '/api/admin/dashboard', stats: '/api/admin/dashboard/stats', activity: '/api/admin/dashboard/activity' },
      courses: {
        overview: '/api/admin/courses/overview', list: '/api/admin/courses', create: '/api/admin/courses',
        publish: '/api/admin/courses/{course_id}/publish',
        student_assessments: '/api/student/courses/{course_id}/assessments',
        student_submissions: '/api/student/courses/{course_id}/assessment-submissions',
      },
      jobs: {
        overview: '/api/admin/jobs/overview', list: '/api/admin/jobs', create: '/api/admin/jobs',
        scrape: '/api/admin/jobs/scrape', approve_candidate: '/api/admin/jobs/applications/{application_id}/approve',
        reject_candidate: '/api/admin/jobs/applications/{application_id}/reject',
      },
      students: {
        overview: '/api/admin/students/overview', list: '/api/admin/students',
        create_account: '/api/admin/students/accounts',
        send_credentials: '/api/admin/students/{student_id}/send-credentials',
        approve_profile: '/api/admin/students/{student_id}/approve', suspend: '/api/admin/students/{student_id}/suspend',
      },
      nerd: { overview: '/api/admin/nerd', sync: '/api/admin/nerd/sync' },
      ide: { overview: '/api/admin/ide', launch_session: '/api/admin/ide/sessions' },
      settings: { overview: '/api/admin/settings/overview', get: '/api/admin/settings', update: '/api/admin/settings' },
    };
  }
}
