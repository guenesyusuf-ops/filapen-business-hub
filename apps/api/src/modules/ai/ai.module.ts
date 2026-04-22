import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AuthModule } from '../auth/auth.module';
import { ShippingModule } from '../shipping/shipping.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [AuthModule, ShippingModule, StorageModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
