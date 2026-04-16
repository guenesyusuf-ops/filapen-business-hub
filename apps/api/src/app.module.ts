import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './common/email/email.module';
import { FinanceModule } from './modules/finance/finance.module';
import { CreatorModule } from './modules/creator/creator.module';
import { InfluencerModule } from './modules/influencer/influencer.module';
import { ContentModule } from './modules/content/content.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { StorageModule } from './common/storage/storage.module';
import { WorkManagementModule } from './modules/work-management/work-management.module';
import { HomeModule } from './modules/home/home.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? [] : ['../../.env', '.env'],
    }),

    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (!redisUrl) {
          return { connection: { host: 'localhost', port: 6379 } };
        }
        const url = new URL(redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port),
            password: url.password || undefined,
            username: url.username || undefined,
          },
        };
      },
    }),

    PrismaModule,
    EmailModule,
    FinanceModule,
    CreatorModule,
    InfluencerModule,
    ContentModule,
    AdminModule,
    AuthModule,
    IntegrationModule,
    StorageModule,
    WorkManagementModule,
    HomeModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
