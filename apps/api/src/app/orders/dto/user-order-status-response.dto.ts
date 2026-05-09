export class UserOrderStatusResponseDto {
  username!: string;
  status!: string;
  message!: string;
  reservationId!: string | null;
  expiresAt!: string | null;
}
