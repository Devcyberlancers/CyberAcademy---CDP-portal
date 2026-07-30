import {
  BadRequestException, Controller, Get, Post, UploadedFile, UseGuards, UseInterceptors, Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ResumeAnalysisService } from './resume-analysis.service';

@Controller('api/resume')
@UseGuards(JwtAuthGuard)
export class ResumeAnalysisController {
  constructor(private readonly service: ResumeAnalysisService) {}

  @Get('quota')
  quota(@CurrentUser() user: AuthenticatedUser) { return this.service.quota(user.sub); }

  @Post('analyze')
  @UseInterceptors(FileInterceptor('resume', { limits: { fileSize: 8 * 1024 * 1024 } }))
  analyze(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Resume file is required.');
    return this.service.analyze(user.sub, file.originalname || 'resume', file.buffer);
  }

  @Post('analyze-profile')
  analyzeProfile(@CurrentUser() user: AuthenticatedUser, @Body('email') email: string) {
    return this.service.analyzeProfile(user.sub, email);
  }
}
