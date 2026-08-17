import {
  BadRequestException, Controller, Get, Param, ParseIntPipe, Post, Query, Res,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, type AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LeaderboardsService } from './leaderboards.service';

const ADMIN_ROLES = ['admin', 'super_admin', 'course_admin', 'placement_admin', 'student_admin'];

@Controller('api/leaderboards')
@UseGuards(JwtAuthGuard)
export class StudentLeaderboardsController {
  constructor(private readonly service: LeaderboardsService) {}

  @Get('batch')
  batch(@CurrentUser() user: AuthenticatedUser) {
    if (user.role !== 'student') throw new BadRequestException('Student permission required');
    return this.service.batchForStudent(user.sub);
  }

  @Get('courses/:id')
  course(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    if (user.role !== 'student') throw new BadRequestException('Student permission required');
    return this.service.courseForStudent(id, user.sub);
  }
}

@Controller('api/admin/leaderboards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
export class AdminLeaderboardsController {
  constructor(private readonly service: LeaderboardsService) {}

  @Get('batch')
  batch(@Query('batch') batch?: string) {
    return this.service.batch(batch);
  }

  @Get('courses/:id')
  course(@Param('id', ParseIntPipe) id: number, @Query('batch') batch?: string) {
    return this.service.course(id, batch);
  }

  @Get('written-exams/template')
  template(@Res() response: Response) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', 'attachment; filename=written-exam-leaderboard-template.csv');
    response.send(this.service.writtenExamTemplate());
  }

  @Post('written-exams/import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  importResults(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('batch') batch: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.importWrittenResults(
      file?.buffer,
      batch,
      user.sub,
      file?.originalname,
    );
  }
}
