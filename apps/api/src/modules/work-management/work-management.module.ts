import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { WorkManagementController } from './work-management.controller';
import { WorkManagementService } from './work-management.service';
import { WmDashboardController } from './wm-dashboard.controller';
import { WmDashboardService } from './wm-dashboard.service';
import { WmChatController } from './wm-chat.controller';
import { WmChatService } from './wm-chat.service';
import { WmSchedulerService } from './wm-scheduler.service';
import { WmNotificationService } from './wm-notification.service';

@Module({
  imports: [StorageModule],
  controllers: [WorkManagementController, WmDashboardController, WmChatController],
  providers: [
    WorkManagementService,
    WmDashboardService,
    WmChatService,
    WmSchedulerService,
    WmNotificationService,
  ],
  exports: [WorkManagementService, WmDashboardService, WmChatService, WmNotificationService],
})
export class WorkManagementModule {}
