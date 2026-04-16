import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { WorkManagementController } from './work-management.controller';
import { WorkManagementService } from './work-management.service';
import { WmDashboardController } from './wm-dashboard.controller';
import { WmDashboardService } from './wm-dashboard.service';
import { WmChatController } from './wm-chat.controller';
import { WmChatService } from './wm-chat.service';
import { WmSchedulerService } from './wm-scheduler.service';
import { WmNotificationService } from './wm-notification.service';
import { WmApprovalController } from './wm-approval.controller';
import { WmApprovalService } from './wm-approval.service';

@Module({
  imports: [StorageModule, AuthModule],
  controllers: [WorkManagementController, WmDashboardController, WmChatController, WmApprovalController],
  providers: [
    WorkManagementService,
    WmDashboardService,
    WmChatService,
    WmSchedulerService,
    WmNotificationService,
    WmApprovalService,
  ],
  exports: [WorkManagementService, WmDashboardService, WmChatService, WmNotificationService, WmApprovalService],
})
export class WorkManagementModule {}
