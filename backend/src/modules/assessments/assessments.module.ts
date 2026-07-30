import { Module } from '@nestjs/common';
import { AdminAssessmentsController, AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

@Module({ controllers: [AdminAssessmentsController, AssessmentsController], providers: [AssessmentsService] })
export class AssessmentsModule {}
