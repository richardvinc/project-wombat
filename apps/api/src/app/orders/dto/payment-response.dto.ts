export class PaymentResponseDto {
  username!: string;
  status!: string;
  reservationId!: string | null;
  paymentReferenceId!: string | null;
  message!: string;
}
