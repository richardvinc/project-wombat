export enum SaleLifecycleStatus {
  UPCOMING = 'upcoming',
  ACTIVE = 'active',
  ENDED = 'ended',
}

export class FlashSaleStatusResponseDto {
  saleId!: string;
  status!: SaleLifecycleStatus;
  totalStock!: number;
  availableSlots!: number;
  startTime!: string;
  endTime!: string;
}
