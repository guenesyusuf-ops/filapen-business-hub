import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { SalesController } from './sales.controller';
import { SalesCustomerService } from './sales-customer.service';
import { SalesOrderService } from './sales-order.service';
import { SalesDocumentService } from './sales-document.service';
import { SalesImportService } from './sales-import.service';
import { EasybillService } from './easybill.service';
import { SalesReminderService } from './sales-reminder.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [SalesController],
  providers: [
    SalesCustomerService,
    SalesOrderService,
    SalesDocumentService,
    SalesImportService,
    EasybillService,
    SalesReminderService,
  ],
  exports: [SalesOrderService, SalesCustomerService],
})
export class SalesModule {}
