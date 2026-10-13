import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthModule } from '../auth/auth.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StorageModule } from '../../common/storage/storage.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { ProfitAnalysisModule } from '../profit-analysis/profit-analysis.module';

@Module({
  imports: [AuthModule, ShippingModule, StorageModule, InvoiceModule, ProfitAnalysisModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
