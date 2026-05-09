import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashSaleModule } from '../sale/flash-sale.module';
import { OrdersController } from './orders.controller';
import { OrderEntity } from './entities/order.entity';
import { ORDERS_QUEUE_NAME } from './orders.constants';
import { OrdersQueueProcessor } from './orders.queue.processor';
import { OrdersLuaService } from './services/orders-lua.service';
import { OrdersService } from './services/orders.service';
import { PaymentSimulatorService } from './services/payment-simulator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity]),
    BullModule.registerQueue({ name: ORDERS_QUEUE_NAME }),
    FlashSaleModule,
  ],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersLuaService,
    PaymentSimulatorService,
    OrdersQueueProcessor,
  ],
})
export class OrdersModule {}
