import { Global, Module } from '@nestjs/common';
import { StepTimerService } from './step-timer';
import { TelemetryController } from './telemetry.controller';
import { AuthModule } from '../../modules/auth/auth.module';

/**
 * Global gemacht damit jeder Service ohne extra Import den Timer nutzen kann.
 * Ring-Buffer bleibt als Singleton im Process.
 */
@Global()
@Module({
  imports: [AuthModule],
  controllers: [TelemetryController],
  providers: [StepTimerService],
  exports: [StepTimerService],
})
export class TelemetryModule {}
