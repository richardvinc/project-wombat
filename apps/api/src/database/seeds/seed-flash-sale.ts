import { FlashSaleEntity } from '../../app/sale/entities/flash-sale.entity';

export function createFlashSaleSeed(): Partial<FlashSaleEntity> {
  const now: number = Date.now();
  // start 1 minute after current time
  const startTime = new Date(now + 30 * 1000);
  // end 10 minutes after start time
  const endTime = new Date(now + 10 * 60 * 1000);

  return {
    id: 'main',
    productName: 'Limited Edition Product',
    totalStock: 100,
    startAt: startTime,
    endAt: endTime,
  };
}
