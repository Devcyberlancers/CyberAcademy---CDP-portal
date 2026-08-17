import { Module } from '@nestjs/common';
import { AdminAssessmentsController, AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';
import { QuestionImportService } from './question-import.service';

@Module({ controllers: [AdminAssessmentsController, AssessmentsController], providers: [AssessmentsService, QuestionImportService] })
export class AssessmentsModule {}
