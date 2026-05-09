import {
  Injectable,
  InternalServerErrorException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createFlashSaleSeed } from '../../../database/seeds/seed-flash-sale';
import { RedisService } from '../../../redis/redis.service';
import { DEFAULT_SALE_ID } from '../../orders/orders.constants';
import { ordersRedisKeys } from '../../orders/orders.redis-keys';
import {
  FlashSaleStatusResponseDto,
  SaleLifecycleStatus,
} from '../dto/flash-sale-status-response.dto';
import { FlashSaleEntity } from '../entities/flash-sale.entity';

@Injectable()
export class FlashSaleService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(FlashSaleEntity)
    private readonly flashSaleRepository: Repository<FlashSaleEntity>,
    private readonly redisService: RedisService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const redis = this.redisService.getClient();
    await redis.flushdb();
    const sale = await this.seedDefaultSale();
    await this.ensureAvailableSlotsInitialized(sale.totalStock);
  }

  async getCurrentStatus(): Promise<FlashSaleStatusResponseDto> {
    const sale = await this.getDefaultSaleEntity();

    const redis = this.redisService.getClient();
    const availableSlotsRaw = await redis.get(ordersRedisKeys.availableSlots());

    return {
      saleId: DEFAULT_SALE_ID,
      status: this.getLifecycleStatus(sale.startAt, sale.endAt),
      totalStock: sale.totalStock,
      availableSlots: Number(availableSlotsRaw ?? sale.totalStock),
      startTime: sale.startAt.toISOString(),
      endTime: sale.endAt.toISOString(),
    };
  }

  async getDefaultSaleEntity(): Promise<FlashSaleEntity> {
    const sale = await this.flashSaleRepository.findOneBy({
      id: DEFAULT_SALE_ID,
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
    await redis.set(ordersRedisKeys.availableSlots(), String(totalStock), 'NX');
  }

  private async seedDefaultSale(): Promise<FlashSaleEntity> {
    const seed = createFlashSaleSeed();

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
