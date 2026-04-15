import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { WorkManagementController } from './work-management.controller';
import { WorkManagementService } from './work-management.service';
import { WmDashboardController } from './wm-dashboard.controller';
import { WmDashboardService } from './wm-dashboard.service';

@Module({
  imports: [StorageModule],
  controllers: [WorkManagementController, WmDashboardController],
  providers: [WorkManagementService, WmDashboardService],
  exports: [WorkManagementService, WmDashboardService],
})
export class WorkManagementModule {}
