import { Module } from '@nestjs/common';
import { StudentPortalController } from './student-portal.controller';
import { StudentPortalService } from './student-portal.service';
import { AuthModule } from '../auth/auth.module';
import { StudentLegacyController } from './student-legacy.controller';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [AuthModule, ScraperModule],
  controllers: [StudentPortalController, StudentLegacyController],
  providers: [StudentPortalService],
  exports: [StudentPortalService],
})
export class StudentPortalModule {}
