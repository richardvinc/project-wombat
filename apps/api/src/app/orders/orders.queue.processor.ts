import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashSaleDemoConfigService } from '../config/demo.config';
import { RedisService } from '../../redis/redis.service';
import { FlashSaleService } from '../sale/services/flash-sale.service';
import { OrderEntity, OrderStatus } from './entities/order.entity';
import { ORDERS_QUEUE_NAME } from './orders.constants';
import { createOrdersRedisKeys } from './orders.redis-keys';
import {
  CreatePaidOrderJobData,
  ReleaseReservationJobData,
} from './orders.types';
import { OrdersLuaService } from './services/orders-lua.service';

@Processor(ORDERS_QUEUE_NAME)
export class OrdersQueueProcessor extends WorkerHost {
  constructor(
    private readonly redisService: RedisService,
    private readonly flashSaleService: FlashSaleService,
    private readonly ordersLuaService: OrdersLuaService,
    private readonly demoConfig: FlashSaleDemoConfigService,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
  ) {
    super();
  }

  async process(
    job: Job<ReleaseReservationJobData | CreatePaidOrderJobData>,
  ): Promise<void> {
    switch (job.name) {
      case 'release-reservation':
        await this.releaseReservation(job as Job<ReleaseReservationJobData>);
        return;
      case 'create-paid-order':
        await this.createPaidOrder(job as Job<CreatePaidOrderJobData>);
        return;
      default:
        throw new Error(`Unsupported job: ${job.name}`);
    }
  }

  private async releaseReservation(
    job: Job<ReleaseReservationJobData>,
  ): Promise<void> {
    const { username, reservationId } = job.data;
    const redis = this.redisService.getClient();
    const redisKeys = createOrdersRedisKeys(this.demoConfig.saleId);

    await redis.eval(
      this.ordersLuaService.getScript('release-reservation.lua'),
      6,
      redisKeys.availableSlots(),
      redisKeys.reservedUser(username),
      redisKeys.reservation(reservationId),
      redisKeys.paidUser(username),
      redisKeys.reservationExpiries(),
      redisKeys.cooldown(username),
      reservationId,
      username,
      this.demoConfig.cooldownTtlSeconds,
    );
  }

  private async createPaidOrder(
    job: Job<CreatePaidOrderJobData>,
  ): Promise<void> {
    const { username, reservationId, paymentReferenceNumber } = job.data;
    const sale = await this.flashSaleService.getDefaultSaleEntity();

    await this.orderRepository.upsert(
      {
        flashSaleId: sale.id,
        username,
        reservationId,
        paymentReferenceNumber,
        status: OrderStatus.PAID,
        quantity: 1,
      },
      ['flashSaleId', 'username'],
    );
  }
}
