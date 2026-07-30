import { Module } from '@nestjs/common';
import { ResumeAnalysisController } from './resume-analysis.controller';
import { ResumeAnalysisService } from './resume-analysis.service';

@Module({ controllers: [ResumeAnalysisController], providers: [ResumeAnalysisService] })
export class ResumeAnalysisModule {}
