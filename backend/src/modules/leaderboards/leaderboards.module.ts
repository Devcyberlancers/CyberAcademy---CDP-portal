import { Module } from '@nestjs/common';
import { AdminLeaderboardsController, StudentLeaderboardsController } from './leaderboards.controller';
import { LeaderboardsService } from './leaderboards.service';

@Module({
  controllers: [AdminLeaderboardsController, StudentLeaderboardsController],
  providers: [LeaderboardsService],
})
export class LeaderboardsModule {}
