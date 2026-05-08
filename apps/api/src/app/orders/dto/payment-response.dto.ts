export enum PaymentResult {
  PAYMENT_ACCEPTED = 'PAYMENT_ACCEPTED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
}

export class PaymentResponseDto {
  username!: string;
  orderId!: string | null;
  paymentReferenceId!: string | null;
  result!: PaymentResult;
  message!: string;
}
