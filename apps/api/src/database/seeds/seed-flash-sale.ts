import { FlashSaleEntity } from '../../app/sale/entities/flash-sale.entity';

export function createFlashSaleSeed(): Partial<FlashSaleEntity> {
  return {
    productName: 'Limited Edition Product',
    totalStock: 100,
    remainingStock: 100,
    startAt: new Date('2026-05-09T10:00:00.000Z'),
    endAt: new Date('2026-05-09T12:00:00.000Z'),
  };
}
