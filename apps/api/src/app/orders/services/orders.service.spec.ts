import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { RedisService } from '../../../redis/redis.service';
import { FlashSaleDemoConfigService } from '../../config/demo.config';
import { FlashSaleEntity } from '../../sale/entities/flash-sale.entity';
import { FlashSaleService } from '../../sale/services/flash-sale.service';
import { OrderEntity } from '../entities/order.entity';
import { createOrdersRedisKeys } from '../orders.redis-keys';
import { OrdersLuaService } from './orders-lua.service';
import { OrdersService } from './orders.service';
import { PaymentSimulatorService } from './payment-simulator.service';

describe('OrdersService', () => {
  const activeSale: Partial<FlashSaleEntity> = {
    id: 'main',
    productName: 'Product',
    startAt: new Date(Date.now() - 60_000),
    endAt: new Date(Date.now() + 60_000),
    totalStock: 5,
  };

  let orderRepository: jest.Mocked<Partial<Repository<OrderEntity>>>;
  let redis: {
    incr: jest.Mock;
    expire: jest.Mock;
    eval: jest.Mock;
    exists: jest.Mock;
    get: jest.Mock;
  };
  let redisService: jest.Mocked<Partial<RedisService>>;
  let flashSaleService: {
    getDefaultSaleEntity: jest.Mock;
  };
  let ordersLuaService: jest.Mocked<Partial<OrdersLuaService>>;
  let paymentSimulatorService: {
    process: jest.Mock;
  };
  let demoConfig: FlashSaleDemoConfigService;
  let ordersQueue: { add: jest.Mock };
  let service: OrdersService;

  beforeEach(() => {
    orderRepository = {
      clear: jest.fn(),
    };
    redis = {
      incr: jest.fn(),
      expire: jest.fn(),
      eval: jest.fn(),
      exists: jest.fn(),
      get: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(redis),
    };
    flashSaleService = {
      getDefaultSaleEntity: jest.fn().mockResolvedValue(activeSale),
    };
    ordersLuaService = {
      getScript: jest
        .fn()
        .mockImplementation((name: string) => `script:${name}`),
    };
    paymentSimulatorService = {
      process: jest.fn(),
    };
    demoConfig = {
      saleId: 'main',
      userAttemptLimit: 3,
      reservationTtlMs: 5_000,
      reservationTtlSeconds: 5,
      attemptWindowSeconds: 60,
    } as FlashSaleDemoConfigService;
    ordersQueue = {
      add: jest.fn(),
    };

    service = new OrdersService(
      orderRepository as Repository<OrderEntity>,
      redisService as unknown as RedisService,
      flashSaleService as unknown as FlashSaleService,
      ordersLuaService as unknown as OrdersLuaService,
      paymentSimulatorService as PaymentSimulatorService,
      demoConfig,
      ordersQueue as never,
    );
  });

  it('rejects purchase when username missing', async () => {
    await expect(service.attemptPurchase({ username: '   ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects purchase before sale start', async () => {
    flashSaleService.getDefaultSaleEntity!.mockResolvedValue({
      ...activeSale,
      startAt: new Date(Date.now() + 5_000),
    } as FlashSaleEntity);

    await expect(
      service.attemptPurchase({ username: 'alice' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects purchase after sale end', async () => {
    flashSaleService.getDefaultSaleEntity!.mockResolvedValue({
      ...activeSale,
      endAt: new Date(Date.now() - 5_000),
    } as FlashSaleEntity);

    await expect(
      service.attemptPurchase({ username: 'alice' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rate limits when attempts exceed config', async () => {
    redis.incr.mockResolvedValue(4);

    await expect(
      service.attemptPurchase({ username: 'alice' }),
    ).rejects.toMatchObject({
      status: 429,
    });
  });

  it('maps reserve failure results to API errors', async () => {
    redis.incr.mockResolvedValue(1);
    redis.eval.mockResolvedValue('ALREADY_RESERVED');

    await expect(
      service.attemptPurchase({ username: 'alice' }),
    ).rejects.toThrow(ConflictException);
    expect(redis.expire).toHaveBeenCalledWith(
      createOrdersRedisKeys('main').buyAttemptsUser('alice'),
      60,
    );
  });

  it('reserves slot and enqueues release job', async () => {
    redis.incr.mockResolvedValue(1);
    redis.eval.mockResolvedValue('RESERVED');

    const result = await service.attemptPurchase({ username: ' alice ' });

    expect(result).toMatchObject({
      username: 'alice',
      status: 'reserved',
    });
    expect(redis.eval).toHaveBeenCalledWith(
      'script:reserve-reservation.lua',
      6,
      'sale:main:available_slots',
      'sale:main:reserved:alice',
      expect.stringMatching(/^sale:main:reservation:/),
      'sale:main:paid:alice',
      'sale:main:cooldown:alice',
      'sale:main:reservation_expiries',
      expect.any(String),
      expect.any(String),
      5,
      expect.any(Number),
      'alice',
    );
    expect(ordersQueue.add).toHaveBeenCalledWith(
      'release-reservation',
      {
        username: 'alice',
        reservationId: result.reservationId,
      },
      expect.objectContaining({
        delay: 5_000,
      }),
    );
  });

  it('rejects status lookup when username missing', async () => {
    await expect(service.getOrderStatus('  ')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns paid status when paid marker exists', async () => {
    redis.exists.mockResolvedValue(1);

    await expect(service.getOrderStatus('alice')).resolves.toEqual({
      username: 'alice',
      status: 'paid',
      message: 'You have successfully purchased the item.',
      reservationId: null,
      expiresAt: null,
    });
  });

  it('returns none when no reservation exists', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get.mockResolvedValue(null);

    await expect(service.getOrderStatus('alice')).resolves.toEqual({
      username: 'alice',
      status: 'none',
      message: 'You do not have an active reservation or paid order.',
      reservationId: null,
      expiresAt: null,
    });
  });

  it('returns none when reservation record already expired', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get
      .mockResolvedValueOnce('reservation-1')
      .mockResolvedValueOnce(null);

    await expect(service.getOrderStatus('alice')).resolves.toEqual({
      username: 'alice',
      status: 'none',
      message: 'Your reservation is no longer active.',
      reservationId: null,
      expiresAt: null,
    });
  });

  it('returns reserved status when reservation record exists', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get.mockResolvedValueOnce('reservation-1').mockResolvedValueOnce(
      JSON.stringify({
        username: 'alice',
        reservationId: 'reservation-1',
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      }),
    );

    const result = await service.getOrderStatus('alice');

    expect(result.status).toBe('reserved');
    expect(result.reservationId).toBe('reservation-1');
  });

  it('rejects payment when payload incomplete', async () => {
    await expect(
      service.makePayment({ username: 'alice', reservationId: ' ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects payment when user already paid', async () => {
    redis.exists.mockResolvedValue(1);

    await expect(
      service.makePayment({ username: 'alice', reservationId: 'r-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects payment when no active reservation exists', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get.mockResolvedValue(null);

    await expect(
      service.makePayment({ username: 'alice', reservationId: 'r-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects payment when reservation belongs to another reservation id', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get.mockResolvedValue('r-2');

    await expect(
      service.makePayment({ username: 'alice', reservationId: 'r-1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects payment when reservation record expired', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get.mockResolvedValueOnce('r-1').mockResolvedValueOnce(null);

    await expect(
      service.makePayment({ username: 'alice', reservationId: 'r-1' }),
    ).rejects.toThrow(GoneException);
  });

  it('returns payment_failed without mutating state when payment simulator fails', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get.mockResolvedValueOnce('r-1').mockResolvedValueOnce(
      JSON.stringify({
        username: 'alice',
        reservationId: 'r-1',
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      }),
    );
    paymentSimulatorService.process!.mockResolvedValue(false);

    const result = await service.makePayment({
      username: 'alice',
      reservationId: 'r-1',
      forceSuccess: false,
    });

    expect(result).toEqual({
      username: 'alice',
      status: 'payment_failed',
      reservationId: 'r-1',
      paymentReferenceId: null,
      message: 'Payment failed. You can retry before your reservation expires.',
    });
    expect(redis.eval).not.toHaveBeenCalled();
    expect(ordersQueue.add).not.toHaveBeenCalled();
  });

  it('maps post-payment redis expiry result to gone error', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get.mockResolvedValueOnce('r-1').mockResolvedValueOnce(
      JSON.stringify({
        username: 'alice',
        reservationId: 'r-1',
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      }),
    );
    paymentSimulatorService.process!.mockResolvedValue(true);
    redis.eval.mockResolvedValue('RESERVATION_EXPIRED');

    await expect(
      service.makePayment({ username: 'alice', reservationId: 'r-1' }),
    ).rejects.toThrow(GoneException);
  });

  it('marks payment as paid and enqueues paid-order job', async () => {
    redis.exists.mockResolvedValue(0);
    redis.get.mockResolvedValueOnce('r-1').mockResolvedValueOnce(
      JSON.stringify({
        username: 'alice',
        reservationId: 'r-1',
        reservedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5_000).toISOString(),
      }),
    );
    paymentSimulatorService.process!.mockResolvedValue(true);
    redis.eval.mockResolvedValue('PAID');

    const result = await service.makePayment({
      username: 'alice',
      reservationId: 'r-1',
    });

    expect(result).toMatchObject({
      username: 'alice',
      status: 'paid',
      reservationId: 'r-1',
      paymentReferenceId: expect.any(String),
      message: 'Payment successful.',
    });
    expect(redis.eval).toHaveBeenCalledWith(
      'script:mark-paid.lua',
      4,
      'sale:main:reserved:alice',
      'sale:main:reservation:r-1',
      'sale:main:paid:alice',
      'sale:main:reservation_expiries',
      'r-1',
      'alice',
    );
    expect(ordersQueue.add).toHaveBeenCalledWith(
      'create-paid-order',
      {
        username: 'alice',
        reservationId: 'r-1',
        paymentReferenceNumber: result.paymentReferenceId,
      },
      expect.objectContaining({
        attempts: 10,
      }),
    );
  });

  it('clears orders table on bootstrap', async () => {
    await service.onApplicationBootstrap();

    expect(orderRepository.clear).toHaveBeenCalled();
  });
});
