import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { RedisService } from '../../../redis/redis.service';
import { FlashSaleDemoConfigService } from '../../config/demo.config';
import { FlashSaleStatusResponseDto, SaleLifecycleStatus } from '../dto/flash-sale-status-response.dto';
import { FlashSaleEntity } from '../entities/flash-sale.entity';
import { FlashSaleService } from './flash-sale.service';

describe('FlashSaleService', () => {
  let flashSaleRepository: jest.Mocked<Partial<Repository<FlashSaleEntity>>>;
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
  };
  let redisService: jest.Mocked<Partial<RedisService>>;
  let demoConfig: FlashSaleDemoConfigService;
  let configService: Partial<ConfigService>;
  let service: FlashSaleService;

  beforeEach(() => {
    flashSaleRepository = {
      findOneBy: jest.fn(),
      upsert: jest.fn(),
    };
    redis = {
      get: jest.fn(),
      set: jest.fn(),
    };
    redisService = {
      getClient: jest.fn().mockReturnValue(redis),
      deleteByPatterns: jest.fn().mockResolvedValue(2),
    };
    demoConfig = {
      saleId: 'main',
      productName: 'Limited Edition Product',
      totalStock: 7,
      startDelaySeconds: 0,
      durationSeconds: 120,
    } as FlashSaleDemoConfigService;
    configService = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'REDIS_KEY_PREFIX':
            return 'wombat:';
          case 'BULLMQ_PREFIX':
            return 'wombat:bull';
          default:
            return undefined;
        }
      }),
    };

    service = new FlashSaleService(
      flashSaleRepository as Repository<FlashSaleEntity>,
      redisService as unknown as RedisService,
      demoConfig,
      configService as unknown as ConfigService,
    );
  });

  it('bootstraps by resetting redis, seeding sale, and initializing slots', async () => {
    const sale = {
      id: 'main',
      productName: 'Limited Edition Product',
      totalStock: 7,
      startAt: new Date(Date.now() - 1_000),
      endAt: new Date(Date.now() + 1_000),
    };
    (flashSaleRepository.findOneBy as jest.Mock).mockResolvedValue(sale as FlashSaleEntity);

    await service.onApplicationBootstrap();

    expect(redisService.deleteByPatterns).toHaveBeenCalledWith([
      'wombat:sale:*',
      'wombat:bull:*',
    ]);
    expect(flashSaleRepository.upsert).toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledWith('sale:main:available_slots', '7', 'NX');
  });

  it.each([
    ['upcoming', 10_000, 20_000, SaleLifecycleStatus.UPCOMING],
    ['active', -10_000, 20_000, SaleLifecycleStatus.ACTIVE],
    ['ended', -20_000, -10_000, SaleLifecycleStatus.ENDED],
  ])(
    'returns %s lifecycle state',
    async (_label, startOffsetMs, endOffsetMs, expectedStatus) => {
      (flashSaleRepository.findOneBy as jest.Mock).mockResolvedValue({
        id: 'main',
        productName: 'Product',
        totalStock: 7,
        startAt: new Date(Date.now() + startOffsetMs),
        endAt: new Date(Date.now() + endOffsetMs),
      } as FlashSaleEntity);
      redis.get.mockResolvedValue('4');

      await expect(service.getCurrentStatus()).resolves.toMatchObject<
        Partial<FlashSaleStatusResponseDto>
      >({
        saleId: 'main',
        status: expectedStatus,
        totalStock: 7,
        availableSlots: 4,
      });
    },
  );

  it('falls back to total stock when redis slots key missing', async () => {
    (flashSaleRepository.findOneBy as jest.Mock).mockResolvedValue({
      id: 'main',
      productName: 'Product',
      totalStock: 7,
      startAt: new Date(Date.now() - 1_000),
      endAt: new Date(Date.now() + 1_000),
    } as FlashSaleEntity);
    redis.get.mockResolvedValue(null);

    await expect(service.getCurrentStatus()).resolves.toMatchObject({
      availableSlots: 7,
    });
  });

  it('throws when default sale missing', async () => {
    (flashSaleRepository.findOneBy as jest.Mock).mockResolvedValue(null);

    await expect(service.getDefaultSaleEntity()).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('initializes available slots using passed stock', async () => {
    await service.ensureAvailableSlotsInitialized(9);

    expect(redis.set).toHaveBeenCalledWith('sale:main:available_slots', '9', 'NX');
  });
});
