import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { FlashSaleDemoConfigService } from '../config/demo.config';
import { FlashSaleEntity } from '../sale/entities/flash-sale.entity';
import { FlashSaleService } from '../sale/services/flash-sale.service';
import { OrderEntity } from './entities/order.entity';
import { OrdersQueueProcessor } from './orders.queue.processor';
import { createOrdersRedisKeys } from './orders.redis-keys';
import { OrdersLuaService } from './services/orders-lua.service';

describe('OrdersQueueProcessor', () => {
  let redis: {
    eval: jest.Mock;
  };
  let redisService: jest.Mocked<Partial<RedisService>>;
  let flashSaleService: jest.Mocked<Partial<FlashSaleService>>;
  let ordersLuaService: jest.Mocked<Partial<OrdersLuaService>>;
  let demoConfig: FlashSaleDemoConfigService;
  let orderRepository: jest.Mocked<Partial<Repository<OrderEntity>>>;
  let processor: OrdersQueueProcessor;

  beforeEach(() => {
    redis = {
      eval: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(redis),
    };
    flashSaleService = {
      getDefaultSaleEntity: jest.fn().mockResolvedValue({
        id: 'main',
      } as FlashSaleEntity),
    };
    ordersLuaService = {
      getScript: jest
        .fn()
        .mockImplementation((name: string) => `script:${name}`),
    };
    demoConfig = {
      saleId: 'main',
      cooldownTtlSeconds: 10,
    } as FlashSaleDemoConfigService;
    orderRepository = {
      upsert: jest.fn(),
    };

    processor = new OrdersQueueProcessor(
      redisService as unknown as RedisService,
      flashSaleService as unknown as FlashSaleService,
      ordersLuaService as unknown as OrdersLuaService,
      demoConfig,
      orderRepository as unknown as Repository<OrderEntity>,
    );
  });

  it('treats expired reservation cleanup as slot release', async () => {
    redis.eval.mockResolvedValue('RELEASED_EXPIRED');

    await expect(
      processor.process({
        name: 'release-reservation',
        id: 'job-1',
        attemptsMade: 0,
        data: {
          username: 'alice',
          reservationId: 'r-1',
        },
      } as never),
    ).resolves.toBeUndefined();

    expect(redis.eval).toHaveBeenCalledWith(
      'script:release-reservation.lua',
      6,
      'sale:main:available_slots',
      createOrdersRedisKeys('main').reservedUser('alice'),
      createOrdersRedisKeys('main').reservation('r-1'),
      createOrdersRedisKeys('main').paidUser('alice'),
      createOrdersRedisKeys('main').reservationExpiries(),
      createOrdersRedisKeys('main').cooldown('alice'),
      'r-1',
      'alice',
      10,
    );
  });
});
