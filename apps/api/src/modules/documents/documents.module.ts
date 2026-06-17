import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocShareService } from './doc-share.service';
import { DocShareController } from './doc-share.controller';
import { StorageModule } from '../../common/storage/storage.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [StorageModule, AuthModule],
  controllers: [DocumentsController, DocShareController],
  providers: [DocumentsService, DocShareService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
