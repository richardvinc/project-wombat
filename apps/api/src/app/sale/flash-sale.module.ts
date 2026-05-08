import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlashSaleController } from './flash-sale.controller';
import { FlashSaleEntity } from './entities/flash-sale.entity';
import { FlashSaleService } from './services/flash-sale.service';

@Module({
  imports: [TypeOrmModule.forFeature([FlashSaleEntity])],
  controllers: [FlashSaleController],
  providers: [FlashSaleService],
})
export class FlashSaleModule {}
