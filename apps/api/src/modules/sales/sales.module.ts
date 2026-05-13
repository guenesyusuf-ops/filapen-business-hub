import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { ShippingModule } from '../shipping/shipping.module';
import { SalesController } from './sales.controller';
import { SalesCustomerService } from './sales-customer.service';
import { SalesOrderService } from './sales-order.service';
import { SalesDocumentService } from './sales-document.service';
import { SalesImportService } from './sales-import.service';
import { EasybillService } from './easybill.service';
import { SalesReminderService } from './sales-reminder.service';
import { SalesExportService } from './sales-export.service';
import { SalesShippingService } from './sales-shipping.service';
import { SalesConditionsService } from './sales-conditions.service';

@Module({
  imports: [AuthModule, StorageModule, ShippingModule],
  controllers: [SalesController],
  providers: [
    SalesCustomerService,
    SalesOrderService,
    SalesDocumentService,
    SalesImportService,
    EasybillService,
    SalesReminderService,
    SalesExportService,
    SalesShippingService,
    SalesConditionsService,
  ],
  exports: [SalesOrderService, SalesCustomerService],
})
export class SalesModule {}
