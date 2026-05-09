export class CreateOrderResponseDto {
  username!: string;
  status!: string;
  message!: string;
  reservationId!: string | null;
  expiresAt!: string | null;
}
