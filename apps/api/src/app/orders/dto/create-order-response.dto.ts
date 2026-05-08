export enum PurchaseAttemptResult {
  ALREADY_PURCHASE = 'ALREADY_PURCHASE',
  READY_FOR_PAYMENT = 'READY_FOR_PAYMENT',
  ITEM_SOLD_OUT = 'ITEM_SOLD_OUT',
  SALE_NOT_STARTED = 'SALE_NOT_STARTED',
  SALE_ENDED = 'SALE_ENDED',
}

export class CreateOrderResponseDto {
  username!: string;
  result!: PurchaseAttemptResult;
  orderId!: string | null;
  message!: string;
}
