import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { envValidationSchema } from './config/env.validation';
import { OrdersModule } from './orders/orders.module';
import { FlashSaleModule } from './sale/flash-sale.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    RedisModule,
    FlashSaleModule,
    OrdersModule,
  ],
})
export class AppModule {}
