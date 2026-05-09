import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createFlashSaleSeed } from '../../../database/seeds/seed-flash-sale';
import { RedisService } from '../../../redis/redis.service';
import { FlashSaleDemoConfigService } from '../../config/demo.config';
import { createOrdersRedisKeys } from '../../orders/orders.redis-keys';
import {
  FlashSaleStatusResponseDto,
  SaleLifecycleStatus,
} from '../dto/flash-sale-status-response.dto';
import { FlashSaleEntity } from '../entities/flash-sale.entity';

@Injectable()
export class FlashSaleService implements OnApplicationBootstrap {
  private readonly logger = new Logger(FlashSaleService.name);

  constructor(
    @InjectRepository(FlashSaleEntity)
    private readonly flashSaleRepository: Repository<FlashSaleEntity>,
    private readonly redisService: RedisService,
    private readonly demoConfig: FlashSaleDemoConfigService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.resetRedisState();
    const sale = await this.seedDefaultSale();
    await this.ensureAvailableSlotsInitialized(sale.totalStock);
  }

  async getCurrentStatus(): Promise<FlashSaleStatusResponseDto> {
    const sale = await this.getDefaultSaleEntity();
    const redisKeys = createOrdersRedisKeys(this.demoConfig.saleId);

    const redis = this.redisService.getClient();
    const availableSlotsRaw = await redis.get(redisKeys.availableSlots());

    return {
      saleId: this.demoConfig.saleId,
      status: this.getLifecycleStatus(sale.startAt, sale.endAt),
      totalStock: sale.totalStock,
      availableSlots: Number(availableSlotsRaw ?? sale.totalStock),
      startTime: sale.startAt.toISOString(),
      endTime: sale.endAt.toISOString(),
    };
  }

  async getDefaultSaleEntity(): Promise<FlashSaleEntity> {
    const sale = await this.flashSaleRepository.findOneBy({
      id: this.demoConfig.saleId,
    });

    if (!sale) {
      throw new InternalServerErrorException(
        'Flash sale is not configured in database.',
      );
    }

    return sale;
  }

  async ensureAvailableSlotsInitialized(totalStock: number): Promise<void> {
    const redis = this.redisService.getClient();
    const redisKeys = createOrdersRedisKeys(this.demoConfig.saleId);
    await redis.set(redisKeys.availableSlots(), String(totalStock), 'NX');
  }

  /**
   * this is a over-engineered way to make sure everytime we launch this demo project, we purge all keys used that WE use and not just flush everything on redis down the drain. we won't need this on production.
   */
  private async resetRedisState(): Promise<void> {
    const redisKeyPrefix =
      this.configService.get<string>('REDIS_KEY_PREFIX') ?? '';
    const bullPrefix = this.configService.get<string>('BULLMQ_PREFIX') ?? '';

    const deleted = await this.redisService.deleteByPatterns([
      `${redisKeyPrefix}sale:*`,
      `${bullPrefix}:*`,
    ]);

    this.logger.log(`Reset Redis demo state. Deleted ${deleted} keys.`);
  }

  private async seedDefaultSale(): Promise<FlashSaleEntity> {
    const seed = createFlashSaleSeed({
      saleId: this.demoConfig.saleId,
      productName: this.demoConfig.productName,
      totalStock: this.demoConfig.totalStock,
      startDelaySeconds: this.demoConfig.startDelaySeconds,
      durationSeconds: this.demoConfig.durationSeconds,
    });

    await this.flashSaleRepository.upsert(
      {
        id: seed.id!,
        productName: seed.productName!,
        totalStock: seed.totalStock!,
        startAt: seed.startAt!,
        endAt: seed.endAt!,
      },
      ['id'],
    );

    return this.getDefaultSaleEntity();
  }

  private getLifecycleStatus(startAt: Date, endAt: Date): SaleLifecycleStatus {
    const now = Date.now();

    if (now < startAt.getTime()) {
      return SaleLifecycleStatus.UPCOMING;
    }

    if (now > endAt.getTime()) {
      return SaleLifecycleStatus.ENDED;
    }

    return SaleLifecycleStatus.ACTIVE;
  }
}
