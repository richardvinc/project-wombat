import { FlashSaleEntity } from '../../app/sale/entities/flash-sale.entity';

export type FlashSaleSeedConfig = {
  saleId: string;
  productName: string;
  totalStock: number;
  startDelaySeconds: number;
  durationSeconds: number;
};

export function createFlashSaleSeed(
  config: FlashSaleSeedConfig,
): Partial<FlashSaleEntity> {
  const now: number = Date.now();
  const startTime = new Date(now + config.startDelaySeconds * 1000);
  const endTime = new Date(startTime.getTime() + config.durationSeconds * 1000);

  return {
    id: config.saleId,
    productName: config.productName,
    totalStock: config.totalStock,
    startAt: startTime,
    endAt: endTime,
  };
}
