import { Global, Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const flashSaleDemoDefaults = {
  saleId: 'main',
  productName: 'Limited Edition Product',
  totalStock: 100,
  // how many second we should wait after running app before flash-sale begins -> default 10 seconds
  startDelaySeconds: 10,

  // how long flash-sale will open -> default 10 minutes
  durationSeconds: 10 * 60,

  // how long reservation is for each user (time for user to make payment) -> default 5 minutes
  reservationTtlSeconds: 5 * 60,

  // if user is on cooldown (after abusing `orders/buy` endpoint), how long should they wait -> default 1 minute
  cooldownTtlSeconds: 60,

  // maximum user attempt to trigger cooldown
  userAttemptLimit: 3,

  // duration to count repeated user attempt before counted as too many attempts -> default to 1 minute
  attemptWindowSeconds: 60,

  // payment outcome success rate when no explicit override is passed
  paymentSuccessRate: 0.7,
} as const;

@Injectable()
export class FlashSaleDemoConfigService {
  constructor(private readonly configService: ConfigService) {}

  get saleId(): string {
    return this.configService.get<string>(
      'FLASH_SALE_ID',
      flashSaleDemoDefaults.saleId,
    );
  }

  get productName(): string {
    return this.configService.get<string>(
      'FLASH_SALE_PRODUCT_NAME',
      flashSaleDemoDefaults.productName,
    );
  }

  get totalStock(): number {
    return this.configService.get<number>(
      'FLASH_SALE_TOTAL_STOCK',
      flashSaleDemoDefaults.totalStock,
    );
  }

  get startDelaySeconds(): number {
    return this.configService.get<number>(
      'FLASH_SALE_START_DELAY_SECONDS',
      flashSaleDemoDefaults.startDelaySeconds,
    );
  }

  get durationSeconds(): number {
    return this.configService.get<number>(
      'FLASH_SALE_DURATION_SECONDS',
      flashSaleDemoDefaults.durationSeconds,
    );
  }

  get reservationTtlSeconds(): number {
    return this.configService.get<number>(
      'FLASH_SALE_RESERVATION_TTL_SECONDS',
      flashSaleDemoDefaults.reservationTtlSeconds,
    );
  }

  get reservationTtlMs(): number {
    return this.reservationTtlSeconds * 1000;
  }

  get cooldownTtlSeconds(): number {
    return this.configService.get<number>(
      'FLASH_SALE_COOLDOWN_TTL_SECONDS',
      flashSaleDemoDefaults.cooldownTtlSeconds,
    );
  }

  get userAttemptLimit(): number {
    return this.configService.get<number>(
      'FLASH_SALE_USER_ATTEMPT_LIMIT',
      flashSaleDemoDefaults.userAttemptLimit,
    );
  }

  get attemptWindowSeconds(): number {
    return this.configService.get<number>(
      'FLASH_SALE_ATTEMPT_WINDOW_SECONDS',
      flashSaleDemoDefaults.attemptWindowSeconds,
    );
  }

  get paymentSuccessRate(): number {
    return this.configService.get<number>(
      'FLASH_SALE_PAYMENT_SUCCESS_RATE',
      flashSaleDemoDefaults.paymentSuccessRate,
    );
  }
}

@Global()
@Module({
  providers: [FlashSaleDemoConfigService],
  exports: [FlashSaleDemoConfigService],
})
export class DemoConfigModule {}
