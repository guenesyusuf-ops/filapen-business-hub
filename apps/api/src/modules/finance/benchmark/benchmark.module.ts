import { Module } from '@nestjs/common';
import { BenchmarkService } from './benchmark.service';

@Module({
  providers: [BenchmarkService],
  exports: [BenchmarkService],
})
export class BenchmarkModule {}
