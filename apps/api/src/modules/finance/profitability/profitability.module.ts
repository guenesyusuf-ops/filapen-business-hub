import { Module } from '@nestjs/common';
import { ProfitabilityController } from './profitability.controller';
import { ProfitabilityService } from './profitability.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ProfitabilityController],
  providers: [ProfitabilityService],
})
export class ProfitabilityModule {}
