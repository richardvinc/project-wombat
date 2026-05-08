export enum UserOrderStatusResult {
  QUEUE_FULL = 'QUEUE_FULL',
  RESERVED = 'RESERVED',
  PAID = 'PAID',
  EXPIRED = 'EXPIRED',
}

export class UserOrderStatusResponseDto {
  username!: string;
  result!: UserOrderStatusResult;
  orderId!: string | null;
}
