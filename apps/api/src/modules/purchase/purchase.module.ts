import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { PurchaseController } from './purchase.controller';
import { SupplierService } from './supplier.service';
import { PurchaseOrderService } from './purchase-order.service';
import { PaymentService } from './payment.service';
import { PurchaseDocumentService } from './purchase-document.service';
import { PurchaseExportService } from './purchase-export.service';
import { PurchaseAuditService } from './purchase-audit.service';
import { ShipmentService } from './shipment.service';

@Module({
  imports: [StorageModule, AuthModule],
  controllers: [PurchaseController],
  providers: [
    SupplierService,
    PurchaseOrderService,
    PaymentService,
    PurchaseDocumentService,
    PurchaseExportService,
    PurchaseAuditService,
    ShipmentService,
  ],
  exports: [SupplierService, PurchaseOrderService, PaymentService, ShipmentService],
})
export class PurchaseModule {}
