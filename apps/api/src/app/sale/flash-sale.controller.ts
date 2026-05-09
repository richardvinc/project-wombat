import { Controller, Get } from '@nestjs/common';
import { FlashSaleStatusResponseDto } from './dto/flash-sale-status-response.dto';
import { FlashSaleService } from './services/flash-sale.service';

@Controller('flash-sale')
export class FlashSaleController {
  constructor(private readonly saleService: FlashSaleService) {}

  @Get('status')
  async getCurrentStatus(): Promise<FlashSaleStatusResponseDto> {
    return this.saleService.getCurrentStatus();
  }
}
