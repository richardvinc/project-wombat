import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { AppModule } from '../app/app.module';
import { createOrdersRedisKeys } from '../app/orders/orders.redis-keys';
import { FlashSaleEntity } from '../app/sale/entities/flash-sale.entity';
import { RedisService } from '../redis/redis.service';

type TestAppContext = {
  app: INestApplication;
  dataSource: DataSource;
  redis: Redis;
  close: () => Promise<void>;
};

type EnvOverrides = Record<string, string>;

const requiredEnv: EnvOverrides = {
  NODE_ENV: 'test',
  NEXT_PUBLIC_API_URL: '/api',
  API_PORT: '3100',
  DATABASE_HOST: 'localhost',
  DATABASE_USER: 'postgres',
  DATABASE_PASSWORD: '1234',
  DATABASE_NAME: 'project-wombat-db',
  REDIS_HOST: 'localhost',
  REDIS_USERNAME: '',
  REDIS_PASSWORD: '1234',
  REDIS_DB: '0',
  REDIS_KEY_PREFIX: 'wombat:',
  BULLMQ_PREFIX: 'wombat:bull',
  NGINX_PORT: '88',
  WEB_CONTAINER_NAME: 'wombat_web',
  API_CONTAINER_NAME: 'wombat_api',
  POSTGRES_CONTAINER_NAME: 'wombat_postgres',
  REDIS_CONTAINER_NAME: 'wombat_redis',
  NGINX_CONTAINER_NAME: 'wombat_nginx',
  FLASH_SALE_ID: 'main',
  FLASH_SALE_PRODUCT_NAME: 'Limited Edition Product',
  FLASH_SALE_TOTAL_STOCK: '2',
  FLASH_SALE_START_DELAY_SECONDS: '0',
  FLASH_SALE_DURATION_SECONDS: '300',
  FLASH_SALE_RESERVATION_TTL_SECONDS: '5',
  FLASH_SALE_COOLDOWN_TTL_SECONDS: '1',
  FLASH_SALE_USER_ATTEMPT_LIMIT: '3',
  FLASH_SALE_ATTEMPT_WINDOW_SECONDS: '60',
  FLASH_SALE_PAYMENT_SUCCESS_RATE: '0.7',
  FLASH_SALE_LOAD_TEST_MODE: 'false',
};

function applyTestEnv(overrides: EnvOverrides): () => void {
  const nextEnv = { ...requiredEnv, ...overrides };
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(nextEnv)) {
    previousValues.set(key, process.env[key]);
    process.env[key] = value;
  }

  return () => {
    for (const [key, previousValue] of previousValues.entries()) {
      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  };
}

export async function createApiTestApp(
  overrides: EnvOverrides = {},
): Promise<TestAppContext> {
  const mergedEnv = { ...requiredEnv, ...overrides };
  const restoreEnv = applyTestEnv(overrides);
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  await app.init();

  const dataSource = app.get(DataSource);
  const redis = app.get(RedisService).getClient();
  const saleRepository = dataSource.getRepository(FlashSaleEntity);
  const saleId = mergedEnv.FLASH_SALE_ID;
  const totalStock = Number(mergedEnv.FLASH_SALE_TOTAL_STOCK);

  await saleRepository.update(
    { id: saleId },
    {
      totalStock,
      startAt: new Date(Date.now() - 1_000),
      endAt: new Date(Date.now() + 300_000),
    },
  );
  await redis.set(createOrdersRedisKeys(saleId).availableSlots(), String(totalStock));

  return {
    app,
    dataSource,
    redis,
    close: async () => {
      await app.close();
      restoreEnv();
    },
  };
}
