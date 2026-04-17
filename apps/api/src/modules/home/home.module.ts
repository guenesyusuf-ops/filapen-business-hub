import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { CurrencyController } from './currency.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [HomeController, CurrencyController],
  providers: [HomeService],
})
export class HomeModule {}
