import {
  Body, Controller, Delete, ForbiddenException, Get, Headers, Ip, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { resolveClientIp, type RequestHeaders } from '../../common/http/client-ip';
import {
  ApplicationStatusDto, ModuleQuizSubmissionDto, ModuleVideoCompletionDto, StudentProfileDto,
} from './dto/student-portal.dto';
import { StudentPortalService } from './student-portal.service';
import { ScraperService } from '../scraper/scraper.service';

@Controller('api')
export class StudentPortalController {
  constructor(private readonly service: StudentPortalService, private readonly scraper: ScraperService) {}

  @Get('companies') companies() { return this.service.companies(); }
  @Get('jobs') jobs(@Query('limit') limit?: string, @Query('email') email?: string) { return this.service.jobs(limit ? Number(limit) : undefined, {}, email); }
  @Get('jobs/latest') latest(@Query('limit') limit?: string) { return this.service.latestJobs(limit ? Number(limit) : undefined); }
  @Get('jobs/platform/:platform') platform(@Param('platform') platform: string, @Query('limit') limit?: string) {
    return this.service.platformJobs(platform, limit ? Number(limit) : undefined);
  }
  @Get('jobs/search') search(@Query('q') q: string, @Query('location') location?: string, @Query('limit') limit?: string) {
    if (!q || q.length < 2) throw new Error('Search query must contain at least 2 characters');
    return this.service.searchJobs(q, location, limit ? Number(limit) : undefined);
  }
  @Get('jobs/location/:location') location(@Param('location') location: string, @Query('limit') limit?: string) {
    return this.service.searchJobs('', location, limit ? Number(limit) : undefined);
  }
  @Get('jobs/locations') locations(@Query('limit') limit?: string) { return this.service.locations(limit ? Number(limit) : undefined); }
  @Get('jobs/entry-level') entry(@Query('location') location?: string, @Query('limit') limit?: string, @Query('email') email?: string) {
    return this.service.jobs(limit ? Number(limit) : undefined, location ? { location: { contains: location } } : {}, email);
  }
  @Get('jobs/entry-level/count') async entryCount(@Query('location') location?: string, @Query('email') email?: string) {
    const count = await this.service.availableJobsCount(location ? { location: { contains: location } } : {}, email);
    return { count };
  }
  @Post('jobs/:id/application-status') status(@Param('id', ParseIntPipe) id: number, @Body() dto: ApplicationStatusDto) {
    return this.service.setApplicationStatus(id, dto);
  }
  @Get('jobs/application-statuses') statuses(@Query('email') email: string) { return this.service.applicationStatuses(email); }
  @Get('jobs/applied') applied(@Query('email') email: string) { return this.service.appliedJobs(email); }
  @Get('jobs/recommended/:studentId') recommended(@Param('studentId', ParseIntPipe) id: number, @Query('limit') limit?: string) {
    return this.service.recommendedJobs(id, limit ? Number(limit) : undefined);
  }
  @Get('jobs/:id') job(@Param('id', ParseIntPipe) id: number) { return this.service.job(id); }

  @Get('student-profile')
  @UseGuards(JwtAuthGuard)
  profile(@CurrentUser() user: AuthenticatedUser) {
    this.requireStudent(user);
    return this.service.getProfile(user.sub);
  }

  @Put('student-profile')
  @UseGuards(JwtAuthGuard)
  saveProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: StudentProfileDto) {
    this.requireStudent(user);
    // The account in the JWT is authoritative; a client cannot save another student's profile.
    return this.service.saveProfile({ ...dto, email: user.sub });
  }
  @Get('courses')
  @UseGuards(JwtAuthGuard)
  courses(@Query('status') status = 'active', @CurrentUser() user: AuthenticatedUser) {
    this.requireStudent(user);
    return this.service.courses(status, user.sub);
  }
  @Get('courses/:id/content')
  @UseGuards(JwtAuthGuard)
  content(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    this.requireStudent(user);
    return this.service.courseContent(id, user.sub);
  }
  @Put('courses/:id/modules/video-complete')
  @UseGuards(JwtAuthGuard)
  completeModuleVideo(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser, @Body() dto: ModuleVideoCompletionDto) {
    this.requireStudent(user);
    return this.service.completeModuleVideo(id, user.sub, dto.module_index);
  }
  @Put('courses/:id/modules/quiz-submit')
  @UseGuards(JwtAuthGuard)
  submitModuleQuiz(
    @Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ModuleQuizSubmissionDto, @Ip() ip: string, @Headers() headers: RequestHeaders,
  ) {
    this.requireStudent(user);
    const userAgent = Array.isArray(headers['user-agent']) ? headers['user-agent'][0] : headers['user-agent'];
    return this.service.submitModuleQuiz(id, user.sub, dto.module_index, dto.answers ?? {}, {
      startedAt: dto.started_at, tabSwitches: dto.tab_switches, browser: dto.browser,
      operatingSystem: dto.operating_system, violationReason: dto.violation_reason,
      ip: resolveClientIp(headers, ip), userAgent: userAgent ?? '',
    });
  }
  @Get('announcements') announcements() { return this.service.announcements(); }

  @Get('student/statistics')
  @UseGuards(JwtAuthGuard)
  statistics(@CurrentUser() user: AuthenticatedUser) { return this.service.statistics(user.sub); }

  @Post('jobs/refresh')
  @UseGuards(JwtAuthGuard)
  async refreshJobs(
    @CurrentUser() user: AuthenticatedUser,
    @Query('location') location = 'India',
    @Query('platforms') platforms = 'naukri,linkedin,indeed,foundit,wellfound,cutshort,hirist,companycareers,greenhouse,remoteok',
    @Query('limit_per_source') limit = '10',
  ) {
    this.requireStudent(user);
    const profile = await this.service.getProfile(user.sub);
    return this.scraper.refresh(
      location,
      platforms.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean),
      Number(limit),
      profile.batch,
    );
  }

  @Get('student-messages')
  @UseGuards(JwtAuthGuard)
  messages(@CurrentUser() user: AuthenticatedUser) { return this.service.messages(user.sub); }

  @Put('student-messages/:id/read')
  @UseGuards(JwtAuthGuard)
  readMessage(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    this.requireStudent(user);
    return this.service.readMessage(user.sub, id);
  }

  @Put('student-messages/read-all')
  @UseGuards(JwtAuthGuard)
  readAllMessages(@CurrentUser() user: AuthenticatedUser) {
    this.requireStudent(user);
    return this.service.readAllMessages(user.sub);
  }

  @Delete('student-messages/read')
  @UseGuards(JwtAuthGuard)
  clearReadMessages(@CurrentUser() user: AuthenticatedUser) {
    this.requireStudent(user);
    return this.service.clearReadMessages(user.sub);
  }

  @Get('portal-access')
  @UseGuards(JwtAuthGuard)
  access(@CurrentUser() user: AuthenticatedUser) { return this.service.portalAccess(user.sub); }

  private requireStudent(user: AuthenticatedUser) {
    if (user.role !== 'student') throw new ForbiddenException('Student permission required');
  }
}
