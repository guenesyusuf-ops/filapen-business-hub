import { Module } from '@nestjs/common';
import { FilapenSendController } from './send.controller';
import { FilapenSendService } from './send.service';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [FilapenSendController],
  providers: [FilapenSendService],
})
export class FilapenSendModule {}
