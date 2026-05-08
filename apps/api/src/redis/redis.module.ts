import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        const username = configService.get<string>('REDIS_USERNAME');
        const redis = new Redis({
          host: configService.getOrThrow<string>('REDIS_HOST'),
          port: configService.getOrThrow<number>('REDIS_PORT'),
          ...(username ? { username } : {}),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
          keyPrefix: configService.get<string>('REDIS_KEY_PREFIX'),
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
        });

        redis.on('connect', () => logger.log('Redis connected'));
        redis.on('ready', () => logger.log('Redis ready'));
        redis.on('error', (error) =>
          logger.error(`Redis error: ${error.message}`),
        );
        redis.on('close', () => logger.warn('Redis connection closed'));
        redis.on('reconnecting', () => logger.warn('Redis reconnecting'));

        return redis;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule {}
