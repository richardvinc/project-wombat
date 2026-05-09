import { Job } from 'bullmq';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { FlashSaleService } from '../sale/services/flash-sale.service';
import { OrderEntity, OrderStatus } from './entities/order.entity';
import { COOLDOWN_TTL_SECONDS, ORDERS_QUEUE_NAME } from './orders.constants';
import { ordersRedisKeys } from './orders.redis-keys';
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

    await redis.eval(
      this.ordersLuaService.getScript('release-reservation.lua'),
      6,
      ordersRedisKeys.availableSlots(),
      ordersRedisKeys.reservedUser(username),
      ordersRedisKeys.reservation(reservationId),
      ordersRedisKeys.paidUser(username),
      ordersRedisKeys.reservationExpiries(),
      ordersRedisKeys.cooldown(username),
      reservationId,
      username,
      COOLDOWN_TTL_SECONDS,
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
