import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PasswordController } from './password.controller';
import { PasswordService } from './password.service';

@Module({
  imports: [AuthModule],
  controllers: [PasswordController],
  providers: [PasswordService],
  exports: [PasswordService],
})
export class PasswordModule {}
