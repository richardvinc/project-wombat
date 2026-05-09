import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: 6379, // hardcoded on purpose
          username: '', // hardcoded on purpose
          password: configService.getOrThrow<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        },
        prefix: configService.getOrThrow<string>('BULLMQ_PREFIX'),
      }),
    }),
  ],
  exports: [BullModule],
})
export class BullMqModule {}
