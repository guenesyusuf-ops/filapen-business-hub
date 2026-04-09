import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { EmailModule } from './common/email/email.module';
import { FinanceModule } from './modules/finance/finance.module';
import { CreatorModule } from './modules/creator/creator.module';
import { InfluencerModule } from './modules/influencer/influencer.module';
import { ContentModule } from './modules/content/content.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'production' ? [] : ['../../.env', '.env'],
    }),

    PrismaModule,
    EmailModule,
    FinanceModule,
    CreatorModule,
    InfluencerModule,
    ContentModule,
    AdminModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
