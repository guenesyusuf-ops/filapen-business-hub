import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { WorkManagementController } from './work-management.controller';
import { WorkManagementService } from './work-management.service';

@Module({
  imports: [StorageModule],
  controllers: [WorkManagementController],
  providers: [WorkManagementService],
  exports: [WorkManagementService],
})
export class WorkManagementModule {}
