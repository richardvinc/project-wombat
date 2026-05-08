import { Injectable } from '@nestjs/common';
import {
  FlashSaleStatusResponseDto,
  SaleLifecycleStatus,
} from '../dto/flash-sale-status-response.dto';

@Injectable()
export class FlashSaleService {
  getCurrentStatus(): FlashSaleStatusResponseDto {
    // not started
    // ended
    // in progress
    return {
      status: SaleLifecycleStatus.NOT_STARTED,
      startAt: new Date('2026-05-09T10:00:00.000Z').toISOString(),
      endAt: new Date('2026-05-09T12:00:00.000Z').toISOString(),
    };
  }
}
