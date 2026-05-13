import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { CurrencyController } from './currency.controller';
import { VacationController } from './vacation.controller';
import { VacationService } from './vacation.service';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../common/email/email.module';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [HomeController, CurrencyController, VacationController],
  providers: [HomeService, VacationService],
})
export class HomeModule {}
