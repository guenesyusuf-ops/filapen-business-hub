import { Module } from '@nestjs/common';
import { InvoiceController } from './invoice.controller';
import { InvoiceService } from './invoice.service';
import { InvoiceOcrService } from './invoice-ocr.service';
import { InvoiceUploadService } from './invoice-upload.service';
import { InvoiceSettingsService } from './invoice-settings.service';
import { InvoiceStatsService } from './invoice-stats.service';
import { InvoiceReminderService } from './invoice-reminder.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [AuthModule, StorageModule, EmailModule],
  controllers: [InvoiceController],
  providers: [
    InvoiceService,
    InvoiceOcrService,
    InvoiceUploadService,
    InvoiceSettingsService,
    InvoiceStatsService,
    InvoiceReminderService,
  ],
  exports: [InvoiceService, InvoiceStatsService],
})
export class InvoiceModule {}
