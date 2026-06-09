import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [InvoiceController],
  providers: [InvoiceService],
  exports: [InvoiceService],
})
export class InvoiceModule {}
