export class MakePaymentDto {
  username!: string;
  reservationId!: string;
  // for testing purposes, to simulate success/failed payment
  forceSuccess?: boolean;
}
