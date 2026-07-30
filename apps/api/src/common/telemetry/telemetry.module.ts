import { Global, Module } from '@nestjs/common';
import { StepTimerService } from './step-timer';
import { TelemetryController } from './telemetry.controller';

@Global()
@Module({
  controllers: [TelemetryController],
  providers: [StepTimerService],
  exports: [StepTimerService],
})
export class TelemetryModule {}
