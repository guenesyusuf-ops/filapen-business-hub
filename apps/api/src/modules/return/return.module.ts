import { Module } from '@nestjs/common';
import { ReturnController } from './return.controller';
import { ReturnService } from './return.service';
import { ReturnImageService } from './return-image.service';
import { ReturnStatsService } from './return-stats.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [ReturnController],
  providers: [ReturnService, ReturnImageService, ReturnStatsService],
  exports: [ReturnService],
})
export class ReturnModule {}
