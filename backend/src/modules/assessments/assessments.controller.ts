import {
  Body, Controller, Get, Headers, Ip, Param, ParseIntPipe, Post, Put, Query, Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AssessmentCollectionDto, CloseAttemptDto, EventDto, SaveAnswerDto, StartAttemptDto,
  NativeAssessmentDto,
} from './dto/assessment.dto';
import { AssessmentsService } from './assessments.service';

const ADMIN_ROLES = ['admin', 'super_admin', 'course_admin', 'placement_admin', 'student_admin'];

@Controller('api/admin/assessments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class AdminAssessmentsController {
  constructor(private readonly service: AssessmentsService) {}
  @Get() all() { return this.service.nativeAssessments(); }
  @Post() upsert(@Body() dto: NativeAssessmentDto) { return this.service.upsertNative(dto); }
  @Get('standalone') standalone() { return this.service.getCollection('standalone'); }
  @Put('standalone') saveStandalone(@Body() dto: AssessmentCollectionDto) { return this.service.saveCollection('standalone', dto.assessments); }
  @Get('courses/:key') course(@Param('key') key: string) { return this.service.getCollection('course', key); }
  @Put('courses/:key') saveCourse(@Param('key') key: string, @Body() dto: AssessmentCollectionDto) { return this.service.saveCollection('course', dto.assessments, key); }
}

@Controller('api/assignments')
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}
  @Get() assignments(@Query('email') email?: string, @Query('assignment') assignment?: string) {
    return this.service.assignments(email, assignment);
  }
  @Post(':assignment/start') async start(
    @Param('assignment') assignment: string, @Body() dto: StartAttemptDto, @Ip() ip: string,
    @Headers('user-agent') userAgent: string, @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.service.start(assignment, dto, ip, userAgent ?? '');
    if (result.action === 'start') response.status(201);
    return result;
  }
  @Post(':id/save-answer') answer(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveAnswerDto) { return this.service.saveAnswer(id, dto); }
  @Post(':id/event') event(@Param('id', ParseIntPipe) id: number, @Body() dto: EventDto) { return this.service.event(id, dto); }
  @Post(':id/terminate') terminate(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseAttemptDto) { return this.service.close(id, dto, true); }
  @Post(':id/submit') submit(@Param('id', ParseIntPipe) id: number, @Body() dto: CloseAttemptDto) { return this.service.close(id, dto); }
  @Get('attempts') attempts() { return this.service.attempts(); }

  @Get('admin/attempts')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN_ROLES)
  adminAttempts(
    @Query('assignment_id') assignment?: string, @Query('status') status?: string,
    @Query('student_email') email?: string, @Query('page') page = '1', @Query('page_size') size = '50',
    @Query('scope') scope?: string,
  ) { return this.service.adminAttempts({ assignment, status, email, scope, page: Number(page), size: Number(size) }); }

  @Get('admin/attempts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN_ROLES)
  detail(@Param('id', ParseIntPipe) id: number) { return this.service.attemptDetail(id); }

  @Get('admin/attempts/:id/answers')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN_ROLES)
  answers(@Param('id', ParseIntPipe) id: number) { return this.service.attemptDetail(id, true); }

  @Get('admin/assignments/:assignment/attempts')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles(...ADMIN_ROLES)
  assignmentAttempts(@Param('assignment') assignment: string, @Query('page') page = '1', @Query('page_size') size = '50') {
    return this.service.adminAttempts({ assignment, page: Number(page), size: Number(size) }).then((result) => ({
      assignmentId: assignment, assignmentTitle: result.items[0]?.assignmentTitle ?? '',
      page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages, items: result.items,
    }));
  }
}
