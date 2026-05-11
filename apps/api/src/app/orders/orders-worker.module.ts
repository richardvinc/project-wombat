import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashSaleModule } from '../sale/flash-sale.module';
import { OrderEntity } from './entities/order.entity';
import { ORDERS_QUEUE_NAME } from './orders.constants';
import { OrdersQueueProcessor } from './orders.queue.processor';
import { OrdersLuaService } from './services/orders-lua.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity]),
    BullModule.registerQueue({ name: ORDERS_QUEUE_NAME }),
    FlashSaleModule,
  ],
  providers: [OrdersLuaService, OrdersQueueProcessor],
})
export class OrdersWorkerModule {}
