export enum SaleLifecycleStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  ENDED = 'ended',
}

export class FlashSaleStatusResponseDto {
  status!: SaleLifecycleStatus;
  startAt!: string;
  endAt!: string;
}
