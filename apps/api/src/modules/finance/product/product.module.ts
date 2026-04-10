import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProfitCalculationModule } from '../profit/profit.module';

@Module({
  imports: [ProfitCalculationModule],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
