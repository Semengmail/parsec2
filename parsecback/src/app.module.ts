import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import KeyvRedis from '@keyv/redis';
import { Keyv } from 'keyv';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER } from '@nestjs/core';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { SystemController } from './system.controller';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { TariffsModule } from './modules/tariffs/tariffs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { PublicApiModule } from './modules/public-api/public-api.module';
import { ServicesModule } from './modules/services/services.module';
import { AdminStatsModule } from './modules/admin-stats/admin-stats.module';
import { TestBenchModule } from './modules/test-bench/test-bench.module';
import { PaymentModule } from './modules/payment/payment.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { FrequencyModule } from './modules/frequency/frequency.module';
import { EconomyModule } from './modules/economy/economy.module';
import { ReceiptModule } from './modules/receipt/receipt.module';
import { TaskStatsModule } from './modules/task-stats/task-stats.module';
import { ReferralModule } from './modules/referral/referral.module';
import { MailModule } from './modules/mail/mail.module';
import { ParserHeartbeatModule } from './modules/parser-heartbeat/parser-heartbeat.module';
import { AlertingModule } from './shared/alerting/alerting.module';
import { isStubMode } from './common/stub-mode';

const configModule = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  envFilePath: ['.env.development.local', '.env'],
});
// ConfigModule loads env before its first await; share one flag across Schedule options.
const scheduleEnabled = !isStubMode(new ConfigService());

@Module({
  controllers: [SystemController],
  imports: [
    // Глобальный конфиг
    configModule,

    // Redis cache (глобально)
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        stores: [
          new Keyv({
            store: new KeyvRedis({
              socket: {
                host: process.env.REDIS_HOST,
                port: Number(process.env.REDIS_PORT),
              },
              password: process.env.REDIS_PASSWORD || undefined,
            }),
            ttl: 0, // или нужный TTL
          }),
        ],
      }),
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get<string>('DB_HOST', 'db'),
        port: Number(cfg.get<string>('DB_PORT', '5432')),
        username: cfg.get<string>('DB_USER', 'parsec'),
        password: cfg.get<string>('DB_PASS', ''),
        database: cfg.get<string>('DB_NAME', 'parsecback'),
        autoLoadEntities: true,
        synchronize: cfg.get<string>('TYPEORM_SYNC', 'true') === 'true',
        logging: cfg.get<string>('DB_LOGGING', 'false') === 'true',
        extra: {
          max: 40, // максимальное количество соединений
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        },
      }),
    }),

    // JWT глобально (секрет из ENV)
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret: cfg.get<string>('JWT_SECRET', 'dev_secret'),
        signOptions: { expiresIn: '180d' },
      }),
    }),

    EventEmitterModule.forRoot(),
    // Disable registration as well as stopping the registry in main: no startup race.
    ScheduleModule.forRoot({
      cronJobs: scheduleEnabled,
      intervals: scheduleEnabled,
      timeouts: scheduleEnabled,
    }),

    UsersModule,
    AuthModule,
    AdminStatsModule,
    BillingModule,
    TariffsModule,
    DashboardModule,
    PublicApiModule,
    ServicesModule,
    TestBenchModule,
    PaymentModule,
    TelegramModule,
    FrequencyModule,
    EconomyModule,
    ReceiptModule,
    TaskStatsModule,
    ReferralModule,
    MailModule,
    ParserHeartbeatModule,
    AlertingModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
