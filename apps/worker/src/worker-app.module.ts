import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullMqModule } from '../../api/src/bullmq/bullmq.module';
import { DatabaseModule } from '../../api/src/database/database.module';
import { RedisModule } from '../../api/src/redis/redis.module';
import { DemoConfigModule } from '../../api/src/app/config/demo.config';
import { envValidationSchema } from '../../api/src/app/config/env.validation';
import { OrdersWorkerModule } from '../../api/src/app/orders/orders-worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: envValidationSchema,
    }),
    DemoConfigModule,
    BullMqModule,
    DatabaseModule,
    RedisModule,
    OrdersWorkerModule,
  ],
})
export class WorkerAppModule {}
