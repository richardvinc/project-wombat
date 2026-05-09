import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';
import { Repository } from 'typeorm';
import { FlashSaleDemoConfigService } from '../../config/demo.config';
import { RedisService } from '../../../redis/redis.service';
import { FlashSaleService } from '../../sale/services/flash-sale.service';
import { CreateOrderResponseDto } from '../dto/create-order-response.dto';
import { CreateOrderDto } from '../dto/create-order.dto';
import { MakePaymentDto } from '../dto/make-payment.dto';
import { PaymentResponseDto } from '../dto/payment-response.dto';
import { UserOrderStatusResponseDto } from '../dto/user-order-status-response.dto';
import { OrderEntity } from '../entities/order.entity';
import {
  ORDERS_QUEUE_NAME,
} from '../orders.constants';
import { createOrdersRedisKeys } from '../orders.redis-keys';
import {
  CreatePaidOrderJobData,
  ReleaseReservationJobData,
  ReservationRecord,
} from '../orders.types';
import { OrdersLuaService } from './orders-lua.service';
import { PaymentSimulatorService } from './payment-simulator.service';

@Injectable()
export class OrdersService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    private readonly redisService: RedisService,
    private readonly flashSaleService: FlashSaleService,
    private readonly ordersLuaService: OrdersLuaService,
    private readonly paymentSimulatorService: PaymentSimulatorService,
    private readonly demoConfig: FlashSaleDemoConfigService,
    @InjectQueue(ORDERS_QUEUE_NAME)
    private readonly ordersQueue: Queue<
      ReleaseReservationJobData | CreatePaidOrderJobData
    >,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.orderRepository.clear();
  }

  async attemptPurchase(
    createOrderDto: CreateOrderDto,
  ): Promise<CreateOrderResponseDto> {
    const redisKeys = createOrdersRedisKeys(this.demoConfig.saleId);
    const username = createOrderDto.username?.trim();

    if (!username) {
      throw new BadRequestException({
        status: 'missing_username',
        message: 'username is required.',
      });
    }

    const sale = await this.flashSaleService.getDefaultSaleEntity();
    this.ensureSaleActiveWindow(sale.startAt, sale.endAt);

    const redis = this.redisService.getClient();
    await this.enforceRateLimit(
      redis,
      redisKeys.buyAttemptsUser(username),
      this.demoConfig.userAttemptLimit,
    );

    const reservationId = randomUUID();
    const reservedAt = new Date();
    const expiresAt = new Date(
      reservedAt.getTime() + this.demoConfig.reservationTtlMs,
    );
    const reservation: ReservationRecord = {
      username,
      reservationId,
      reservedAt: reservedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const result = await redis.eval(
      this.ordersLuaService.getScript('reserve-reservation.lua'),
      6,
      redisKeys.availableSlots(),
      redisKeys.reservedUser(username),
      redisKeys.reservation(reservationId),
      redisKeys.paidUser(username),
      redisKeys.cooldown(username),
      redisKeys.reservationExpiries(),
      reservationId,
      JSON.stringify(reservation),
      this.demoConfig.reservationTtlSeconds,
      expiresAt.getTime(),
      username,
    );

    if (result !== 'RESERVED') {
      this.throwForReserveResult(String(result));
    }

    await this.ordersQueue.add(
      'release-reservation',
      { username, reservationId },
      {
        delay: this.demoConfig.reservationTtlMs,
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        jobId: `release-reservation:${this.demoConfig.saleId}:${reservationId}`,
      },
    );

    return {
      username,
      status: 'reserved',
      message: `Slot reserved. Please pay within ${this.formatDuration(this.demoConfig.reservationTtlSeconds)}.`,
      reservationId,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getOrderStatus(username: string): Promise<UserOrderStatusResponseDto> {
    const redisKeys = createOrdersRedisKeys(this.demoConfig.saleId);
    const normalizedUsername = username?.trim();

    if (!normalizedUsername) {
      throw new BadRequestException({
        status: 'missing_username',
        message: 'username is required.',
      });
    }

    const redis = this.redisService.getClient();

    // user already paid
    if (await redis.exists(redisKeys.paidUser(normalizedUsername))) {
      return {
        username: normalizedUsername,
        status: 'paid',
        message: 'You have successfully purchased the item.',
        reservationId: null,
        expiresAt: null,
      };
    }

    const reservationId = await redis.get(
      redisKeys.reservedUser(normalizedUsername),
    );

    // no reservation
    if (!reservationId) {
      return {
        username: normalizedUsername,
        status: 'none',
        message: 'You do not have an active reservation or paid order.',
        reservationId: null,
        expiresAt: null,
      };
    }

    const reservation = await this.getReservation(redis, reservationId);

    // expired reservation
    if (!reservation) {
      return {
        username: normalizedUsername,
        status: 'none',
        message: 'Your reservation is no longer active.',
        reservationId: null,
        expiresAt: null,
      };
    }

    return {
      username: normalizedUsername,
      status: 'reserved',
      message: 'You have an active reservation.',
      reservationId,
      expiresAt: reservation.expiresAt,
    };
  }

  async makePayment(
    makePaymentDto: MakePaymentDto,
  ): Promise<PaymentResponseDto> {
    const redisKeys = createOrdersRedisKeys(this.demoConfig.saleId);
    const username = makePaymentDto.username?.trim();
    const reservationId = makePaymentDto.reservationId?.trim();

    if (!username || !reservationId) {
      throw new BadRequestException({
        status: 'invalid_payment_request',
        message: 'username and reservationId are required.',
      });
    }

    const redis = this.redisService.getClient();

    // user already paid
    if (await redis.exists(redisKeys.paidUser(username))) {
      throw new ConflictException({
        status: 'already_paid',
        message: 'You have already paid.',
      });
    }

    const currentReservationId = await redis.get(
      redisKeys.reservedUser(username),
    );

    // no active reservation
    if (!currentReservationId) {
      throw new NotFoundException({
        status: 'no_active_reservation',
        message: 'You do not have an active reservation.',
      });
    }

    // try to pay other reservation (probably old one)
    if (currentReservationId !== reservationId) {
      throw new ForbiddenException({
        status: 'invalid_reservation',
        message: 'This reservation does not belong to the user.',
      });
    }

    const reservation = await this.getReservation(redis, reservationId);

    // expired reservation
    if (!reservation) {
      throw new GoneException({
        status: 'reservation_expired',
        message:
          'Your reservation has expired. You can try to attempt buy again.',
      });
    }

    const paymentSucceeded = await this.paymentSimulatorService.process(
      makePaymentDto.forceSuccess,
    );

    if (!paymentSucceeded) {
      return {
        username,
        status: 'payment_failed',
        reservationId,
        paymentReferenceId: null,
        message:
          'Payment failed. You can retry before your reservation expires.',
      };
    }

    const result = await redis.eval(
      this.ordersLuaService.getScript('mark-paid.lua'),
      4,
      redisKeys.reservedUser(username),
      redisKeys.reservation(reservationId),
      redisKeys.paidUser(username),
      redisKeys.reservationExpiries(),
      reservationId,
      username,
    );

    switch (String(result)) {
      case 'PAID':
        break;
      case 'ALREADY_PAID':
        throw new ConflictException({
          status: 'already_paid',
          message: 'You have already paid.',
        });
      case 'NO_RESERVATION':
        throw new NotFoundException({
          status: 'no_active_reservation',
          message: 'You do not have an active reservation.',
        });
      case 'RESERVATION_MISMATCH':
        throw new ForbiddenException({
          status: 'invalid_reservation',
          message: 'This reservation does not belong to the user.',
        });
      case 'RESERVATION_EXPIRED':
        throw new GoneException({
          status: 'reservation_expired',
          message: 'Your reservation has expired. Please try to buy again.',
        });
      default:
        throw new ConflictException({
          status: 'payment_state_invalid',
          message: `Unexpected payment state: ${String(result)}`,
        });
    }

    const paymentReferenceId = randomUUID();

    await this.ordersQueue.add(
      'create-paid-order',
      {
        username,
        reservationId,
        paymentReferenceNumber: paymentReferenceId,
      },
      {
        attempts: 10,
        backoff: { type: 'exponential', delay: 1000 },
        jobId: `create-paid-order:${this.demoConfig.saleId}:${username}`,
      },
    );

    return {
      username,
      status: 'paid',
      reservationId,
      paymentReferenceId,
      message: 'Payment successful.',
    };
  }

  private ensureSaleActiveWindow(startAt: Date, endAt: Date): void {
    const now = Date.now();

    if (now < startAt.getTime()) {
      throw new ForbiddenException({
        status: 'sale_not_started',
        message: 'Sale has not started yet.',
      });
    }

    if (now > endAt.getTime()) {
      throw new ForbiddenException({
        status: 'sale_ended',
        message: 'Sale has ended.',
      });
    }
  }

  private async enforceRateLimit(
    redis: Redis,
    key: string,
    maxAttempts: number,
  ): Promise<void> {
    const attempts = await redis.incr(key);

    if (attempts === 1) {
      await redis.expire(key, this.demoConfig.attemptWindowSeconds);
    }

    if (attempts > maxAttempts) {
      throw new HttpException(
        {
          status: 'too_many_requests',
          message: 'Too many requests. Please try again later.',
        },
        429,
      );
    }
  }

  private async getReservation(
    redis: Redis,
    reservationId: string,
  ): Promise<ReservationRecord | null> {
    const reservationRaw = await redis.get(
      createOrdersRedisKeys(this.demoConfig.saleId).reservation(reservationId),
    );

    if (!reservationRaw) {
      return null;
    }

    return JSON.parse(reservationRaw) as ReservationRecord;
  }

  private throwForReserveResult(result: string): never {
    switch (result) {
      case 'ALREADY_PAID':
        throw new ConflictException({
          status: 'already_paid',
          message: 'You have already purchased this item.',
        });
      case 'ALREADY_RESERVED':
        throw new ConflictException({
          status: 'already_reserved',
          message: 'You already have an active reservation.',
        });
      case 'QUEUE_FULL':
        throw new ConflictException({
          status: 'queue_full',
          message:
            'All payment slots are currently reserved. Please try again later.',
        });
      case 'COOLDOWN_ACTIVE':
        throw new HttpException(
          {
            status: 'cooldown_active',
            message:
              'You recently let a reservation expire. Please try again later.',
          },
          429,
        );
      default:
        throw new ConflictException({
          status: 'reservation_failed',
          message: `Unexpected reservation state: ${result}`,
        });
    }
  }

  private formatDuration(durationSeconds: number): string {
    if (durationSeconds % 60 === 0) {
      const minutes = durationSeconds / 60;
      return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    }

    return `${durationSeconds} second${durationSeconds === 1 ? '' : 's'}`;
  }
}
