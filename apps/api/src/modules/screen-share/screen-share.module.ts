import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { ScreenShareController } from './screen-share.controller';
import { ScreenShareService } from './screen-share.service';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [ScreenShareController],
  providers: [ScreenShareService],
  exports: [ScreenShareService],
})
export class ScreenShareModule {}
