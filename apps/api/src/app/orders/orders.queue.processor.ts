import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(OrdersQueueProcessor.name);

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
    this.logger.log(
      `Processing job "${job.name}" (id=${job.id ?? 'unknown'}, attemptsMade=${job.attemptsMade})`,
    );

    try {
      let result: string;

      switch (job.name) {
        case 'release-reservation':
          result = await this.releaseReservation(
            job as Job<ReleaseReservationJobData>,
          );
          break;
        case 'create-paid-order':
          result = await this.createPaidOrder(job as Job<CreatePaidOrderJobData>);
          break;
        default:
          throw new Error(`Unsupported job: ${job.name}`);
      }

      this.logger.log(
        `Completed job "${job.name}" (id=${job.id ?? 'unknown'}) with result=${result}`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.stack ?? error.message : String(error);

      this.logger.error(
        `Failed job "${job.name}" (id=${job.id ?? 'unknown'})`,
        message,
      );
      throw error;
    }
  }

  private async releaseReservation(
    job: Job<ReleaseReservationJobData>,
  ): Promise<string> {
    const { username, reservationId } = job.data;
    const redis = this.redisService.getClient();
    const redisKeys = createOrdersRedisKeys(this.demoConfig.saleId);

    const result = await redis.eval(
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

    return String(result);
  }

  private async createPaidOrder(
    job: Job<CreatePaidOrderJobData>,
  ): Promise<string> {
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

    return OrderStatus.PAID;
  }
}
