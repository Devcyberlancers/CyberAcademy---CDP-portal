import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  ApplicationStatusDto, JobSearchPreferenceDto, StudentProfileDto,
} from './dto/student-portal.dto';
import { StudentPortalService } from './student-portal.service';
import { ScraperService } from '../scraper/scraper.service';

@Controller('api')
export class StudentPortalController {
  constructor(private readonly service: StudentPortalService, private readonly scraper: ScraperService) {}

  @Get('companies') companies() { return this.service.companies(); }
  @Get('jobs') jobs(@Query('limit') limit?: string) { return this.service.jobs(limit ? Number(limit) : undefined); }
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
  @Get('jobs/entry-level') entry(@Query('location') location?: string, @Query('limit') limit?: string) {
    return this.service.jobs(limit ? Number(limit) : undefined, location ? { location: { contains: location } } : {});
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

  @Get('student-profile') profile(@Query('email') email: string) { return this.service.getProfile(email); }
  @Put('student-profile') saveProfile(@Body() dto: StudentProfileDto) { return this.service.saveProfile(dto); }
  @Get('courses') courses(@Query('status') status = 'active') { return this.service.courses(status); }
  @Get('courses/:id/content') content(@Param('id', ParseIntPipe) id: number) { return this.service.courseContent(id); }
  @Get('announcements') announcements() { return this.service.announcements(); }

  @Get('student/statistics')
  @UseGuards(JwtAuthGuard)
  statistics(@CurrentUser() user: AuthenticatedUser) { return this.service.statistics(user.sub); }

  @Post('jobs/refresh')
  refreshJobs(
    @Query('location') location = 'India', @Query('q') q?: string,
    @Query('platforms') platforms = 'naukri,linkedin,indeed,foundit,wellfound',
    @Query('limit_per_source') limit = '6',
  ) {
    return this.scraper.refresh(location, platforms.split(',').map((v) => v.trim().toLowerCase()).filter(Boolean), Number(limit), q ? [q.trim()] : undefined);
  }

  @Get('student-messages')
  @UseGuards(JwtAuthGuard)
  messages(@CurrentUser() user: AuthenticatedUser) { return this.service.messages(user.sub); }

  @Get('portal-access')
  @UseGuards(JwtAuthGuard)
  access(@CurrentUser() user: AuthenticatedUser) { return this.service.portalAccess(user.sub); }

  @Get('job-search-preference')
  @UseGuards(JwtAuthGuard)
  preference(@CurrentUser() user: AuthenticatedUser) { return this.service.getPreference(user.sub); }

  @Put('job-search-preference')
  @UseGuards(JwtAuthGuard)
  savePreference(@CurrentUser() user: AuthenticatedUser, @Body() dto: JobSearchPreferenceDto) {
    return this.service.savePreference(user.sub, dto);
  }
}
