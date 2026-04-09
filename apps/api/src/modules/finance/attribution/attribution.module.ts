import { Module } from '@nestjs/common';
import { AttributionService } from './attribution.service';

@Module({
  providers: [AttributionService],
  exports: [AttributionService],
})
export class AttributionModule {}
